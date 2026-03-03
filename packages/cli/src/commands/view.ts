import type { Command } from "commander";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exec } from "node:child_process";
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
  InteractionEntity,
  LifecycleStatesResult,
  LifecycleState,
  StateTransition,
  StateCriterion,
  EntityProperty,
  ValueMoment,
} from "@basesignal/core";
import { loadConfig } from "../config.js";

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage(title: string, body: string, options?: { script?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }
    code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
    th { font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody tr:hover { background: #f3f4f6; }
    .empty-state { color: #6b7280; margin-top: 2rem; }
    .back-link { display: inline-block; margin-bottom: 1rem; font-size: 0.9rem; }
    section { margin-bottom: 2.5rem; }
    section h2 { font-size: 1.35rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.4rem; margin-bottom: 1rem; }
    section h2::before { content: '\\2713  '; color: #059669; font-size: 0.9em; }
    section.no-data h2::before { content: '\\2014  '; color: #9ca3af; }
    .confidence { font-size: 0.85rem; color: #6b7280; margin-top: 0.75rem; }
    .not-analyzed { color: #9ca3af; font-style: italic; }
    .report-header { margin-bottom: 2rem; }
    .report-header .meta { font-size: 0.9rem; color: #6b7280; display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.5rem; align-items: center; }
    .report-header .meta a { color: #6b7280; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; margin: 0; }
    dt { font-weight: 600; color: #374151; }
    dd { margin: 0; }
    .badge { display: inline-block; font-size: 0.75rem; padding: 0.1em 0.5em; border-radius: 3px; background: #dbeafe; color: #1e40af; font-weight: 500; }
    .badge-primary { background: #fef3c7; color: #92400e; }
    .risk-low { color: #059669; }
    .risk-medium { color: #d97706; }
    .risk-high { color: #dc2626; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; transition: border-color 0.15s, box-shadow 0.15s; }
    .card:hover { border-color: #d1d5db; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .card h3, .card h4 { margin-top: 0.5rem; margin-bottom: 0.25rem; }
    .card h3:first-child { margin-top: 0; }
    .card ul { margin: 0.25rem 0 0.5rem 0; padding-left: 1.25rem; }
    .card p { margin: 0.25rem 0; }
    .card table { margin-top: 0.5rem; font-size: 0.9rem; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; }
    h4 { font-size: 0.95rem; color: #374151; }
    h5 { font-size: 0.85rem; color: #6b7280; margin: 0.5rem 0 0.25rem; }
    .warnings { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 0.75rem 1rem; margin-top: 0.75rem; }
    .warnings h4 { color: #92400e; margin: 0; }
    .warnings ul { margin: 0.25rem 0 0; padding-left: 1.25rem; }
    .section-nav { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 0.5rem 0; margin-bottom: 1.5rem; display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .section-nav a { color: #6b7280; font-size: 0.85rem; font-weight: 500; padding-bottom: 0.25rem; border-bottom: 2px solid transparent; }
    .section-nav a:hover { color: #374151; text-decoration: none; }
    .section-nav a.active { color: #2563eb; border-bottom-color: #2563eb; }
    .section-nav a.dimmed { color: #d1d5db; }
    .progress-bar { position: relative; height: 1.25rem; background: #f3f4f6; border-radius: 4px; overflow: hidden; min-width: 80px; }
    .progress-fill { height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.3s; }
    .progress-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; }
    .progress-bar-mini { display: inline-block; width: 60px; height: 0.75rem; vertical-align: middle; margin-right: 0.35rem; }
    .progress-bar-mini .progress-fill { border-radius: 3px; }
    .conf-badge { display: inline-block; font-size: 0.8rem; padding: 0.1em 0.5em; border-radius: 3px; font-weight: 500; }
    .conf-high { background: #d1fae5; color: #065f46; }
    .conf-med { background: #fef3c7; color: #92400e; }
    .conf-low { background: #f3f4f6; color: #6b7280; }
  </style>
</head>
<body>
${body}${options?.script ? `\n<script>${options.script}</script>` : ""}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Visual indicator helpers
// ---------------------------------------------------------------------------

export function progressBar(value: number, mini = false): string {
  const pct = Math.round(value * 100);
  const cls = mini ? "progress-bar progress-bar-mini" : "progress-bar";
  return `<div class="${cls}"><div class="progress-fill" style="width:${pct}%"></div>${mini ? "" : `<span class="progress-label">${pct}%</span>`}</div>`;
}

export function confidenceBadge(value: number | string): string {
  if (typeof value === "string") {
    const cls = value === "high" ? "conf-high" : value === "medium" ? "conf-med" : "conf-low";
    return `<span class="conf-badge ${cls}">${escapeHtml(value)}</span>`;
  }
  const pct = Math.round(value * 100);
  const cls = pct >= 70 ? "conf-high" : pct >= 40 ? "conf-med" : "conf-low";
  return `<span class="conf-badge ${cls}">${pct}%</span>`;
}

// ---------------------------------------------------------------------------
// Section navigation
// ---------------------------------------------------------------------------

const SECTION_NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: "identity", label: "Identity" },
  { id: "journey", label: "Journey" },
  { id: "icp-profiles", label: "ICP Profiles" },
  { id: "value-moments", label: "Value Moments" },
  { id: "measurement-spec", label: "Measurement Spec" },
  { id: "lifecycle-states", label: "Lifecycle States" },
];

function renderSectionNav(analyzedSections: Set<string>): string {
  const links = SECTION_NAV_ITEMS
    .map((item) => {
      const cls = analyzedSections.has(item.id) ? "" : " dimmed";
      return `<a href="#${item.id}" class="${cls}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
  return `<nav class="section-nav">${links}</nav>`;
}

const SCROLL_SPY_SCRIPT = `(function(){var n=document.querySelector('.section-nav');if(!n)return;var ls=n.querySelectorAll('a[href^=\"#\"]');var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){ls.forEach(function(l){l.classList.remove('active')});var a=n.querySelector('a[href=\"#'+e.target.id+'\"]');if(a)a.classList.add('active')}})},{rootMargin:'-20% 0px -70% 0px'});document.querySelectorAll('section[id]').forEach(function(s){o.observe(s)})})();`;

// ---------------------------------------------------------------------------
// Product list
// ---------------------------------------------------------------------------

export interface ProductListItem {
  slug: string;
  name: string;
  url: string;
  scannedAt: string;
  completeness: number;
}

export function loadProductList(productDir: ProductDirectory): ProductListItem[] {
  const slugs = productDir.listProducts();
  return slugs.map((slug) => {
    const profile = productDir.readJson<ProductProfile>(slug, "profile.json");
    return {
      slug,
      name: profile?.identity?.productName ?? slug,
      url: profile?.metadata?.url ?? "",
      scannedAt: profile?.metadata?.scannedAt
        ? new Date(profile.metadata.scannedAt).toISOString().split("T")[0]
        : "unknown",
      completeness: profile?.completeness ?? 0,
    };
  });
}

export function renderProductList(products: ProductListItem[]): string {
  if (products.length === 0) {
    return renderPage(
      "Basesignal",
      `<h1>Basesignal</h1>
<div class="empty-state">
  <p>No products scanned yet.</p>
  <p>Run <code>basesignal scan &lt;url&gt;</code> to get started.</p>
</div>`,
    );
  }

  const rows = products
    .map(
      (p) => `      <tr>
        <td><a href="/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a></td>
        <td>${escapeHtml(p.url)}</td>
        <td>${escapeHtml(p.scannedAt)}</td>
        <td>${progressBar(p.completeness, true)} ${Math.round(p.completeness * 100)}%</td>
      </tr>`,
    )
    .join("\n");

  return renderPage(
    "Basesignal",
    `<h1>Basesignal</h1>
<table>
  <thead>
    <tr><th>Product</th><th>URL</th><th>Scanned</th><th>Completeness</th></tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`,
  );
}

// ---------------------------------------------------------------------------
// Product report
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

function renderIdentitySection(identity: ProductProfile["identity"]): string {
  if (!identity) {
    return `<section id="identity" class="no-data">
  <h2>Identity</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const fields: Array<[string, string | undefined]> = [
    ["Description", identity.description],
    ["Target Customer", identity.targetCustomer],
    ["Business Model", identity.businessModel],
    ["Industry", identity.industry],
    ["Company Stage", identity.companyStage],
  ];

  const items = fields
    .filter(([, v]) => v)
    .map(([label, value]) => `    <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value!)}</dd>`)
    .join("\n");

  const confLine = identity.confidence != null ? `\n  <p class="confidence">Confidence: ${confidenceBadge(identity.confidence)}</p>` : "";

  return `<section id="identity">
  <h2>Identity</h2>
  <dl>
${items}
  </dl>${confLine}
</section>`;
}

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

function renderValueMomentsSection(valueMoments: ValueMoment[] | null): string {
  if (!valueMoments || valueMoments.length === 0) {
    return `<section id="value-moments" class="no-data">
  <h2>Value Moments</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const tierLabels: Record<number, string> = { 1: "Core Value Moments", 2: "Important", 3: "Supporting" };
  const grouped: Record<number, ValueMoment[]> = {};
  for (const m of valueMoments) {
    const tier = m.tier ?? 3;
    (grouped[tier] ??= []).push(m);
  }

  const totalLenses = 7;
  const tierSections = [1, 2, 3]
    .filter((t) => grouped[t]?.length)
    .map((t) => {
      const label = tierLabels[t] ?? `Tier ${t}`;
      const items = grouped[t]
        .map((m: ValueMoment) => {
          const details: string[] = [];
          if (m.lens_count > 0) details.push(`${m.lens_count} of ${totalLenses} lenses`);
          if (m.roles.length > 0) details.push(`Roles: ${m.roles.map((r) => escapeHtml(r)).join(", ")}`);
          if (m.product_surfaces.length > 0) details.push(`Surfaces: ${m.product_surfaces.map((s) => escapeHtml(s)).join(", ")}`);
          return `      <div class="card">
        <h4>${escapeHtml(m.name)}</h4>
        ${m.description ? `<p>${escapeHtml(m.description)}</p>` : ""}
        ${details.length > 0 ? `<p class="confidence">${details.join(" &middot; ")}</p>` : ""}
      </div>`;
        })
        .join("\n");
      return `    <h3>${escapeHtml(label)}</h3>\n${items}`;
    })
    .join("\n");

  return `<section id="value-moments">
  <h2>Value Moments</h2>
${tierSections}
</section>`;
}

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
        ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ""}${renderPropertyTable(e.properties)}${activitiesHtml}
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
        <h4>${escapeHtml(e.name)}</h4>${renderPropertyTable(e.properties)}${activitiesHtml}
      </div>`;
    })
    .join("\n");
}

function renderInteractionEntities(entities: InteractionEntity[]): string {
  if (entities.length === 0) return "<p>No entities defined.</p>";
  return entities
    .map((e) => {
      let activitiesHtml = "";
      if (e.activities.length > 0) {
        const actItems = e.activities
          .map((a) => `<li>${escapeHtml(a.name)}${a.properties_supported.length > 0 ? ` (${a.properties_supported.map((s) => escapeHtml(s)).join(", ")})` : ""}</li>`)
          .join("");
        activitiesHtml = `\n        <h5>Activities</h5>\n        <ul>${actItems}</ul>`;
      }
      return `      <div class="card">
        <h4>${escapeHtml(e.name)}</h4>${renderPropertyTable(e.properties)}${activitiesHtml}
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
    `    <h3>Interaction Perspective</h3>\n${renderInteractionEntities(spec.perspectives.interaction.entities)}`,
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

export function renderProductReport(slug: string, productDir: ProductDirectory): string {
  const profile = productDir.readJson<ProductProfile>(slug, "profile.json");
  const activationMap = productDir.readJson<ActivationMap>(slug, "outputs/activation-map.json");
  const icpProfiles = productDir.readJson<ICPProfile[]>(slug, "outputs/icp-profiles.json");
  const valueMoments = productDir.readJson<ValueMoment[]>(slug, "convergence/value-moments.json");
  const measurementSpec = productDir.readJson<MeasurementSpec>(slug, "outputs/measurement-spec.json");
  const lifecycleStates = productDir.readJson<LifecycleStatesResult>(slug, "outputs/lifecycle-states.json");

  // Track which sections have data for nav styling
  const analyzed = new Set<string>();
  if (profile?.identity) analyzed.add("identity");
  if (activationMap) analyzed.add("journey");
  if (icpProfiles && icpProfiles.length > 0) analyzed.add("icp-profiles");
  if (valueMoments && valueMoments.length > 0) analyzed.add("value-moments");
  if (measurementSpec) analyzed.add("measurement-spec");
  if (lifecycleStates) analyzed.add("lifecycle-states");

  const sections = [
    `<p class="back-link"><a href="/">&larr; Back to product list</a></p>`,
    renderReportHeader(profile),
    renderSectionNav(analyzed),
    renderIdentitySection(profile?.identity),
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

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) && slug.length <= 128;
}

// ---------------------------------------------------------------------------
// Browser auto-open
// ---------------------------------------------------------------------------

export function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error("Could not open browser automatically. Visit:", url);
    }
  });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(
  productDir: ProductDirectory,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/") {
    const products = loadProductList(productDir);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderProductList(products));
    return;
  }

  // Slug routing: /{slug}
  const slug = decodeURIComponent(pathname.slice(1));
  if (isValidSlug(slug) && productDir.exists(slug)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderProductReport(slug, productDir));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    renderPage(
      "Not Found",
      `<h1>Product not found</h1>\n<p>No product with slug &ldquo;${escapeHtml(slug)}&rdquo; exists.</p>\n<p><a href="/">Back to product list</a></p>`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export interface ViewServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export function startViewServer(options: {
  port: number;
  productDir: ProductDirectory;
}): Promise<ViewServerHandle> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      handleRequest(options.productDir, req, res);
    });

    server.on("error", reject);

    server.listen(options.port, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://localhost:${addr.port}`,
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerViewCommand(program: Command): void {
  program
    .command("view [slug]")
    .description("View scan results in the browser")
    .option("-p, --port <number>", "Server port", "3700")
    .option("--no-open", "Don't open browser automatically")
    .action(async (slug: string | undefined, opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);
      if (!Number.isFinite(port) || port < 0 || port > 65535) {
        console.error(`Error: invalid port "${opts.port}"`);
        process.exit(1);
      }

      const config = loadConfig({ verbose: program.opts().verbose });
      const { ProductDirectory } = await import("@basesignal/storage");
      const productDir = new ProductDirectory({
        root: config.storagePath + "/products",
      });

      const handle = await startViewServer({ port, productDir });

      const targetUrl = slug
        ? `${handle.url}/${slug}`
        : handle.url;
      console.error(`Listening on ${handle.url}`);
      if (opts.open) {
        openBrowser(targetUrl);
      }

      const shutdown = () => {
        handle.close().then(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
