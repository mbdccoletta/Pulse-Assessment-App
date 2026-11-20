# Architecture diagrams

Mermaid diagrams for Pulse Assessment 3.0.8. Each one follows the code under `ui/app/`; the text reference is [ARCHITECTURE.md](ARCHITECTURE.md). GitHub and the VS Code Markdown preview (with a Mermaid extension) render them directly.

## 1. Module map

`App.tsx` owns the shared state (history, scale tier, assessment results, adoption) and applies the three-part score once. Pages receive that state as props; they call the AI and report modules only on a click.

```mermaid
flowchart TB
    subgraph Shell["Shell"]
        MAIN["main.tsx<br/>AppRoot + MemoryRouter"]
        APP["App.tsx<br/>routes, header, score, history save"]
    end

    subgraph Pages["pages/"]
        OV["CoverageAssessment<br/>Overview (radar)"]
        OS["ExecutiveSummary<br/>Overall score"]
        EV["EvolutionPage"]
        GU["GuidePage"]
        CD["CapabilityDetailPage"]
    end

    subgraph Hooks["hooks/"]
        UCD["useCoverageData"]
        UAA["useAppAdoption"]
        UAH["useAssessmentHistory"]
        UST["useScaleTier"]
    end

    subgraph Engine["Catalog and scoring"]
        Q["queries.ts<br/>11 capabilities, 143 criteria"]
        ADAPT["log-metric.ts<br/>trace-proxy.ts<br/>entity-model.ts"]
        SCALE["scale-tier.ts"]
        CACHE["perf/queryCache.ts"]
        SCORE["pulseScore.ts<br/>passLine.ts<br/>diagnosis.ts"]
    end

    subgraph OnClick["Loaded or called on a click"]
        AI["ai/<br/>reportPrompt, pageIntelligence,<br/>smartReport, assistIntent"]
        REP["reports/<br/>pulseReports, aiNarrativePdf"]
        FIN["finopsData.ts"]
    end

    subgraph Platform["Dynatrace platform"]
        GRAIL[("Grail (DQL)")]
        CFG[("Settings API<br/>SLO service")]
        DOCS[("Document Store")]
        COPILOT["Davis CoPilot"]
        ASSIST["Dynatrace Assist app"]
    end

    MAIN --> APP
    APP --> Pages
    APP --> Hooks
    OV --> OS
    OV --> ADAPT
    ADAPT --> Q
    UCD --> SCALE
    UCD --> CACHE
    UCD --> GRAIL
    UCD --> CFG
    UAA --> GRAIL
    UST --> GRAIL
    UAH --> DOCS
    CACHE --> DOCS
    APP --> SCORE
    Pages --> AI
    OV --> REP
    OV --> FIN
    FIN --> GRAIL
    AI --> COPILOT
    AI --> ASSIST
```

## 2. Run flow: from open to saved snapshot

The run starts on the first mount of the Overview page. A run inside 24 hours is answered from the cache document; Refresh empties that document first. The snapshot is saved from `App.tsx` only after adoption has answered, so the saved score has all three parts.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as CoverageAssessment
    participant C as useCoverageData
    participant K as QueryCache
    participant G as Grail and config APIs
    participant A as useAppAdoption
    participant R as App.tsx
    participant H as useAssessmentHistory

    U->>P: Opens the app
    P->>G: Three probes in parallel
    G-->>P: Traces entitled? Classic entities? Log metric?
    P->>C: start(adapted catalog)
    C->>K: load()
    K-->>C: Entries younger than 24h
    C->>G: Phase 1: entity-count denominators
    Note over C: Criteria with a zero or failed denominator are skipped
    loop Phase 2: unique queries, 10 workers
        alt Cache hit
            K-->>C: Cached value
        else Miss or configuration read
            C->>G: scaleQuery(query, tier) or settings and SLO read
            G-->>C: Value and scanned bytes
        end
    end
    C->>K: flush()
    C-->>R: Coverage and utilization per capability
    R->>A: Enabled once capabilities exist
    A->>G: Users per app and total users, 30 days
    A-->>R: Adoption per capability
    R->>R: withPulseScore(), total score
    R->>H: saveSnapshot() if measured and changed
    H->>H: Skip if equal to the latest run of the day
    H-->>U: Run stored (localStorage and Document Store)
```

## 3. Scoring pipeline

A criterion that cannot be measured is "not assessed" and leaves every denominator. Coverage and utilization come from `useCoverageData`, adoption from `useAppAdoption`; `withPulseScore()` averages them and `diagnose()` names the result without changing it.

```mermaid
flowchart TB
    QA["Numerator query A"] --> VAL
    QB["Denominator query B<br/>or constant"] --> VAL
    VAL{"A failed, or B is 0 or less?"}
    VAL -->|yes| NA["Not assessed<br/>(out of all denominators)"]
    VAL -->|no| V["value = floor(A / B x 1000) / 10<br/>capped at 100<br/>(raw A when there is no denominator)"]
    V --> PL{"value >= pass line?<br/>(middle threshold)"}
    PL -->|yes| MET["Met"]
    PL -->|no| UNMET["Not met"]

    MET --> COV
    UNMET --> COV
    COV["Coverage<br/>floor(met / assessed x 100)"]

    MET --> TIERS
    UNMET --> TIERS
    TIERS["Share met per tier<br/>f = Foundation, b = Best practice, e = Excellence"]
    TIERS --> GATE["effB = b if f >= 0.8, else 0<br/>effE = e if effB >= 0.6, else 0"]
    GATE --> UTIL["Utilization<br/>floor(f x 60 + effB x 25 + effE x 15)"]

    SYS["dt.system.events, 30 days<br/>distinct users per app"] --> RATE["rate = floor(max users among the<br/>capability's apps / active users x 100)"]
    RATE --> ADO["Adoption<br/>min(100, floor(rate / 20 x 100))"]

    COV --> CAP
    UTIL --> CAP
    ADO --> CAP
    CAP["Capability score<br/>floor(average of the parts)<br/>two parts when adoption is unknown"]
    CAP --> TOTAL["Overall score<br/>floor(average of capability scores)"]
    CAP --> DX["diagnose()<br/>Healthy, Skin-deep, Unwatched,<br/>Starved, Dark, Not assessed"]
    COV --> DX
    UTIL --> DX
    RATE --> DX
