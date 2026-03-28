import type { ProductDirectory, ProductProfile } from "@basesignal/storage";
import type {
  ActivationMap,
  ICPProfile,
  ValueMoment,
  MeasurementSpec,
  LifecycleStatesResult,
  OutcomeItem,
} from "@basesignal/core";
import { escapeHtml, renderPage, confidenceBadge } from "./view-html.js";
import { SCROLL_SPY_SCRIPT, renderSectionNav } from "./view-sections.js";

// ---------------------------------------------------------------------------
// Comparison data structures
// ---------------------------------------------------------------------------

export interface ComparisonData {
  slug: string;
  name: string;
  profile: ProductProfile | null;
  activationMap: ActivationMap | null;
  icpProfiles: ICPProfile[] | null;
  valueMoments: ValueMoment[] | null;
  measurementSpec: MeasurementSpec | null;
  lifecycleStates: LifecycleStatesResult | null;
  outcomes: OutcomeItem[] | null;
}

// ---------------------------------------------------------------------------
// Data loader
// ---------------------------------------------------------------------------

export function loadComparisonData(slug: string, productDir: ProductDirectory): ComparisonData {
  const profile = productDir.readJson<ProductProfile>(slug, "profile.json");
  const activationMap = productDir.readJson<ActivationMap>(slug, "outputs/activation-map.json");
  const icpProfiles = productDir.readJson<ICPProfile[]>(slug, "outputs/icp-profiles.json");
  const valueMoments = productDir.readJson<ValueMoment[]>(slug, "outputs/value-moments.json")
    ?? productDir.readJson<ValueMoment[]>(slug, "convergence/value-moments.json");
  const measurementSpec = productDir.readJson<MeasurementSpec>(slug, "outputs/measurement-spec.json");
  const lifecycleStates = productDir.readJson<LifecycleStatesResult>(slug, "outputs/lifecycle-states.json");
  const outcomes = productDir.readJson<OutcomeItem[]>(slug, "outputs/outcomes.json")
    ?? (profile?.outcomes?.items ?? null);

  return {
    slug,
    name: profile?.identity?.productName ?? slug,
    profile,
    activationMap,
    icpProfiles,
    valueMoments,
    measurementSpec,
    lifecycleStates,
    outcomes,
  };
}

// ---------------------------------------------------------------------------
// Comparison CSS
// ---------------------------------------------------------------------------

const COMPARISON_CSS = `
    .compare-layout { max-width: 1400px; margin: 0 auto; }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    .compare-column { min-width: 0; }
    .compare-label { font-weight: 600; font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px 6px 0 0; margin-bottom: 0.5rem; }
    .compare-label-left { background: #dbeafe; color: #1e40af; border-left: 3px solid #2563eb; }
    .compare-label-right { background: #ede9fe; color: #5b21b6; border-left: 3px solid #7c3aed; }
    .badge-shared { background: #d1fae5; color: #065f46; }
    .compare-layout body, .compare-layout { max-width: 1400px; }
    .compare-header { margin-bottom: 2rem; }
    .compare-header h1 { font-size: 1.5rem; }
    .compare-header .meta { font-size: 0.85rem; color: #6b7280; }
    .compare-section-title { font-size: 1.35rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.4rem; margin-bottom: 1rem; margin-top: 2rem; }
    .compare-section-title::before { content: '\\2713  '; color: #059669; font-size: 0.9em; }
    .compare-empty .compare-section-title::before { content: '\\2014  '; color: #9ca3af; }
`;

// ---------------------------------------------------------------------------
// Section renderers (comparison)
// ---------------------------------------------------------------------------

function notAnalyzed(): string {
  return `<p class="not-analyzed">Not yet analyzed</p>`;
}

function renderSideColumn(left: string, right: string, leftName: string, rightName: string): string {
  return `<div class="compare-grid">
  <div class="compare-column">
    <div class="compare-label compare-label-left">${escapeHtml(leftName)}</div>
    ${left}
  </div>
  <div class="compare-column">
    <div class="compare-label compare-label-right">${escapeHtml(rightName)}</div>
    ${right}
  </div>
</div>`;
}

