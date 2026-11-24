// ui/app/kit/PulseHost.tsx
//
// Where Pulse is mounted. Pulse runs as its own app (base path "") and as the
// Coverage section of another app (for example under "/coverage"). Every
// in-app link goes through usePulseNavigate / usePulsePath, so the screens are
// the same code in both places and only the prefix changes.

import React, { createContext, useCallback, useContext } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";

export interface PulseHostConfig {
  /** Route prefix Pulse is mounted under: "" standalone, "/coverage" embedded. */
  basePath: string;
  /** Id of the element the Refresh and Reports actions are portalled into. */
  headerSlotId: string;
  /** Inside another app's page: the page scrolls, so the viewport, not Pulse's own box, bounds the chart height. */
  embedded?: boolean;
  /** Window, in hours, of the inventory and metrics criteria: the host's own window, so counts match its screens. */
  windowHours?: number;
}

export const DEFAULT_HOST: PulseHostConfig = { basePath: "", headerSlotId: "pulse-header-actions" };

const PulseHostContext = createContext<PulseHostConfig>(DEFAULT_HOST);

export const PulseHostProvider: React.FC<{ value: PulseHostConfig; children: React.ReactNode }> = ({ value, children }) => (
  <PulseHostContext.Provider value={value}>{children}</PulseHostContext.Provider>
);

export const usePulseHost = () => useContext(PulseHostContext);

/** Normalizes a base path: no trailing slash, "" for root. */
export const normalizeBase = (base?: string) => {
  const b = (base ?? "").trim().replace(/\/+$/, "");
  return b === "" || b === "/" ? "" : b.startsWith("/") ? b : `/${b}`;
};

/** Absolute path for a Pulse route ("/", "/summary", "/capability/x"). */
export const usePulsePath = () => {
  const { basePath } = usePulseHost();
  return useCallback((to: string) => (to === "/" ? basePath || "/" : `${basePath}${to}`), [basePath]);
};

/** navigate() for Pulse routes: same calls as before, prefixed by the host. */
export const usePulseNavigate = () => {
  const navigate = useNavigate();
  const path = usePulsePath();
  return useCallback((to: string, options?: NavigateOptions) => navigate(path(to), options), [navigate, path]);
};

/** The Pulse route the current pathname is on ("/" when on the base path). */
export const pulseRoute = (pathname: string, basePath: string) => {
  const rest = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  return rest === "" ? "/" : rest;
};
