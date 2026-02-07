#!/usr/bin/env node
/**
 * H6 Hypothesis Validation Script
 *
 * Throwaway script that validates the 7-Lens Value Discovery hypothesis (H6).
 * Loads Linear crawled pages from Convex, runs 7 analytical lens prompts via
 * Claude API in parallel, clusters candidates by Jaccard word similarity,
 * tiers by convergence count, compares Tier 1 moments against reference doc,
 * and outputs a validation report.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/validate-h6.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// --- Config ---
const CONVEX_URL = "https://woozy-kangaroo-701.convex.cloud";
const LINEAR_PRODUCT_ID = "nh78n36ve9dt5q0z2pnj9gadnx80mm54";
const LINEAR_USER_ID = "jd7a4vr0mhfwnf20930zzpsmqs80ntnf";
const SIMILARITY_THRESHOLD = 0.15;
const TIER_1_MIN_LENSES = 5;
const TIER_2_MIN_LENSES = 3;
const MODEL = "claude-haiku-4-5-20251001";
const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 60_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// --- Lens Prompts ---
const LENS_PROMPTS = {
  "Capability Mapping": `You are a product analyst applying the Capability Mapping lens.

Identify what users can DO with this product. Focus on concrete capabilities — actions, operations, and functions the product enables.

For each value moment candidate, return:
- name: A concise name for the capability (3-8 words)
- description: What this capability lets users accomplish (1-2 sentences)
- roles: Which user roles benefit most (array of strings, e.g. ["engineer", "product manager"])
- product_surfaces: Where in the product this appears (array of strings, e.g. ["issue tracker", "cycle view"])

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.

Example:
[{"name": "Track issues through lifecycle", "description": "Users can create, assign, prioritize, and close issues through defined workflow states.", "roles": ["engineer", "team lead"], "product_surfaces": ["issue tracker", "board view"]}]`,

  "Effort Elimination": `You are a product analyst applying the Effort Elimination lens.

Identify what work or effort this product REMOVES for users. Focus on manual tasks, coordination overhead, information gathering, and repetitive work that the product eliminates or drastically reduces.

For each value moment candidate, return:
- name: A concise name for the eliminated effort (3-8 words)
- description: What work is removed and how (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.

Example:
[{"name": "Eliminate manual status updates", "description": "Automatic status transitions based on PR merges remove the need to manually update issue status.", "roles": ["engineer"], "product_surfaces": ["integrations", "issue tracker"]}]`,

  "Time Compression": `You are a product analyst applying the Time Compression lens.

Identify what becomes FASTER with this product. Focus on activities that previously took significant time and are now much quicker — faster decisions, faster context-switching, faster onboarding, etc.

For each value moment candidate, return:
- name: A concise name for the time compression (3-8 words)
- description: What is faster and by roughly how much (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.`,

  "Artifact Creation": `You are a product analyst applying the Artifact Creation lens.

Identify what valuable OUTPUTS or ARTIFACTS users produce with this product. Focus on things that persist, can be shared, referenced later, or used by others — reports, plans, documents, configurations, dashboards, etc.

For each value moment candidate, return:
- name: A concise name for the artifact (3-8 words)
- description: What artifact is created and why it's valuable (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.`,

  "Information Asymmetry": `You are a product analyst applying the Information Asymmetry lens.

Identify what users LEARN or DISCOVER through this product that they couldn't easily know otherwise. Focus on insights, visibility, awareness, and knowledge that the product uniquely provides.

For each value moment candidate, return:
- name: A concise name for the information advantage (3-8 words)
- description: What users learn and why it matters (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.`,

  "Decision Enablement": `You are a product analyst applying the Decision Enablement lens.

Identify what DECISIONS this product enables users to make better, faster, or with more confidence. Focus on prioritization, resource allocation, strategic choices, and operational decisions.

For each value moment candidate, return:
- name: A concise name for the decision enabled (3-8 words)
- description: What decision is improved and how (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.`,

  "State Transitions": `You are a product analyst applying the State Transitions lens.

Identify what user STATES change through this product. Focus on transitions in workflow, team dynamics, organizational maturity, or user capability — e.g., from "ad hoc" to "structured", from "siloed" to "collaborative", from "reactive" to "proactive".

For each value moment candidate, return:
- name: A concise name for the state transition (3-8 words)
- description: What state changes and what the before/after looks like (1-2 sentences)
- roles: Which user roles benefit most (array of strings)
- product_surfaces: Where in the product this appears (array of strings)

Return a JSON array of 8-15 candidates. Return ONLY valid JSON, no commentary.`,
};

// --- Utility Functions ---

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(text1, text2) {
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  if (set1.size === 0 && set2.size === 0) return 0;

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function truncateContent(content, maxLength) {
  if (content.length <= maxLength) return content;
  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

function buildPageContext(pages) {
  let totalLength = 0;
  const sections = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}

function parseJsonResponse(responseText) {
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();
  return JSON.parse(jsonStr);
}

function parseReferenceDoc(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const moments = [];
  const refRegex = /### (REF-\d+): (.+?)(?:\s*`\[.*?\]`)?\n[\s\S]*?\*\*Name:\*\* (.+?)\n[\s\S]*?\*\*Description:\*\* ([\s\S]*?)(?=\n\n\*\*Evidence|\n---|\n### REF)/g;

  let match;
  while ((match = refRegex.exec(content)) !== null) {
    moments.push({
      id: match[1],
      name: match[3].trim(),
      description: match[4].trim(),
    });
  }

  return moments;
}

// --- Core Pipeline Functions ---

async function loadLinearData(convex) {
  console.log("Loading crawled pages from Convex...");
  let pages;
  try {
    pages = await convex.query(api.crawledPages.listByProductForTest, {
      productId: LINEAR_PRODUCT_ID,
    });
  } catch {
    // Fallback to MCP query if listByProductForTest isn't deployed yet
    console.log("  (listByProductForTest not deployed, using listByProductMcp)");
    pages = await convex.query(api.crawledPages.listByProductMcp, {
      userId: LINEAR_USER_ID,
      productId: LINEAR_PRODUCT_ID,
    });
  }
  console.log(`  Loaded ${pages.length} crawled pages`);

  let profile = null;
  try {
    profile = await convex.query(api.productProfiles.getForTest, {
      productId: LINEAR_PRODUCT_ID,
    });
    if (profile?.identity) {
      const id = profile.identity;
      console.log(`  Product: ${id.productName || "unknown"}`);
    }
  } catch {
    console.log("  (no product profile found)");
  }

  return { pages, profile };
}

async function runLens(client, lensName, prompt, pageContext, identityContext) {
  const userMessage = identityContext
    ? `${identityContext}\n\nAnalyze the following product content and identify value moment candidates:\n\n${pageContext}`
    : `Analyze the following product content and identify value moment candidates:\n\n${pageContext}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: prompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textContent = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const candidates = parseJsonResponse(textContent);
  if (!Array.isArray(candidates)) {
    throw new Error(`${lensName}: Expected array, got ${typeof candidates}`);
  }

  return candidates.map((c) => ({
    name: String(c.name || ""),
    description: String(c.description || ""),
    roles: Array.isArray(c.roles) ? c.roles.map(String) : [],
    product_surfaces: Array.isArray(c.product_surfaces)
      ? c.product_surfaces.map(String)
      : [],
    lens: lensName,
  }));
}

async function runAllLenses(client, pageContext, identityContext) {
  const lensNames = Object.keys(LENS_PROMPTS);
  const batch1Names = [
    "Capability Mapping",
    "Effort Elimination",
    "Time Compression",
    "Artifact Creation",
  ];
  const batch2Names = [
    "Information Asymmetry",
    "Decision Enablement",
    "State Transitions",
  ];

  console.log("\nRunning Batch 1 lenses (4 in parallel)...");
  const batch1Results = await Promise.allSettled(
    batch1Names.map((name) =>
      runLens(client, name, LENS_PROMPTS[name], pageContext, identityContext)
    )
  );

  const allCandidates = [];
  const lensStats = {};

  for (let i = 0; i < batch1Names.length; i++) {
    const name = batch1Names[i];
    const result = batch1Results[i];
    if (result.status === "fulfilled") {
      lensStats[name] = result.value.length;
      allCandidates.push(...result.value);
      console.log(`  ${name}: ${result.value.length} candidates`);
    } else {
      lensStats[name] = 0;
      console.error(`  ${name}: FAILED - ${result.reason}`);
    }
  }

  // Build batch 1 summary for batch 2 context
  const batch1Summary = allCandidates
    .slice(0, 30) // Top 30 from batch 1
    .map((c) => `- [${c.lens}] ${c.name}: ${c.description}`)
    .join("\n");

  const batch2Context = batch1Summary
    ? `\n\nPrevious analysis has identified these value moment candidates from other lenses. Use this as additional context (but find NEW moments from your lens, don't repeat these):\n\n${batch1Summary}`
    : "";

  console.log("\nRunning Batch 2 lenses (3 in parallel)...");
  const batch2Results = await Promise.allSettled(
    batch2Names.map((name) =>
      runLens(
        client,
        name,
        LENS_PROMPTS[name],
        pageContext + batch2Context,
        identityContext
      )
    )
  );

  for (let i = 0; i < batch2Names.length; i++) {
    const name = batch2Names[i];
    const result = batch2Results[i];
    if (result.status === "fulfilled") {
      lensStats[name] = result.value.length;
      allCandidates.push(...result.value);
      console.log(`  ${name}: ${result.value.length} candidates`);
    } else {
      lensStats[name] = 0;
      console.error(`  ${name}: FAILED - ${result.reason}`);
    }
  }

  console.log(
    `\nTotal candidates: ${allCandidates.length} across ${lensNames.length} lenses`
  );
  return { allCandidates, lensStats };
}

function validateCandidates(candidates) {
  console.log("\nValidating candidates...");
  const before = candidates.length;

  const validated = candidates.filter((c) => {
    // Remove candidates with very short names (likely feature names not value moments)
    if (c.name.split(/\s+/).length < 3) return false;
    // Remove vague descriptions
    if (c.description.length < 15) return false;
    return true;
  });

  // Deduplicate by exact name match within same lens
  const seen = new Set();
  const deduped = validated.filter((c) => {
    const key = `${c.lens}::${c.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `  ${before} → ${deduped.length} (removed ${before - deduped.length} invalid/duplicate)`
  );
  return deduped;
}

function clusterCandidates(candidates) {
  console.log("\nClustering candidates...");

  // Each candidate starts as its own cluster
  const clusters = candidates.map((c, i) => ({
    id: i,
    candidates: [c],
    lenses: new Set([c.lens]),
  }));

  // Map candidate index to cluster index
  const clusterMap = candidates.map((_, i) => i);

  function findCluster(idx) {
    while (clusterMap[idx] !== idx) {
      clusterMap[idx] = clusterMap[clusterMap[idx]];
      idx = clusterMap[idx];
    }
    return idx;
  }

  // Collect all cross-lens similarity scores for diagnostics
  const allScores = [];

  // Compare all pairs, merge if similar enough and from different lenses
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (candidates[i].lens === candidates[j].lens) continue;

      const textI = `${candidates[i].name} ${candidates[i].description}`;
      const textJ = `${candidates[j].name} ${candidates[j].description}`;
      const sim = jaccardSimilarity(textI, textJ);

      if (sim > 0.05) {
        allScores.push({ i, j, sim, nameI: candidates[i].name, nameJ: candidates[j].name });
      }

      const ci = findCluster(i);
      const cj = findCluster(j);
      if (ci === cj) continue;

      const clusterI = clusters[ci];

      if (sim >= SIMILARITY_THRESHOLD) {
        // Cap cluster size to prevent mega-clusters
        const mergedSize = clusterI.candidates.length + clusters[cj].candidates.length;
        if (mergedSize > 15) continue;

        // Merge j's cluster into i's cluster
        clusterMap[cj] = ci;
        clusterI.candidates.push(...clusters[cj].candidates);
        for (const lens of clusters[cj].lenses) {
          clusterI.lenses.add(lens);
        }
        clusters[cj].candidates = [];
        clusters[cj].lenses = new Set();
      }
    }
  }

  // Print top similarity scores for diagnostics
  allScores.sort((a, b) => b.sim - a.sim);
  console.log("  Top 20 cross-lens similarity scores:");
  for (const s of allScores.slice(0, 20)) {
    console.log(`    ${s.sim.toFixed(3)} | "${s.nameI}" <-> "${s.nameJ}"`);
  }

  // Collect non-empty clusters
  const result = clusters
    .filter((c) => c.candidates.length > 0)
    .map((c) => {
      // Name from longest description candidate
      const best = c.candidates.reduce((a, b) =>
        a.description.length >= b.description.length ? a : b
      );
      return {
        name: best.name,
        description: best.description,
        lenses: [...c.lenses],
        lensCount: c.lenses.size,
        candidates: c.candidates,
      };
    })
    .sort((a, b) => b.lensCount - a.lensCount);

  console.log(`  ${candidates.length} candidates → ${result.length} clusters`);
  return result;
}

function tierClusters(clusters) {
  const tiers = { tier1: [], tier2: [], tier3: [] };

  for (const cluster of clusters) {
    if (cluster.lensCount >= TIER_1_MIN_LENSES) {
      tiers.tier1.push(cluster);
    } else if (cluster.lensCount >= TIER_2_MIN_LENSES) {
      tiers.tier2.push(cluster);
    } else {
      tiers.tier3.push(cluster);
    }
  }

  console.log(
    `\nTier distribution: T1=${tiers.tier1.length}, T2=${tiers.tier2.length}, T3=${tiers.tier3.length}`
  );
  return tiers;
}

function compareAgainstReference(tier1Moments, referenceMoments) {
  console.log("\nComparing Tier 1 moments against reference...");
  const comparisons = [];

  for (const moment of tier1Moments) {
    const momentText = `${moment.name} ${moment.description}`;
    let bestMatch = null;
    let bestScore = 0;

    for (const ref of referenceMoments) {
      const refText = `${ref.name} ${ref.description}`;
      const score = jaccardSimilarity(momentText, refText);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ref;
      }
    }

    let suggestedRating;
    if (bestScore > 0.15) {
      suggestedRating = "accurate";
    } else if (bestScore > 0.08) {
      suggestedRating = "mostly accurate";
    } else {
      suggestedRating = "inaccurate";
    }

    comparisons.push({
      moment,
      bestMatch,
      bestScore,
      suggestedRating,
    });

    console.log(
      `  "${moment.name}" → ${bestMatch ? bestMatch.id : "none"} (${bestScore.toFixed(3)}) [${suggestedRating}]`
    );
  }

  return comparisons;
}

function generateReport(lensStats, clusters, tiers, comparisons) {
  const accurateCount = comparisons.filter(
    (c) => c.suggestedRating === "accurate"
  ).length;
  const mostlyAccurateCount = comparisons.filter(
    (c) => c.suggestedRating === "mostly accurate"
  ).length;
  const inaccurateCount = comparisons.filter(
    (c) => c.suggestedRating === "inaccurate"
  ).length;
  const total = comparisons.length;
  const accuracy = total > 0 ? (accurateCount + mostlyAccurateCount) / total : 0;
  const accuracyPct = (accuracy * 100).toFixed(1);

  const totalCandidates = Object.values(lensStats).reduce((a, b) => a + b, 0);

  let report = `# M003 Validation Results — H6: 7-Lens Value Discovery

**Date:** ${new Date().toISOString().split("T")[0]}
**Product:** Linear (reference case)
**Model:** ${MODEL}
**Similarity Threshold:** ${SIMILARITY_THRESHOLD}

---

## Lens Execution Summary

| Lens | Candidates |
|------|-----------|
`;

  for (const [lens, count] of Object.entries(lensStats)) {
    report += `| ${lens} | ${count} |\n`;
  }
  report += `| **Total** | **${totalCandidates}** |\n`;

  report += `
---

## Clustering & Convergence

- **Total candidates (after validation):** ${clusters.reduce((sum, c) => sum + c.candidates.length, 0)}
- **Clusters formed:** ${clusters.length}
- **Similarity threshold:** ${SIMILARITY_THRESHOLD}
- **Clustering method:** Greedy single-linkage with Jaccard word similarity, same-lens constraint

### Tier Distribution

| Tier | Min Lenses | Count |
|------|-----------|-------|
| Tier 1 (high convergence) | ${TIER_1_MIN_LENSES}+ | ${tiers.tier1.length} |
| Tier 2 (medium convergence) | ${TIER_2_MIN_LENSES}-${TIER_1_MIN_LENSES - 1} | ${tiers.tier2.length} |
| Tier 3 (low convergence) | 1-${TIER_2_MIN_LENSES - 1} | ${tiers.tier3.length} |

---

## Tier 1 Moments — Detail

`;

  if (comparisons.length === 0) {
    report += `*No Tier 1 moments found. This may indicate the similarity threshold is too high or the lenses aren't producing convergent results.*\n`;
  } else {
    for (const comp of comparisons) {
      report += `### ${comp.moment.name}

**Description:** ${comp.moment.description}
**Contributing lenses (${comp.moment.lensCount}):** ${comp.moment.lenses.join(", ")}
**Best reference match:** ${comp.bestMatch ? `${comp.bestMatch.id} — ${comp.bestMatch.name}` : "None"}
**Similarity score:** ${comp.bestScore.toFixed(3)}
**Suggested rating:** ${comp.suggestedRating}

`;
    }
  }

  report += `---

## Tier 2 Moments — Summary

`;

  if (tiers.tier2.length === 0) {
    report += `*No Tier 2 moments.*\n\n`;
  } else {
    report += `| Moment | Lenses | Contributing Lenses |\n|--------|--------|--------------------|\n`;
    for (const m of tiers.tier2) {
      report += `| ${m.name} | ${m.lensCount} | ${m.lenses.join(", ")} |\n`;
    }
    report += "\n";
  }

  report += `---

## Accuracy Calculation

| Rating | Count |
|--------|-------|
| Accurate | ${accurateCount} |
| Mostly Accurate | ${mostlyAccurateCount} |
| Inaccurate | ${inaccurateCount} |
| **Total Tier 1** | **${total}** |

**Accuracy = (accurate + mostly_accurate) / total = (${accurateCount} + ${mostlyAccurateCount}) / ${total} = ${accuracyPct}%**

**Threshold:** 70%
**Result:** ${accuracy >= 0.7 ? "PASS" : "FAIL"} (${accuracyPct}% ${accuracy >= 0.7 ? ">=" : "<"} 70%)

---

## Lens Contribution Analysis

`;

  // Which lenses appear most in Tier 1
  const lensContributions = {};
  for (const comp of comparisons) {
    for (const lens of comp.moment.lenses) {
      lensContributions[lens] = (lensContributions[lens] || 0) + 1;
    }
  }

  if (Object.keys(lensContributions).length > 0) {
    report += `| Lens | Tier 1 Appearances | Contribution Rate |\n|------|-------------------|-------------------|\n`;
    for (const [lens, count] of Object.entries(lensContributions).sort(
      (a, b) => b[1] - a[1]
    )) {
      const rate = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
      report += `| ${lens} | ${count} | ${rate}% |\n`;
    }
  }

  report += `
---

## H6 Verdict

`;

  if (accuracy >= 0.7) {
    report += `### Recommended: Validate H6

The 7-lens convergence pipeline achieved **${accuracyPct}% accuracy** on Linear (reference case), exceeding the 70% threshold.

**Action items:**
1. Update HYPOTHESES.md: Change H6 status from 🔵 Testing to 🟢 Validated
2. Add evidence: "${total} Tier 1 moments evaluated, ${accuracyPct}% accuracy (${accurateCount} accurate + ${mostlyAccurateCount} mostly accurate)"
3. Proceed with M004: Output layers (ICPs, activation maps, measurement specs)

**Note:** These are first-pass automated ratings based on Jaccard word similarity.
Human review should confirm or adjust individual ratings before finalizing.
`;
  } else {
    report += `### Recommended: Keep H6 at Testing

The 7-lens convergence pipeline achieved **${accuracyPct}% accuracy** on Linear (reference case), below the 70% threshold.

**Action items:**
1. Keep HYPOTHESES.md H6 status at 🔵 Testing
2. Document learnings and identify which lenses underperformed
3. Refine lens prompts and re-run validation

**Note:** These are first-pass automated ratings. Human review may adjust the result.
`;
  }

  report += `
---

*Generated by scripts/validate-h6.mjs on ${new Date().toISOString()}*
`;

  return { report, accuracy, accuracyPct, accurateCount, mostlyAccurateCount, inaccurateCount, total };
}

// --- Main ---

async function main() {
  console.log("=== H6 Hypothesis Validation ===\n");

  // Validate environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY environment variable is required");
    console.error("Usage: ANTHROPIC_API_KEY=sk-... node scripts/validate-h6.mjs");
    process.exit(1);
  }

  // Initialize clients
  const convex = new ConvexHttpClient(CONVEX_URL);
  const anthropic = new Anthropic({ apiKey });

  // 1. Load data
  const { pages, profile } = await loadLinearData(convex);

  if (pages.length === 0) {
    console.error("ERROR: No crawled pages found for Linear product");
    console.error(`Product ID: ${LINEAR_PRODUCT_ID}`);
    process.exit(1);
  }

  // Build page context
  const pageContext = buildPageContext(pages);
  console.log(`  Page context: ${pageContext.length} chars`);

  let identityContext = "";
  if (profile?.identity) {
    const id = profile.identity;
    identityContext = `Product: ${id.productName || "Linear"}\nDescription: ${id.description || "Project management tool"}`;
    if (id.targetCustomer) {
      identityContext += `\nTarget customer: ${id.targetCustomer}`;
    }
  } else {
    identityContext =
      "Product: Linear\nDescription: Modern project management and issue tracking tool for software teams";
  }

  // 2. Run all lenses
  const { allCandidates, lensStats } = await runAllLenses(
    anthropic,
    pageContext,
    identityContext
  );

  // 3. Validate candidates
  const validated = validateCandidates(allCandidates);

  // 4. Cluster
  const clusters = clusterCandidates(validated);

  // 5. Tier
  const tiers = tierClusters(clusters);

  // 6. Load reference and compare
  const refPath = resolve(
    PROJECT_ROOT,
    "docs/reference/linear-value-moments.md"
  );
  const referenceMoments = parseReferenceDoc(refPath);
  console.log(`\nReference moments loaded: ${referenceMoments.length}`);

  const comparisons = compareAgainstReference(tiers.tier1, referenceMoments);

  // 7. Generate report
  const { report, accuracy, accuracyPct, total } = generateReport(
    lensStats,
    clusters,
    tiers,
    comparisons
  );

  // 8. Write report
  const reportPath = resolve(PROJECT_ROOT, "docs/plans/M003-validation-results.md");
  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to: ${reportPath}`);

  // 9. Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total candidates: ${allCandidates.length}`);
  console.log(`After validation: ${validated.length}`);
  console.log(`Clusters: ${clusters.length}`);
  console.log(
    `Tiers: T1=${tiers.tier1.length}, T2=${tiers.tier2.length}, T3=${tiers.tier3.length}`
  );
  console.log(`Tier 1 accuracy: ${accuracyPct}% (threshold: 70%)`);
  console.log(`H6 verdict: ${accuracy >= 0.7 ? "VALIDATED" : "NEEDS REFINEMENT"}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
