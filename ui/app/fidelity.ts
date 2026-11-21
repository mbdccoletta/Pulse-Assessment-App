// ui/app/fidelity.ts
//
// How completely the assessment reads the data.
//
// "full"  Every criterion reads the window it was written with, unsampled and
//         without a scan ceiling. Used when the signed-in user is a Dynatrace
//         user: queries run by Dynatrace users are not billed to the customer,
//         so the cost controls below buy nothing and only make numbers partial.
// "cost"  The cost controls of ./scale-tier.ts: shorter windows, sampling where
//         it cancels out, and a 50 GB scan ceiling per query. Used for every
//         other user. A reading that stops at the ceiling is flagged as partial.

import { getCurrentUserDetails } from "@dynatrace-sdk/app-environment";
import { isDevEnvironment } from "./hooks/useDevMode";

export type Fidelity = "full" | "cost";

/** Email domains of Dynatrace users. */
const DYNATRACE_DOMAINS = [/@dynatrace\.com$/i];

export function detectFidelity(): Fidelity {
  if (isDevEnvironment()) {
    try {
      const forced = new URLSearchParams(window.location.search).get("fidelity") ?? window.localStorage.getItem("cca.fidelity");
      if (forced === "full" || forced === "cost") return forced;
    } catch { /* storage blocked */ }
  }
  try {
    const email = getCurrentUserDetails()?.email ?? "";
    return DYNATRACE_DOMAINS.some(d => d.test(email.trim())) ? "full" : "cost";
  } catch {
    return "cost";
  }
}

let current: Fidelity = "cost";
export const setFidelity = (f: Fidelity) => { current = f; };
export const getFidelity = () => current;
