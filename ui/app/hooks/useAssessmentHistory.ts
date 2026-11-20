import { useState, useCallback, useEffect, useRef } from "react";
import { documentsClient } from "@dynatrace-sdk/client-document";
import type { CapabilityResult } from "./useCoverageData";
import { APP_VERSION } from "../appVersion";

export interface AssessmentSnapshot {
  id: string;
  timestamp: string;
  totalScore: number;
  tenant: string;
  /** App version that produced the run: a different version can mean a different catalog. */
  appVersion?: string;
  capabilities: {
    name: string;
    color: string;
    score: number;
    /** Parts of the score, on snapshots written since v2.6.0. */
    coverage?: number;
    adoption?: number;
    utilization?: number;
    /** Adoption as measured: share of active users (0–100) and people. */
    adoptionRate?: number;
    adoptionUsers?: number;
    criteriaResults: {
      id: string;
      label: string;
      value: number;
      points: number;
      error: boolean;
      /** Could not be measured. Absent on snapshots written before v2.5.11:
       *  those record a missing denominator as `value: 0, error: false`,
       *  indistinguishable from a genuine zero, so older history can only be
       *  reprocessed for the `error` case. Treat `undefined` as false. */
      notAssessed?: boolean;
    }[];
  }[];
}

const STORAGE_KEY = "ppa-assessment-history";
const DOC_TYPE = "ppa-snapshot";

/** Capability names that changed; snapshots saved under the old name keep their trend. */
const RENAMED: Record<string, string> = { "AI Observability": "AI/LLM Observability" };
function normalize(s: AssessmentSnapshot): AssessmentSnapshot {
  if (!s?.capabilities?.some(c => RENAMED[c.name])) return s;
  return { ...s, capabilities: s.capabilities.map(c => (RENAMED[c.name] ? { ...c, name: RENAMED[c.name] } : c)) };
}

/* ── localStorage cache helpers ── */

function loadLocal(): AssessmentSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AssessmentSnapshot[]).map(normalize) : [];
  } catch {
    return [];
  }
}

function persistLocal(snapshots: AssessmentSnapshot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch { /* quota exceeded */ }
}

/* ── Document Store helpers ── */

async function loadFromDocStore(): Promise<{ snapshots: AssessmentSnapshot[], remoteDocIds: Set<string> }> {
  const remoteDocIds = new Set<string>();
  try {
    const list = await documentsClient.listDocuments({
      filter: `type == '${DOC_TYPE}'`,
      sort: "-name",
      pageSize: 200,
    });
    for (const doc of list.documents) remoteDocIds.add(doc.id);

    // Downloads run in parallel, bounded. The previous version awaited each
    // document in turn: with a full retention window that is one round-trip
    // after another, and Evolution sat blank for all of them.
    const CONCURRENCY = 8;
    const docs = list.documents;
    const snaps: AssessmentSnapshot[] = [];
    let next = 0;
    async function worker(): Promise<void> {
      for (;;) {
        const i = next++;
        if (i >= docs.length) return;
        try {
          const content = await documentsClient.downloadDocumentContent({ id: docs[i].id });
          const text = await content.get("text");
          snaps.push(normalize(JSON.parse(text)));
        } catch { /* skip corrupt documents */ }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, worker));
    snaps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { snapshots: snaps, remoteDocIds };
  } catch (err) {
    console.warn("[CCA] Document Store load failed, using localStorage:", err);
    return { snapshots: [], remoteDocIds };
  }
}

async function saveToDocStore(snap: AssessmentSnapshot, knownIds?: Set<string>): Promise<void> {
  const docId = `cca-${snap.id}`;
  // Skip if we already know this document exists remotely
  if (knownIds?.has(docId)) return;
  try {
    await documentsClient.createDocument({
      body: {
        name: `cca-${snap.timestamp}`,
        type: DOC_TYPE,
        content: new Blob([JSON.stringify(snap)], { type: "application/json" }),
        id: docId,
      },
    });
    knownIds?.add(docId);
  } catch (err: any) {
    // 409 = document already exists — safe to ignore (duplicate save)
    const code = err?.response?.status ?? err?.code ?? err?.error?.code ?? err?.body?.error?.code;
    const msg = typeof err?.message === "string" ? err.message : "";
    if (code === 409 || msg.includes("already exists") || msg.includes("AlreadyExists")) {
      knownIds?.add(docId);
      return;
    }
    console.warn("[CCA] Document Store save failed:", err);
  }
}

/* ── Retention policy: one snapshot per day, kept for 90 days ──
   Evolution offers "30 days" and "90 days": the history has to reach that far. */

const RETENTION_DAYS = 90;

/**
 * Determines which snapshot IDs should be removed from Grail.
 * Rule: keep only the latest snapshot per calendar day, drop anything older than RETENTION_DAYS.
 * Returns ALL snapshots (not pruned) so the UI can still compare same-day runs,
 * but reports which IDs should be deleted from remote storage.
 */
function applyRetention(snapshots: AssessmentSnapshot[]): {
  keep: AssessmentSnapshot[];
  removeIds: string[];
} {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  // Identify duplicates per calendar day (only the LATEST per day survives in Grail)
  const bestPerDay = new Map<string, string>(); // day → snapshot id (latest)
  const duplicateIds: string[] = [];
  for (const s of sorted) {
    const day = s.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!bestPerDay.has(day)) {
      bestPerDay.set(day, s.id);
    } else {
      duplicateIds.push(s.id); // older same-day snapshot — remove from Grail
    }
  }

  // Identify expired snapshots (older than RETENTION_DAYS)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const expiredIds: string[] = [];
  const keep: AssessmentSnapshot[] = [];
  for (const s of sorted) {
    if (new Date(s.timestamp) >= cutoff) {
      keep.push(s); // keep ALL non-expired snapshots in the UI (even same-day)
    } else {
      expiredIds.push(s.id);
    }
  }

  return { keep, removeIds: [...duplicateIds, ...expiredIds] };
}

