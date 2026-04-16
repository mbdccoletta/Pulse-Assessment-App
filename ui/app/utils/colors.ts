/** Shared color utility — maps a 0–100% score to a band color. */
export function scoreColor(score: number): string {
  if (score >= 80) return "#36B37E";
  if (score >= 60) return "#5EB1A9";
  if (score >= 40) return "#EEA746";
  if (score >= 20) return "#DC671E";
  return "#CD3C44";
}
