// ui/app/pages/GuidePage.tsx
//
// The guide: how to read the app. A reading page (centred, one column), so
// this is the one place where explanations are written out in full. Every
// number quoted here is read from the same constants the scoring uses, so the
// guide cannot drift from what the app computes.

import React from "react";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Heading, Paragraph, Text, Strong } from "@dynatrace/strato-components/typography";
import { Accordion, Chip } from "@dynatrace/strato-components/content";
import { Flex, Surface, Grid } from "@dynatrace/strato-components/layouts";
import { CAPABILITIES } from "../queries";
import { CRITERION_TIERS } from "../data/criterionTiers";
import { passLine } from "../passLine";
import { ADOPTION_FULL_RATE } from "../pulseScore";
import { DEFAULT_CUTS, diagnosisMeta } from "../diagnosis";
import type { DiagnosisId } from "../diagnosis";
import { SCORE_BANDS } from "../utils/colors";
import { VerdictChip } from "./CapabilityDetailPage";
import { FOUNDATION_WEIGHT, BEST_PRACTICE_WEIGHT, EXCELLENCE_WEIGHT } from "../hooks/useCoverageData";
import type { CoverageData } from "../hooks/useCoverageData";
import { NO_ADOPTION } from "../hooks/useAppAdoption";
import { telemetryLabel } from "../telemetry";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, QUESTIONS, guideFacts } from "../ai/pageIntelligence";
import { bandWord, criterionText, tr, useLang, useTr, type PulseLang } from "../i18n/lang";

const MONO = Typography.Code.Small.Default.Family;
const INK = Colors.Text.Neutral.Default;
const NEUTRAL = Colors.Text.Neutral.Subdued;
const LINE = Colors.Border.Neutral.Default;
const SURFACE = Colors.Background.Surface.Default;
const PART = {
  coverage: Colors.Charts.Categorical.Color01.Default,
  utilization: Colors.Charts.Categorical.Color08.Default,
  adoption: Colors.Charts.Categorical.Color07.Default,
};

const pct = (w: number) => Math.round(w <= 1 ? w * 100 : w);
// Tier names are Dynatrace's own and stay in English; the question is translated.
const tiers = (lang: PulseLang) => [
  { key: "foundation", label: "Foundation", weight: pct(FOUNDATION_WEIGHT), what: tr(lang, "Is the capability switched on and sending data?", "A capacidade está ativada e enviando dados?", "¿La capacidad está activada y enviando datos?") },
  { key: "bestPractice", label: "Best practice", weight: pct(BEST_PRACTICE_WEIGHT), what: tr(lang, "Is it set up the way Dynatrace recommends?", "Está configurada como a Dynatrace recomenda?", "¿Está configurada como Dynatrace recomienda?") },
  { key: "excellence", label: "Excellence", weight: pct(EXCELLENCE_WEIGHT), what: tr(lang, "Is it used for automation and advanced analysis?", "É usada para automação e análise avançada?", "¿Se usa para automatización y análisis avanzado?") },
] as const;

/** When each verdict applies, in the order the rules are checked (../diagnosis.ts). */
const verdictWhen = (lang: PulseLang): { id: DiagnosisId; when: string }[] => {
  const { adoptionRate: ar, coverage: cv, utilization: ut } = DEFAULT_CUTS;
  return [
    { id: "notAssessed", when: tr(lang,
      "None of the capability's criteria could be measured in this environment.",
      "Nenhum critério da capacidade pôde ser medido neste ambiente.",
      "Ningún criterio de la capacidad pudo medirse en este entorno.") },
    { id: "starved", when: tr(lang,
      `People open the apps (adoption at ${ar}% of active users or more), but coverage is below ${cv}%.`,
      `As pessoas abrem os apps (adoção de ${ar}% dos usuários ativos ou mais), mas a cobertura está abaixo de ${cv}%.`,
      `Las personas abren las apps (adopción de ${ar}% de los usuarios activos o más), pero la cobertura está por debajo de ${cv}%.`) },
    { id: "unwatched", when: tr(lang,
      `Coverage is at ${cv}% or more, but fewer than ${ar}% of active users open the apps.`,
      `A cobertura é de ${cv}% ou mais, mas menos de ${ar}% dos usuários ativos abrem os apps.`,
      `La cobertura es de ${cv}% o más, pero menos del ${ar}% de los usuarios activos abre las apps.`) },
    { id: "skinDeep", when: tr(lang,
      `Coverage and adoption are both high, but utilization is below ${ut}%.`,
      `Cobertura e adoção são altas, mas a utilização está abaixo de ${ut}%.`,
      `Cobertura y adopción son altas, pero la utilización está por debajo de ${ut}%.`) },
    { id: "healthy", when: tr(lang,
      "Coverage, utilization and adoption are all high.",
      "Cobertura, utilização e adoção são todas altas.",
      "Cobertura, utilización y adopción son todas altas.") },
    { id: "dark", when: tr(lang,
      `Coverage is below ${cv}% and few people open the apps.`,
      `A cobertura está abaixo de ${cv}% e poucas pessoas abrem os apps.`,
      `La cobertura está por debajo de ${cv}% y pocas personas abren las apps.`) },
  ];
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Surface elevation="flat" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
    <Heading level={4}>{title}</Heading>
    {children}
  </Surface>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Paragraph style={{ maxWidth: 760 }}>{children}</Paragraph>
);

