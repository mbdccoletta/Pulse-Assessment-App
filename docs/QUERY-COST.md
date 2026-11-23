# Query cost: how the assessment reads Grail

Volumes are GiB scanned (`QUERY_EXECUTION_EVENT.scanned_bytes`), the load a run
puts on Grail. The bill is a different number (`BILLING_USAGE_EVENT.billed_bytes`)
and depends on the tenant's licensing and on who runs the query. Convert volumes
with the customer's contract rate when money is needed; no list price here.

## Result (3.0.13)

| Tenant | Version | Fresh run (cache cleared) |
|---|---|---|
| Lab tenant, ~18 M log records per minute | 3.0.12, cost mode | ≈ 356 GiB |
| Lab tenant | 3.0.12, no ceiling (Dynatrace user) | ≈ 1.6 TB |
| Lab tenant | **3.0.13** | **74 GiB** (135 statements) |
| Any tenant | Reopen within 24 h | ≈ 0 (Document Store cache) |

Lab tenant, 3.0.13, heaviest statements:

| Statement | GiB |
|---|---|
| Logs, one shared 15-minute read (hosts, services, sources, levels, namespaces, error services, cloud hosts) | 45 |
| Mixed-estate host log coverage (log metric + OpenTelemetry host names) | 11 |
| Multi-source host logging (per host, 15 minutes) | 7 |
| Agent tool-call tracing (presence, 72 h) | 7 |
| Third-party security findings (24 h) | 3 |
| Structured logging (1-in-1000 sample, 2 h) | 1 |
| Everything else (metrics, Smartscape, entities, settings, system events, Davis) | ≈ 0 |

On a production estate of ~20,000 hosts every raw log or span read reaches the
50 GB ceiling: the run is bounded by about ten such reads, and the values those
reads cut are marked ≈.

## Rules the catalog follows

1. **Metrics and Smartscape first.** They answer at no scan and are what the
   platform's own apps show. Database, messaging and database-depth coverage read
   `dt.service.database.query.count` and `dt.service.messaging.*`; service-to-service
   calls read `smartscapeEdges "calls"`.
2. **One fact, one number.** A criterion that a metric answers identically to an
   existing criterion is removed rather than kept as a duplicate (a1 and a3 equal
   a7 once read from metrics).
3. **Ratios of plain counts are sampled 1-in-1000** over their whole window; the
   sample cancels out (Structured logging: 16.0% sampled, about 17% unsampled).
4. **Distinct counts are never sampled** (they collapse: 8,814 services became
   5,981 at 1-in-100). With no metric, they read a 15-minute window, and criteria
   over the same records share one scan.
5. **Presence checks keep their window** (24 h, 72 h): the window is their meaning.
6. **One shape for every user.** Same windows, sampling and 50 GB ceiling whoever
   opens the app; a cut reading is marked ≈, never silently partial.
7. **Source-agnostic.** No criterion scores the choice of OneAgent or OpenTelemetry.

## Evidence

Measured on 2026-11-22. Free sources checked service by service against the span
reading in the same fixed window (recall = services the source also finds,
precision = services it finds that spans also show):

| Criterion | Source | Recall | Precision | Decision |
|---|---|---|---|---|
| Root span coverage | `dt.service.request.count` | 99.96% | 99.97% | Equals a7 → removed |
| Database span coverage | `dt.service.database.query.count` | 98.1% | 99.4% | Metric |
| Database call depth | same, by `db.system` | 98.2% | 100% | Metric |
| Messaging span coverage | `dt.service.messaging.*` | 99.5% | 98.7% | Metric |
| Service tracing coverage | request + database + messaging metrics | 90.1% | 99.3% | Removed (equals a7 plus jobs without requests) |
| OTel instrumentation coverage | request metric with `telemetry.sdk.name` | 66% | 100% | Removed (judges the source) |
| Cloud span enrichment | request metric with `azure.*` | 37% | 100% | Removed (no source) |

What did not work: sampling distinct counts, entity lifetime as "seen in the
window" (it is already the denominator), `fieldsSnapshot` with a timeframe (returns
nothing), and the classic `calls[]` relationship (truncated on large estates).

The AI criteria keep reading spans: `gen_ai.*` metrics carry services, providers
and models but not agents, content, errors, guardrails or tool calls, and AI
spans captured without an SDK emit no metric. They read 4 hours unsampled in one
shared scan; a filter on sparse `gen_ai.*` attributes cut the scan about 26-fold
compared with counting every span.
