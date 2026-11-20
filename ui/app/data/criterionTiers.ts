// ═══════════════════════════════════════════════════════════
// Criterion Tier Classification
//
// Each criterion is classified into one of three tiers:
//   - foundation:    Essential items everyone should have (~3-4 per capability)
//   - bestPractice:  Good practices for deeper adoption (~4-5 per capability)
//   - excellence:    Advanced/mature usage patterns (~2-3 per capability)
//
// Utilization weighs the tiers 60 / 25 / 15 and gates them: Best practice
// counts once Foundation reaches 80%, Excellence once Best practice reaches 60%
// (hooks/useCoverageData.ts).
// ═══════════════════════════════════════════════════════════

export type CriterionTier = "foundation" | "bestPractice" | "excellence";

export const CRITERION_TIERS: Record<string, CriterionTier> = {
  // ─── 1. INFRASTRUCTURE OBSERVABILITY ───
  i1:  "foundation",     // Host CPU coverage
  i2:  "foundation",     // Host memory coverage
  i4:  "foundation",     // Host availability coverage
  i3:  "bestPractice",   // Host disk coverage
  i5:  "bestPractice",   // Host network coverage
  i6:  "bestPractice",   // Process CPU coverage
  i9:  "bestPractice",   // Davis problem coverage
  i7:  "excellence",     // K8s cluster coverage
  i8:  "excellence",     // Host disk entity coverage
  i10: "excellence",     // Cloud workload coverage
  i11: "bestPractice",   // Host-process topology
  i12: "excellence",     // K8s workload mapping
  // Cloud Platform Monitoring (under Infrastructure)
  i13: "bestPractice",   // Cloud host log enrichment
  i14: "bestPractice",   // Cloud log enrichment
  i15: "excellence",     // Cloud region diversity
  i16: "excellence",     // Cloud AZ diversity
  i17: "bestPractice",   // Cloud account monitoring
  i18: "excellence",     // Cloud span enrichment
  i19: "bestPractice",   // K8s node monitoring depth
  i20: "bestPractice",   // Cloud namespace metric coverage
  i21: "bestPractice",   // Container restart monitoring
  i22: "excellence",     // Container resource limits
  i23: "bestPractice",   // Problems with root cause
  i24: "excellence",     // Problems with automated response

  // ─── 2. APPLICATION OBSERVABILITY ───
  a1:  "foundation",     // Service tracing coverage
  a3:  "foundation",     // Root span coverage
  a5:  "foundation",     // Response time coverage
  a2:  "bestPractice",   // Service method coverage
  a6:  "bestPractice",   // Failure tracking coverage
  a7:  "bestPractice",   // Throughput coverage
  a4:  "excellence",     // OTel instrumentation coverage
  a8:  "excellence",     // Database span coverage
  a9:  "excellence",     // Messaging span coverage
  a10: "excellence",     // Multi-service trace depth
  a11: "bestPractice",   // Service-process mapping
  a12: "bestPractice",     // Service tagging utilization
  a13: "excellence",     // Database call depth
  a14: "bestPractice",   // Problems with root cause
  a15: "excellence",     // Problems with automated response

  // ─── 3. DIGITAL EXPERIENCE ───
  d1:  "foundation",     // RUM action coverage
  d2:  "foundation",     // Session tracking coverage
  d3:  "foundation",     // LCP coverage
  d4:  "bestPractice",   // INP coverage
  d5:  "bestPractice",   // CLS coverage
  d6:  "bestPractice",   // Frontend error coverage
  d7:  "bestPractice",   // Synthetic HTTP coverage
  d8:  "excellence",     // Synthetic browser coverage
  d9:  "excellence",     // Mobile app coverage
  d10: "excellence",     // Synthetic location diversity
  d11: "bestPractice",   // Synthetic availability coverage
  d12: "bestPractice",   // Problems with root cause
  d13: "excellence",     // Problems with automated response

  // ─── 4. LOG ANALYTICS ───
  l1:  "foundation",     // Host log coverage
  l2:  "foundation",     // Service log coverage
  l6:  "foundation",     // Log source diversity
  l3:  "bestPractice",   // Trace-correlated logs
  l4:  "bestPractice",   // Entity-enriched logs
  l7:  "bestPractice",   // Error log coverage
  l9:  "bestPractice",   // Log severity diversity
  l5:  "excellence",     // Process group log correlation
  l8:  "excellence",     // K8s log coverage
  l11: "bestPractice",     // Dedicated buckets usage
  l12: "bestPractice",   // Structured logging
  l13: "excellence",     // Span-correlated logs
  l14: "bestPractice",   // Log volume balance
  l15: "excellence",     // Log-based events
  l16: "bestPractice",   // Custom attribute enrichment

  // ─── 5. APPLICATION SECURITY ───
  s13: "foundation",  // Runtime Vulnerability Analytics active
  s1: "bestPractice",  // Runtime vulnerability coverage
  s11: "bestPractice",  // Runtime Application Protection
  s12: "bestPractice",  // Security Posture Management
  s2: "excellence",  // Third-party security findings
  t4: "foundation",  // Detection findings
  t12: "bestPractice",  // External detection sources

  // ─── 6. THREAT OBSERVABILITY ───

  // ─── 7. AI OBSERVABILITY ───
  ai1: "foundation",     // AI span service coverage
  ai2: "foundation",     // Token tracking coverage
  ai3: "bestPractice",   // AI provider diversity
  ai4: "bestPractice",   // Agent invocation coverage
  ai6: "foundation",     // AI error tracking coverage
  ai5: "excellence",     // Prompt/response tracing coverage
  ai7: "excellence",     // Guardrail coverage
  ai8: "excellence",     // Cost tracking coverage
  ai9: "excellence",     // AI tracing service breadth
  ai10: "bestPractice",  // Agent tool-call tracing
  ai18: "excellence",    // dtctl driven by AI agents
  ai12: "excellence",    // Agentic AI in use
  ai14: "excellence",    // Agentic workflows
  ai15: "bestPractice",  // Problems with root cause
  ai16: "excellence",    // Problems with automated response

  // ─── 8. BUSINESS OBSERVABILITY ───
  b1:  "foundation",     // Service bizevent coverage
  b2:  "foundation",     // Bizevent type diversity
  b3:  "foundation",     // Events with service context
  b4:  "bestPractice",   // Bizevent provider diversity
  b5:  "bestPractice",   // Revenue data coverage
  b6:  "excellence",     // Session-linked events
  b7:  "excellence",     // Trace-linked events
  b8:  "excellence",     // Cost center coverage
  b9: "bestPractice",    // Problems with root cause
  b10: "excellence",     // Problems with automated response

  // ─── 9. SOFTWARE DELIVERY ───
  sd1: "bestPractice",     // Service deployment coverage
  sd2: "foundation",   // CI/CD deployment events
  sd10: "bestPractice",    // Ownership assignment
  sd11: "bestPractice",  // Problems with root cause
  sd12: "excellence",    // Problems with automated response
  sd13: "excellence",    // Release validation (SRG)
  // ── Workflows, placed by what they do ──
  i25: "excellence",     // Infrastructure automation workflows
  d14: "excellence",     // Synthetic checks run by workflows
  t13: "excellence",     // Security automation workflows
  sd14: "excellence",    // Pipeline integration workflows
  // ── Assist, MCP and dtctl, placed by the data they read ──
  i26: "bestPractice",   // Assist, MCP and dtctl usage
  a16: "bestPractice",   // Assist, MCP and dtctl usage
  d15: "bestPractice",   // Assist, MCP and dtctl usage
  l17: "bestPractice",   // Assist, MCP and dtctl usage
  s14: "bestPractice",   // Assist, MCP and dtctl usage
  t14: "bestPractice",   // Assist, MCP and dtctl usage
  b11: "bestPractice",   // Assist, MCP and dtctl usage
  g9: "bestPractice",   // Assist, MCP and dtctl usage
  g10: "bestPractice",   // SLOs defined
  g11: "excellence",   // Custom anomaly detectors configured
  g12: "bestPractice",   // Adaptive or seasonal baselines in alerts
  l18: "bestPractice",   // Custom log pipelines configured
  s16: "bestPractice",   // Vulnerabilities with Davis assessment
  ai19: "bestPractice",   // Response model recorded
  // ── Platform Governance ──
  g2: "foundation",      // OneAgent version currency
  g3: "bestPractice",    // Host monitoring cost allocated
  g4: "bestPractice",    // Logs with security context
  g5: "bestPractice",    // Workflow execution success
  g6: "bestPractice",    // ITSM or chat integration in workflows
  g8: "excellence",      // Human approval in workflows
  // ── FinOps & Sustainability ──
  f1: "foundation",      // Cost and carbon calculation running
  f2: "foundation",      // Hosts with carbon measurement
  f3: "foundation",      // Cloud spend ingested
  f4: "bestPractice",    // Cloud spend with an owner
  f5: "bestPractice",    // Kubernetes namespaces with carbon measurement
  f6: "bestPractice",    // Hosts in active use
  f7: "excellence",      // Spend under commitment discount
  f8: "excellence",      // Energy in productive use


};
