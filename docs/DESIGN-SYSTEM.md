# Pulse Assessment - Design System Reference

Documenta cores, fontes, componentes, layout e padrões usados no Pulse Assessment para que voce possa replicar a mesma identidade em outro app Dynatrace (dt-app).

App de referencia: `pulse-assessment-dyna-version` v2.5.3
Framework: **React + TypeScript + Strato** (design system oficial da Dynatrace)

---

## 1. Stack e dependencias

```json
{
  "@dynatrace/strato-components":          "~1.18.0",
  "@dynatrace/strato-components-preview":  "~1.11.2",
  "@dynatrace/strato-design-tokens":       "^1.1.0",
  "@dynatrace-sdk/client-document":        "^1.30.0",
  "@dynatrace-sdk/client-query":           "^1.17.0",
  "chart.js":                              "^4.5.1",
  "react":                                 "^18.x",
  "react-router-dom":                      "^6.x"
}
```

Regra de ouro: **sempre que possivel, usar componentes Strato e design tokens** ao inves de hex hardcoded ou CSS inline. Eles ja respeitam tema claro/escuro automaticamente.

---

## 2. Tema (claro/escuro)

O app detecta tema com `useCurrentTheme()` e propaga para componentes que precisam renderizar fora do Strato (canvas, SVG).

```tsx
import { useCurrentTheme } from "@dynatrace/strato-components/core";

const dk = useCurrentTheme() === "dark";
const subtleBg = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
```

**Componentes Strato** (Text, Button, Container, ...) **ja se adaptam ao tema sozinhos** via CSS custom properties - so use `dk` quando renderizar fora do Strato (Chart.js, canvas, SVG, overlays manuais).

---

## 3. Paleta - Design tokens (preferidos)

Importe via `@dynatrace/strato-design-tokens/colors`. Cada token e uma string `var(--dt-...)` que ja muda com o tema.

```tsx
import Colors from "@dynatrace/strato-design-tokens/colors";

const colors = {
  // Backgrounds
  bg:        Colors.Background.Base.Default,
  bgSurface: Colors.Background.Surface.Default,
  bgSubtle:  Colors.Background.Container.Neutral.Subdued,
  bgPrimary: Colors.Background.Container.Primary.Default,

  // Text
  text:    Colors.Text.Neutral.Default,
  textSec: Colors.Text.Neutral.Subdued,
  textTert:Colors.Text.Neutral.Disabled,
  accent:  Colors.Text.Primary.Default,
  success: Colors.Text.Success.Default,
  danger:  Colors.Text.Critical.Default,

  // Borders
  border:    Colors.Border.Neutral.Default,
  borderPri: Colors.Border.Primary.Default,
};
```

| Token | Uso recomendado |
|---|---|
| `Colors.Background.Base.Default` | fundo principal da pagina |
| `Colors.Background.Surface.Default` | cards / paineis principais |
| `Colors.Background.Container.Neutral.Subdued` | secoes secundarias |
| `Colors.Background.Container.Primary.Default` | destaques (info bar) |
| `Colors.Text.Neutral.Default` | texto principal |
| `Colors.Text.Neutral.Subdued` | texto secundario / descricoes |
| `Colors.Text.Neutral.Disabled` | metadados, helper text |
| `Colors.Text.Primary.Default` | links / acoes / cor de marca |
| `Colors.Text.Success.Default` | scores positivos, "passed" |
| `Colors.Text.Critical.Default` | erros, "failed" |
| `Colors.Border.Neutral.Default` | divisores padrao |
| `Colors.Border.Primary.Default` | bordas de destaque |

---

## 4. Paleta - Cores tematicas hardcoded

Estas sao **constantes do dominio** (Pulse), nao tokens. Quando voce levar para outro app, mantenha-as como **enum/dicionario por dominio** e referencie via objeto, nao espalhe pelo codigo.

### 4.1 Cores por capability (radar)

