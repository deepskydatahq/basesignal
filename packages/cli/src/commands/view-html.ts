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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --blue: #118AB2;
      --teal: #06D6A0;
      --teal-dark: #05a87d;
      --teal-light: #e6faf4;
      --gold: #FFD166;
      --gold-dark: #c9a030;
      --gold-light: #fff8e6;
      --rose: #EF476F;
      --rose-light: #fde8ed;
      --navy: #073B4C;
      --navy-mid: #0d5068;

      --text: #1a2b33;
      --text-2: #4a6270;
      --text-3: #8a9da8;
      --bg: #f0f2f4;
      --card: #ffffff;
      --subtle: #f7f8f9;
      --border: #e0e5e9;

      --font-d: 'DM Serif Display', Georgia, serif;
      --font-b: 'Plus Jakarta Sans', system-ui, sans-serif;
      --font-m: 'JetBrains Mono', monospace;
    }

    *, *::before, *::after { box-sizing: border-box; }
    html { background: var(--bg); min-height: 100%; }

    body {
      font-family: var(--font-b);
      font-size: 14.5px;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      max-width: 900px;
      margin: 0 auto;
      padding: 0 1rem 3rem;
      -webkit-font-smoothing: antialiased;
    }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    h2 { font-family: var(--font-d); font-size: 1.8rem; font-weight: 400; margin: 0 0 1rem; }
    h3 { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.25rem; }
    h4 { font-size: 0.68rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; margin: 0.85rem 0 0.3rem; }

    code { font-family: var(--font-m); font-size: 0.78em; background: var(--subtle); padding: 0.15em 0.4em; border-radius: 3px; color: var(--navy); }

    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 0.5rem 0; }
    th { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); padding: 0.5rem 0.6rem; text-align: left; border-bottom: 2px solid var(--border); }
    td { padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }

    /* ============ HERO HEADER ============ */
    .report-header {
      background: var(--navy);
      margin: 0 -1rem;
      padding: 1.5rem 2rem 2rem;
      border-radius: 0 0 20px 20px;
      position: relative;
      overflow: hidden;
    }
    .report-header::after {
      content: '';
      position: absolute;
      top: -60%; right: -30%;
      width: 80%; height: 250%;
      background: radial-gradient(ellipse, rgba(6,214,160,0.12) 0%, transparent 60%);
      pointer-events: none;
    }
    .back-link { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.4); display: inline-block; margin-bottom: 1rem; position: relative; z-index: 1; }
    .back-link:hover { color: #fff; text-decoration: none; }
    .report-header h1 { font-family: var(--font-d); font-size: 3rem; color: #fff; margin: 0; line-height: 1.1; position: relative; z-index: 1; }
    .hero-url { display: block; font-size: 0.82rem; color: rgba(255,255,255,0.4); margin-top: 0.5rem; position: relative; z-index: 1; }
    .hero-url:hover { color: rgba(255,255,255,0.7); text-decoration: none; }
    .hero-stats { display: flex; gap: 2rem; margin-top: 1.5rem; position: relative; z-index: 1; }
    .hero-stat { display: flex; flex-direction: column; }
    .hero-stat-value { font-size: 1.4rem; font-weight: 800; color: var(--teal); line-height: 1.2; }
    .hero-stat-label { font-size: 0.68rem; font-weight: 600; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.15rem; }

    /* ============ SOURCE MATERIAL ============ */
    .hero-brand { font-family: var(--font-d); font-size: 1rem; color: rgba(255,255,255,0.3); margin-bottom: 0.5rem; letter-spacing: 0.02em; position: relative; z-index: 1; }
    .source-material { margin-top: 1.5rem; position: relative; z-index: 1; }
    .source-material-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); display: block; margin-bottom: 0.5rem; }
    .source-boxes { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .source-box {
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.75rem 1rem;
      display: flex; flex-direction: column; min-width: 140px;
    }
    .source-value { font-size: 1.6rem; font-weight: 800; color: var(--teal); line-height: 1.2; }
    .source-label { font-size: 0.78rem; color: rgba(255,255,255,0.55); margin-top: 0.1rem; }
    .source-date { font-size: 0.68rem; color: rgba(255,255,255,0.25); margin-top: 0.25rem; }

    /* ============ NAV ============ */
    .section-nav {
      position: sticky; top: 0; z-index: 100;
      background: var(--bg);
      display: flex; gap: 0; flex-wrap: wrap;
      border-bottom: 1px solid var(--border);
      margin: 0 0 1.25rem;
    }
    .section-nav a {
      font-size: 0.75rem; font-weight: 700; color: var(--text-3);
      padding: 0.75rem 0.85rem; border-bottom: 2px solid transparent; margin-bottom: -1px;
      letter-spacing: 0.02em; transition: all 0.15s;
    }
    .section-nav a:hover { color: var(--text); text-decoration: none; }
    .section-nav a.active { color: var(--navy); border-bottom-color: var(--teal); }
    .section-nav a.dimmed { color: var(--border); }

    /* ============ SECTIONS ============ */
    section {
      background: var(--card);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      margin-bottom: 0.75rem;
      border: 1px solid var(--border);
    }
    section.no-data { background: var(--subtle); }
    section.no-data h2 { color: var(--text-3); }
    .not-analyzed { color: var(--text-3); font-style: italic; }
    .confidence { font-size: 0.8rem; color: var(--text-3); margin-top: 0.75rem; }
    .section-subtitle { font-size: 0.85rem; color: var(--text-2); margin: -0.5rem 0 1rem; }

    /* Section accent underlines */
    section h2 { position: relative; padding-bottom: 0.6rem; margin-bottom: 1.25rem; }
    section h2::after { content: ''; position: absolute; bottom: 0; left: 0; width: 32px; height: 3px; border-radius: 2px; }
    #identity h2 { color: var(--navy); } #identity h2::after { background: var(--blue); }
    #outcomes h2 { color: var(--navy); } #outcomes h2::after { background: var(--teal); }
    #journey h2 { color: var(--navy); } #journey h2::after { background: var(--gold); }
    #icp-profiles h2 { color: var(--navy); } #icp-profiles h2::after { background: var(--rose); }
    #value-moments h2 { color: var(--navy); } #value-moments h2::after { background: var(--blue); }
    #measurement-spec h2 { color: var(--navy); } #measurement-spec h2::after { background: var(--navy); }
    #lifecycle-states h2 { color: var(--navy); } #lifecycle-states h2::after { background: var(--teal); }

    /* ============ IDENTITY ============ */
    .identity-description { font-size: 1.05rem; line-height: 1.75; color: var(--text); margin: 0 0 1.25rem; }
    .identity-target { margin-bottom: 0.75rem; }
    .identity-target-label { display: block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 0.15rem; }
    .identity-target-value { font-weight: 600; color: var(--blue); font-size: 0.95rem; }
    .identity-context { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem; }

    /* ============ SECTION INTRO ============ */
    .section-intro { font-size: 0.88rem; color: var(--text-2); line-height: 1.65; margin: -0.5rem 0 1.25rem; }

    /* ============ POSITIONING ============ */
    .positioning { margin-top: 1.25rem; }
    .positioning h3 { font-family: var(--font-d); font-size: 1.15rem; margin: 0 0 0.65rem; }
    .pos-group { margin-bottom: 0.65rem; }
    .pos-label { display: block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 0.25rem; }
    .pos-items { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .pos-item { display: inline-block; font-size: 0.82rem; padding: 0.3em 0.65em; border: 1px solid var(--border); border-radius: 6px; color: var(--text); background: var(--card); }

    /* ============ PERFORMANCE TABLE ============ */
    .perf-table { margin-top: 0.5rem; table-layout: fixed; }
    .perf-table th:nth-child(1) { width: 18%; }
    .perf-table th:nth-child(2) { width: 60%; }
    .perf-table th:nth-child(3) { width: 22%; }
    .state-window-cell { font-size: 0.82rem; color: var(--text-3); }
    .state-pill { display: inline-block; font-size: 0.72rem; font-weight: 800; padding: 0.3em 0.7em; border-radius: 6px; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; }
    .state-def { font-size: 0.85rem; color: var(--text-2); }
    .state-window { font-size: 0.72rem; color: var(--text-3); background: var(--subtle); padding: 0.1em 0.4em; border-radius: 3px; margin-left: 0.25rem; }
    .row-primary { background: var(--subtle); }

    /* ============ GUIDANCE ============ */
    .guidance-box { background: var(--subtle); border: 1px dashed var(--border); border-radius: 10px; padding: 1rem 1.25rem; margin-top: 1.25rem; }
    .guidance-box h3 { margin: 0 0 0.25rem; font-size: 0.9rem; }
    .guidance-box p { font-size: 0.85rem; color: var(--text-2); margin: 0; }

    /* ============ BADGES / TAGS ============ */
    .badge { display: inline-block; font-size: 0.65rem; font-weight: 700; padding: 0.2em 0.5em; border-radius: 3px; background: var(--subtle); color: var(--text-2); letter-spacing: 0.03em; text-transform: uppercase; }
    .badge-measurement { background: #e8f4f8; color: var(--blue); }
    .badge-lifecycle { background: var(--teal-light); color: var(--teal-dark); }
    .badge-heartbeat { background: var(--rose-light); color: var(--rose); }
    .badge-primary { background: var(--gold-light); color: var(--gold-dark); }

    .tag { display: inline-block; font-size: 0.72rem; font-weight: 500; padding: 0.2em 0.55em; border-radius: 3px; background: var(--subtle); color: var(--text-2); margin: 0.15rem 0.15rem 0 0; }
    .tag-user { background: #e8f4f8; color: var(--blue); }
    .tag-business { background: var(--gold-light); color: var(--gold-dark); }

    /* ============ OUTCOMES ============ */
    .outcome-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem;
      margin-bottom: 0.75rem; background: var(--card);
    }
    .outcome-desc {
      font-size: 0.95rem; font-weight: 600; line-height: 1.6;
      margin: 0 0 0.85rem; color: var(--text);
    }
    .outcome-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .outcome-col h4 { margin-top: 0; }
    .outcome-col ul { margin: 0.15rem 0 0; padding-left: 1rem; font-size: 0.82rem; color: var(--text-2); }
    .outcome-col li { margin-bottom: 0.1rem; }
    .outcome-codes { display: flex; flex-wrap: wrap; gap: 0.2rem; }
    .outcome-codes code { font-size: 0.72rem; }

    /* ============ JOURNEY ============ */
    .guidance-events { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .segment-item { margin-top: 0.65rem; }
    .segment-item strong { font-size: 0.88rem; }
    .segment-item p { font-size: 0.82rem; color: var(--text-2); margin: 0.2rem 0 0; }
    .metrics-section { margin-top: 1.5rem; }
    .metrics-section > h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 0.75rem; }
    .metric-card { border: 1px solid var(--border); border-radius: 10px; padding: 1.1rem 1.25rem; }
    .metric-card h4 { margin: 0 0 0.35rem; font-size: 0.82rem; color: var(--navy); text-transform: none; letter-spacing: 0; }
    .metric-formula { font-family: var(--font-m); font-size: 0.75rem; color: var(--blue); background: var(--subtle); padding: 0.3em 0.55em; border-radius: 4px; display: inline-block; margin: 0 0 0.5rem; }
    .metric-card > p { font-size: 0.82rem; color: var(--text-2); margin: 0.25rem 0; line-height: 1.55; }
    .metric-thresholds { margin-top: 0.5rem; }
    .threshold { font-size: 0.78rem; padding: 0.35em 0.6em; border-radius: 4px; margin-bottom: 0.3rem; line-height: 1.5; }
    .threshold.warn { background: var(--gold-light); color: var(--gold-dark); }

    .risk-low { color: var(--teal-dark); }
    .risk-medium { color: var(--gold-dark); }
    .risk-high { color: var(--rose); }

    /* ============ ICP SEGMENTS ============ */
    .icp-card {
      border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem;
      margin-bottom: 0.75rem; background: var(--card);
    }
    .icp-card h3 { font-family: var(--font-d); font-size: 1.15rem; font-weight: 400; margin: 0 0 0.35rem; }
    .icp-desc { font-size: 0.88rem; color: var(--text-2); margin: 0 0 0.5rem; line-height: 1.55; }
    .icp-card ul { margin: 0.15rem 0 0.35rem; padding-left: 1.1rem; font-size: 0.85rem; color: var(--text-2); }
    .icp-card li { margin-bottom: 0.15rem; }

    /* ============ DETAILS ============ */
    details > summary { cursor: pointer; font-weight: 700; font-size: 0.85rem; color: var(--text-2); padding: 0.35rem 0; }
    .prop-detail { margin-top: 0.5rem; }
    .prop-detail summary { font-size: 0.78rem; }

    /* ============ MEASUREMENT SPEC ============ */
    .entity-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    .entity-card {
      border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;
      border-top: 3px solid var(--navy);
    }
    .entity-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
    .entity-head h3 { margin: 0; }
    .entity-card p { font-size: 0.85rem; color: var(--text-2); margin: 0 0 0.5rem; }
    .entity-acts { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.5rem; }
    .entity-acts code { font-size: 0.72rem; background: var(--navy); color: rgba(255,255,255,0.85); padding: 0.2em 0.45em; border-radius: 3px; }
    .prop-detail { margin-top: 0.5rem; }
    .prop-detail summary { font-size: 0.78rem; font-weight: 700; color: var(--text-2); cursor: pointer; }
    .prop-detail table td code { font-size: 0.75rem; }

    /* ============ CITATIONS ============ */
    .citations { margin-top: 0.65rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .citations h4 { margin-top: 0; }
    .citations ul { margin: 0.15rem 0 0; padding-left: 1rem; font-size: 0.8rem; color: var(--text-2); }
    .citations li { margin-bottom: 0.2rem; }
    .citations a { font-size: 0.75rem; }
    .citations em { color: var(--text-3); }

    /* ============ WARNINGS ============ */
    .warnings { background: var(--gold-light); border: 1px solid var(--gold); border-radius: 8px; padding: 0.75rem 1rem; margin-top: 0.75rem; }
    .warnings h4 { color: var(--gold-dark); margin: 0; }
    .warnings ul { margin: 0.2rem 0 0; padding-left: 1.1rem; font-size: 0.85rem; }

    /* ============ PROGRESS / CONFIDENCE ============ */
    .progress-bar { position: relative; height: 1rem; background: var(--border); border-radius: 5px; overflow: hidden; min-width: 80px; }
    .progress-fill { height: 100%; background: var(--teal); border-radius: 5px; }
    .progress-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 800; color: #fff; }
    .progress-bar-mini { display: inline-block; width: 50px; height: 0.6rem; vertical-align: middle; margin-right: 0.3rem; }
    .conf-badge { display: inline-block; font-size: 0.68rem; font-weight: 700; padding: 0.15em 0.45em; border-radius: 3px; }
    .conf-high { background: var(--teal-light); color: var(--teal-dark); }
    .conf-med { background: var(--gold-light); color: var(--gold-dark); }
    .conf-low { background: var(--subtle); color: var(--text-3); }

    /* ============ FOOTER ============ */
    .report-footer { text-align: center; padding: 1.5rem 0 0.5rem; font-size: 0.72rem; color: var(--text-3); }
    .report-footer a { color: var(--text-3); }
    .report-footer a:hover { color: var(--blue); }${options?.extraCss ? `\n    ${options.extraCss}` : ""}
  </style>
</head>
<body>
${body}
<div class="report-footer">Generated by <a href="https://github.com/deepskydatahq/basesignal">basesignal</a></div>
${options?.script ? `<script>${options.script}</script>` : ""}
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
