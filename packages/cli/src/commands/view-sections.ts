import type { ProductDirectory, ProductProfile } from "@basesignal/storage";
import type {
  ActivationMap,
  ActivationStage,
  StageTransition,
  ICPProfile,
  ValueMomentPriority,
  MeasurementSpec,
  ProductEntity,
  CustomerEntity,
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
  { id: "measurement-spec", label: "Measurement Spec" },
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
  ${metaParts.length > 0 ? `<div class="meta">${metaParts.map((p) => `<span>${p}</span>`).join("")}</div>` : ""}
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
// Measurement Spec
// ---------------------------------------------------------------------------

function renderPropertyTable(properties: EntityProperty[]): string {
  if (properties.length === 0) return "";
  const propRows = properties
    .map((p) => `          <tr><td>${escapeHtml(p.name)}</td><td><span class="badge">${escapeHtml(p.type)}</span></td><td>${p.isRequired ? "yes" : ""}</td><td>${escapeHtml(p.description)}</td></tr>`)
    .join("\n");
  return `
        <table>
          <thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
          <tbody>
${propRows}
          </tbody>
        </table>`;
}

function renderProductEntities(entities: ProductEntity[]): string {
  if (entities.length === 0) return "<p>No entities defined.</p>";
  return entities
    .map((e) => {
      const heartbeatBadge = e.isHeartbeat ? ' <span class="badge">heartbeat</span>' : "";
      let activitiesHtml = "";
      if (e.activities.length > 0) {
        const actItems = e.activities
          .map((a) => `<li>${escapeHtml(a.name)}${a.properties_supported.length > 0 ? ` (${a.properties_supported.map((s) => escapeHtml(s)).join(", ")})` : ""}</li>`)
          .join("");
        activitiesHtml = `\n        <h5>Activities</h5>\n        <ul>${actItems}</ul>`;
      }
      return `      <div class="card">
        <h4>${escapeHtml(e.name)}${heartbeatBadge}</h4>
        ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}${activitiesHtml}${renderPropertyTable(e.properties)}
      </div>`;
    })
    .join("\n");
}

function renderCustomerEntities(entities: CustomerEntity[]): string {
  if (entities.length === 0) return "<p>No entities defined.</p>";
  return entities
    .map((e) => {
      let activitiesHtml = "";
      if (e.activities.length > 0) {
        const actItems = e.activities
          .map((a) => `<li>${escapeHtml(a.name)}${a.derivation_rule ? ` — <em>${escapeHtml(a.derivation_rule)}</em>` : ""}</li>`)
          .join("");
        activitiesHtml = `\n        <h5>Activities</h5>\n        <ul>${actItems}</ul>`;
      }
      return `      <div class="card">
        <h4>${escapeHtml(e.name)}</h4>${activitiesHtml}${renderPropertyTable(e.properties)}
      </div>`;
    })
    .join("\n");
}


function renderMeasurementSpecSection(spec: MeasurementSpec | null): string {
  if (!spec) {
    return `<section id="measurement-spec" class="no-data">
  <h2>Measurement Spec</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const perspectivesHtml = [
    `    <h3>Product Perspective</h3>\n${renderProductEntities(spec.perspectives.product.entities)}`,
    `    <h3>Customer Perspective</h3>\n${renderCustomerEntities(spec.perspectives.customer.entities)}`,
  ].join("\n");

  let warningsHtml = "";
  if (spec.warnings && spec.warnings.length > 0) {
    warningsHtml = `\n  <div class="warnings"><h4>Warnings</h4><ul>${spec.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`;
  }

  const confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(spec.confidence)}</p>`;

  return `<section id="measurement-spec">
  <h2>Measurement Spec</h2>
${perspectivesHtml}${warningsHtml}${confLine}
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
  if (measurementSpec) analyzed.add("measurement-spec");
  if (lifecycleStates) analyzed.add("lifecycle-states");

  const sections = [
    `<p class="back-link"><a href="/">&larr; Back to product list</a></p>`,
    renderReportHeader(profile),
    renderSourceMaterial(profile?.sourceMaterial as SourceMaterialData | undefined),
    renderSectionNav(analyzed),
    renderIdentitySection(profile?.identity),
    renderOutcomesSection(outcomes),
    renderJourneySection(activationMap),
    renderIcpSection(icpProfiles),
    renderValueMomentsSection(valueMoments),
    renderMeasurementSpecSection(measurementSpec),
    renderLifecycleStatesSection(lifecycleStates),
  ];

  return renderPage(
    profile?.identity?.productName ?? slug,
    sections.join("\n"),
    { script: SCROLL_SPY_SCRIPT },
  );
}
