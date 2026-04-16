import { useState, useCallback, useEffect, useRef } from "react";
import { documentsClient } from "@dynatrace-sdk/client-document";
import type { CapabilityResult } from "./useCoverageData";

export interface AssessmentSnapshot {
  id: string;
  timestamp: string;
  totalScore: number;
  tenant: string;
  capabilities: {
    name: string;
    color: string;
    score: number;
    criteriaResults: {
      id: string;
      label: string;
      value: number;
      points: number;
      error: boolean;
    }[];
  }[];
}

const STORAGE_KEY = "ppa-assessment-history";
const DOC_TYPE = "ppa-snapshot";

/* ── localStorage cache helpers ── */

function loadLocal(): AssessmentSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
    const snaps: AssessmentSnapshot[] = [];
    for (const doc of list.documents) {
      try {
        const content = await documentsClient.downloadDocumentContent({ id: doc.id });
        const text = await content.get("text");
        snaps.push(JSON.parse(text));
      } catch { /* skip corrupt documents */ }
    }
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

/* ── Retention policy: keep only the 12 most recent snapshots ── */

const MAX_SNAPSHOTS = 12;

function applyRetention(snapshots: AssessmentSnapshot[]): {
  keep: AssessmentSnapshot[];
  removeIds: string[];
} {
  if (snapshots.length <= MAX_SNAPSHOTS) return { keep: snapshots, removeIds: [] };

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const keep = sorted.slice(0, MAX_SNAPSHOTS);
  const removeIds = sorted.slice(MAX_SNAPSHOTS).map((s) => s.id);
  return { keep, removeIds };
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
    });
  }, []);

  const saveSnapshot = useCallback((capabilities: CapabilityResult[], totalScore: number, tenant: string) => {
    const snap: AssessmentSnapshot = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      totalScore,
      tenant,
      capabilities: capabilities.map((c) => ({
        name: c.name,
        color: c.color,
        score: c.score,
        criteriaResults: c.criteriaResults.map((cr) => ({
          id: cr.id,
          label: cr.label,
          value: cr.value,
          points: cr.points,
          error: cr.error,
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

  const clearHistory = useCallback(() => {
    setSnapshots([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { snapshots, saveSnapshot, clearHistory };
}
