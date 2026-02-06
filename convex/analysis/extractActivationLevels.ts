/**
 * Types and prompt for multi-level activation extraction.
 *
 * S001: Type definitions
 * S002: System prompt for Claude extraction
 */

// --- S001: Type Definitions ---

export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

// --- S002: System Prompt ---

export const ACTIVATION_SYSTEM_PROMPT = `You are a product analyst identifying user activation progression from website content.

Extract 3-4 activation levels representing the journey from first exploration to full adoption. Each level represents a deeper commitment to the product.

Return ONLY valid JSON matching this structure:

{
  "levels": [
    {
      "level": 1,
      "name": "short lowercase name",
      "signalStrength": "weak|medium|strong|very_strong",
      "criteria": [{"action": "verb_noun", "count": 1, "timeWindow": "first_7d"}],
      "reasoning": "Why this level matters for activation",
      "confidence": 0.0 to 1.0,
      "evidence": [{"url": "source page URL", "excerpt": "quoted text from page"}]
    }
  ],
  "primaryActivation": 3,
  "overallConfidence": 0.0 to 1.0
}

Signal strength mapping:
- weak: Individual exploration — user created first item, browsed content, basic setup
- medium: Learning the product — used a template, completed a tutorial, configured settings
- strong: Realized core value — shared work, collaborated with others, achieved first outcome
- very_strong: Team adoption — multiple users active, regular usage patterns, embedded in workflow

Identifying primaryActivation:
Set primaryActivation to the level number where the product's core value proposition is first realized. This is the aha-moment — the point where the user experiences the transformation the product promises. For a collaboration tool, this is when someone else engages with shared work. For a project tracker, this is when a task flows through completion.

Look for behavioral language in the content that reveals activation actions:
- Onboarding flows: create, setup, configure, connect, import
- Engagement signals: invite, share, collaborate, assign, comment
- Value moments: complete, publish, launch, deliver, export
- Adoption signals: integrate, automate, customize, scale

Example — B2B SaaS project management tool:

{
  "levels": [
    {
      "level": 1,
      "name": "explorer",
      "signalStrength": "weak",
      "criteria": [{"action": "create_project", "count": 1}],
      "reasoning": "Creating a project is individual exploration — no collaboration yet",
      "confidence": 0.8,
      "evidence": [{"url": "https://example.com/features", "excerpt": "Get started by creating your first project"}]
    },
    {
      "level": 2,
      "name": "organizer",
      "signalStrength": "medium",
      "criteria": [{"action": "create_task", "count": 3}, {"action": "assign_task", "count": 1}],
      "reasoning": "Structuring work shows learning — user understands the task model",
      "confidence": 0.7,
      "evidence": [{"url": "https://example.com/getting-started", "excerpt": "Break your project into tasks and assign them to team members"}]
    },
    {
      "level": 3,
      "name": "collaborator",
      "signalStrength": "strong",
      "criteria": [{"action": "invite_member", "count": 1}, {"action": "complete_task", "count": 1}],
      "reasoning": "Inviting a team member and completing work together realizes the core value of team collaboration",
      "confidence": 0.8,
      "evidence": [{"url": "https://example.com", "excerpt": "Collaborate with your team to ship projects faster"}]
    },
    {
      "level": 4,
      "name": "team_adopter",
      "signalStrength": "very_strong",
      "criteria": [{"action": "invite_member", "count": 3}, {"action": "complete_task", "count": 5, "timeWindow": "first_14d"}],
      "reasoning": "Multiple team members actively completing tasks signals team adoption and workflow embedding",
      "confidence": 0.6,
      "evidence": [{"url": "https://example.com/customers", "excerpt": "Teams ship 2x faster with real-time collaboration"}]
    }
  ],
  "primaryActivation": 3,
  "overallConfidence": 0.75
}

Rules:
- Return ONLY valid JSON, no commentary
- Extract 3-4 levels (never fewer than 3)
- Levels must progress from individual exploration to team adoption
- Use evidence excerpts quoted directly from the page content
- Set overallConfidence based on content quality: 0.8+ for help docs/case studies, 0.5-0.7 for marketing copy, <0.5 for sparse content
- Each criterion action should use verb_noun format (e.g., create_project, invite_member, share_board)`;