// Identity comparison
export function renderIdentityComparison(left: ComparisonData, right: ComparisonData): string {
  const renderIdentityCard = (data: ComparisonData): string => {
    const identity = data.profile?.identity;
    if (!identity) return notAnalyzed();

    const parts: string[] = [];
    if (identity.description) parts.push(`<p class="identity-description">${escapeHtml(identity.description)}</p>`);
    if (identity.targetCustomer) {
      parts.push(`<div class="identity-target"><span class="identity-target-label">Target Customer</span> <span class="identity-target-value">${escapeHtml(identity.targetCustomer)}</span></div>`);
    }
    const badges: string[] = [];
    if (identity.businessModel) badges.push(escapeHtml(identity.businessModel));
    if (identity.industry) badges.push(escapeHtml(identity.industry));
    if (identity.companyStage) badges.push(escapeHtml(identity.companyStage));
    if (badges.length > 0) {
      parts.push(`<div class="identity-context">${badges.map((b) => `<span class="badge">${b}</span>`).join(" ")}</div>`);
    }
    if (identity.confidence != null) {
      parts.push(`<p class="confidence">Confidence: ${confidenceBadge(identity.confidence)}</p>`);
    }
    return `<div class="identity-card">${parts.join("\n    ")}</div>`;
  };

  const hasData = left.profile?.identity || right.profile?.identity;
  const cls = hasData ? "" : " compare-empty";
  return `<section id="identity"${cls}>
  <h2 class="compare-section-title">Identity</h2>
  ${renderSideColumn(renderIdentityCard(left), renderIdentityCard(right), left.name, right.name)}
</section>`;
}

