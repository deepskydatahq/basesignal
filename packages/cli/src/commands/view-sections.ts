import type { ProductDirectory, ProductProfile } from "@basesignal/storage";
import type {
  ActivationMap,
  ActivationStage,
  StageTransition,
  ICPProfile,
  ValueMomentPriority,
  MeasurementSpec,
  LifecycleStatesResult,
  LifecycleState,
  StateCriterion,
  EntityProperty,
  ValueMoment,
  OutcomeItem,
} from "@basesignal/core";
import { EXPERIENTIAL_LENS_TYPES } from "@basesignal/core";
import { escapeHtml, renderPage, progressBar, confidenceBadge } from "./view-html.js";

// ---------------------------------------------------------------------------
// Section navigation
// ---------------------------------------------------------------------------

export const SECTION_NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: "identity", label: "Identity" },
  { id: "outcomes", label: "Possible Outcomes" },
  { id: "journey", label: "Journey" },
  { id: "icp-segments", label: "ICP Segments" },
  { id: "active-measurement", label: "Active Measurement" },
  { id: "value-moments", label: "Value Moments" },
  { id: "measurement-plan", label: "Measurement Plan" },
  { id: "performance-model", label: "Performance Model" },
];

export function renderSectionNav(analyzedSections: Set<string>): string {
  const links = SECTION_NAV_ITEMS
    .map((item) => {
      const cls = analyzedSections.has(item.id) ? "" : " dimmed";
      return `<a href="#${item.id}" class="${cls}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
  return `<nav class="section-nav">${links}</nav>`;
}

export const SCROLL_SPY_SCRIPT = `(function(){var n=document.querySelector('.section-nav');if(!n)return;var ls=n.querySelectorAll('a[href^="#"]');var cur=null;var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){cur=e.target.id}});if(cur){ls.forEach(function(l){l.classList.remove('active')});var a=n.querySelector('a[href="#'+cur+'"]');if(a)a.classList.add('active')}},{rootMargin:'-10% 0px -50% 0px',threshold:[0,0.1]});document.querySelectorAll('section[id]').forEach(function(s){o.observe(s)})})();`;

// ---------------------------------------------------------------------------
// Report header
// ---------------------------------------------------------------------------

function renderSourceMaterial(profile: ProductProfile | null): string {
  const sm = profile?.metadata?.sourceMaterial;
  if (!sm) return "";

  const cards: string[] = [];
  if (sm.pagesScanned > 0) {
    cards.push(`<div class="source-card">
      <span class="source-count">${sm.pagesScanned}</span>
      <span class="source-label">pages scanned</span>
    </div>`);
  }
  if (sm.videosFound > 0) {
    cards.push(`<div class="source-card">
      <span class="source-count">${sm.videosFound}</span>
      <span class="source-label">videos found</span>
    </div>`);
  }
  if (sm.documentsRead > 0) {
    cards.push(`<div class="source-card">
      <span class="source-count">${sm.documentsRead}</span>
      <span class="source-label">documents read</span>
    </div>`);
  }

  if (cards.length === 0) return "";
  return `\n  <div class="source-material">${cards.join("")}</div>`;
}

function renderReportHeader(profile: ProductProfile | null): string {
  const name = profile?.identity?.productName ?? "Unknown Product";
  const url = profile?.metadata?.url;
  const scannedAt = profile?.metadata?.scannedAt;
  const completeness = profile?.completeness;
  const overallConfidence = profile?.overallConfidence;

  const metaParts: string[] = [];
  if (url) metaParts.push(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
  if (scannedAt) metaParts.push(`Scanned: ${new Date(scannedAt).toISOString().split("T")[0]}`);
  if (completeness != null) metaParts.push(`${progressBar(completeness)}`);
  if (overallConfidence != null) metaParts.push(`Confidence: ${confidenceBadge(overallConfidence)}`);

  return `<div class="report-header">
  <h1>${escapeHtml(name)}</h1>
  ${metaParts.length > 0 ? `<div class="meta">${metaParts.map((p) => `<span>${p}</span>`).join("")}</div>` : ""}${renderSourceMaterial(profile)}