```

## 4. Environment adaptation: probes to catalog

Three probes decide how the catalog is rewritten before the run. The order is fixed: log metric, then trace proxy, then Smartscape. Each executed query then passes through `scaleQuery()`, which applies the scale tier and the cost rules to hot sources only.

```mermaid
flowchart TB
    START["First mount of CoverageAssessment"] --> PROBES

    subgraph PROBES["Probes, in parallel"]
        P1["logMetricAvailable()<br/>timeseries on dt.log.status_per_entity_count"]
        P2["tracesNotEntitled()<br/>fetch spans, entitlement error?"]
        P3["classicEntitiesMissing()<br/>fetch dt.entity.host, UNKNOWN_DATA_OBJECT?"]
    end

    PROBES --> BASE["CAPABILITIES<br/>(queries.ts)"]
    BASE --> D1{"Log metric found<br/>and classic entities exist?"}
    D1 -->|yes| LM["applyLogMetricMode<br/>l1, l2, l6, l7, l8, l9 read the metric"]
    D1 -->|no| D2
    LM --> D2{"Traces not entitled?"}
    D2 -->|yes| TP["applyTraceProxyMode<br/>proxied: metric or topology query<br/>no proxy: criterion removed"]
    D2 -->|no| D3
    TP --> D3{"Classic entities missing?"}
    D3 -->|yes| SM["applySmartscapeModel<br/>smartscapeNodes statements,<br/>dt.smartscape.* dimensions<br/>no equivalent: criterion removed"]
    D3 -->|no| RUN
    SM --> RUN["start(caps)"]

    RUN --> SQ{"Hot source?<br/>logs, spans, events, bizevents"}
    SQ -->|no| ASIS["Executed as written"]
    SQ -->|yes| TIER["Tier window<br/>large: 30 min, xlarge: 5 min"]
    TIER --> SAMP{"Both sides plain counts,<br/>same window?"}
    SAMP -->|yes| S1["samplingRatio: 1000"]
    SAMP -->|no| S2["Shorter window<br/>15 min, or at most 4 h"]
    S1 --> LIMIT["scanLimitGBytes: 50"]
    S2 --> LIMIT
```

## 5. Dynatrace Intelligence request

One prompt builder serves the Intelligence bar, the Smart Report and the hand-off to Assist. The app computes every number the answer may quote; the instruction is cut to 2,500 characters and the request text is kept under 9,000.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as IntelligenceBar
    participant F as pageIntelligence.ts
    participant P as reportPrompt.ts
    participant D as Davis CoPilot
    participant S as Dynatrace Assist app

    Note over B,F: The page passes its lens, questions and computed facts
    U->>B: Clicks a question
    B->>P: buildReportPrompt(ctx, question + bullet suffix)
    P->>P: buildAssessmentContext(), page facts up to 6,000 chars
    P->>P: Over 9,000 chars? Weakest criteria 4, then 2, then 0, then truncate
    P->>P: buildInstruction(): lens + rules, cut to 2,500 chars
    P-->>B: text and instruction
    B->>D: recommenderConversation(text, instruction, document-retrieval)
    alt Answer
        D-->>B: Markdown
        B-->>U: Bulleted answer, kept for this question
    else Error
        D-->>B: HTTP error
        B-->>U: Message and hint from davisError.ts
    end

    opt Go deeper in Assist
        U->>B: Clicks the button
        B->>S: sendIntent(prompt, supplementary context, instruction)
        S-->>U: Conversation in the Assist app
    end
```

## 6. Reports

The report code and jsPDF are loaded on the first click. All reports read the capability results already on screen; only the FinOps report and a cost-related Smart Report request run additional queries.

```mermaid
flowchart LR
    MENU["Reports menu<br/>(CoverageAssessment)"]
    INPUT["reportInput()<br/>capabilities, total score, adoption,<br/>history, app names, run block"]
    MENU --> INPUT

    INPUT --> PDF["generateReport(kind, input, lang)<br/>kind: overall, plan, criteria<br/>lang: en, pt, es"]
    PDF --> F1["PDF download"]

    INPUT --> RAW["exportRawData(format, input)"]
    RAW --> F2["JSON or CSV download"]

    MENU --> FIN["loadFinOpsData()<br/>bizevents from Cost & Carbon Optimization"]
    FIN --> FQ{"Data found?"}
    FQ -->|yes| FPDF["generateFinOpsReport(input, data, lang)"]
    FQ -->|no| TOAST["Toast: No FinOps data"]
    FPDF --> F3["PDF download"]

    MENU --> SMART["SmartReportModal<br/>free-text request"]
    SMART --> COST{"Request mentions cost,<br/>energy or carbon?"}
    COST -->|yes| NOTE["finopsNote() added to the context"]
    COST -->|no| ASK
    NOTE --> ASK{"Output"}
    ASK -->|Generate PDF| GEN["generateSmartReportText()<br/>Davis CoPilot"]
    GEN --> NARR["generateAiNarrativePdf()"]
    NARR --> F4["PDF download"]
    ASK -->|Open in Assist| INT["openDynatraceAssist()<br/>intent to the Assist app"]
```
