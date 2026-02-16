/**
 * Parsed robots.txt rules for a single user agent.
 */
export interface RobotsTxtRules {
  /** Disallowed path prefixes. */
  disallowed: string[];
  /** Explicitly allowed path prefixes (overrides disallow). */
  allowed: string[];
}

/**
 * Parse a robots.txt file and extract rules for the given user agent.
 *
 * Follows the standard precedence:
 * 1. Look for a section matching the given userAgent
 * 2. Fall back to the "*" section
 * 3. If no rules found, everything is allowed
 *
 * Does NOT handle: Crawl-delay, Sitemap, wildcard patterns (*, $).
 * These are non-standard extensions that most sites don't rely on for access control.
 */
export function parseRobotsTxt(
  robotsTxt: string,
  userAgent: string
): RobotsTxtRules {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  const sections = new Map<string, RobotsTxtRules>();

  let currentAgents: string[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") {
      // A blank line resets the current agent group
      if (line === "" && currentAgents.length > 0) {
        currentAgents = [];
      }
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === "user-agent") {
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!sections.has(agent)) {
        sections.set(agent, { disallowed: [], allowed: [] });
      }
    } else if (directive === "disallow" && value && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        sections.get(agent)!.disallowed.push(value);
      }
    } else if (directive === "allow" && value && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        sections.get(agent)!.allowed.push(value);
      }
    }
  }

  // Prefer specific agent, fall back to wildcard
  const agentLower = userAgent.toLowerCase();
  return (
    sections.get(agentLower) ??
    sections.get("*") ??
    { disallowed: [], allowed: [] }
  );
}

/**
 * Check if a URL path is allowed by the given robots.txt rules.
 *
 * Allow rules take precedence over Disallow rules when both match.
 * Longer path matches take precedence (more specific wins).
 */
export function isPathAllowed(path: string, rules: RobotsTxtRules): boolean {
  // If no rules, everything is allowed
  if (rules.disallowed.length === 0 && rules.allowed.length === 0) {
    return true;
  }

  // Find the most specific matching rule
  let bestMatch = "";
  let bestIsAllow = true;

  for (const prefix of rules.disallowed) {
    if (path.startsWith(prefix) && prefix.length >= bestMatch.length) {
      bestMatch = prefix;
      bestIsAllow = false;
    }
  }

  for (const prefix of rules.allowed) {
    if (path.startsWith(prefix) && prefix.length >= bestMatch.length) {
      bestMatch = prefix;
      bestIsAllow = true;
    }
  }

  return bestIsAllow;
}
