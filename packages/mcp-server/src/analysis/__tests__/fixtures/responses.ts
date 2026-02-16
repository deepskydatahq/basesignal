// Canned LLM response strings for testing.

export const IDENTITY_RESPONSE = JSON.stringify({
  productName: "Example Product",
  description: "A project management tool for engineering teams that provides boards, sprint planning, and status reporting.",
  targetCustomer: "Engineering managers leading teams of 5-50 developers at B2B SaaS companies",
  businessModel: "B2B SaaS with freemium model",
  industry: "Developer Tools",
  companyStage: "growth",
  confidence: 0.85,
  evidence: [
    { url: "https://example.com", excerpt: "Project management tool for engineering teams" },
    { url: "https://example.com/about", excerpt: "Engineering managers leading teams of 5-50 developers" },
  ],
});

export const ACTIVATION_RESPONSE = JSON.stringify({
  levels: [
    {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "create_board", count: 1 }],
      reasoning: "Creating the first board shows initial interest",
      confidence: 0.7,
      evidence: [{ url: "https://example.com/help/getting-started", excerpt: "Step 1: Create your first board" }],
    },
    {
      level: 2,
      name: "builder",
      signalStrength: "medium",
      criteria: [{ action: "invite_member", count: 2 }, { action: "create_sprint", count: 1 }],
      reasoning: "Inviting team members and creating a sprint shows commitment",
      confidence: 0.65,
      evidence: [{ url: "https://example.com/help/getting-started", excerpt: "Step 2: Invite team members" }],
    },
    {
      level: 3,
      name: "collaborator",
      signalStrength: "strong",
      criteria: [{ action: "complete_issue", count: 5 }, { action: "share_report", count: 1 }],
      reasoning: "Completing issues and sharing reports means the team is getting real value",
      confidence: 0.6,
      evidence: [{ url: "https://example.com/customers", excerpt: "reduced sprint planning time from 2 hours to 10 minutes" }],
    },
  ],
  primaryActivation: 2,
  overallConfidence: 0.65,
});

/**
 * Generate a lens response for any lens type.
 */
export function lensResponse(lens: string, lensField: string): string {
  const candidates = [
    {
      name: `${lens} Candidate 1`,
      description: `User opens the Board View and performs an action specific to ${lens}`,
      role: "Engineering Manager",
      confidence: "high",
      source_urls: ["https://example.com/features"],
      [lensField]: Array.isArray(getFieldDefault(lensField))
        ? getFieldDefault(lensField)
        : `Specific ${lensField} for candidate 1`,
    },
    {
      name: `${lens} Candidate 2`,
      description: `User navigates to Sprint Planning and performs ${lens}-related action`,
      role: "Developer",
      confidence: "medium",
      source_urls: ["https://example.com/features", "https://example.com/customers"],
      [lensField]: Array.isArray(getFieldDefault(lensField))
        ? getFieldDefault(lensField)
        : `Specific ${lensField} for candidate 2`,
    },
  ];
  return JSON.stringify(candidates);
}

function getFieldDefault(lensField: string): string | string[] {
  if (lensField === "enabling_features") return ["Board View", "Sprint Planner"];
  return `Example ${lensField} value`;
}

export const CLUSTER_RESPONSE = JSON.stringify([
  {
    label: "Sprint planning and management",
    candidate_ids: ["c-1", "c-2"],
  },
  {
    label: "Status reporting and dashboards",
    candidate_ids: ["c-3", "c-4"],
  },
  {
    label: "Team collaboration",
    candidate_ids: ["c-5"],
  },
]);

export const MERGE_RESPONSE = JSON.stringify({
  name: "Create sprint plan from capacity data",
  description: "Engineering manager opens Sprint Planning view, reviews team capacity indicators, and clicks Auto-assign to populate the sprint in seconds.",
  roles: ["Engineering Manager", "Tech Lead"],
  product_surfaces: ["Sprint Planning", "Board View"],
  is_coherent: true,
});

export const ICP_RESPONSE = JSON.stringify([
  {
    name: "Engineering Team Lead",
    description: "Manages a team of 5-15 developers. Responsible for sprint planning, issue triage, and status reporting to leadership.",
    value_moment_priorities: [
      { moment_id: "moment-cluster-0", priority: 1, relevance_reason: "Core sprint planning workflow" },
      { moment_id: "moment-cluster-1", priority: 2, relevance_reason: "Status reporting saves hours" },
    ],
    activation_triggers: ["create_board", "invite_3_members", "complete_first_sprint"],
    pain_points: ["Manual sprint planning takes 2 hours", "Status reports are compiled from spreadsheets"],
    success_metrics: ["Sprint planning time < 15 minutes", "Automated weekly status reports"],
    confidence: 0.8,
  },
  {
    name: "Senior Developer",
    description: "Individual contributor focused on shipping code. Uses the tool daily to manage tasks and track progress.",
    value_moment_priorities: [
      { moment_id: "moment-cluster-2", priority: 1, relevance_reason: "Daily task management" },
    ],
    activation_triggers: ["create_first_issue", "link_pr_to_task"],
    pain_points: ["Context switching between tools", "Losing track of blocked tasks"],
    success_metrics: ["All active tasks visible in one view", "PR-to-task linking automated"],
    confidence: 0.7,
  },
]);

