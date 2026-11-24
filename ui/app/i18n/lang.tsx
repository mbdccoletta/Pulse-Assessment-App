// ui/app/i18n/lang.tsx
//
// The language Pulse's screens speak. Pulse as its own app speaks English; a
// host app that mounts Pulse (kit/PulseCoverage) passes its own language, so
// the section follows the host's language switch.
//
// Texts are translated where they are written: tr("Overall score",
// "Pontuação geral", "Puntuación general"). One call keeps the three versions
// side by side, so a screen cannot gain an English sentence without its
// translation being in front of the author. Spanish is optional: a missing
// Spanish text falls back to English.
//
// Criterion names, descriptions and actions reuse the reports' translations
// (reports/i18n/pt.ts, es.ts). Capability names stay as Dynatrace writes them:
// they are product names, the same in every language.

import React, { createContext, useCallback, useContext } from "react";
import { PT } from "../reports/i18n/pt";
import { ES } from "../reports/i18n/es";

export type PulseLang = "en" | "pt" | "es";

const LangContext = createContext<PulseLang>("en");

export const PulseLangProvider: React.FC<{ lang: PulseLang; children: React.ReactNode }> = ({ lang, children }) => (
  <LangContext.Provider value={lang}>{children}</LangContext.Provider>
);

/** The active language of Pulse's screens. */
export const useLang = (): PulseLang => useContext(LangContext);

/** Picks the text for a language; Spanish falls back to English when absent. */
export const tr = (lang: PulseLang, en: string, pt: string, es?: string): string =>
  lang === "pt" ? pt : lang === "es" ? (es ?? en) : en;

/** Hook form of tr for components: tr("Overall score", "Pontuação geral"). */
export const useTr = () => {
  const lang = useLang();
  return useCallback((en: string, pt: string, es?: string) => tr(lang, en, pt, es), [lang]);
};

/** BCP 47 tag for number and date formatting in the active language. */
export const localeTag = (lang: PulseLang) => (lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en-US");

const CRITERIA = { pt: PT, es: ES } as const;

/** A criterion's label, description and action in the language, falling back to the catalog's English. */
export function criterionText(
  id: string,
  lang: PulseLang,
  english: { label: string; description?: string; action?: string },
): { label: string; description: string; action: string } {
  const t = lang === "en" ? undefined : CRITERIA[lang]?.[id];
  return {
    label: t?.label || english.label,
    description: t?.description || english.description || "",
    action: t?.action || english.action || "",
  };
}

/** Score band words (the band thresholds themselves live in utils/colors). */
const BANDS: Record<string, { pt: string; es: string }> = {
  Critical: { pt: "Crítico", es: "Crítico" },
  Low: { pt: "Baixo", es: "Bajo" },
  Moderate: { pt: "Moderado", es: "Moderado" },
  Good: { pt: "Bom", es: "Bueno" },
  Excellent: { pt: "Excelente", es: "Excelente" },
};

/** A band label ("Low", "Good"…) in the language; unknown labels pass through. */
export const bandWord = (label: string, lang: PulseLang): string =>
  lang === "en" ? label : BANDS[label]?.[lang] ?? label;

/** "last 24 h" / "últimas 24 h" / "last 7 days": the window inventory and metrics criteria read. */
export const windowWords = (hours: number, lang: PulseLang): string => {
  if (hours >= 48 && hours % 24 === 0) {
    const d = hours / 24;
    return tr(lang, `last ${d} days`, `últimos ${d} dias`, `últimos ${d} días`);
  }
  return tr(lang, `last ${hours} h`, `últimas ${hours} h`, `últimas ${hours} h`);
};