// Outcomes comparison
export function renderOutcomesComparison(left: ComparisonData, right: ComparisonData): string {
  const renderOutcomesSide = (outcomes: OutcomeItem[] | null): string => {
    if (!outcomes || outcomes.length === 0) return notAnalyzed();
    return outcomes.map((o) => {
      const typeBadge = `<span class="badge">${escapeHtml(o.type)}</span>`;
      const features = o.linkedFeatures.length > 0
        ? `<ul>${o.linkedFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
        : "";
      return `<div class="card">
      <h4>${escapeHtml(o.description)}</h4>
      ${typeBadge}${features}
    </div>`;
    }).join("\n");
  };

  const hasData = (left.outcomes && left.outcomes.length > 0) || (right.outcomes && right.outcomes.length > 0);
  const cls = hasData ? "" : " compare-empty";
  return `<section id="outcomes"${cls}>
  <h2 class="compare-section-title">Outcomes</h2>
  ${renderSideColumn(renderOutcomesSide(left.outcomes), renderOutcomesSide(right.outcomes), left.name, right.name)}
</section>`;
}

// Journey comparison
export function renderJourneyComparison(left: ComparisonData, right: ComparisonData): string {
  const renderJourneySide = (map: ActivationMap | null): string => {
    if (!map) return notAnalyzed();
    const stageCount = map.stages.length;
    const primaryLevel = map.primary_activation_level;
    const summary = `<p><strong>${stageCount} stage${stageCount !== 1 ? "s" : ""}</strong>, primary activation at level ${primaryLevel}</p>`;
    const stageList = map.stages.map((s) => {
      const isPrimary = s.level === primaryLevel;
      return `<div class="card">
        <h4>Level ${s.level}: ${escapeHtml(s.name)}${isPrimary ? ' <span class="badge badge-primary">primary</span>' : ""}</h4>
        <p>Signal: <span class="badge">${escapeHtml(s.signal_strength)}</span>, Drop-off: <span class="${s.drop_off_risk.level === "high" ? "risk-high" : s.drop_off_risk.level === "medium" ? "risk-medium" : "risk-low"}">${escapeHtml(s.drop_off_risk.level)}</span></p>
      </div>`;
    }).join("\n    ");
    return `${summary}\n    ${stageList}\n    <p class="confidence">Confidence: ${confidenceBadge(map.confidence)}</p>`;
  };

  const hasData = left.activationMap || right.activationMap;
  const cls = hasData ? "" : " compare-empty";
  return `<section id="journey"${cls}>
  <h2 class="compare-section-title">Activation Journey</h2>
  ${renderSideColumn(renderJourneySide(left.activationMap), renderJourneySide(right.activationMap), left.name, right.name)}
</section>`;
}

// ICP Profiles comparison with shared pain point highlighting
export function renderIcpComparison(left: ComparisonData, right: ComparisonData): string {
  // Collect all pain points from both sides for shared detection
  const leftPainPoints = new Set((left.icpProfiles ?? []).flatMap((p) => p.pain_points.map((pp) => pp.toLowerCase())));
  const rightPainPoints = new Set((right.icpProfiles ?? []).flatMap((p) => p.pain_points.map((pp) => pp.toLowerCase())));

  const renderIcpSide = (profiles: ICPProfile[] | null, otherPainPoints: Set<string>): string => {
    if (!profiles || profiles.length === 0) return notAnalyzed();
    return profiles.map((p) => {
      const painPointsHtml = p.pain_points.length > 0
        ? `<h5>Pain Points</h5><ul>${p.pain_points.map((pp) => {
            const isShared = otherPainPoints.has(pp.toLowerCase());
            return `<li>${escapeHtml(pp)}${isShared ? ' <span class="badge badge-shared">Shared</span>' : ""}</li>`;
          }).join("")}</ul>`
        : "";
      const triggersHtml = p.activation_triggers.length > 0
        ? `<h5>Triggers</h5><ul>${p.activation_triggers.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
        : "";
      return `<div class="card">
        <h4>${escapeHtml(p.name)}</h4>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        ${painPointsHtml}${triggersHtml}
        <p class="confidence">Confidence: ${confidenceBadge(p.confidence)}</p>
      </div>`;
    }).join("\n    ");
  };

  const hasData = (left.icpProfiles && left.icpProfiles.length > 0) || (right.icpProfiles && right.icpProfiles.length > 0);
  const cls = hasData ? "" : " compare-empty";
  return `<section id="icp-profiles"${cls}>
  <h2 class="compare-section-title">ICP Profiles</h2>
  ${renderSideColumn(renderIcpSide(left.icpProfiles, rightPainPoints), renderIcpSide(right.icpProfiles, leftPainPoints), left.name, right.name)}
</section>`;
}

// Value Moments comparison with tier summaries
export function renderValueMomentsComparison(left: ComparisonData, right: ComparisonData): string {
  const renderVmSide = (moments: ValueMoment[] | null): string => {
    if (!moments || moments.length === 0) return notAnalyzed();
    const grouped: Record<number, ValueMoment[]> = {};
    for (const m of moments) {
      const tier = m.tier ?? 3;
      (grouped[tier] ??= []).push(m);
    }
    const tierLabels: Record<number, string> = { 1: "Core", 2: "Important", 3: "Supporting" };
    const summary = [1, 2, 3]
      .filter((t) => grouped[t]?.length)
      .map((t) => `<span class="badge">${tierLabels[t]}: ${grouped[t].length}</span>`)
      .join(" ");
    const list = moments.slice(0, 5).map((m) => {
      return `<div class="card vm-tier-${m.tier ?? 3}">
        <h4>${escapeHtml(m.name)}</h4>
        ${m.description ? `<p>${escapeHtml(m.description)}</p>` : ""}
      </div>`;
    }).join("\n    ");
    const more = moments.length > 5 ? `<p class="confidence">and ${moments.length - 5} more...</p>` : "";
    return `<p>${summary}</p>\n    ${list}\n    ${more}`;
  };

  const hasData = (left.valueMoments && left.valueMoments.length > 0) || (right.valueMoments && right.valueMoments.length > 0);
  const cls = hasData ? "" : " compare-empty";
  return `<section id="value-moments"${cls}>
  <h2 class="compare-section-title">Value Moments</h2>
  ${renderSideColumn(renderVmSide(left.valueMoments), renderVmSide(right.valueMoments), left.name, right.name)}
</section>`;
}

// Measurement Spec comparison with shared entity highlighting
export function renderMeasurementSpecComparison(left: ComparisonData, right: ComparisonData): string {
  const getEntityNames = (spec: MeasurementSpec | null): Set<string> => {
    if (!spec) return new Set();
    const names = new Set<string>();
    for (const e of spec.perspectives.product.entities) names.add(e.name.toLowerCase());
    for (const e of spec.perspectives.interaction.entities) names.add(e.name.toLowerCase());
    return names;
  };

  const leftEntities = getEntityNames(left.measurementSpec);
  const rightEntities = getEntityNames(right.measurementSpec);

  const renderSpecSide = (spec: MeasurementSpec | null, otherEntities: Set<string>): string => {
    if (!spec) return notAnalyzed();
    const allEntities = [
      ...spec.perspectives.product.entities.map((e) => ({ ...e, perspective: "product" as const })),
      ...spec.perspectives.interaction.entities.map((e) => ({ ...e, perspective: "interaction" as const })),
    ];
    const entityCount = allEntities.length;
    const breakdown: string[] = [];
    if (spec.perspectives.product.entities.length > 0) {
      breakdown.push(`${spec.perspectives.product.entities.length} product`);
    }
    if (spec.perspectives.interaction.entities.length > 0) {
      breakdown.push(`${spec.perspectives.interaction.entities.length} interaction`);
    }
    const summary = `<p><strong>${entityCount} entit${entityCount !== 1 ? "ies" : "y"}</strong>${breakdown.length ? ` (${breakdown.join(", ")})` : ""}</p>`;
    const entityList = allEntities.map((e) => {
      const isShared = otherEntities.has(e.name.toLowerCase());
      return `<div class="card">
        <h4>${escapeHtml(e.name)}${isShared ? ' <span class="badge badge-shared">Shared</span>' : ""} <span class="badge">${escapeHtml(e.perspective)}</span></h4>
      </div>`;
    }).join("\n    ");
    return `${summary}\n    ${entityList}\n    <p class="confidence">Confidence: ${confidenceBadge(spec.confidence)}</p>`;
  };

  const hasData = left.measurementSpec || right.measurementSpec;
  const cls = hasData ? "" : " compare-empty";
  return `<section id="measurement-spec"${cls}>
  <h2 class="compare-section-title">Measurement Spec</h2>
  ${renderSideColumn(renderSpecSide(left.measurementSpec, rightEntities), renderSpecSide(right.measurementSpec, leftEntities), left.name, right.name)}
</section>`;
}

// Lifecycle States comparison with shared state highlighting
export function renderLifecycleComparison(left: ComparisonData, right: ComparisonData): string {
  const getStateNames = (data: LifecycleStatesResult | null): Set<string> => {
    if (!data) return new Set();
    return new Set(data.states.map((s) => s.name.toLowerCase()));
  };

  const leftStates = getStateNames(left.lifecycleStates);
  const rightStates = getStateNames(right.lifecycleStates);

  const renderLifecycleSide = (data: LifecycleStatesResult | null, otherStates: Set<string>): string => {
    if (!data) return notAnalyzed();
    const stateCount = data.states.length;
    const summary = `<p><strong>${stateCount} state${stateCount !== 1 ? "s" : ""}</strong></p>`;
    const stateList = data.states.map((s) => {
      const isShared = otherStates.has(s.name.toLowerCase());
      return `<div class="card">
        <h4>${escapeHtml(s.name)}${isShared ? ' <span class="badge badge-shared">Shared</span>' : ""}${s.time_window ? ` <span class="badge">${escapeHtml(s.time_window)}</span>` : ""}</h4>
        <p>${escapeHtml(s.definition)}</p>
      </div>`;
    }).join("\n    ");
    return `${summary}\n    ${stateList}\n    <p class="confidence">Confidence: ${confidenceBadge(data.confidence)}</p>`;
  };

  const hasData = left.lifecycleStates || right.lifecycleStates;
  const cls = hasData ? "" : " compare-empty";
  return `<section id="lifecycle-states"${cls}>
  <h2 class="compare-section-title">Lifecycle States</h2>
  ${renderSideColumn(renderLifecycleSide(left.lifecycleStates, rightStates), renderLifecycleSide(right.lifecycleStates, leftStates), left.name, right.name)}
</section>`;
}

// ---------------------------------------------------------------------------
// Comparison report orchestrator
// ---------------------------------------------------------------------------

export function renderComparisonReport(slug1: string, slug2: string, productDir: ProductDirectory): string {
  const left = loadComparisonData(slug1, productDir);
  const right = loadComparisonData(slug2, productDir);

  // Track which sections have data for nav styling
  const analyzed = new Set<string>();
  if (left.profile?.identity || right.profile?.identity) analyzed.add("identity");
  if ((left.outcomes && left.outcomes.length > 0) || (right.outcomes && right.outcomes.length > 0)) analyzed.add("outcomes");
  if (left.activationMap || right.activationMap) analyzed.add("journey");
  if ((left.icpProfiles && left.icpProfiles.length > 0) || (right.icpProfiles && right.icpProfiles.length > 0)) analyzed.add("icp-profiles");
  if ((left.valueMoments && left.valueMoments.length > 0) || (right.valueMoments && right.valueMoments.length > 0)) analyzed.add("value-moments");
  if (left.measurementSpec || right.measurementSpec) analyzed.add("measurement-spec");
  if (left.lifecycleStates || right.lifecycleStates) analyzed.add("lifecycle-states");

  const header = `<div class="compare-header">
  <p class="back-link"><a href="/">&larr; Back to product list</a></p>
  <h1>${escapeHtml(left.name)} vs ${escapeHtml(right.name)}</h1>
</div>`;

  const sections = [
    header,
    renderSectionNav(analyzed),
    renderIdentityComparison(left, right),
    renderOutcomesComparison(left, right),
    renderJourneyComparison(left, right),
    renderIcpComparison(left, right),
    renderValueMomentsComparison(left, right),
    renderMeasurementSpecComparison(left, right),
    renderLifecycleComparison(left, right),
  ];

  return renderPage(
    `${left.name} vs ${right.name} — Basesignal`,
    `<div class="compare-layout">${sections.join("\n")}</div>`,
    { script: SCROLL_SPY_SCRIPT, extraCss: COMPARISON_CSS },
  );
}
