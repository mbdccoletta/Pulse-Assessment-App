// ui/app/hooks/useProjects.ts
//
// Customer-declared observability projects, persisted in the Document Store.
//
// The customer (or the SE on their behalf) declares internal projects that
// relate to observability — "migrate checkout to K8s with full tracing",
// "reduce MTTR for payment incidents", "pass the SOC2 audit". Each project
// becomes a card on the Projects page; Davis then maps which Pulse
// capabilities serve the objective and proposes an execution plan
// (see ../ai/projectAnalysis.ts). The analysis result is stored on the
// project so cards stay populated across sessions.
//
// Persistence follows the same pattern as DavisCache / QueryCache:
// one Document Store doc ("pulse-projects"), schemaVersion guard,
// optimistic locking on update, silent degradation on storage errors
// (the page still works in-memory for the session).

import { useCallback, useEffect, useRef, useState } from "react";
import { documentsClient } from "@dynatrace-sdk/client-document";

export interface ProjectAnalysis {
  /** Epoch ms when Davis produced this analysis. */
  ts: number;
  /** Markdown body — capability mapping + phased execution plan. */
  text: string;
  /** Capability names detected in the response (chips on the card). */
  capabilities: string[];
}

export interface ObservabilityProject {
  id: string;
  name: string;
  /** Free-text objective — what the customer wants to achieve. */
  objective: string;
  /** Optional owning team — display name. When picked from the official
   *  Ownership teams (Settings > Ownership > Teams), teamIdentifier holds
   *  the identifier used in dt.owner tags. */
  team?: string;
  /** Official Dynatrace Ownership team identifier (dt.owner value). */
  teamIdentifier?: string;
  /** Optional target date (free text, e.g. "Q4 2026"). */
  targetDate?: string;
  createdAt: number;
  analysis?: ProjectAnalysis;
}

interface ProjectsDocument {
  schemaVersion: 1;
  projects: ObservabilityProject[];
}

const DOC_ID = "pulse-projects";
const DOC_TYPE = "pulse-projects";

export interface UseProjectsResult {
  /** All declared projects, newest first. */
  projects: ObservabilityProject[];
  /** True while the initial Doc Store load is in flight. */
  loading: boolean;
  addProject: (p: Omit<ObservabilityProject, "id" | "createdAt">) => void;
  removeProject: (id: string) => void;
  /** Attach/replace the Davis analysis on a project. */
  saveAnalysis: (id: string, analysis: ProjectAnalysis) => void;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ObservabilityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const docVersionRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const content = await documentsClient.downloadDocumentContent({ id: DOC_ID });
        const text = await content.get("text");
        const doc = JSON.parse(text) as Partial<ProjectsDocument>;
        try {
          const meta = await documentsClient.getDocumentMetadata({ id: DOC_ID });
          docVersionRef.current = String(meta.version ?? "");
        } catch {
          docVersionRef.current = null;
        }
        if (!cancelled && doc?.schemaVersion === 1 && Array.isArray(doc.projects)) {
          setProjects(doc.projects);
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 404) {
          // eslint-disable-next-line no-console
          console.warn("[useProjects] load failed, starting empty:", err);
        }
      } finally {
        loadedRef.current = true;
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Persist (fire-and-forget, optimistic locking) ─────────────────────
  const flush = useCallback(async (next: ObservabilityProject[]) => {
    if (!loadedRef.current) return;
    const body: ProjectsDocument = { schemaVersion: 1, projects: next };
    const content = new Blob([JSON.stringify(body)], { type: "application/json" });
    try {
      if (docVersionRef.current != null) {
        const res = await documentsClient.updateDocument({
          id: DOC_ID,
          body: { content, name: DOC_ID, type: DOC_TYPE },
          optimisticLockingVersion: docVersionRef.current,
        });
        docVersionRef.current = String(res.documentMetadata?.version ?? docVersionRef.current);
      } else {
        await documentsClient.createDocument({
          body: { content, name: DOC_ID, type: DOC_TYPE },
        });
        try {
          const meta = await documentsClient.getDocumentMetadata({ id: DOC_ID });
          docVersionRef.current = String(meta.version ?? "");
        } catch { /* keep null; next flush retries create/update */ }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[useProjects] flush failed (projects kept in memory):", err);
    }
  }, []);

  const mutate = useCallback((updater: (prev: ObservabilityProject[]) => ObservabilityProject[]) => {
    setProjects(prev => {
      const next = updater(prev);
      void flush(next);
      return next;
    });
  }, [flush]);

  const addProject = useCallback((p: Omit<ObservabilityProject, "id" | "createdAt">) => {
    const project: ObservabilityProject = {
      ...p,
      id: (globalThis.crypto?.randomUUID?.() ?? `p-${Math.random().toString(36).slice(2)}`),
      createdAt: Date.now(),
    };
    mutate(prev => [project, ...prev]);
  }, [mutate]);

  const removeProject = useCallback((id: string) => {
    mutate(prev => prev.filter(p => p.id !== id));
  }, [mutate]);

  const saveAnalysis = useCallback((id: string, analysis: ProjectAnalysis) => {
    mutate(prev => prev.map(p => (p.id === id ? { ...p, analysis } : p)));
  }, [mutate]);

  return { projects, loading, addProject, removeProject, saveAnalysis };
}