9 cores fortes em alto contraste com fundo escuro. Ficam em `ui/app/queries.ts` ao lado da definicao da capability.

```ts
const CAPABILITY_COLORS = {
  "Infrastructure Observability": "#3B82F6", // azul
  "Application Observability":    "#8B5CF6", // roxo
  "Digital Experience":           "#EC4899", // rosa
  "Log Analytics":                "#F59E0B", // ambar
  "Application Security":         "#EF4444", // vermelho
  "Threat Observability":         "#F97316", // laranja
  "AI Observability":             "#06B6D4", // ciano
  "Business Observability":       "#10B981", // verde
  "Software Delivery":            "#6366F1", // indigo
};
```

Padrao: paleta Tailwind 500/600. Se voce criar mais dominios, escolha tonalidade **500** e mantenha saturacao consistente.

### 4.2 Bandas de score (0-100%)

Centralizado em `ui/app/utils/colors.ts`. Tem hex (para canvas) e token Strato (para JSX) - sempre prefira o token em JSX.

```ts
import Colors from "@dynatrace/strato-design-tokens/colors";

export const SCORE_BANDS = [
  { min:  0, max:  20, label: "N/A",       color: "#CD3C44",
    token: Colors.Charts.Status.Critical.Default },
  { min: 20, max:  40, label: "Low",       color: "#DC671E",
    token: Colors.Charts.Categorical.Color14.Default },
  { min: 40, max:  60, label: "Moderate",  color: "#EEA746",
    token: Colors.Charts.Status.Warning.Default },
  { min: 60, max:  80, label: "Good",      color: "#5EB1A9",
    token: Colors.Charts.Categorical.Color07.Default },
  { min: 80, max: 100, label: "Excellent", color: "#36B37E",
    token: Colors.Charts.Status.Ideal.Default },
];

export function scoreBand(score: number) {
  if (score >= 80) return SCORE_BANDS[4];
  if (score >= 60) return SCORE_BANDS[3];
  if (score >= 40) return SCORE_BANDS[2];
  if (score >= 20) return SCORE_BANDS[1];
  return SCORE_BANDS[0];
}
```

| Banda | Limites | Hex (canvas) | Token Strato (JSX) |
|---|---|---|---|
| N/A | < 20 | `#CD3C44` | `Charts.Status.Critical` |
| Low | 20-39 | `#DC671E` | `Charts.Categorical.Color14` |
| Moderate | 40-59 | `#EEA746` | `Charts.Status.Warning` |
| Good | 60-79 | `#5EB1A9` | `Charts.Categorical.Color07` |
| Excellent | >= 80 | `#36B37E` | `Charts.Status.Ideal` |

---

## 5. Tipografia

Strato injeta a fonte Dynatrace ("Bernina Sans") via CSS global. Voce so usa **componentes**, nao se preocupa com a familia.

```tsx
import { Text, Strong, Heading, Code, ExternalLink }
  from "@dynatrace/strato-components/typography";
```

### Escala usada no Pulse

| Tamanho | Uso |
|---|---|
| **10 px** | chips/badges minusculos, uppercase |
| **11 px** | metadados, helper text, labels de eixos |
| **12 px** | texto secundario, criterios |
| **13 px** | descricoes |
| **14 px** | titulos de secao, valores destaque |
| `Heading` Strato | titulos H1/H2 da pagina |

```tsx
<Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued, lineHeight: 1.6 }}>
  Capabilidade nao avaliada
</Text>

<Strong style={{ color: text }}>Cobertura total</Strong>

<Text style={{
  fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 0.5,
  color: Colors.Text.Primary.Default
}}>
  Recommendation
</Text>
```

Padroes:
- **`fontWeight: 600`** para enfase media (rotulos), **`700`** para destaque/uppercase
- **`letterSpacing: 0.5` + `textTransform: "uppercase"`** para chip labels
- **`lineHeight: 1.5-1.6`** em paragrafos
- Use **`<Strong>`** em vez de `<b>` ou `fontWeight: bold` quando possivel

