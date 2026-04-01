import type { ProductDirectory, ProductProfile } from "@basesignal/storage";
import type {
  ActivationMap,
  ActivationStage,
  StageTransition,
  ICPProfile,
  ValueMomentPriority,
  MeasurementSpec,
  ProductEntity,
  LifecycleStatesResult,
  LifecycleState,
  EntityProperty,
  OutcomeItem,
} from "@basesignal/core";
import { escapeHtml, renderPage, confidenceBadge } from "./view-html.js";

// ---------------------------------------------------------------------------
// Section navigation
// ---------------------------------------------------------------------------

export const SECTION_NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: "identity", label: "Identity" },
  { id: "lifecycle-states", label: "Performance Model" },
  { id: "journey", label: "Activation" },
  { id: "outcomes", label: "Outcomes" },
  { id: "icp-profiles", label: "ICP Segments" },
  { id: "measurement-spec", label: "Measurement Plan" },
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

function renderReportHeader(profile: ProductProfile | null, pageCount: number): string {
  const name = profile?.identity?.productName ?? "Unknown Product";
  const url = profile?.metadata?.url;
  const scannedAt = profile?.metadata?.scannedAt;
  const dateStr = scannedAt ? new Date(scannedAt).toISOString().split("T")[0] : null;

  // Source material boxes
  const sources: string[] = [];
  if (pageCount > 0) {
    sources.push(`<div class="source-box"><span class="source-value">${pageCount}</span><span class="source-label">pages scanned</span>${dateStr ? `<span class="source-date">Last updated ${dateStr}</span>` : ""}</div>`);
  }

  return `<div class="report-header">
  <a href="/" class="back-link">&larr; All products</a>
  <div class="hero-brand">Basesignal</div>
  <h1>${escapeHtml(name)}</h1>
  ${url ? `<a href="${escapeHtml(url)}" class="hero-url">${escapeHtml(url)}</a>` : ""}
  ${sources.length > 0 ? `<div class="source-material"><span class="source-material-label">Source Material</span><div class="source-boxes">${sources.join("")}</div></div>` : ""}
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
    ? `<div class="identity-target"><span class="identity-target-label">Target Customer</span><span class="identity-target-value">${escapeHtml(identity.targetCustomer)}</span></div>`
    : "";

  // Positioning section — group business context into categories
  const positioningGroups: Array<{ label: string; items: string[] }> = [];
  if (identity.industry) positioningGroups.push({ label: "Industry", items: [identity.industry] });
  if (identity.businessModel) positioningGroups.push({ label: "Revenue Model", items: [identity.businessModel] });
  if (identity.companyStage) positioningGroups.push({ label: "Stage", items: [identity.companyStage] });

  let positioningHtml = "";
  if (positioningGroups.length > 0) {
    const groups = positioningGroups.map((g) =>
      `<div class="pos-group"><span class="pos-label">${escapeHtml(g.label)}</span><div class="pos-items">${g.items.map((i) => `<span class="pos-item">${escapeHtml(i)}</span>`).join("")}</div></div>`,
    ).join("");
    positioningHtml = `<div class="positioning"><h3>Positioning</h3>${groups}</div>`;
  }

  return `<section id="identity">
  <h2>Identity</h2>
  ${descHtml}
  ${targetHtml}
  ${positioningHtml}
</section>`;
}

// ---------------------------------------------------------------------------
// Product Performance Model (Lifecycle States)
// ---------------------------------------------------------------------------

function renderLifecycleStatesSection(lifecycleData: LifecycleStatesResult | null): string {
  if (!lifecycleData) {
    return `<section id="lifecycle-states" class="no-data">
  <h2>Product Performance Model</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const stateColors = ["var(--blue)", "var(--teal)", "var(--gold-dark)", "var(--rose)", "var(--navy)", "var(--blue)", "var(--teal)"];

  const stateRows = lifecycleData.states
    .map((s: LifecycleState, i: number) => {
      const color = stateColors[i % stateColors.length];
      return `<tr>
        <td><span class="state-pill" style="background:${color}">${escapeHtml(s.name)}</span></td>
        <td class="state-def">${escapeHtml(s.definition)}</td>
        <td class="state-window-cell">${s.time_window ? escapeHtml(s.time_window) : "—"}</td>
      </tr>`;
    })
    .join("\n");

  return `<section id="lifecycle-states">
  <h2>Product Performance Model</h2>
  <table class="perf-table">
    <thead><tr><th>State</th><th>Definition</th><th>Time Window</th></tr></thead>
    <tbody>
${stateRows}
    </tbody>
  </table>
  <p class="confidence">Confidence: ${confidenceBadge(lifecycleData.confidence)}</p>
</section>`;
}