</div>`;
}

// ---------------------------------------------------------------------------
// Source material
// ---------------------------------------------------------------------------

interface SourceMaterialData {
  pagesScanned?: number;
  pagesLastUpdated?: number;
  documentsRead?: number;
  documentsLastUpdated?: number;
  videosWatched?: number;
  videosLastUpdated?: number;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

export function renderSourceMaterial(sm: SourceMaterialData | undefined): string {
  if (!sm) return "";

  const categories: Array<{ count: number; label: string; timestamp?: number }> = [];
  if (sm.pagesScanned && sm.pagesScanned > 0) {
    categories.push({ count: sm.pagesScanned, label: "pages scanned", timestamp: sm.pagesLastUpdated });
  }
  if (sm.documentsRead && sm.documentsRead > 0) {
    categories.push({ count: sm.documentsRead, label: "documents read", timestamp: sm.documentsLastUpdated });
  }
  if (sm.videosWatched && sm.videosWatched > 0) {
    categories.push({ count: sm.videosWatched, label: "videos watched", timestamp: sm.videosLastUpdated });
  }

  if (categories.length === 0) return "";

  const cards = categories
    .map((c) => {
      const tsLine = c.timestamp
        ? `\n      <span class="source-card-date">Last updated: ${formatTimestamp(c.timestamp)}</span>`
        : "";
      return `    <div class="source-card">
      <span class="source-card-count">${c.count}</span>
      <span class="source-card-label">${escapeHtml(c.label)}</span>${tsLine}
    </div>`;
    })
    .join("\n");

  return `<div class="source-material">\n${cards}\n</div>`;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

function renderPositioningGroups(identity: NonNullable<ProductProfile["identity"]>): string {
  const groups: Array<{ label: string; items: string[] | undefined }> = [
    { label: "Teams", items: identity.teams },
    { label: "Companies", items: identity.companies },
    { label: "Use Cases", items: identity.use_cases },
    { label: "Revenue Model", items: identity.revenue_model },
  ];

  const populated = groups.filter((g) => g.items && g.items.length > 0);
  if (populated.length === 0) return "";

  const groupHtml = populated
    .map(
      (g) =>
        `<div class="positioning-group">
      <span class="positioning-label">${escapeHtml(g.label)}</span>
      <div class="positioning-badges">${g.items!.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join(" ")}</div>
    </div>`,
    )
    .join("\n    ");

  return `\n    <div class="positioning-subsection">\n    ${groupHtml}\n    </div>`;
}

function renderIdentitySection(identity: ProductProfile["identity"]): string {
  if (!identity) {
    return `<section id="identity" class="no-data">
  <h2>Identity</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const descHtml = identity.description
    ? `<p class="identity-description">${escapeHtml(identity.description)}</p>`
    : "";

  const targetHtml = identity.targetCustomer
    ? `<div class="identity-target"><span class="identity-target-label">Target Customer</span> <span class="identity-target-value">${escapeHtml(identity.targetCustomer)}</span></div>`
    : "";

  const contextBadges: string[] = [];
  if (identity.businessModel) contextBadges.push(escapeHtml(identity.businessModel));
  if (identity.industry) contextBadges.push(escapeHtml(identity.industry));
  if (identity.companyStage) contextBadges.push(escapeHtml(identity.companyStage));
  const contextHtml = contextBadges.length > 0
    ? `<div class="identity-context">${contextBadges.map((b) => `<span class="badge">${b}</span>`).join(" ")}</div>`
    : "";

  const positioningHtml = renderPositioningGroups(identity);

  const confLine = identity.confidence != null
    ? `\n  <p class="confidence">Confidence: ${confidenceBadge(identity.confidence)}</p>`
    : "";

  return `<section id="identity">
  <h2>Identity</h2>
  <div class="identity-card">
    ${descHtml}
    ${targetHtml}
    ${contextHtml}${positioningHtml}${confLine}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

function renderOutcomesSection(outcomes: OutcomeItem[] | null): string {
  if (!outcomes || outcomes.length === 0) {
    return `<section id="outcomes" class="no-data">
  <h2>Possible Outcomes</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const contextBlock = `  <div class="outcomes-context">
    <p>Active starts after initial activation and describes the ongoing process of value delivery. As long as your product delivers value to the user, their account stays active. These outcomes describe the situation changes that indicate sustained value.</p>
  </div>`;

  const cards = outcomes
    .map((o: OutcomeItem) => {
      const narrativeHtml = `<p class="outcome-narrative">${escapeHtml(o.description)}</p>`;
      const typeBadge = `<span class="badge">${escapeHtml(o.type)}</span>`;

      let featuresHtml = "";
      if (o.linkedFeatures.length > 0) {
        featuresHtml = `\n      <h4>Features involved</h4>\n      <ul>${o.linkedFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`;
      }

      let measurementColHtml = "";
      if (o.measurement_references && o.measurement_references.length > 0) {
        const items = o.measurement_references
          .map((r) => `<li>${escapeHtml(r.entity)}.${escapeHtml(r.activity)}</li>`)
          .join("");
        measurementColHtml = `<div class="outcome-measurement">\n          <h5>Measurement</h5>\n          <ul>${items}</ul>\n        </div>`;
      }

      let metricsColHtml = "";
      if (o.suggested_metrics && o.suggested_metrics.length > 0) {
        const items = o.suggested_metrics
          .map((s) => `<li>${escapeHtml(s)}</li>`)
          .join("");
        metricsColHtml = `<div class="outcome-metrics">\n          <h5>Metrics</h5>\n          <ul>${items}</ul>\n        </div>`;
      }

      let columnsHtml = "";
      if (measurementColHtml || metricsColHtml) {
        columnsHtml = `\n      <div class="outcome-columns">\n        ${measurementColHtml}${metricsColHtml}\n      </div>`;
      }

      return `    <div class="card">
      ${narrativeHtml}
      ${typeBadge}${featuresHtml}${columnsHtml}
    </div>`;
    })
    .join("\n");

  return `<section id="outcomes">
  <h2>Possible Outcomes</h2>
${contextBlock}
${cards}
</section>`;
}