---

## 6. Layout primitives

Importe sempre dos pacotes Strato. Page so existe em `-preview`.

```tsx
import { Page } from "@dynatrace/strato-components-preview/layouts";
import { Flex, Grid, Surface, Container }
  from "@dynatrace/strato-components/layouts";
```

### 6.1 Esqueleto da app

```tsx
<Page>
  <Page.Main>
    {/* todo o conteudo */}
  </Page.Main>
</Page>
```

### 6.2 Composicao tipica

```
Page
 +- Page.Main
     +- Flex (column, height 100%)
         +- Grid (380px 1fr)          // sidebar + main
             +- Surface ("primary")   // card destacado
             |   +- Container          // padding interno
             |       +- Flex (gap=16)
             +- Flex (column, scroll) // painel direito
```

### 6.3 Grid 2-colunas (sidebar fixa + conteudo)

```tsx
<Grid
  gridTemplateColumns={isMobile ? "1fr" : "380px 1fr"}
  gridTemplateRows="minmax(0,1fr)"
  style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
>
  <LeftPanel />
  <Flex flexDirection="column" style={{ overflowY: "scroll", padding: "20px 24px", minHeight: 0 }}>
    {/* main */}
  </Flex>
</Grid>
```

Padrao **`minHeight: 0`** + **`overflow: hidden`** no Grid e **`overflowY: scroll`** no filho - sem isso o scroll vaza para a pagina inteira.

### 6.4 Container e Surface

| Componente | Quando usar |
|---|---|
| `<Surface variant="default">` | wrapper de mais alto nivel (uma "pagina" / aba) |
| `<Container color="primary" variant="default">` | bloco de destaque dentro da pagina (info bar, info card) |
| `<Container color="neutral">` | bloco secundario |
| `<Flex>` | qualquer agrupamento simples (default) |

Sempre passe `style={{ marginBottom: 16 }}` para separar blocos - Strato nao injeta margin entre filhos.

---

## 7. Spacing

Pulse segue **multiplos de 4** em quase todo lugar (`gap`, `padding`, `marginBottom`).

| px | Usar para |
|---|---|
| **4** | padding de chip, gap entre icone+texto |
| **6** | padding-y dentro de chip |
| **8** | gap padrao entre items horizontais |
| **12** | gap em listas verticais |
| **16** | margin entre blocos / containers |
| **20** | padding interno de card |
| **24** | padding lateral de paineis |
| **32** | espacamento de pagina ao redor |

```tsx
<Flex gap={8} alignItems="center">              {/* numeric */}
<Flex style={{ padding: "20px 24px" }}>         {/* string CSS */}
<div style={{ marginBottom: 16 }}>              {/* sempre 16 entre blocos */}
```

`gap` aceita numero (px) ou string. Prefira numero - mais legivel.

---

## 8. Buttons e acoes

```tsx
import { Button } from "@dynatrace/strato-components/buttons";
import { ToggleButtonGroup, ToggleButtonGroupItem }
  from "@dynatrace/strato-components-preview/buttons";
```

### Sizes
- `size="condensed"` - toolbar / footer (default no Pulse)
- `size="default"` - corpo da pagina
- `size="large"` - CTA principal (raro)

### Variants
- `variant="default"` - acao primaria/CTA
- `variant="emphasized"` - destaque alto
- `variant="accent"` - secundario
- `variant="minimal"` - acao discreta / no toolbar
- `variant="danger"` - destrutivo

```tsx
<Button size="condensed" variant="default" onClick={start}>
  Run Assessment
</Button>

<Button size="condensed" variant="minimal" onClick={refresh}>
  ↻ Refresh
</Button>

{isDev && (
  <Button size="condensed" onClick={downloadPerfReport}>
    📥 Perf JSON
  </Button>
)}
```

### Toggle group (view modes)