async function deleteSnapshotsFromDocStore(ids: string[], remoteIds?: Set<string>): Promise<void> {
  if (ids.length === 0) return;
  // Only attempt to delete IDs that we know exist remotely
  const remoteOnly = remoteIds
    ? ids.filter((id) => remoteIds.has(`cca-${id}`))
    : ids;
  if (remoteOnly.length === 0) return;
  try {
    const toDelete = new Set(remoteOnly.map((id) => `cca-${id}`));
    const list = await documentsClient.listDocuments({
      filter: `type == '${DOC_TYPE}'`,
      pageSize: 200,
    });
    let cleaned = 0;
    for (const doc of list.documents) {
      if (toDelete.has(doc.id)) {
        try {
          await documentsClient.deleteDocument({ id: doc.id, optimisticLockingVersion: doc.version });
          remoteIds?.delete(doc.id);
          cleaned++;
        } catch { /* 404/409 — safe to ignore */ }
      }
    }
    if (cleaned > 0) console.log(`[CCA] Retention: removed ${cleaned} old snapshots from Grail`);
  } catch { /* best-effort */ }
}

/* ── Hook ── */

export function useAssessmentHistory() {
  const [snapshots, setSnapshots] = useState<AssessmentSnapshot[]>(loadLocal);
  /** True while the first Document Store sync is in flight. Without it the
   *  Evolution screen cannot tell "still loading" from "never ran" — both
   *  rendered as an empty page, and the ambiguity read as a broken app. */
  const [loading, setLoading] = useState(true);
  const syncedRef = useRef(false);
  const remoteIdsRef = useRef(new Set<string>());

  // Load from Document Store on mount and merge with localStorage
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    loadFromDocStore().then(({ snapshots: remote, remoteDocIds }) => {
      remoteIdsRef.current = remoteDocIds;
      if (remote.length === 0) return; // no remote data or error — keep local
      // Merge: deduplicate by id, prefer remote
      const merged = new Map<string, AssessmentSnapshot>();
      for (const s of remote) merged.set(s.id, s);
      // Add local-only snapshots to the merged set (no remote upload — they'll be saved on next assessment)
      const local = loadLocal();
      for (const s of local) {
        if (!merged.has(s.id)) merged.set(s.id, s);
      }
      const all = [...merged.values()]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      // Apply smart retention
      const { keep, removeIds } = applyRetention(all);
      setSnapshots(keep);
      persistLocal(keep);
      if (removeIds.length > 0) deleteSnapshotsFromDocStore(removeIds, remoteIdsRef.current);
    }).finally(() => setLoading(false));
  }, []);

  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  const saveSnapshot = useCallback((capabilities: CapabilityResult[], totalScore: number, tenant: string) => {
    // Reopening the app on the same day with the same result is not a new run:
    // saving it again only piled identical entries into the history.
    const last = snapshotsRef.current[0];
    const today = new Date().toISOString().slice(0, 10);
    const same = last && last.timestamp.slice(0, 10) === today && last.tenant === tenant && last.appVersion === APP_VERSION
      && last.capabilities.length === capabilities.length
      && capabilities.every(c => {
        const p = last.capabilities.find(x => x.name === c.name);
        return !!p && p.score === c.score && (p.coverage ?? null) === (c.coverageScore ?? null)
          && (p.adoption ?? null) === (c.adoptionScore ?? null) && p.utilization === c.effectiveUtilizationScore
          && p.criteriaResults.length === c.criteriaResults.length
          && c.criteriaResults.every(r => { const q = p.criteriaResults.find(y => y.id === r.id); return !!q && q.value === r.value && q.points === r.points; });
      });
    if (same) return;
    const snap: AssessmentSnapshot = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      totalScore,
      tenant,
      appVersion: APP_VERSION,
      capabilities: capabilities.map((c) => ({
        name: c.name,
        color: c.color,
        // The score the screen shows (coverage, utilization and adoption combined).
        score: c.score,
        ...(c.coverageScore != null ? { coverage: c.coverageScore } : {}),
        ...(c.adoptionScore != null ? { adoption: c.adoptionScore } : {}),
        ...(c.adoptionRate != null ? { adoptionRate: c.adoptionRate } : {}),
        utilization: c.effectiveUtilizationScore,
        criteriaResults: c.criteriaResults.map((cr) => ({
          id: cr.id,
          label: cr.label,
          value: cr.value,
          points: cr.points,
          error: cr.error,
          ...(cr.notAssessed ? { notAssessed: true } : {}),
        })),
      })),
    };
    setSnapshots((prev) => {
      const all = [snap, ...prev];
      const { keep, removeIds } = applyRetention(all);
      persistLocal(keep);
      // Schedule deletion outside of state updater to avoid side effects during render
      if (removeIds.length > 0) {
        Promise.resolve().then(() => deleteSnapshotsFromDocStore(removeIds, remoteIdsRef.current));
      }
      return keep;
    });
    // Save to Document Store (fire-and-forget)
    saveToDocStore(snap, remoteIdsRef.current);
  }, []);

  return { snapshots, loading, saveSnapshot };
}