/** Term on the left, explanation on the right. */
const Def: React.FC<{ term: React.ReactNode; children: React.ReactNode }> = ({ term, children }) => (
  <Grid style={{ gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr)", gap: 16, padding: "10px 0", borderTop: `1px solid ${LINE}`, alignItems: "baseline" }}>
    <Text textStyle="base-emphasized" style={{ color: INK }}>{term}</Text>
    <Text textStyle="base" style={{ lineHeight: 1.6, color: INK }}>{children}</Text>
  </Grid>
);

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: 3, background: color, marginRight: 8, flexShrink: 0 }} />
);

const num = (n: React.ReactNode) => <Text style={{ fontFamily: MONO, fontWeight: 700 }}>{n}</Text>;

function target(c: (typeof CAPABILITIES)[number]["criteria"][number], lang: PulseLang): string {
  const line = passLine(c.thresholds.map(t => t.min));
  if (line == null) return "";
  // Same rule as the engine: a constant denominator other than 1 is a share too.
  return c.queryB || (c.denominatorConstant != null && c.denominatorConstant !== 1) ? tr(lang, `${line}% or more`, `${line}% ou mais`, `${line}% o más`) : tr(lang, "at least one", "pelo menos um", "al menos uno");
}

export const GuidePage: React.FC<{ coverageData: CoverageData }> = ({ coverageData }) => {
  const caps = coverageData.capabilities;
  const adoption = coverageData.adoption ?? NO_ADOPTION;
  const lang = useLang();
  const t = useTr();
  const TIERS = tiers(lang);
  const VERDICT_WHEN = verdictWhen(lang);

  return (
    <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <IntelligenceBar
        questions={QUESTIONS.guide}
        ctx={{
          tenant: coverageData.tenant, date: coverageData.date, overallCoverage: coverageData.totalScore, overallUtilization: coverageData.overallUtilizationLevel, capabilities: caps,
          lens: LENS.guide,
          pageNote: guideFacts(caps, adoption),
        }}
      />
      <Flex flexDirection="column" gap={16} style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "24px 20px 48px" }}>
        <Flex flexDirection="column" gap={8}>
          <Heading level={2}>{t("Guide", "Guia", "Guía")}</Heading>
          <P>
            {t(
              "Pulse Assessment measures how much of the Dynatrace platform this environment really uses. It reads the environment's own data, scores ",
              "O Pulse Assessment mede quanto da plataforma Dynatrace este ambiente realmente usa. Ele lê os dados do próprio ambiente, pontua ",
              "Pulse Assessment mide cuánto de la plataforma Dynatrace usa realmente este entorno. Lee los datos del propio entorno, puntúa ",
            )}{num(CAPABILITIES.length)}{t(
              " capabilities from 0 to 100, and shows what to do to raise each score.",
              " capacidades de 0 a 100 e mostra o que fazer para elevar cada pontuação.",
              " capacidades de 0 a 100 y muestra qué hacer para subir cada puntuación.",
            )}
          </P>
        </Flex>

        <Section title={t("How the score is built", "Como a pontuação é formada", "Cómo se forma la puntuación")}>
          <P>
            {t(
              "Every capability gets three readings. The capability score is the average of the three, and the overall score is the average of the capabilities. Both are rounded down. When adoption cannot be read, the capability score is the average of coverage and utilization.",
              "Cada capacidade recebe três leituras. A pontuação da capacidade é a média das três, e a pontuação geral é a média das capacidades. Ambas são arredondadas para baixo. Quando a adoção não pode ser lida, a pontuação da capacidade é a média de cobertura e utilização.",
              "Cada capacidad recibe tres lecturas. La puntuación de la capacidad es el promedio de las tres, y la puntuación general es el promedio de las capacidades. Ambas se redondean hacia abajo. Cuando la adopción no puede leerse, la puntuación de la capacidad es el promedio de cobertura y utilización.",
            )}
          </P>
          <Flex flexDirection="column">
            <Def term={<><Dot color={PART.coverage} />{t("Coverage", "Cobertura", "Cobertura")}</>}>
              {t(
                "Is the data there? The share of the capability's assessed criteria that are met. A criterion that cannot be measured in this environment is not assessed and is left out. A criterion is met when its measured value reaches its target, for example \"70% of hosts send CPU metrics\".",
                "Os dados estão lá? A parcela dos critérios avaliados da capacidade que são atendidos. Um critério que não pode ser medido neste ambiente não é avaliado e fica de fora. Um critério é atendido quando o valor medido alcança a meta, por exemplo \"70% dos hosts enviam métricas de CPU\".",
                "¿Están los datos? La proporción de los criterios evaluados de la capacidad que se cumplen. Un criterio que no puede medirse en este entorno no se evalúa y queda fuera. Un criterio se cumple cuando su valor medido alcanza su meta, por ejemplo \"70% de los hosts envían métricas de CPU\".",
              )}
            </Def>
            <Def term={<><Dot color={PART.utilization} />{t("Utilization", "Utilização", "Utilización")}</>}>
              {t(
                "How deep is the setup? The same criteria, grouped in three tiers and weighted so that the basics count most (see below).",
                "Quão profunda é a configuração? Os mesmos critérios, agrupados em três níveis e ponderados para que o básico conte mais (veja abaixo).",
                "¿Qué tan profunda es la configuración? Los mismos criterios, agrupados en tres niveles y ponderados para que lo básico cuente más (ver abajo).",
              )}
            </Def>
            <Def term={<><Dot color={PART.adoption} />{t("Adoption", "Adoção", "Adopción")}</>}>
              {t(
                "Do people use it? The share of active users who opened the capability's most used app in the last 30 days. It counts as ",
                "As pessoas usam? A parcela de usuários ativos que abriram o app mais usado da capacidade nos últimos 30 dias. Conta como ",
                "¿La gente la usa? La proporción de usuarios activos que abrieron la app más usada de la capacidad en los últimos 30 días. Cuenta como ",
              )}{num(100)}{t(" when ", " quando ", " cuando ")}{num(`${ADOPTION_FULL_RATE}%`)}{t(
                " of active users did; below that it scales in proportion.",
                " dos usuários ativos o fizeram; abaixo disso, é proporcional.",
                " de los usuarios activos lo hicieron; por debajo, escala en proporción.",
              )}
            </Def>
          </Flex>
        </Section>

        <Section title={t("Utilization tiers", "Níveis de utilização", "Niveles de utilización")}>
          <P>
            {t(
              "Each criterion belongs to one tier. Utilization is the weighted share of criteria met in each tier. Best practice only counts once Foundation reaches ",
              "Cada critério pertence a um nível. A utilização é a parcela ponderada de critérios atendidos em cada nível. Best practice só conta quando Foundation chega a ",
              "Cada criterio pertenece a un nivel. La utilización es la proporción ponderada de criterios cumplidos en cada nivel. Best practice solo cuenta cuando Foundation llega a ",
            )}{num("80%")}{t(
              ", and Excellence only once Best practice reaches ",
              ", e Excellence só quando Best practice chega a ",
              ", y Excellence solo cuando Best practice llega a ",
            )}{num("60%")}{t(
              ": advanced use on top of a weak base is not counted. A tier with no assessed criterion counts as ",
              ": uso avançado sobre uma base fraca não é contado. Um nível sem nenhum critério avaliado conta como ",
              ": el uso avanzado sobre una base débil no se cuenta. Un nivel sin ningún criterio evaluado cuenta como ",
            )}{num("0%")}.
          </P>
          <Flex flexDirection="column">
            {TIERS.map(x => (
              <Def key={x.key} term={<>{x.label} <Text style={{ fontFamily: MONO, color: NEUTRAL, fontWeight: 400 }}>· {t("weight", "peso", "peso")} {x.weight}%</Text></>}>{x.what}</Def>
            ))}
          </Flex>
        </Section>

        <Section title={t("Score bands", "Faixas de pontuação", "Bandas de puntuación")}>
          <P>{t(
            "The colour of a score is its band. The same bands apply to the overall score, a capability and each of its parts.",
            "A cor de uma pontuação é a sua faixa. As mesmas faixas valem para a pontuação geral, para uma capacidade e para cada uma de suas partes.",
            "El color de una puntuación es su banda. Las mismas bandas se aplican a la puntuación general, a una capacidad y a cada una de sus partes.",
          )}</P>
          <Flex gap={8} flexWrap="wrap">
            {[...SCORE_BANDS].reverse().map(b => (
              <Chip key={b.label} color="neutral">
                <Chip.Prefix><Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: b.token, flexShrink: 0 }} /></Chip.Prefix>
                {bandWord(b.label, lang)} {b.min}–{b.max === 100 ? 100 : b.max - 1}
              </Chip>
            ))}
          </Flex>
        </Section>

        <Section title={t("Verdicts", "Veredictos", "Veredictos")}>
          <P>
            {t(
              "Next to each score there is a one-word verdict. It does not change the score: it reads the three parts together and says what kind of problem the capability has, so the next step is clear.",
              "Ao lado de cada pontuação há um veredicto de uma palavra. Ele não altera a pontuação: lê as três partes juntas e diz que tipo de problema a capacidade tem, para que o próximo passo fique claro.",
              "Junto a cada puntuación hay un veredicto de una palabra. No cambia la puntuación: lee las tres partes juntas y dice qué tipo de problema tiene la capacidad, para que el siguiente paso quede claro.",
            )}
          </P>
          <Flex flexDirection="column">
            {VERDICT_WHEN.map(v => (
              <Def key={v.id} term={<VerdictChip id={v.id} label={diagnosisMeta(v.id, lang).label} />}>
                {v.when}<br /><Text style={{ color: NEUTRAL }}>{t("Next step", "Próximo passo", "Siguiente paso")}: {diagnosisMeta(v.id, lang).action}</Text>
              </Def>
            ))}
          </Flex>
        </Section>

        <Section title={t("The pages", "As páginas", "Las páginas")}>
          <Flex flexDirection="column">
            <Def term={t("Overview", "Visão geral", "Resumen")}>
              {t(
                "The radar. One sector per capability, with three bars: coverage, utilization and adoption. Point at a sector to read its numbers in the centre; click it to open the capability. Click the legend to hide or show a part.",
                "O radar. Um setor por capacidade, com três barras: cobertura, utilização e adoção. Aponte para um setor para ler seus números no centro; clique nele para abrir a capacidade. Clique na legenda para ocultar ou mostrar uma parte.",
                "El radar. Un sector por capacidad, con tres barras: cobertura, utilización y adopción. Apunte a un sector para leer sus números en el centro; haga clic para abrir la capacidad. Haga clic en la leyenda para ocultar o mostrar una parte.",
              )}
            </Def>
            <Def term={t("Capability detail", "Detalhe da capacidade", "Detalle de la capacidad")}>
              {t(
                "Everything about one capability: the score and its parts, what to do (ordered by how much each action raises the score), every criterion with its value, the score over time and the apps people use. Click a utilization tier to filter the page by it.",
                "Tudo sobre uma capacidade: a pontuação e suas partes, o que fazer (ordenado por quanto cada ação eleva a pontuação), cada critério com seu valor, a pontuação ao longo do tempo e os apps que as pessoas usam. Clique em um nível de utilização para filtrar a página por ele.",
                "Todo sobre una capacidad: la puntuación y sus partes, qué hacer (ordenado por cuánto sube la puntuación cada acción), cada criterio con su valor, la puntuación en el tiempo y las apps que la gente usa. Haga clic en un nivel de utilización para filtrar la página por él.",
              )}
            </Def>
            <Def term={t("Overall score", "Pontuação geral", "Puntuación general")}>
              {t(
                "The whole environment on one page: the overall score and its parts, the capabilities from lowest to highest, and the actions that raise the overall score most. Also opens from the centre of the radar.",
                "O ambiente inteiro em uma página: a pontuação geral e suas partes, as capacidades da menor para a maior e as ações que mais elevam a pontuação geral. Também abre pelo centro do radar.",
                "Todo el entorno en una página: la puntuación general y sus partes, las capacidades de menor a mayor y las acciones que más suben la puntuación general. También se abre desde el centro del radar.",
              )}
            </Def>
            <Def term={t("Evolution", "Evolução", "Evolución")}>
              {t(
                "Compares two saved runs: what changed in the score, in each capability, and which criteria were gained or lost.",
                "Compara duas execuções salvas: o que mudou na pontuação, em cada capacidade, e quais critérios foram ganhos ou perdidos.",
                "Compara dos ejecuciones guardadas: qué cambió en la puntuación, en cada capacidad, y qué criterios se ganaron o se perdieron.",
              )}
            </Def>
            <Def term="Dynatrace Intelligence">
              {t(
                "The bar at the top answers ready-made questions about the assessment in a few lines. \"Go deeper in Assist\" continues the same question in Dynatrace Assist. Answers are generated by AI: verify them before acting.",
                "A barra no topo responde, em poucas linhas, perguntas prontas sobre a avaliação. \"Aprofundar no Assist\" continua a mesma pergunta no Dynatrace Assist. As respostas são geradas por AI: verifique-as antes de agir.",
                "La barra superior responde, en pocas líneas, preguntas predefinidas sobre la evaluación. \"Profundizar en Assist\" continúa la misma pregunta en Dynatrace Assist. Las respuestas las genera AI: verifíquelas antes de actuar.",
              )}
            </Def>
          </Flex>
        </Section>

        <Section title={t("Running the assessment", "Executando a avaliação", "Ejecución de la evaluación")}>
          <P>
            {t(
              "The assessment runs when the app opens and is saved automatically, so Evolution builds its history without any extra step. Results are reused for 24 hours; \"Refresh\" on the Overview runs everything again. \"Run details\" on the Overview shows how much data the run read.",
              "A avaliação roda quando o app abre e é salva automaticamente, então a Evolução monta seu histórico sem nenhum passo extra. Os resultados são reaproveitados por 24 horas; \"Atualizar\" na Visão geral roda tudo de novo. \"Detalhes da execução\" na Visão geral mostra quantos dados a execução leu.",
              "La evaluación se ejecuta cuando la app se abre y se guarda automáticamente, así Evolución construye su historial sin ningún paso extra. Los resultados se reutilizan durante 24 horas; \"Actualizar\" en el Resumen ejecuta todo de nuevo. \"Detalles de la ejecución\" en el Resumen muestra cuántos datos leyó la ejecución.",
            )}
          </P>
          <P>
            {t(
              "Criteria read Dynatrace metrics and Smartscape wherever they answer the question, at no Grail scan. The remaining log and AI reads share one scan per family and stop at 50 GB; a value read only in part shows with \"≈\" and its tooltip says so.",
              "Os critérios leem métricas da Dynatrace e o Smartscape sempre que eles respondem à pergunta, sem leitura no Grail. As leituras restantes de logs e de AI compartilham uma leitura por família e param em 50 GB; um valor lido só em parte aparece com \"≈\" e o tooltip avisa.",
              "Los criterios leen métricas de Dynatrace y Smartscape siempre que responden a la pregunta, sin lectura en Grail. Las lecturas restantes de logs y de AI comparten una lectura por familia y se detienen en 50 GB; un valor leído solo en parte aparece con \"≈\" y su tooltip lo indica.",
            )}
          </P>
        </Section>

        <Section title={t("Telemetry strategy", "Estratégia de telemetria", "Estrategia de telemetría")}>
          <P>
            {t(
              "On open the app classifies how the environment collects telemetry, and reads each criterion accordingly. The classification heads every report.",
              "Ao abrir, o app classifica como o ambiente coleta telemetria e lê cada critério de acordo. A classificação abre todos os relatórios.",
              "Al abrirse, la app clasifica cómo el entorno recolecta telemetría y lee cada criterio en consecuencia. La clasificación encabeza todos los informes.",
            )}
          </P>
          <Flex flexDirection="column">
            <Def term={telemetryLabel("oneagent", lang)}>{t(
              "Every host is monitored by OneAgent. Every criterion reads OneAgent data.",
              "Todos os hosts são monitorados pelo OneAgent. Todos os critérios leem dados do OneAgent.",
              "Todos los hosts son monitoreados por OneAgent. Todos los criterios leen datos de OneAgent.",
            )}</Def>
            <Def term={telemetryLabel("mixed", lang)}>
              {t(
                "Part of the hosts run OneAgent, part are reported only through OpenTelemetry. Hosts, Kubernetes, processes and logs are counted on both sides, and a host seen by both counts once.",
                "Parte dos hosts roda OneAgent, parte é reportada só por OpenTelemetry. Hosts, Kubernetes, processos e logs são contados dos dois lados, e um host visto pelos dois conta uma vez.",
                "Parte de los hosts ejecuta OneAgent y parte se reporta solo por OpenTelemetry. Hosts, Kubernetes, procesos y logs se cuentan en ambos lados, y un host visto por ambos cuenta una vez.",
              )}
            </Def>
            <Def term={telemetryLabel("otel", lang)}>
              {t(
                "No host runs OneAgent. Hosts, Kubernetes and logs are read from OpenTelemetry metrics and attributes, and the criteria that only exist with OneAgent are left out of the score instead of counting as not met.",
                "Nenhum host roda OneAgent. Hosts, Kubernetes e logs são lidos de métricas e atributos do OpenTelemetry, e os critérios que só existem com OneAgent ficam fora da pontuação em vez de contar como não atendidos.",
                "Ningún host ejecuta OneAgent. Hosts, Kubernetes y logs se leen de métricas y atributos de OpenTelemetry, y los criterios que solo existen con OneAgent quedan fuera de la puntuación en lugar de contar como no cumplidos.",
              )}
            </Def>
          </Flex>
        </Section>

        <Section title={t("What is measured", "O que é medido", "Qué se mide")}>
          <P>{t(
            "Select a capability to see its criteria, what each one measures and the value it needs to reach.",
            "Selecione uma capacidade para ver seus critérios, o que cada um mede e o valor que precisa alcançar.",
            "Seleccione una capacidad para ver sus criterios, qué mide cada uno y el valor que necesita alcanzar.",
          )}</P>
          <Accordion>
            {CAPABILITIES.map(c => (
              <Accordion.Section key={c.name} id={c.name}>
                <Accordion.SectionLabel>
                  <Flex alignItems="center" gap={8}>
                    <Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    {c.name}
                  </Flex>
                </Accordion.SectionLabel>
                <Accordion.SectionContent>
                  <Flex flexDirection="column" gap={16}>
                    {TIERS.map(x => {
                      const rows = c.criteria.filter(cr => CRITERION_TIERS[cr.id] === x.key);
                      if (rows.length === 0) return null;
                      return (
                        <Flex key={x.key} flexDirection="column" gap={8}>
                          <Heading level={6}>{x.label}</Heading>
                          {rows.map(cr => {
                            const ct = criterionText(cr.id, lang, { label: cr.label, description: cr.description });
                            return (
                            <Grid key={cr.id} style={{ gridTemplateColumns: "minmax(0, 1fr) 110px", gap: 16, alignItems: "baseline" }}>
                              <Text textStyle="base" style={{ lineHeight: 1.5, color: INK }}>
                                <Strong>{ct.label.replace(/\s*\(%\)\s*$/, "")}</Strong>
                                <Text style={{ color: NEUTRAL }}> · {ct.description}</Text>
                              </Text>
                              <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL, textAlign: "right" }}>{target(cr, lang)}</Text>
                            </Grid>
                            );
                          })}
                        </Flex>
                      );
                    })}
                  </Flex>
                </Accordion.SectionContent>
              </Accordion.Section>
            ))}
          </Accordion>
        </Section>
      </Flex>
    </Flex>
  );
};