// ---------------------------------------------------------------------------
// Activation Journey
// ---------------------------------------------------------------------------

function renderJourneySection(activationMap: ActivationMap | null): string {
  if (!activationMap) {
    return `<section id="journey" class="no-data">
  <h2>Activation Journey</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  // Stage rows
  const stageRows = activationMap.stages
    .map((s: ActivationStage) => {
      const riskLevel = s.drop_off_risk.level;
      const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "medium" ? "risk-medium" : "risk-low";
      const isPrimary = s.level === activationMap.primary_activation_level;

      return `      <tr>
        <td>${s.level}${isPrimary ? ' <span class="badge badge-primary">primary</span>' : ""}</td>
        <td>${escapeHtml(s.name)}</td>
        <td><span class="badge">${escapeHtml(s.signal_strength)}</span></td>
        <td>${s.trigger_events.map((t) => escapeHtml(t)).join(", ")}</td>
        <td>${s.value_moments_unlocked.length > 0 ? s.value_moments_unlocked.length + " moment" + (s.value_moments_unlocked.length > 1 ? "s" : "") : "—"}</td>
        <td><span class="${riskClass}">${escapeHtml(riskLevel)}</span></td>
      </tr>`;
    })
    .join("\n");

  const stageTable = activationMap.stages.length > 0
    ? `  <table>
    <thead>
      <tr><th>Level</th><th>Name</th><th>Signal</th><th>Triggers</th><th>Value Moments</th><th>Drop-off Risk</th></tr>
    </thead>
    <tbody>
${stageRows}
    </tbody>
  </table>`
    : "";

  // Transition rows
  let transitionHtml = "";
  if (activationMap.transitions.length > 0) {
    const transRows = activationMap.transitions
      .map((t: StageTransition) => {
        return `      <tr>
        <td>Level ${t.from_level} &rarr; Level ${t.to_level}</td>
        <td>${t.trigger_events.map((e) => escapeHtml(e)).join(", ")}</td>
        <td>${escapeHtml(t.typical_timeframe ?? "—")}</td>
      </tr>`;
      })
      .join("\n");

    transitionHtml = `
  <h3>Transitions</h3>
  <table>
    <thead>
      <tr><th>Transition</th><th>Trigger Events</th><th>Timeframe</th></tr>
    </thead>
    <tbody>
${transRows}
    </tbody>
  </table>`;
  }

  // Activation Context
  const activationContextHtml = `
  <div class="activation-context">
    <h3>Activation Context</h3>
    <p>Activation represents the moments when users first experience meaningful value —
  the "aha moments" that transform casual visitors into engaged users. Each activation
  level represents a deeper commitment to the product, from initial exploration to
  habitual usage.</p>
  </div>`;

  // Track Activations
  const allTriggerEvents = Array.from(
    new Set(activationMap.stages.flatMap((s: ActivationStage) => s.trigger_events))
  );
  const triggerEventItems = allTriggerEvents.length > 0
    ? `<ul>${allTriggerEvents.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
    : "<p>No trigger events defined.</p>";

  const segmentItems = activationMap.stages.length > 0
    ? `<ul>${activationMap.stages.map((s: ActivationStage) => `<li>Level ${s.level}: ${escapeHtml(s.name)}</li>`).join("")}</ul>`
    : "<p>No stages defined.</p>";

  const trackActivationsHtml = `
  <h3>Track Activations</h3>
  <p>These events and properties need to be implemented and tested:</p>
  ${triggerEventItems}
  <p>Create the following segments in your analytics tool:</p>
  ${segmentItems}`;

  // Activation Metrics
  const primaryStage = activationMap.stages.find((s: ActivationStage) => s.level === activationMap.primary_activation_level);
  const primaryName = primaryStage?.name ?? "Activated";

  const metricCards = [
    {
      name: "Activation Rate",
      formula: `Accounts reaching '${primaryName}' / All new accounts`,
      interpretation: "Target: >40%. Below 25% suggests the activation criteria may be too strict or the onboarding flow has friction.",
    },
    {
      name: "Activated Subscription Rate",
      formula: "Activated accounts that subscribe / All activated accounts",
      interpretation: "If <50%, activation does not reliably indicate subscription intent. Consider revising activation criteria.",
    },
    {
      name: "Retention Comparison",
      formula: `30/60/90-day retention for '${primaryName}' users vs all users`,
      interpretation: "Activated users should retain 2-3x better. If the gap is <1.5x, the activation signal may not be meaningful.",
    },
    {
      name: "Conversion Rate Delta",
      formula: "Conversion rate of activated users minus non-activated users",
      interpretation: "A positive delta validates that activation predicts business outcomes. Target: >15 percentage points.",
    },
    {
      name: "Time to Activation",
      formula: `Median time from signup to reaching '${primaryName}'`,
      interpretation: "Shorter is better. If >7 days for most products, investigate onboarding bottlenecks.",
    },
  ];

  const metricCardHtml = metricCards
    .map(
      (card) => `    <div class="card">
      <h4>${escapeHtml(card.name)}</h4>
      <p>${escapeHtml(card.formula)}</p>
      <p class="interpretation">${escapeHtml(card.interpretation)}</p>
    </div>`
    )
    .join("\n");

  const activationMetricsHtml = `
  <h3>Activation Metrics</h3>
  <div class="metrics-grid">
${metricCardHtml}
  </div>`;

  const confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(activationMap.confidence)}</p>`;

  return `<section id="journey">
  <h2>Activation Journey</h2>
${stageTable}${transitionHtml}${activationContextHtml}${trackActivationsHtml}${activationMetricsHtml}${confLine}
</section>`;
}

// ---------------------------------------------------------------------------
// ICP Segments
// ---------------------------------------------------------------------------

function renderIcpSection(icpProfiles: ICPProfile[] | null): string {
  if (!icpProfiles || icpProfiles.length === 0) {
    return `<section id="icp-segments" class="no-data">
  <h2>ICP Segments</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const renderList = (items: string[]) =>
    items.length > 0
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : "";

  const contextBlock = `  <div class="icp-context">
  <p>Your product has different user types naturally — they will achieve different outcomes and will have different value needs. Identifying these segments helps you tailor activation paths and measure success per persona.</p>
  <p class="icp-identification">The easiest way to identify segments is to ask users during account creation.</p>
</div>`;

  const cards = icpProfiles
    .map((p: ICPProfile) => {
      let prioritiesHtml = "";
      if (p.value_moment_priorities.length > 0) {
        const rows = p.value_moment_priorities
          .map((pr: ValueMomentPriority) => `        <li>P${pr.priority}: ${escapeHtml(pr.relevance_reason)}</li>`)
          .join("\n");
        prioritiesHtml = `\n      <h4>Value Moment Priorities</h4>\n      <ul>\n${rows}\n      </ul>`;
      }

      let valueTriggersHtml = "";
      if (p.value_triggers && p.value_triggers.length > 0) {
        valueTriggersHtml = `\n      <h4>Value Triggers</h4>\n      <ul>${p.value_triggers.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
      }

      let valueMomentLevelsHtml = "";
      if (p.value_moment_levels && p.value_moment_levels.length > 0) {
        valueMomentLevelsHtml = `\n      <h4>Value Moment Levels</h4>\n      <ul>${p.value_moment_levels.map((v) => `<li><span class="badge">${escapeHtml(v.level)}</span> ${escapeHtml(v.description)}</li>`).join("")}</ul>`;
      }

      const confLine = `\n      <p class="confidence">Confidence: ${confidenceBadge(p.confidence)}</p>`;

      return `    <div class="card">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
      ${p.pain_points.length > 0 ? `<h4>Pain Points</h4>\n      ${renderList(p.pain_points)}` : ""}
      ${p.activation_triggers.length > 0 ? `<h4>Activation Triggers</h4>\n      ${renderList(p.activation_triggers)}` : ""}${valueTriggersHtml}
      ${p.success_metrics.length > 0 ? `<h4>Success Metrics</h4>\n      ${renderList(p.success_metrics)}` : ""}${prioritiesHtml}${valueMomentLevelsHtml}${confLine}
    </div>`;
    })
    .join("\n");

  return `<section id="icp-segments">
  <h2>ICP Segments</h2>
${contextBlock}
${cards}
</section>`;
}

// ---------------------------------------------------------------------------
// Value Moments
// ---------------------------------------------------------------------------

function renderValueMomentCrossRefs(m: ValueMoment): string {
  const parts: string[] = [];

  if (m.measurement_references && m.measurement_references.length > 0) {
    const badges = m.measurement_references
      .map((r) => `<span class="badge badge-measurement">${escapeHtml(r.entity)}.${escapeHtml(r.activity)}</span>`)
      .join(" ");
    parts.push(`<div class="vm-crossrefs"><span class="vm-crossref-label">Tracks:</span> ${badges}</div>`);
  }

  if (m.lifecycle_relevance && m.lifecycle_relevance.length > 0) {
    const badges = m.lifecycle_relevance
      .map((s) => `<span class="badge badge-lifecycle">${escapeHtml(s)}</span>`)
      .join(" ");
    parts.push(`<div class="vm-crossrefs"><span class="vm-crossref-label">Lifecycle:</span> ${badges}</div>`);
  }

  if (m.suggested_metrics && m.suggested_metrics.length > 0) {
    const items = m.suggested_metrics
      .map((s) => `<code>${escapeHtml(s)}</code>`)
      .join(", ");
    parts.push(`<div class="vm-crossrefs"><span class="vm-crossref-label">Metrics:</span> ${items}</div>`);
  }

  return parts.join("\n        ");
}

function renderValueMomentsSection(valueMoments: ValueMoment[] | null): string {
  if (!valueMoments || valueMoments.length === 0) {
    return `<section id="value-moments" class="no-data">
  <h2>Value Moments</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const tierLabels: Record<number, string> = { 1: "Core Value Moments", 2: "Important", 3: "Supporting" };
  const tierClasses: Record<number, string> = { 1: "vm-tier-1", 2: "vm-tier-2", 3: "vm-tier-3" };
  const grouped: Record<number, ValueMoment[]> = {};
  for (const m of valueMoments) {
    const tier = m.tier ?? 3;
    (grouped[tier] ??= []).push(m);
  }

  const totalLenses = EXPERIENTIAL_LENS_TYPES.length;
  const tierSections = [1, 2, 3]
    .filter((t) => grouped[t]?.length)
    .map((t) => {
      const label = tierLabels[t] ?? `Tier ${t}`;
      const tierClass = tierClasses[t] ?? "";
      const isOpen = t <= 2;
      const items = grouped[t]
        .map((m: ValueMoment) => {
          const details: string[] = [];
          if (m.lens_count > 0) details.push(`${m.lens_count} of ${totalLenses} lenses`);
          if (m.roles.length > 0) details.push(`Roles: ${m.roles.map((r) => escapeHtml(r)).join(", ")}`);
          if (m.product_surfaces.length > 0) details.push(`Surfaces: ${m.product_surfaces.map((s) => escapeHtml(s)).join(", ")}`);
          const crossRefs = renderValueMomentCrossRefs(m);
          return `      <div class="card ${tierClass}">
        <h4>${escapeHtml(m.name)}</h4>
        ${m.description ? `<p>${escapeHtml(m.description)}</p>` : ""}
        ${details.length > 0 ? `<p class="confidence">${details.join(" &middot; ")}</p>` : ""}
        ${crossRefs}
      </div>`;
        })
        .join("\n");
      return `    <details${isOpen ? " open" : ""}>\n      <summary>${escapeHtml(label)} <span class="badge">${grouped[t].length}</span></summary>\n${items}\n    </details>`;
    })
    .join("\n");

  return `<section id="value-moments">
  <h2>Value Moments</h2>
${tierSections}
</section>`;
}

// ---------------------------------------------------------------------------
// Measurement Plan
// ---------------------------------------------------------------------------

interface PlanEvent {
  name: string;
  properties: string[];
  sources: string[];
}

function renderMeasurementPlanSection(
  spec: MeasurementSpec | null,
  activationMap: ActivationMap | null,
  lifecycleStates: LifecycleStatesResult | null,
): string {
  if (!spec && !activationMap && !lifecycleStates) {
    return `<section id="measurement-plan" class="no-data">
  <h2>Measurement Plan</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const eventMap = new Map<string, PlanEvent>();

  const getOrCreate = (name: string): PlanEvent => {
    if (!eventMap.has(name)) {
      eventMap.set(name, { name, properties: [], sources: [] });
    }
    return eventMap.get(name)!;
  };

  const addSource = (event: PlanEvent, source: string) => {
    if (!event.sources.includes(source)) event.sources.push(source);
  };

  const addProperties = (event: PlanEvent, props: string[]) => {
    for (const p of props) {
      if (!event.properties.includes(p)) event.properties.push(p);
    }
  };

  // Step 1: From MeasurementSpec
  if (spec) {
    for (const entity of spec.perspectives.product.entities) {
      for (const activity of entity.activities) {
        const eventName = `${entity.name}.${activity.name}`;
        const planEvent = getOrCreate(eventName);
        addSource(planEvent, "measurement-spec");
        addProperties(planEvent, entity.properties.map((p: EntityProperty) => p.name));
      }
    }
  }

  // Step 2: From ActivationMap
  if (activationMap) {
    for (const stage of activationMap.stages) {
      for (const trigger of stage.trigger_events) {
        const planEvent = getOrCreate(trigger);
        addSource(planEvent, "activation");
      }
    }
  }

  // Step 3: From LifecycleStatesResult
  if (lifecycleStates) {
    for (const state of lifecycleStates.states) {
      for (const criterion of state.entry_criteria) {
        const planEvent = getOrCreate(criterion.event_name);
        addSource(planEvent, "lifecycle");
      }
      for (const trigger of state.exit_triggers) {
        const planEvent = getOrCreate(trigger.event_name);
        addSource(planEvent, "lifecycle");
      }
    }
  }

  const sortedEvents = Array.from(eventMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const sourceBadge = (source: string): string => {
    if (source === "activation") return `<span class="badge badge-primary">activation</span>`;
    if (source === "lifecycle") return `<span class="badge badge-lifecycle">lifecycle</span>`;
    return `<span class="badge">measurement-spec</span>`;
  };

  const rows = sortedEvents.map((event) => {
    const propertiesHtml = event.properties.length > 0
      ? event.properties.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")
      : "—";
    const sourcesHtml = event.sources.map(sourceBadge).join(" ");
    return `      <tr>
        <td><code>${escapeHtml(event.name)}</code></td>
        <td>${propertiesHtml}</td>
        <td>${sourcesHtml}</td>
      </tr>`;
  }).join("\n");

  return `<section id="measurement-plan">
  <h2>Measurement Plan</h2>
  <p class="measurement-plan-intro">This is your consolidated tracking implementation plan. It combines events from the measurement specification, activation triggers, and lifecycle state criteria into a single checklist for your analytics engineer.</p>
  <table>
    <thead>
      <tr><th>Event</th><th>Properties</th><th>Sources</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</section>`;
}

// ---------------------------------------------------------------------------
// Product Performance Model
// ---------------------------------------------------------------------------

export function renderProductPerformanceModel(lifecycleData: LifecycleStatesResult | null): string {
  if (!lifecycleData) {
    return `<section id="performance-model" class="no-data">
  <h2>Product Performance Model</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const renderCriteriaList = (criteria: StateCriterion[]) =>
    criteria.length > 0
      ? `<ul>${criteria.map((c) => `<li>${escapeHtml(c.event_name)}: ${escapeHtml(c.condition)}</li>`).join("")}</ul>`
      : "<span>—</span>";

  const stateRows = lifecycleData.states
    .map((s: LifecycleState) => {
      const stateCell = `<span class="state-name">${escapeHtml(s.name)}</span>${s.time_window ? ` <span class="badge">${escapeHtml(s.time_window)}</span>` : ""}`;
      const entersCell = renderCriteriaList(s.entry_criteria);
      const leavesCell = renderCriteriaList(s.exit_triggers);
      const breakdownCell = s.definition
        ? `<span class="breakdown-text">${escapeHtml(s.definition)}</span>`
        : "—";
      return `      <tr>
        <td>${stateCell}</td>
        <td>${entersCell}</td>
        <td>${leavesCell}</td>
        <td>${breakdownCell}</td>
      </tr>`;
    })
    .join("\n");

  const table = lifecycleData.states.length > 0
    ? `  <div class="performance-model">
    <table>
      <thead>
        <tr><th>State</th><th>Enters</th><th>Leaves</th><th>Breakdowns</th></tr>
      </thead>
      <tbody>
${stateRows}
      </tbody>
    </table>
  </div>`
    : "";

  const confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(lifecycleData.confidence)}</p>`;

  return `<section id="performance-model">
  <h2>Product Performance Model</h2>
  <p class="performance-model-label">Account Level</p>
${table}${confLine}
</section>`;
}

// ---------------------------------------------------------------------------
// Active Measurement
// ---------------------------------------------------------------------------

export function renderActiveMeasurementSection(
  icpProfiles: ICPProfile[] | null,
  outcomes: OutcomeItem[] | null,
  lifecycleStates: LifecycleStatesResult | null,
): string {
  if (!icpProfiles || icpProfiles.length === 0) {
    return `<section id="active-measurement" class="no-data">
  <h2>Active Measurement</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  // Collect unique measurement references from all outcomes
  const seenMeasurements = new Set<string>();
  const measurementRefs: Array<{ entity: string; activity: string }> = [];
  if (outcomes && outcomes.length > 0) {
    for (const o of outcomes) {
      if (o.measurement_references) {
        for (const ref of o.measurement_references) {
          const key = `${ref.entity}.${ref.activity}`;
          if (!seenMeasurements.has(key)) {
            seenMeasurements.add(key);
            measurementRefs.push(ref);
          }
        }
      }
    }
  }

  // Collect unique suggested metrics from all outcomes
  const seenMetrics = new Set<string>();
  const allMetrics: string[] = [];
  if (outcomes && outcomes.length > 0) {
    for (const o of outcomes) {
      if (o.suggested_metrics) {
        for (const m of o.suggested_metrics) {
          if (!seenMetrics.has(m)) {
            seenMetrics.add(m);
            allMetrics.push(m);
          }
        }
      }
    }
  }

  // Find the "Active" lifecycle state
  const activeState = lifecycleStates?.states.find((s) =>
    s.name.toLowerCase().includes("active"),
  ) ?? null;

  const cards = icpProfiles
    .map((icp: ICPProfile) => {
      // Outcomes section
      let outcomesHtml: string;
      if (!outcomes || outcomes.length === 0) {
        outcomesHtml = `<h4>Applicable Outcomes</h4>\n      <p class="not-analyzed">No outcomes generated yet</p>`;
      } else {
        const outcomeItems = outcomes
          .map((o, idx) => `<li>O${idx + 1}: ${escapeHtml(o.description)}</li>`)
          .join("");
        outcomesHtml = `<h4>Applicable Outcomes</h4>\n      <ul>${outcomeItems}</ul>`;
      }

      // Outcome columns (measurement + metrics)
      const measurementItems = measurementRefs.length > 0
        ? measurementRefs.map((r) => `<li>${escapeHtml(r.entity)}.${escapeHtml(r.activity)}</li>`).join("")
        : "<li>No measurement events defined yet</li>";

      const metricsItems = allMetrics.length > 0
        ? allMetrics.map((m) => `<li>${escapeHtml(m)}</li>`).join("")
        : "<li>No metrics defined yet</li>";

      const outcomeColumnsHtml = outcomes && outcomes.length > 0
        ? `\n      <div class="outcome-columns">
        <div class="outcome-measurement">
          <h5>Measurement needed</h5>
          <ul>${measurementItems}</ul>
        </div>
        <div class="outcome-metrics">
          <h5>Metrics to verify</h5>
          <ul>${metricsItems}</ul>
        </div>
      </div>`
        : "";

      // Is active when section
      let activeWhenHtml: string;
      if (!activeState || activeState.entry_criteria.length === 0) {
        activeWhenHtml = `<ul><li>No activity rule defined yet</li></ul>`;
      } else {
        const criteriaItems = activeState.entry_criteria
          .map((c) => `<li>${escapeHtml(c.event_name)}: ${escapeHtml(c.condition)}</li>`)
          .join("");
        activeWhenHtml = `<ul>${criteriaItems}</ul>`;
      }

      return `    <div class="card">
      <h3>${escapeHtml(icp.name)}</h3>
      ${outcomesHtml}${outcomeColumnsHtml}
      <div class="active-when">
        <h4>Is active when</h4>
        ${activeWhenHtml}
      </div>
    </div>`;
    })
    .join("\n");

  return `<section id="active-measurement">
  <h2>Active Measurement</h2>
  <div class="active-measurement-context">
    <p>This section brings it all together. For each user segment, it maps the outcomes they should achieve, the events needed to measure progress, and the activity patterns that indicate ongoing engagement.</p>
  </div>
${cards}
</section>`;
}

// ---------------------------------------------------------------------------
// Product report (orchestrator)
// ---------------------------------------------------------------------------

export function renderProductReport(slug: string, productDir: ProductDirectory): string {
  const profile = productDir.readJson<ProductProfile>(slug, "profile.json");

  // Backfill source material stats from crawl metadata for older scans
  if (profile?.metadata && !profile.metadata.sourceMaterial) {
    const crawlMeta = productDir.readJson<Record<string, unknown>>(slug, "crawl/metadata.json");
    if (crawlMeta?.sourceMaterial) {
      profile.metadata.sourceMaterial = crawlMeta.sourceMaterial as NonNullable<NonNullable<ProductProfile["metadata"]>["sourceMaterial"]>;
    } else if (typeof crawlMeta?.pageCount === "number") {
      profile.metadata.sourceMaterial = {
        pagesScanned: crawlMeta.pageCount,
        documentsRead: 0,
        videosFound: 0,
      };
    }
  }

  const activationMap = productDir.readJson<ActivationMap>(slug, "outputs/activation-map.json");
  const icpProfiles = productDir.readJson<ICPProfile[]>(slug, "outputs/icp-profiles.json");
  const valueMoments = productDir.readJson<ValueMoment[]>(slug, "outputs/value-moments.json")
    ?? productDir.readJson<ValueMoment[]>(slug, "convergence/value-moments.json");
  const measurementSpec = productDir.readJson<MeasurementSpec>(slug, "outputs/measurement-spec.json");
  const lifecycleStates = productDir.readJson<LifecycleStatesResult>(slug, "outputs/lifecycle-states.json");
  const outcomes = productDir.readJson<OutcomeItem[]>(slug, "outputs/outcomes.json")
    ?? (profile?.outcomes?.items ?? null);

  // Track which sections have data for nav styling
  const analyzed = new Set<string>();
  if (profile?.identity) analyzed.add("identity");
  if (outcomes && outcomes.length > 0) analyzed.add("outcomes");
  if (activationMap) analyzed.add("journey");
  if (icpProfiles && icpProfiles.length > 0) analyzed.add("icp-segments");
  if (icpProfiles && icpProfiles.length > 0 && outcomes && outcomes.length > 0) analyzed.add("active-measurement");
  if (valueMoments && valueMoments.length > 0) analyzed.add("value-moments");
  if (measurementSpec || activationMap || lifecycleStates) analyzed.add("measurement-plan");
  if (lifecycleStates) analyzed.add("performance-model");

  const sections = [
    `<p class="back-link"><a href="/">&larr; Back to product list</a></p>`,
    renderReportHeader(profile),
    renderSourceMaterial(profile?.sourceMaterial as SourceMaterialData | undefined),
    renderSectionNav(analyzed),
    renderIdentitySection(profile?.identity),
    renderProductPerformanceModel(lifecycleStates),
    renderOutcomesSection(outcomes),
    renderJourneySection(activationMap),
    renderIcpSection(icpProfiles),
    renderActiveMeasurementSection(icpProfiles, outcomes, lifecycleStates),
    renderValueMomentsSection(valueMoments),
    renderMeasurementPlanSection(measurementSpec, activationMap, lifecycleStates),
  ];

  return renderPage(
    profile?.identity?.productName ?? slug,
    sections.join("\n"),
    { script: SCROLL_SPY_SCRIPT },
  );
}