```tsx
<ToggleButtonGroup value={viewMode} onChange={setViewMode}>
  <ToggleButtonGroupItem value="coverage">Coverage</ToggleButtonGroupItem>
  <ToggleButtonGroupItem value="maturity">Maturity</ToggleButtonGroupItem>
  <ToggleButtonGroupItem value="recommendations">Actions</ToggleButtonGroupItem>
</ToggleButtonGroup>
```

---

## 9. Estados de carregamento e erro

### Skeleton (loading)

```tsx
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";

<Suspense fallback={
  <Flex flexDirection="column" gap={16} style={{ padding: 32 }}>
    <Skeleton height={48} width="30%" />
    <Flex gap={16}>
      <Skeleton height={300} width="50%" />
      <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
        <SkeletonText lines={3} />
        <Skeleton height={120} />
      </Flex>
    </Flex>
  </Flex>
}>
  <Routes>...</Routes>
</Suspense>
```

### ProgressBar (progresso definido)

```tsx
import { ProgressBar } from "@dynatrace/strato-components/content";
<ProgressBar value={pct} max={100} />
```

### ErrorBoundary

Pulse define um `ErrorBoundary` customizado em `ui/app/components/ErrorBoundary.tsx` que envolve toda a `App`. Replique o padrao - **sempre** envolva o topo da app:

```tsx
<ErrorBoundary>
  <Page>...</Page>
</ErrorBoundary>
```

### Code splitting

```tsx
const HeavyPage = React.lazy(() =>
  import("./pages/HeavyPage").then(m => ({ default: m.HeavyPage }))
);
```

---

## 10. Overlays

```tsx
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Tooltip as StratoTooltip }
  from "@dynatrace/strato-components-preview/overlays";
```

Pulse tem um wrapper proprio (`ui/app/components/Tooltip.tsx`) com largura controlada. Padrao de uso:

```tsx
<Tooltip text={<Text>Explicacao detalhada</Text>} maxWidth={320}>
  <Text>Termo com tooltip</Text>
</Tooltip>
```

Modal:

```tsx
<Modal show={open} onDismiss={() => setOpen(false)} title="Detalhes">
  {/* corpo */}
</Modal>
```

---

## 11. Bordas e cantos arredondados

| `borderRadius` | Uso |
|---|---|
| **4 px** | chips pequenos, pills internos |
| **6 px** | botoes condensed (Strato ja aplica) |
| **8 px** | badges, callouts |
| **h/2** | progress bar full-pill (`h=8` -> `borderRadius=4`) |

```tsx
<Flex style={{
  borderRadius: 8,
  padding: "2px 10px",
  background: accent + "15",   // accent com 15/255 opacity
}}>
  <Text>22 / 32 selected</Text>
</Flex>
```

### Bordas sutis tema-aware

```tsx
const borderSub = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
const bgHover  = dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
```

Use para dividers ou separators internos onde `Colors.Border.Neutral.Default` seria forte demais.

---

## 12. Padroes de UI

### Badges/chips

```tsx
<Text style={{
  fontSize: 11, fontWeight: 700,
  padding: "2px 10px", borderRadius: 8,
  background: accent + "15",
  color: accent,
}}>
  22 / 32 selected
</Text>
```

### Section header com link/acao

```tsx
<Flex alignItems="center" justifyContent="space-between" style={{ marginBottom: 4 }}>
  <Strong style={{ fontSize: 14, color: text }}>32 Capabilities Available</Strong>
  <Text style={{ fontSize: 11, color: accent, cursor: "pointer",
                 textDecoration: "underline", fontWeight: 600 }}
        onClick={selectAll}>Select All</Text>
</Flex>
```

### Progress pill horizontal

```tsx
<Flex flexDirection="column" style={{
  width: "100%", height: 8, borderRadius: 4,
  background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  overflow: "hidden",
}}>
  <Flex style={{
    height: "100%", width: `${pct}%`, borderRadius: 4,
    background: `linear-gradient(90deg, ${color}99, ${color})`,
  }} />
</Flex>
```