// ---------------------------------------------------------------------------
// Activation (Journey)
// ---------------------------------------------------------------------------

function renderJourneySection(activationMap: ActivationMap | null): string {
  if (!activationMap) {
    return `<section id="journey" class="no-data">
  <h2>Activation</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const introText = `<p class="section-intro">Activation measures if you can give a new account/user glimpses of the value that you can deliver. We believe in activation levels to understand activation as a funnel.</p>`;

  // Journey table
  const stageRows = activationMap.stages
    .map((s: ActivationStage) => {
      const riskLevel = s.drop_off_risk.level;
      const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "medium" ? "risk-medium" : "risk-low";
      const isPrimary = s.level === activationMap.primary_activation_level;
      const triggers = s.trigger_events.map((t) => `<code>${escapeHtml(t)}</code>`).join(" ");
      return `<tr${isPrimary ? ' class="row-primary"' : ""}>
        <td>${s.level}</td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td><span class="badge">${escapeHtml(s.signal_strength)}</span></td>
        <td>${triggers}</td>
        <td><span class="${riskClass}">${escapeHtml(riskLevel)}</span></td>
      </tr>`;
    })
    .join("\n");

  const journeyTable = `<h3>Activation Journey</h3>
  <table>
    <thead><tr><th>Level</th><th>Name</th><th>Signal</th><th>Triggers</th><th>Drop-off Risk</th></tr></thead>
    <tbody>${stageRows}</tbody>
  </table>`;

  // Transitions
  let transitionHtml = "";
  if (activationMap.transitions.length > 0) {
    const transRows = activationMap.transitions
      .map((t: StageTransition) =>
        `<tr><td>Level ${t.from_level} &rarr; Level ${t.to_level}</td><td>${t.trigger_events.map((e) => `<code>${escapeHtml(e)}</code>`).join(" ")}</td><td>${escapeHtml(t.typical_timeframe ?? "—")}</td></tr>`,
      )
      .join("\n");
    transitionHtml = `<h3>Transitions</h3>
  <table>
    <thead><tr><th>Transition</th><th>Events</th><th>Timeframe</th></tr></thead>
    <tbody>${transRows}</tbody>
  </table>`;
  }

  // --- Implementation: Events & Properties ---
  const allTriggers = new Set<string>();
  for (const s of activationMap.stages) {
    for (const t of s.trigger_events) allTriggers.add(t);
  }
  const eventItems = [...allTriggers]
    .map((t) => `<code>${escapeHtml(t)}</code>`)
    .join(" ");

  const trackHtml = `<div class="guidance-box">
    <h3>Track Activations</h3>
    <p>These events and properties need to be implemented and tested.</p>
    <div class="guidance-events">${eventItems}</div>
  </div>`;

  // --- Implementation: Segments ---
  const segmentItems = activationMap.stages
    .map((s: ActivationStage) => {
      const triggers = s.trigger_events.map((t) => escapeHtml(t)).join(" AND ");
      return `<div class="segment-item">
        <strong>L${s.level}: ${escapeHtml(s.name)}</strong>
        <p>Create an audience/segment in your analytics tool or data model where <code>${triggers}</code> have occurred. Use this to filter dashboards and compare behavior across levels.</p>
      </div>`;
    })
    .join("\n");

  const segmentHtml = `<div class="guidance-box">
    <h3>Build Segments</h3>
    <p>You need to create the following audiences/segments in your analytics tool or in your data model.</p>
    ${segmentItems}
  </div>`;

  // --- Activation Metrics ---
  const metricsHtml = `<div class="metrics-section">
    <h3>Activation Metrics</h3>
    <p class="section-intro">Track the following metrics for all activation levels. These are all cohort metrics &mdash; if you want to report them in weekly or monthly reports, derive the numbers from the cohort baseline.</p>
    <div class="metrics-grid">
      <div class="metric-card">
        <h4>Activation Rate</h4>
        <p class="metric-formula">activated accounts / all new accounts</p>
        <p>The essential conversion rate for your early product success. Low here, low performance in total. Use the levels to understand where people get stuck.</p>
      </div>
      <div class="metric-card">
        <h4>Activated New Subscription Rate</h4>
        <p class="metric-formula">new subscriptions that were activated / all new subscriptions</p>
        <p>Check for impact of activation (also broken down by level) on subscriptions.</p>
        <div class="metric-thresholds">
          <div class="threshold warn">If &lt;50% &mdash; your activation does not indicate subscription success and needs definition rework.</div>
          <div class="threshold warn">If &gt;95% &mdash; your activation looks most likely too broad (like logged in). It is not a difference maker.</div>
        </div>
      </div>
      <div class="metric-card">
        <h4>30/60/90d Retention: Activated vs All</h4>
        <p class="metric-formula">retention by activated accounts vs avg. retention</p>
        <p>Check the core retention metrics by activated accounts on the different levels &mdash; if and how much they outperform the average retention values.</p>
        <p>Activated accounts should outperform, and ideally stronger with each level.</p>
      </div>
      <div class="metric-card">
        <h4>Conversion Rate Delta</h4>
        <p class="metric-formula">subscription conversion rate (activated) vs conversion rate (all)</p>
        <p>Activated accounts should convert at a higher rate to subscriptions. Determine the x-factor to understand level differences and the impact of activation in general.</p>
      </div>
      <div class="metric-card">
        <h4>Time to Activated Smell Test</h4>
        <p class="metric-formula">avg. time to reach each activation level</p>
        <p>Calculate the average time to conversion metrics for each level. Any too fast is not a good definition (L1 achieved after 10s).</p>
      </div>
    </div>
  </div>`;

  return `<section id="journey">
  <h2>Activation</h2>
  ${introText}
  ${journeyTable}
  ${transitionHtml}
  ${trackHtml}
  ${segmentHtml}
  ${metricsHtml}
  <p class="confidence">Confidence: ${confidenceBadge(activationMap.confidence)}</p>
</section>`;
}

// ---------------------------------------------------------------------------
// Citation helper
// ---------------------------------------------------------------------------

function renderCitations(citations: Array<{ url: string; excerpt: string }> | undefined): string {
  if (!citations || citations.length === 0) return "";
  const items = citations
    .map((c) => `<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.url)}</a> — <em>${escapeHtml(c.excerpt)}</em></li>`)
    .join("");
  return `<div class="citations"><h4>Sources</h4><ul>${items}</ul></div>`;
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

  const introText = `<p class="section-intro">Active is driven by outcomes. Different outcomes are achieved by different groups of users. These need to be defined and measured as well.</p>`;

  const cards = outcomes
    .map((o: OutcomeItem) => {
      const features = o.linkedFeatures.length > 0
        ? `<div class="outcome-col"><h4>Features involved</h4><ul>${o.linkedFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul></div>`
        : "";

      const measurement = (o.measurement_references && o.measurement_references.length > 0)
        ? `<div class="outcome-col"><h4>Measurement</h4><div class="outcome-codes">${o.measurement_references.map((r) => `<code>${escapeHtml(r.entity)}.${escapeHtml(r.activity)}</code>`).join(" ")}</div></div>`
        : "";

      const metrics = (o.suggested_metrics && o.suggested_metrics.length > 0)
        ? `<div class="outcome-col"><h4>Metrics</h4><div class="outcome-codes">${o.suggested_metrics.map((s) => `<code>${escapeHtml(s)}</code>`).join(" ")}</div></div>`
        : "";

      const citationsHtml = renderCitations(o.citations);

      return `<div class="outcome-card">
      <p class="outcome-desc">${escapeHtml(o.description)}</p>
      <div class="outcome-grid">${features}${measurement}${metrics}</div>
      ${citationsHtml}
    </div>`;
    })
    .join("\n");

  return `<section id="outcomes">
  <h2>Possible Outcomes</h2>
  ${introText}
${cards}
</section>`;
}

// ---------------------------------------------------------------------------
// ICP Segments
// ---------------------------------------------------------------------------

function renderIcpSection(icpProfiles: ICPProfile[] | null): string {
  if (!icpProfiles || icpProfiles.length === 0) {
    return `<section id="icp-profiles" class="no-data">
  <h2>ICP Segments</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const introText = `<p class="section-intro">Your product has different user types naturally; they will achieve different outcomes and will have different value needs. Identification is essential. The easiest way is still to ask them during account creation.</p>`;

  const cards = icpProfiles
    .map((p: ICPProfile) => {
      const painHtml = p.pain_points.length > 0
        ? `<h4>Pain Points</h4><ul>${p.pain_points.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
        : "";

      const triggerHtml = p.activation_triggers.length > 0
        ? `<h4>Value Triggers</h4><ul>${p.activation_triggers.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
        : "";

      let vmLevels = "";
      if (p.value_moment_priorities.length > 0) {
        vmLevels = `<h4>Value Moment Levels</h4><ul>${p.value_moment_priorities.map((pr: ValueMomentPriority) => `<li><strong>P${pr.priority}:</strong> ${escapeHtml(pr.relevance_reason)}</li>`).join("")}</ul>`;
      }

      const citationsHtml = renderCitations(p.citations);

      return `<div class="icp-card">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.description ? `<p class="icp-desc">${escapeHtml(p.description)}</p>` : ""}
      ${painHtml}
      ${triggerHtml}
      ${vmLevels}
      ${citationsHtml}
      <div class="confidence">Confidence: ${confidenceBadge(p.confidence)}</div>
    </div>`;
    })
    .join("\n");

  return `<section id="icp-profiles">
  <h2>ICP Segments</h2>
  ${introText}
${cards}
</section>`;
}

// ---------------------------------------------------------------------------
// Measurement Plan (Measurement Spec)
// ---------------------------------------------------------------------------

function renderPropertyTable(properties: EntityProperty[]): string {
  if (properties.length === 0) return "";
  const propRows = properties
    .map((p) => `<tr><td><code>${escapeHtml(p.name)}</code></td><td><span class="badge">${escapeHtml(p.type)}</span></td><td>${p.isRequired ? "yes" : ""}</td><td>${escapeHtml(p.description)}</td></tr>`)
    .join("\n");
  return `<table>
    <thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
    <tbody>${propRows}</tbody>
  </table>`;
}

function renderMeasurementSpecSection(spec: MeasurementSpec | null): string {
  if (!spec) {
    return `<section id="measurement-spec" class="no-data">
  <h2>Measurement Plan</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const entities = spec.perspectives.product.entities
    .map((e: ProductEntity) => {
      const heartbeatBadge = e.isHeartbeat ? ' <span class="badge badge-heartbeat">&#9829; heartbeat</span>' : "";
      const acts = e.activities.length > 0
        ? `<div class="entity-acts"><h4>Activities</h4>${e.activities.map((a) => `<code>${escapeHtml(a.name)}</code>`).join(" ")}</div>`
        : "";
      return `<div class="entity-card">
      <div class="entity-head"><h3>${escapeHtml(e.name)}</h3>${heartbeatBadge}</div>
      ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}
      ${acts}
      ${renderPropertyTable(e.properties)}
    </div>`;
    })
    .join("\n");

  return `<section id="measurement-spec">
  <h2>Measurement Plan</h2>
${entities}
  <p class="confidence">Confidence: ${confidenceBadge(spec.confidence)}</p>
</section>`;
}

// ---------------------------------------------------------------------------
// Product report (orchestrator)
// ---------------------------------------------------------------------------

export function renderProductReport(slug: string, productDir: ProductDirectory): string {
  const profile = productDir.readJson<ProductProfile>(slug, "profile.json");
  const activationMap = productDir.readJson<ActivationMap>(slug, "outputs/activation-map.json");
  const icpProfiles = productDir.readJson<ICPProfile[]>(slug, "outputs/icp-profiles.json");
  const measurementSpec = productDir.readJson<MeasurementSpec>(slug, "outputs/measurement-spec.json");
  const lifecycleStates = productDir.readJson<LifecycleStatesResult>(slug, "outputs/lifecycle-states.json");
  const outcomes = productDir.readJson<OutcomeItem[]>(slug, "outputs/outcomes.json")
    ?? (profile?.outcomes?.items ?? null);

  // Count source pages
  const pageCount = profile?.metadata?.pageCount ?? 0;

  // Track which sections have data for nav styling
  const analyzed = new Set<string>();
  if (profile?.identity) analyzed.add("identity");
  if (lifecycleStates) analyzed.add("lifecycle-states");
  if (activationMap) analyzed.add("journey");
  if (outcomes && outcomes.length > 0) analyzed.add("outcomes");
  if (icpProfiles && icpProfiles.length > 0) analyzed.add("icp-profiles");
  if (measurementSpec) analyzed.add("measurement-spec");

  // Section order matches wireframes:
  // Identity → Performance Model → Activation → Outcomes → ICP Segments → Measurement Plan
  const sections = [
    renderReportHeader(profile, pageCount),
    renderSectionNav(analyzed),
    renderIdentitySection(profile?.identity),
    renderLifecycleStatesSection(lifecycleStates),
    renderJourneySection(activationMap),
    renderOutcomesSection(outcomes),
    renderIcpSection(icpProfiles),
    renderMeasurementSpecSection(measurementSpec),
  ];

  return renderPage(
    profile?.identity?.productName ?? slug,
    sections.join("\n"),
    { script: SCROLL_SPY_SCRIPT },
  );
}
