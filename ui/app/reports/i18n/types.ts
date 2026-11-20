// Texts of one criterion as a report prints them. English comes from the
// catalog itself (queries.ts, remediationActions.ts); pt.ts and es.ts carry the
// other two languages, keyed by criterion id.
export interface CriterionText {
  label: string;
  description: string;
  action: string;
}