Padrao: gradiente **`color99` -> `color`** (faz a barra parecer "encher" com brilho).

### Score pill (passou/falhou)

```tsx
<Text style={{
  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
  background: passed
    ? (dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.10)")
    : (dk ? "rgba(229,57,53,0.12)" : "rgba(229,57,53,0.10)"),
  color: passed ? Colors.Text.Success.Default : Colors.Text.Critical.Default,
}}>
  {passed ? "✓ Met" : "✗ Not met"}
</Text>
```

### Recomendacoes (mini-card dentro de criterio)

```tsx
<Flex flexDirection="column" style={{
  marginTop: 6, paddingTop: 6,
  borderTop: `1px solid ${borderSub}`,
}}>
  <Flex flexDirection="row" alignItems="center" gap={8}>
    <Text style={{
      fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5,
      color: Colors.Text.Primary.Default,
    }}>Recommendation</Text>
  </Flex>
  <Text>{recommendationText}</Text>
</Flex>
```

---

## 13. Visualizacoes (canvas)

Pulse usa **HTML Canvas direto** (nao Chart.js) para o radar - performance melhor para 32 pontos animados. Padrao:

```tsx
const c = canvasRef.current;
const ctx = c.getContext("2d");
const dpr = window.devicePixelRatio || 1;
c.width  = size * dpr;
c.height = size * dpr;
c.style.width  = size + "px";
c.style.height = size + "px";
ctx.scale(dpr, dpr);   // <- nao esquece, senao fica borrado em retina
```

Cores em canvas precisam ser **hex strings** (nao tokens Strato) - por isso `SCORE_BANDS` carrega tanto `color` quanto `token`.

Para grafico simples (linha/area/bar) que nao precisa de animacao custom, use Chart.js:

```tsx
import { Chart } from "chart.js/auto";
// integration via useRef + useEffect
```

---

## 14. Footer / toolbar

Pulse renderiza um footer condensado sticky com botoes de acao + DPS cost badge + scale tier banner. Padrao:

```tsx
<Flex
  alignItems="center" justifyContent="space-between"
  gap={12}
  style={{
    padding: "8px 16px",
    borderTop: `1px solid ${Colors.Border.Neutral.Default}`,
    background: Colors.Background.Surface.Default,
    position: "sticky", bottom: 0, zIndex: 10,
  }}
>
  <DpsCostBadge {...} />
  <Flex gap={8}>
    <Button size="condensed" variant="minimal" onClick={...}>
      Compare
    </Button>
  </Flex>
</Flex>
```

---

## 15. Gating: customer-facing vs SE/dev

Padrao do Pulse para mostrar controles diagnosticos so para SE:

```tsx
import { useDevMode } from "./hooks/useDevMode";
const { isDev } = useDevMode();

// ?dev=1 na URL OU localStorage.cca.dev=true
{isDev && <Button onClick={downloadPerfJson}>Perf JSON</Button>}
```

Cliente final ve apenas:
- Radar / capabilities cards
- ScaleTier banner (info de sampling)
- DPS cost badge (transparencia de custo)
- Botoes de acao customer-friendly (Run / Compare / Export PDF)

SE com `?dev=1` ve adicionalmente:
- Download perf JSON
- Force refresh (bypass cache)
- Demo / scenario controls (removidos em v2.5.3, mas o padrao continua)

---

## 16. Estrutura de pastas recomendada

```
ui/app/
  App.tsx                       # entry, Page + Routes + ErrorBoundary
  appVersion.ts                 # APP_VERSION export (sincronizar com app.config.json)
  pages/
    MyMainPage.tsx              # 1 arquivo por rota
  components/
    Tooltip.tsx                 # wrappers proprios do Strato
    SomeBadge.tsx
    SomeBanner.tsx
  hooks/
    useDevMode.ts               # gating SE
    useScaleTier.ts             # auto-detect tamanho
    useMyData.ts                # data fetching (DQL + cache + perf)
  utils/
    colors.ts                   # SCORE_BANDS + helpers
  data/                         # constantes de dominio (textos, mapeamentos)
  perf/                         # instrumentacao (types, buildReport, queryCache)
  queries.ts                    # DQL definitions
  scale-tier.ts                 # tier-detection logic
```

