import Colors from "@dynatrace/strato-design-tokens/colors";

/**
 * Strato design-token colors for each scoring band (for JSX / inline styles).
 * Only the platform's status colours, as the native apps read them: green
 * for healthy (Good, Excellent), amber for Warning (Moderate), red for
 * Critical (Low, Critical). Strato's blue "Good" status is its informative
 * level, not "healthy", so it is not used. Bands that share a colour are told
 * apart by their word; a categorical series colour never stands for a status.
 * These resolve to CSS custom properties and adapt to dark/light theme automatically.
 */
export const SCORE_BAND_TOKENS = {
  Critical:   Colors.Charts.Status.Critical.Default,
  Low:        Colors.Charts.Status.Critical.Default,
  Moderate:   Colors.Charts.Status.Warning.Default,
  Good:       Colors.Charts.Status.Ideal.Default,
  Excellent:  Colors.Charts.Status.Ideal.Default,
} as const;

/** The same bands for TEXT (numbers, labels). Status text uses the platform's
 *  text tokens, which stay legible on the dark background; the chart status
 *  tokens above are for marks (bars, rings, dots). */
export const SCORE_BAND_TEXT = {
  Critical:   Colors.Text.Critical.Default,
  Low:        Colors.Text.Critical.Default,
  Moderate:   Colors.Text.Warning.Default,
  Good:       Colors.Text.Success.Default,
  Excellent:  Colors.Text.Success.Default,
} as const;

/**
 * Shared scoring band definitions — single source of truth for the entire app.
 * `color` values are plain hex strings for canvas and PDF rendering: the
 * fallback values of the same Strato tokens, so screen and report match.
 * For JSX use the corresponding `token` (CSS custom property).
 */
export const SCORE_BANDS = [
  { min: 0,  max: 20,  label: "Critical",  color: "#d40036", token: SCORE_BAND_TOKENS.Critical, text: SCORE_BAND_TEXT.Critical },
  { min: 20, max: 40,  label: "Low",       color: "#d40036", token: SCORE_BAND_TOKENS.Low, text: SCORE_BAND_TEXT.Low },
  { min: 40, max: 60,  label: "Moderate",  color: "#d7b43b", token: SCORE_BAND_TOKENS.Moderate, text: SCORE_BAND_TEXT.Moderate },
  { min: 60, max: 80,  label: "Good",      color: "#00bb7b", token: SCORE_BAND_TOKENS.Good, text: SCORE_BAND_TEXT.Good },
  { min: 80, max: 100, label: "Excellent", color: "#00bb7b", token: SCORE_BAND_TOKENS.Excellent, text: SCORE_BAND_TEXT.Excellent },
] as const;

/** Maps a 0–100% score to a { label, color, token } band. */
export function scoreBand(score: number): { label: string; color: string; token: string; text: string } {
  if (score >= 80) return { label: "Excellent", color: "#00bb7b", token: SCORE_BAND_TOKENS.Excellent, text: SCORE_BAND_TEXT.Excellent };
  if (score >= 60) return { label: "Good",      color: "#00bb7b", token: SCORE_BAND_TOKENS.Good, text: SCORE_BAND_TEXT.Good };
  if (score >= 40) return { label: "Moderate",  color: "#d7b43b", token: SCORE_BAND_TOKENS.Moderate, text: SCORE_BAND_TEXT.Moderate };
  if (score >= 20) return { label: "Low",       color: "#d40036", token: SCORE_BAND_TOKENS.Low, text: SCORE_BAND_TEXT.Low };
  return { label: "Critical", color: "#d40036", token: SCORE_BAND_TOKENS.Critical, text: SCORE_BAND_TEXT.Critical };
}

/** Maps a 0–100% score to a band hex color (canvas-safe). */
export function scoreColor(score: number): string {
  return scoreBand(score).color;
}

/** Maps a 0–100% score to a Strato design-token color (JSX-safe). */
export function scoreTokenColor(score: number): string {
  return scoreBand(score).token;
}

/** Maps a 0–100% score to a band label. */
export function bandLabel(score: number): string {
  return scoreBand(score).label;
}