export const ACTIVATION_MAP_RESPONSE = JSON.stringify({
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_board"],
      value_moments_unlocked: ["Board creation"],
      drop_off_risk: { level: "medium", reason: "Users may not invite team members" },
    },
    {
      level: 2,
      name: "builder",
      signal_strength: "medium",
      trigger_events: ["invite_member", "create_sprint"],
      value_moments_unlocked: ["Sprint planning"],
      drop_off_risk: { level: "high", reason: "Team adoption is the critical hurdle" },
    },
    {
      level: 3,
      name: "collaborator",
      signal_strength: "strong",
      trigger_events: ["complete_issue", "share_report"],
      value_moments_unlocked: ["Status reporting", "Sprint completion"],
      drop_off_risk: { level: "low", reason: "Active teams rarely churn" },
    },
  ],
  transitions: [
    { from_level: 1, to_level: 2, trigger_events: ["invite_member"], typical_timeframe: "1-3 days" },
    { from_level: 2, to_level: 3, trigger_events: ["complete_issue"], typical_timeframe: "1-2 weeks" },
  ],
  primary_activation_level: 2,
  confidence: "medium",
  sources: ["activation_levels", "value_moments"],
});

export const MEASUREMENT_SPEC_RESPONSE = JSON.stringify({
  entities: [
    {
      id: "board",
      name: "Board",
      description: "A project board for tracking work",
      isHeartbeat: false,
      properties: [
        { name: "board_id", type: "string", description: "Unique board identifier", isRequired: true },
      ],
    },
    {
      id: "issue",
      name: "Issue",
      description: "A trackable work item",
      isHeartbeat: true,
      properties: [
        { name: "issue_id", type: "string", description: "Unique issue identifier", isRequired: true },
        { name: "status", type: "string", description: "Current status", isRequired: true },
      ],
    },
    {
      id: "sprint",
      name: "Sprint",
      description: "A time-boxed iteration",
      isHeartbeat: false,
      properties: [
        { name: "sprint_id", type: "string", description: "Unique sprint identifier", isRequired: true },
      ],
    },
    {
      id: "report",
      name: "Report",
      description: "A status report artifact",
      isHeartbeat: false,
      properties: [
        { name: "report_id", type: "string", description: "Unique report identifier", isRequired: true },
      ],
    },
    {
      id: "user",
      name: "User",
      description: "A product user",
      isHeartbeat: false,
      properties: [
        { name: "user_id", type: "string", description: "Unique user identifier", isRequired: true },
      ],
    },
  ],
  events: [
    {
      name: "board_created",
      entity_id: "board",
      description: "User creates a new board",
      perspective: "customer",
      properties: [
        { name: "board_name", type: "string", description: "Name of the board", required: true },
        { name: "template_used", type: "boolean", description: "Whether a template was used", required: false },
      ],
      trigger_condition: "When user clicks Create Board",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
    },
    {
      name: "issue_created",
      entity_id: "issue",
      description: "User creates a new issue",
      perspective: "customer",
      properties: [
        { name: "issue_title", type: "string", description: "Title of the issue", required: true },
        { name: "priority", type: "string", description: "Issue priority", required: false },
      ],
      trigger_condition: "When user creates an issue",
      maps_to: { type: "value_moment", moment_id: "moment-cluster-0" },
      category: "value",
    },
    {
      name: "sprint_completed",
      entity_id: "sprint",
      description: "Sprint is completed",
      perspective: "interaction",
      properties: [
        { name: "issues_completed", type: "number", description: "Number of issues completed", required: true },
        { name: "velocity", type: "number", description: "Sprint velocity", required: false },
      ],
      trigger_condition: "When sprint end date is reached",
      maps_to: { type: "both", moment_id: "moment-cluster-1", activation_level: 3 },
      category: "value",
    },
    {
      name: "report_exported",
      entity_id: "report",
      description: "Report is exported as PDF",
      perspective: "product",
      properties: [
        { name: "format", type: "string", description: "Export format", required: true },
        { name: "recipient_count", type: "number", description: "Number of recipients", required: false },
      ],
      trigger_condition: "When user clicks Export Report",
      maps_to: { type: "value_moment", moment_id: "moment-cluster-2" },
      category: "expansion",
    },
    {
      name: "user_invited",
      entity_id: "user",
      description: "Team member invited",
      perspective: "customer",
      properties: [
        { name: "invitee_role", type: "string", description: "Role of invited user", required: true },
        { name: "invite_method", type: "string", description: "How the invite was sent", required: false },
      ],
      trigger_condition: "When user sends team invite",
      maps_to: { type: "activation_level", activation_level: 2 },
      category: "expansion",
    },
    {
      name: "user_returned",
      entity_id: "user",
      description: "User returns to the product",
      perspective: "interaction",
      properties: [
        { name: "days_since_last", type: "number", description: "Days since last session", required: true },
        { name: "entry_point", type: "string", description: "Where the user entered", required: false },
      ],
      trigger_condition: "User opens app after > 24 hours",
      maps_to: { type: "activation_level", activation_level: 2 },
      category: "retention",
    },
  ],
  userStateModel: [
    { name: "new", definition: "Users who signed up but haven't created a board", criteria: [{ event_name: "board_created", condition: "no board_created event within 7 days of signup" }] },
    { name: "activated", definition: "Users who have created a board and invited members", criteria: [{ event_name: "user_invited", condition: "at least 2 user_invited events" }] },
    { name: "active", definition: "Users who complete issues regularly", criteria: [{ event_name: "issue_created", condition: "at least 3 issue_created events in last 7 days" }] },
    { name: "at_risk", definition: "Users showing declining engagement", criteria: [{ event_name: "user_returned", condition: "days_since_last > 7 and < 30" }] },
    { name: "dormant", definition: "Users who have stopped engaging", criteria: [{ event_name: "user_returned", condition: "days_since_last > 30" }] },
  ],
  confidence: 0.7,
});

export const VALIDATION_REVIEW_RESPONSE = JSON.stringify([
  {
    id: "test-1",
    action: "confirm_flag",
    rewritten_name: "Achieve automated status tracking",
    rewritten_description: "Users see real-time status updates on the dashboard",
    validation_issue: "Original used feature-as-value pattern",
  },
]);