---

## 17. Checklist rapido para um novo app

1. **Setup**:
   - `npm i @dynatrace/strato-components @dynatrace/strato-components-preview @dynatrace/strato-design-tokens`
   - Configurar `app.config.json` com scopes minimos necessarios

2. **Topo da App**:
   ```tsx
   <ErrorBoundary>
     <Page><Page.Main>
       <Suspense fallback={<Skeleton .../>}>
         <Routes>...</Routes>
       </Suspense>
     </Page.Main></Page>
   </ErrorBoundary>
   ```

3. **Sempre usar tokens** para cor de texto/fundo/borda. Hex so para canvas/SVG ou cores de dominio (capability colors).

4. **Detectar tema** com `useCurrentTheme()` so quando renderizar fora do Strato.

5. **Layout**: `Grid` 380px+1fr para split sidebar/main, `Flex column` para conteudo, `Container color="primary"` para callouts.

6. **Spacing em multiplos de 4** (4, 8, 12, 16, 20, 24).

7. **Tipografia**: usar `Text`/`Strong`/`Heading`. Tamanhos 10/11/12/13/14 conforme tabela.

8. **Loading**: `Skeleton` + `SkeletonText` em Suspense fallback.

9. **Erros**: `ErrorBoundary` + `Colors.Text.Critical.Default` em mensagens.

10. **Gating dev**: hook `useDevMode` + `?dev=1` + `localStorage.<app>.dev`.

11. **Badge de custo / transparencia** (se aplicavel): sempre customer-facing, no toolbar.

---

## 18. Arquivos do Pulse de referencia

Quando precisar copiar um padrao, abra direto:

| Arquivo | O que copiar |
|---|---|
| `ui/app/App.tsx` | esqueleto Page/Routes/Suspense/ErrorBoundary |
| `ui/app/utils/colors.ts` | SCORE_BANDS + scoreBand() |
| `ui/app/pages/CoverageAssessment.tsx` | Grid 380/1fr + theme colors object |
| `ui/app/components/CapabilityCards.tsx` | row interativo com tooltip + expand |
| `ui/app/components/DpsCostBadge.tsx` | badge customer-facing no toolbar |
| `ui/app/components/ScaleTierBanner.tsx` | banner de info com fallback de tema |
| `ui/app/components/TechRadar.tsx` | canvas + dpr scaling + paint loop |
| `ui/app/components/Tooltip.tsx` | wrapper proprio de Tooltip |
| `ui/app/hooks/useDevMode.ts` | gating ?dev=1 |
| `ui/app/components/ErrorBoundary.tsx` | error boundary customizado |

---

## 19. Anti-patterns (evitar)

- `style={{ color: "#fff" }}` em texto - sempre use `Colors.Text.*`
- `<div>` cru para layout - prefira `<Flex>` ou `<Grid>`
- `<b>`/`<strong>` HTML - use `<Strong>` do Strato
- `fontFamily: "Arial"` etc. - Strato injeta a fonte certa, nao sobrescreva
- Cores hardcoded em multiplos componentes - centralize num `colors.ts` ou um objeto `useMemo`
- `gap="8px"` - use numero (`gap={8}`)
- Esquecer `dpr` ao desenhar em canvas (fica borrado em retina)
- Misturar `padding: 20` e `padding: "1.25rem"` - escolha uma unidade (px) e mantenha
- Loading sem fallback - todo `React.lazy` deve estar em `<Suspense fallback={<Skeleton/>}>`

---

**Documento gerado a partir do estado atual de v2.5.3. Atualize quando bumpar versoes do Strato ou mudar a paleta.**
