/** Shared scoring band definitions — single source of truth for the entire app. */
export const SCORE_BANDS = [
  { min: 0, max: 20, label: "N/A", color: "#CD3C44" },
  { min: 20, max: 40, label: "Low", color: "#DC671E" },
  { min: 40, max: 60, label: "Moderate", color: "#EEA746" },
  { min: 60, max: 80, label: "Good", color: "#5EB1A9" },
  { min: 80, max: 100, label: "Excellent", color: "#36B37E" },
] as const;

/** Maps a 0–100% score to a { label, color } band. */
export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "#36B37E" };
  if (score >= 60) return { label: "Good", color: "#5EB1A9" };
  if (score >= 40) return { label: "Moderate", color: "#EEA746" };
  if (score >= 20) return { label: "Low", color: "#DC671E" };
  return { label: "N/A", color: "#CD3C44" };
}

/** Maps a 0–100% score to a band color. */
export function scoreColor(score: number): string {
  return scoreBand(score).color;
}

/** Maps a 0–100% score to a band label. */
export function bandLabel(score: number): string {
  return scoreBand(score).label;
}
