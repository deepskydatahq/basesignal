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

export function renderPage(title: string, body: string, options?: { script?: string; extraCss?: string }): string {
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
    .identity-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25rem; }
    .identity-description { font-size: 1.05rem; line-height: 1.7; margin: 0 0 1rem; }
    .identity-target { margin-bottom: 0.75rem; }
    .identity-target-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; }
    .identity-target-value { font-weight: 600; color: #1e40af; }
    .identity-context { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .positioning-subsection { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .positioning-group { display: flex; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap; }
    .positioning-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; min-width: 6rem; padding-top: 0.1em; flex-shrink: 0; }
    .positioning-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    details { margin-bottom: 0.5rem; }
    details > summary { cursor: pointer; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; padding: 0.25rem 0; list-style: revert; }
    details > summary .badge { font-size: 0.7rem; vertical-align: middle; }
    .vm-tier-1 { border-left: 3px solid #2563eb; }
    .vm-tier-2 { border-left: 3px solid #94a3b8; }
    .vm-tier-3 { border-color: #e5e7eb; color: #6b7280; }
    .vm-tier-3 h4 { font-size: 0.9rem; }
    .vm-crossrefs { font-size: 0.8rem; margin-top: 0.35rem; }
    .vm-crossref-label { color: #6b7280; font-weight: 500; margin-right: 0.25rem; }
    .badge-measurement { background: #dbeafe; color: #1e40af; }
    .badge-lifecycle { background: #d1fae5; color: #065f46; }
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
    .source-material { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .source-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem 1.25rem; text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 120px; }
    .source-card-count { font-size: 1.5rem; font-weight: 700; color: #1e40af; }
    .source-card-label { font-size: 0.8rem; color: #6b7280; }
    .source-card-date { font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem; }
    .conf-badge { display: inline-block; font-size: 0.8rem; padding: 0.1em 0.5em; border-radius: 3px; font-weight: 500; }
    .conf-high { background: #d1fae5; color: #065f46; }
    .conf-med { background: #fef3c7; color: #92400e; }
    .conf-low { background: #f3f4f6; color: #6b7280; }
    .performance-model-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; margin-bottom: 0.75rem; }
    .performance-model table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    .performance-model th, .performance-model td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .performance-model th { font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; background: #f9fafb; }
    .performance-model tbody tr:hover { background: #f3f4f6; }
    .performance-model td:first-child { font-weight: 600; white-space: nowrap; }
    .performance-model ul { margin: 0; padding-left: 1.1rem; }
    .performance-model ul li { font-size: 0.875rem; margin-bottom: 0.15rem; }
    .performance-model .state-name { font-weight: 600; }
    .performance-model .breakdown-text { font-size: 0.875rem; color: #374151; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .interpretation { font-size: 0.85rem; color: #6b7280; font-style: italic; }${options?.extraCss ? `\n    ${options.extraCss}` : ""}
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
