import type { Command } from "commander";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exec } from "node:child_process";
import type { ProductDirectory } from "@basesignal/storage";
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
    const profile = productDir.readJson<Record<string, unknown>>(slug, "profile.json");
    const identity = profile?.identity as { productName?: string } | undefined;
    const metadata = profile?.metadata as { url?: string; scannedAt?: number } | undefined;
    return {
      slug,
      name: identity?.productName ?? slug,
      url: metadata?.url ?? "",
      scannedAt: metadata?.scannedAt
        ? new Date(metadata.scannedAt).toISOString().split("T")[0]
        : "unknown",
      completeness: (profile?.completeness as number) ?? 0,
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

function renderReportHeader(
  identity: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
  profile: Record<string, unknown> | null,
): string {
  const name = (identity?.productName as string) ?? "Unknown Product";
  const url = metadata?.url as string | undefined;
  const scannedAt = metadata?.scannedAt as number | undefined;
  const completeness = profile?.completeness as number | undefined;
  const overallConfidence = profile?.overallConfidence as number | undefined;

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

function renderIdentitySection(identity: Record<string, unknown> | undefined): string {
  if (!identity) {
    return `<section id="identity" class="no-data">
  <h2>Identity</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const fields: Array<[string, string | undefined]> = [
    ["Description", identity.description as string | undefined],
    ["Target Customer", identity.targetCustomer as string | undefined],
    ["Business Model", identity.businessModel as string | undefined],
    ["Industry", identity.industry as string | undefined],
    ["Company Stage", identity.companyStage as string | undefined],
  ];

  const items = fields
    .filter(([, v]) => v)
    .map(([label, value]) => `    <dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value!)}</dd>`)
    .join("\n");

  const confidence = identity.confidence as number | undefined;
  const confLine = confidence != null ? `\n  <p class="confidence">Confidence: ${confidenceBadge(confidence)}</p>` : "";

  return `<section id="identity">
  <h2>Identity</h2>
  <dl>
${items}
  </dl>${confLine}
</section>`;
}

function renderJourneySection(activationMap: Record<string, unknown> | null): string {
  if (!activationMap) {
    return `<section id="journey" class="no-data">
  <h2>Activation Journey</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const stages = (activationMap.stages ?? []) as Array<Record<string, unknown>>;
  const transitions = (activationMap.transitions ?? []) as Array<Record<string, unknown>>;
  const primaryLevel = activationMap.primary_activation_level as number | undefined;
  const confidence = activationMap.confidence as string | number | undefined;

  // Stage rows
  const stageRows = stages
    .map((s) => {
      const level = s.level as number;
      const name = s.name as string;
      const signal = s.signal_strength as string;
      const triggers = (s.trigger_events as string[]) ?? [];
      const moments = (s.value_moments_unlocked as string[]) ?? [];
      const dropOff = s.drop_off_risk as { level?: string; reason?: string } | string | undefined;
      const riskLevel = typeof dropOff === "object" ? dropOff?.level : dropOff;
      const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "medium" ? "risk-medium" : "risk-low";
      const isPrimary = level === primaryLevel;

      return `      <tr>
        <td>${level}${isPrimary ? ' <span class="badge badge-primary">primary</span>' : ""}</td>
        <td>${escapeHtml(name)}</td>
        <td><span class="badge">${escapeHtml(signal ?? "")}</span></td>
        <td>${triggers.map((t) => escapeHtml(t)).join(", ")}</td>
        <td>${moments.length > 0 ? moments.length + " moment" + (moments.length > 1 ? "s" : "") : "—"}</td>
        <td><span class="${riskClass}">${escapeHtml(riskLevel ?? "—")}</span></td>
      </tr>`;
    })
    .join("\n");

  const stageTable = stages.length > 0
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
  if (transitions.length > 0) {
    const transRows = transitions
      .map((t) => {
        const from = t.from_level as number;
        const to = t.to_level as number;
        const triggers = (t.trigger_events as string[]) ?? [];
        const timeframe = (t.typical_timeframe as string) ?? "—";
        return `      <tr>
        <td>Level ${from} &rarr; Level ${to}</td>
        <td>${triggers.map((e) => escapeHtml(e)).join(", ")}</td>
        <td>${escapeHtml(timeframe)}</td>
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

  // Confidence — can be string ("high") or number
  let confLine = "";
  if (confidence != null) {
    confLine = `\n  <p class="confidence">Confidence: ${confidenceBadge(confidence)}</p>`;
  }

  return `<section id="journey">
  <h2>Activation Journey</h2>
${stageTable}${transitionHtml}${confLine}
</section>`;
}

function renderIcpSection(icpProfiles: Array<Record<string, unknown>> | null): string {
  if (!icpProfiles || icpProfiles.length === 0) {
    return `<section id="icp-profiles" class="no-data">
  <h2>ICP Profiles</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const cards = icpProfiles
    .map((p) => {
      const name = p.name as string;
      const description = p.description as string | undefined;
      const confidence = p.confidence as number | undefined;
      const painPoints = (p.pain_points as string[]) ?? [];
      const triggers = (p.activation_triggers as string[]) ?? [];
      const metrics = (p.success_metrics as string[]) ?? [];
      const priorities = (p.value_moment_priorities as Array<Record<string, unknown>>) ?? [];

      const renderList = (items: string[]) =>
        items.length > 0
          ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
          : "";

      let prioritiesHtml = "";
      if (priorities.length > 0) {
        const rows = priorities
          .map((pr) => `        <li>P${pr.priority}: ${escapeHtml(pr.relevance_reason as string)}</li>`)
          .join("\n");
        prioritiesHtml = `\n      <h4>Value Moment Priorities</h4>\n      <ul>\n${rows}\n      </ul>`;
      }

      const confLine = confidence != null ? `\n      <p class="confidence">Confidence: ${confidenceBadge(confidence)}</p>` : "";

      return `    <div class="card">
      <h3>${escapeHtml(name)}</h3>
      ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      ${painPoints.length > 0 ? `<h4>Pain Points</h4>\n      ${renderList(painPoints)}` : ""}
      ${triggers.length > 0 ? `<h4>Activation Triggers</h4>\n      ${renderList(triggers)}` : ""}
      ${metrics.length > 0 ? `<h4>Success Metrics</h4>\n      ${renderList(metrics)}` : ""}${prioritiesHtml}${confLine}
    </div>`;
    })
    .join("\n");

  return `<section id="icp-profiles">
  <h2>ICP Profiles</h2>
${cards}
</section>`;
}

function renderValueMomentsSection(valueMoments: Array<Record<string, unknown>> | null): string {
  if (!valueMoments || valueMoments.length === 0) {
    return `<section id="value-moments" class="no-data">
  <h2>Value Moments</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const tierLabels: Record<number, string> = { 1: "Core Value Moments", 2: "Important", 3: "Supporting" };
  const grouped: Record<number, Array<Record<string, unknown>>> = {};
  for (const m of valueMoments) {
    const tier = (m.tier as number) ?? 3;
    (grouped[tier] ??= []).push(m);
  }

  const totalLenses = 7;
  const tierSections = [1, 2, 3]
    .filter((t) => grouped[t]?.length)
    .map((t) => {
      const label = tierLabels[t] ?? `Tier ${t}`;
      const items = grouped[t]
        .map((m) => {
          const name = m.name as string;
          const description = m.description as string | undefined;
          const lenses = (m.lenses as string[]) ?? [];
          const lensCount = (m.lens_count as number) ?? lenses.length;
          const roles = (m.roles as string[]) ?? [];
          const surfaces = (m.product_surfaces as string[]) ?? [];
          const details: string[] = [];
          if (lensCount > 0) details.push(`${lensCount} of ${totalLenses} lenses`);
          if (roles.length > 0) details.push(`Roles: ${roles.map((r) => escapeHtml(r)).join(", ")}`);
          if (surfaces.length > 0) details.push(`Surfaces: ${surfaces.map((s) => escapeHtml(s)).join(", ")}`);
          return `      <div class="card">
        <h4>${escapeHtml(name)}</h4>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
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

function renderMeasurementSpecSection(spec: Record<string, unknown> | null): string {
  if (!spec) {
    return `<section id="measurement-spec" class="no-data">
  <h2>Measurement Spec</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const perspectives = spec.perspectives as Record<string, Record<string, unknown>> | undefined;
  const confidence = spec.confidence as number | undefined;
  const warnings = (spec.warnings as string[]) ?? [];

  const renderEntities = (
    entities: Array<Record<string, unknown>>,
    perspective: string,
  ): string => {
    if (entities.length === 0) return "<p>No entities defined.</p>";

    return entities
      .map((e) => {
        const name = e.name as string;
        const description = e.description as string | undefined;
        const isHeartbeat = e.isHeartbeat as boolean | undefined;
        const properties = (e.properties as Array<Record<string, unknown>>) ?? [];
        const activities = (e.activities as Array<Record<string, unknown>>) ?? [];

        const heartbeatBadge = isHeartbeat ? ' <span class="badge">heartbeat</span>' : "";

        // Properties table
        let propsHtml = "";
        if (properties.length > 0) {
          const propRows = properties
            .map((p) => {
              const pName = p.name as string;
              const pType = p.type as string;
              const pDesc = (p.description as string) ?? "";
              const pReq = p.isRequired ? "yes" : "";
              return `          <tr><td>${escapeHtml(pName)}</td><td><span class="badge">${escapeHtml(pType)}</span></td><td>${escapeHtml(pReq)}</td><td>${escapeHtml(pDesc)}</td></tr>`;
            })
            .join("\n");
          propsHtml = `
        <table>
          <thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
          <tbody>
${propRows}
          </tbody>
        </table>`;
        }

        // Activities
        let activitiesHtml = "";
        if (activities.length > 0) {
          const actItems = activities
            .map((a) => {
              const aName = a.name as string;
              if (perspective === "customer") {
                const rule = (a.derivation_rule as string) ?? "";
                return `<li>${escapeHtml(aName)}${rule ? ` — <em>${escapeHtml(rule)}</em>` : ""}</li>`;
              }
              const supported = (a.properties_supported as string[]) ?? [];
              return `<li>${escapeHtml(aName)}${supported.length > 0 ? ` (${supported.map((s) => escapeHtml(s)).join(", ")})` : ""}</li>`;
            })
            .join("");
          activitiesHtml = `\n        <h5>Activities</h5>\n        <ul>${actItems}</ul>`;
        }

        return `      <div class="card">
        <h4>${escapeHtml(name)}${heartbeatBadge}</h4>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}${propsHtml}${activitiesHtml}
      </div>`;
      })
      .join("\n");
  };

  const perspectiveOrder = ["product", "customer", "interaction"] as const;
  const perspectiveLabels: Record<string, string> = {
    product: "Product Perspective",
    customer: "Customer Perspective",
    interaction: "Interaction Perspective",
  };

  let perspectivesHtml = "";
  if (perspectives) {
    perspectivesHtml = perspectiveOrder
      .map((p) => {
        const entities = ((perspectives[p] as Record<string, unknown>)?.entities as Array<Record<string, unknown>>) ?? [];
        return `    <h3>${perspectiveLabels[p]}</h3>\n${renderEntities(entities, p)}`;
      })
      .join("\n");
  }

  let warningsHtml = "";
  if (warnings.length > 0) {
    warningsHtml = `\n  <div class="warnings"><h4>Warnings</h4><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`;
  }

  const confLine = confidence != null ? `\n  <p class="confidence">Confidence: ${confidenceBadge(confidence)}</p>` : "";

  return `<section id="measurement-spec">
  <h2>Measurement Spec</h2>
${perspectivesHtml}${warningsHtml}${confLine}
</section>`;
}

function renderLifecycleStatesSection(lifecycleData: Record<string, unknown> | null): string {
  if (!lifecycleData) {
    return `<section id="lifecycle-states" class="no-data">
  <h2>Lifecycle States</h2>
  <p class="not-analyzed">Not yet analyzed</p>
</section>`;
  }

  const states = (lifecycleData.states as Array<Record<string, unknown>>) ?? [];
  const transitions = (lifecycleData.transitions as Array<Record<string, unknown>>) ?? [];
  const confidence = lifecycleData.confidence as number | undefined;

  const stateCards = states
    .map((s) => {
      const name = s.name as string;
      const definition = (s.definition as string) ?? "";
      const timeWindow = (s.time_window as string) ?? "";
      const entryCriteria = (s.entry_criteria as Array<Record<string, unknown>>) ?? [];
      const exitTriggers = (s.exit_triggers as Array<Record<string, unknown>>) ?? [];

      const renderCriteria = (criteria: Array<Record<string, unknown>>) =>
        criteria.length > 0
          ? `<ul>${criteria.map((c) => `<li>${escapeHtml(c.event_name as string)}: ${escapeHtml(c.condition as string)}</li>`).join("")}</ul>`
          : "";

      return `    <div class="card">
      <h3>${escapeHtml(name)}${timeWindow ? ` <span class="badge">${escapeHtml(timeWindow)}</span>` : ""}</h3>
      <p>${escapeHtml(definition)}</p>
      ${entryCriteria.length > 0 ? `<h4>Entry Criteria</h4>\n      ${renderCriteria(entryCriteria)}` : ""}
      ${exitTriggers.length > 0 ? `<h4>Exit Triggers</h4>\n      ${renderCriteria(exitTriggers)}` : ""}
    </div>`;
    })
    .join("\n");

  let transitionsHtml = "";
  if (transitions.length > 0) {
    const transRows = transitions
      .map((t) => {
        const from = t.from_state as string;
        const to = t.to_state as string;
        const conditions = (t.trigger_conditions as string[]) ?? [];
        const timeframe = (t.typical_timeframe as string) ?? "—";
        return `      <tr>
        <td>${escapeHtml(from)} &rarr; ${escapeHtml(to)}</td>
        <td>${conditions.map((c) => escapeHtml(c)).join(", ")}</td>
        <td>${escapeHtml(timeframe)}</td>
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

  const confLine = confidence != null ? `\n  <p class="confidence">Confidence: ${confidenceBadge(confidence)}</p>` : "";

  return `<section id="lifecycle-states">
  <h2>Lifecycle States</h2>
${stateCards}${transitionsHtml}${confLine}
</section>`;
}

export function renderProductReport(slug: string, productDir: ProductDirectory): string {
  const profile = productDir.readJson<Record<string, unknown>>(slug, "profile.json");
  const activationMap = productDir.readJson<Record<string, unknown>>(slug, "outputs/activation-map.json");
  const icpProfiles = productDir.readJson<Array<Record<string, unknown>>>(slug, "outputs/icp-profiles.json");
  const valueMoments = productDir.readJson<Array<Record<string, unknown>>>(slug, "convergence/value-moments.json");
  const measurementSpec = productDir.readJson<Record<string, unknown>>(slug, "outputs/measurement-spec.json");
  const lifecycleStates = productDir.readJson<Record<string, unknown>>(slug, "outputs/lifecycle-states.json");

  const identity = profile?.identity as Record<string, unknown> | undefined;
  const metadata = profile?.metadata as Record<string, unknown> | undefined;

  // Track which sections have data for nav styling
  const analyzed = new Set<string>();
  if (identity) analyzed.add("identity");
  if (activationMap) analyzed.add("journey");
  if (icpProfiles && icpProfiles.length > 0) analyzed.add("icp-profiles");
  if (valueMoments && valueMoments.length > 0) analyzed.add("value-moments");
  if (measurementSpec) analyzed.add("measurement-spec");
  if (lifecycleStates) analyzed.add("lifecycle-states");

  const sections = [
    `<p class="back-link"><a href="/">&larr; Back to product list</a></p>`,
    renderReportHeader(identity, metadata, profile),
    renderSectionNav(analyzed),
    renderIdentitySection(identity),
    renderJourneySection(activationMap),
    renderIcpSection(icpProfiles),
    renderValueMomentsSection(valueMoments),
    renderMeasurementSpecSection(measurementSpec),
    renderLifecycleStatesSection(lifecycleStates),
  ];

  return renderPage(
    (identity?.productName as string) ?? slug,
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
