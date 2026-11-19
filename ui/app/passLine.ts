// ui/app/passLine.ts
//
// One target per criterion. A criterion is met when its value reaches the
// pass line; the capability score is the share of criteria met.
//
// The catalog lists up to three targets per criterion (for example 30/10/1).
// Until v2.5.15 the LOWEST decided, so 98 of 111 criteria passed from 1%.
// The pass line is now the MIDDLE target (the higher one when there are two).
// Presence checks (a single target) are unaffected.
//
// Rollback: PASS_LINE_DEFAULT = "lowest", or per session with
// ?passline=lowest / localStorage "cca.passline" = "lowest".

export type PassLineMode = "middle" | "lowest";
export const PASS_LINE_DEFAULT: PassLineMode = "middle";

export function passLineMode(): PassLineMode {
  try {
    if (typeof window === "undefined") return PASS_LINE_DEFAULT;
    const p = new URLSearchParams(window.location.search).get("passline");
    if (p === "lowest" || p === "middle") return p;
    const ls = window.localStorage.getItem("cca.passline");
    if (ls === "lowest" || ls === "middle") return ls;
  } catch { /* storage blocked — use the default */ }
  return PASS_LINE_DEFAULT;
}

/** The single value a criterion must reach, from its list of targets. */
export function passLine(mins: number[], mode: PassLineMode = passLineMode()): number | null {
  if (mins.length === 0) return null;
  const desc = [...mins].sort((a, b) => b - a);
  return mode === "lowest" ? desc[desc.length - 1] : desc[Math.floor((desc.length - 1) / 2)];
}
