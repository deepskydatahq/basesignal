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
  StateTransition,
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
  { id: "outcomes", label: "Outcomes" },
  { id: "journey", label: "Journey" },
  { id: "icp-profiles", label: "ICP Profiles" },
  { id: "value-moments", label: "Value Moments" },
  { id: "measurement-plan", label: "Measurement Plan" },
  { id: "lifecycle-states", label: "Lifecycle States" },
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
// Identity
// ---------------------------------------------------------------------------

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

  const confLine = identity.confidence != null
    ? `\n  <p class="confidence">Confidence: ${confidenceBadge(identity.confidence)}</p>`
    : "";

  return `<section id="identity">
  <h2>Identity</h2>
  <div class="identity-card">
    ${descHtml}
    ${targetHtml}
    ${contextHtml}${confLine}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

function renderOutcomesSection(outcomes: OutcomeItem[] | null): string {
  if (!outcomes || outcomes.length === 0) {
    return `<section id="outcomes" class="no-data">
  <h2>Outcomes</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const cards = outcomes
    .map((o: OutcomeItem) => {
      const typeBadge = `<span class="badge">${escapeHtml(o.type)}</span>`;

      let linkedHtml = "";
      if (o.linkedFeatures.length > 0) {
        linkedHtml = `\n      <h4>Linked Features</h4>\n      <ul>${o.linkedFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`;
      }

      let measurementHtml = "";
      if (o.measurement_references && o.measurement_references.length > 0) {
        const badges = o.measurement_references
          .map((r) => `<span class="badge badge-measurement">${escapeHtml(r.entity)}.${escapeHtml(r.activity)}</span>`)
          .join(" ");
        measurementHtml = `\n      <div class="vm-crossrefs"><span class="vm-crossref-label">Tracks:</span> ${badges}</div>`;
      }

      let metricsHtml = "";
      if (o.suggested_metrics && o.suggested_metrics.length > 0) {
        const items = o.suggested_metrics
          .map((s) => `<code>${escapeHtml(s)}</code>`)
          .join(", ");
        metricsHtml = `\n      <div class="vm-crossrefs"><span class="vm-crossref-label">Metrics:</span> ${items}</div>`;
      }

      return `    <div class="card">
      <h3>${escapeHtml(o.description)}</h3>
      ${typeBadge}${linkedHtml}${measurementHtml}${metricsHtml}
    </div>`;
    })
    .join("\n");

  return `<section id="outcomes">
  <h2>Outcomes</h2>
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

  const confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(activationMap.confidence)}</p>`;

  return `<section id="journey">
  <h2>Activation Journey</h2>
${stageTable}${transitionHtml}${confLine}
</section>`;
}

// ---------------------------------------------------------------------------
// ICP Profiles
// ---------------------------------------------------------------------------

function renderIcpSection(icpProfiles: ICPProfile[] | null): string {
  if (!icpProfiles || icpProfiles.length === 0) {
    return `<section id="icp-profiles" class="no-data">
  <h2>ICP Profiles</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const renderList = (items: string[]) =>
    items.length > 0
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : "";

  const cards = icpProfiles
    .map((p: ICPProfile) => {
      let prioritiesHtml = "";
      if (p.value_moment_priorities.length > 0) {
        const rows = p.value_moment_priorities
          .map((pr: ValueMomentPriority) => `        <li>P${pr.priority}: ${escapeHtml(pr.relevance_reason)}</li>`)
          .join("\n");
        prioritiesHtml = `\n      <h4>Value Moment Priorities</h4>\n      <ul>\n${rows}\n      </ul>`;
      }

      const confLine = `\n      <p class="confidence">Confidence: ${confidenceBadge(p.confidence)}</p>`;

      return `    <div class="card">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
      ${p.pain_points.length > 0 ? `<h4>Pain Points</h4>\n      ${renderList(p.pain_points)}` : ""}
      ${p.activation_triggers.length > 0 ? `<h4>Activation Triggers</h4>\n      ${renderList(p.activation_triggers)}` : ""}
      ${p.success_metrics.length > 0 ? `<h4>Success Metrics</h4>\n      ${renderList(p.success_metrics)}` : ""}${prioritiesHtml}${confLine}
    </div>`;
    })
    .join("\n");

  return `<section id="icp-profiles">
  <h2>ICP Profiles</h2>
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
// Lifecycle States
// ---------------------------------------------------------------------------

function renderLifecycleStatesSection(lifecycleData: LifecycleStatesResult | null): string {
  if (!lifecycleData) {
    return `<section id="lifecycle-states" class="no-data">
  <h2>Lifecycle States</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const renderCriteria = (criteria: StateCriterion[]) =>
    criteria.length > 0
      ? `<ul>${criteria.map((c) => `<li>${escapeHtml(c.event_name)}: ${escapeHtml(c.condition)}</li>`).join("")}</ul>`
      : "";

  const stateCards = lifecycleData.states
    .map((s: LifecycleState) => {
      return `    <div class="card">
      <h3>${escapeHtml(s.name)}${s.time_window ? ` <span class="badge">${escapeHtml(s.time_window)}</span>` : ""}</h3>
      <p>${escapeHtml(s.definition)}</p>
      ${s.entry_criteria.length > 0 ? `<h4>Entry Criteria</h4>\n      ${renderCriteria(s.entry_criteria)}` : ""}
      ${s.exit_triggers.length > 0 ? `<h4>Exit Triggers</h4>\n      ${renderCriteria(s.exit_triggers)}` : ""}
    </div>`;
    })
    .join("\n");

  let transitionsHtml = "";
  if (lifecycleData.transitions.length > 0) {
    const transRows = lifecycleData.transitions
      .map((t: StateTransition) => {
        return `      <tr>
        <td>${escapeHtml(t.from_state)} &rarr; ${escapeHtml(t.to_state)}</td>
        <td>${t.trigger_conditions.map((c) => escapeHtml(c)).join(", ")}</td>
        <td>${escapeHtml(t.typical_timeframe ?? "—")}</td>
      </tr>`;
      })
      .join("\n");

    transitionsHtml = `
  <h3>Transitions</h3>
  <table>
    <thead><tr><th>Transition</th><th>Trigger Conditions</th><th>Timeframe</th></tr></thead>
    <tbody>
${transRows}
    </tbody>
  </table>`;
  }

  const confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(lifecycleData.confidence)}</p>`;

  return `<section id="lifecycle-states">
  <h2>Lifecycle States</h2>
${stateCards}${transitionsHtml}${confLine}
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
  if (icpProfiles && icpProfiles.length > 0) analyzed.add("icp-profiles");
  if (valueMoments && valueMoments.length > 0) analyzed.add("value-moments");
  if (measurementSpec || activationMap || lifecycleStates) analyzed.add("measurement-plan");
  if (lifecycleStates) analyzed.add("lifecycle-states");

  const sections = [
    `<p class="back-link"><a href="/">&larr; Back to product list</a></p>`,
    renderReportHeader(profile),
    renderSectionNav(analyzed),
    renderIdentitySection(profile?.identity),
    renderOutcomesSection(outcomes),
    renderJourneySection(activationMap),
    renderIcpSection(icpProfiles),
    renderValueMomentsSection(valueMoments),
    renderMeasurementPlanSection(measurementSpec, activationMap, lifecycleStates),
    renderLifecycleStatesSection(lifecycleStates),
  ];

  return renderPage(
    profile?.identity?.productName ?? slug,
    sections.join("\n"),
    { script: SCROLL_SPY_SCRIPT },
  );
}
