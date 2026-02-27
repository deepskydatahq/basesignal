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
  perspectives: {
    product: {
      entities: [
        {
          id: "board",
          name: "Board",
          description: "A project board for tracking work",
          isHeartbeat: false,
          properties: [
            { name: "board_id", type: "id", description: "Unique board identifier", isRequired: true },
            { name: "board_name", type: "string", description: "Board name", isRequired: false },
          ],
          activities: [
            { name: "created", properties_supported: ["board_id", "board_name"], activity_properties: [] },
            { name: "updated", properties_supported: ["board_id"], activity_properties: [] },
            { name: "deleted", properties_supported: ["board_id"], activity_properties: [] },
          ],
        },
        {
          id: "issue",
          name: "Issue",
          description: "A trackable work item",
          isHeartbeat: true,
          properties: [
            { name: "issue_id", type: "id", description: "Unique issue identifier", isRequired: true },
            { name: "status", type: "string", description: "Current status", isRequired: true },
            { name: "priority", type: "string", description: "Issue priority", isRequired: false },
          ],
          activities: [
            { name: "created", properties_supported: ["issue_id", "status", "priority"], activity_properties: [] },
            { name: "updated", properties_supported: ["issue_id", "status"], activity_properties: [] },
            { name: "completed", properties_supported: ["issue_id", "status"], activity_properties: [] },
            { name: "deleted", properties_supported: ["issue_id"], activity_properties: [] },
          ],
        },
        {
          id: "sprint",
          name: "Sprint",
          description: "A time-boxed iteration",
          isHeartbeat: false,
          properties: [
            { name: "sprint_id", type: "id", description: "Unique sprint identifier", isRequired: true },
            { name: "sprint_name", type: "string", description: "Sprint name", isRequired: false },
          ],
          activities: [
            { name: "created", properties_supported: ["sprint_id", "sprint_name"], activity_properties: [] },
            { name: "completed", properties_supported: ["sprint_id"], activity_properties: [] },
          ],
        },
        {
          id: "user",
          name: "User",
          description: "A product user",
          isHeartbeat: false,
          properties: [
            { name: "user_id", type: "id", description: "Unique user identifier", isRequired: true },
            { name: "user_role", type: "string", description: "User role", isRequired: false },
          ],
          activities: [
            { name: "invited", properties_supported: ["user_id", "user_role"], activity_properties: [] },
            { name: "created", properties_supported: ["user_id"], activity_properties: [] },
            { name: "deleted", properties_supported: ["user_id"], activity_properties: [] },
          ],
        },
      ],
    },
    customer: {
      entities: [
        {
          name: "Customer",
          properties: [
            { name: "customer_id", type: "id", description: "Customer identifier", isRequired: true },
          ],
          activities: [
            { name: "first_value_created", derivation_rule: "Issue created (first time) OR Board created (3+ times)", properties_used: ["customer_id"] },
            { name: "value_repeated", derivation_rule: "Issue completed (5+ in last 30 days)", properties_used: ["customer_id"] },
            { name: "expansion_started", derivation_rule: "User invited (first time)", properties_used: ["customer_id"] },
          ],
        },
      ],
    },
    interaction: {
      entities: [
        {
          name: "Interaction",
          properties: [
            { name: "element_type", type: "string", description: "Type of UI element", isRequired: true },
            { name: "element_text", type: "string", description: "Visible text", isRequired: false },
            { name: "element_position", type: "string", description: "Location on page", isRequired: false },
          ],
          activities: [
            { name: "element_clicked", properties_supported: ["element_type", "element_text", "element_position"] },
            { name: "element_submitted", properties_supported: ["element_type", "element_text"] },
          ],
        },
      ],
    },
  },
  confidence: 0.7,
});

export const LIFECYCLE_STATES_RESPONSE = JSON.stringify({
  states: [
    {
      name: "new",
      definition: "Users who have signed up but not yet completed onboarding",
      entry_criteria: [{ event_name: "user_signed_up", condition: "account created" }],
      exit_triggers: [{ event_name: "board_created", condition: "creates first board" }],
      time_window: "0-7 days",
    },
    {
      name: "activated",
      definition: "Users who have completed core onboarding actions",
      entry_criteria: [{ event_name: "board_created", condition: "at least 1 board created" }, { event_name: "user_invited", condition: "at least 1 team member invited" }],
      exit_triggers: [{ event_name: "issue_created", condition: "creates 5+ issues" }],
      time_window: "7-14 days",
    },
    {
      name: "engaged",
      definition: "Users who regularly use the product and derive value",
      entry_criteria: [{ event_name: "issue_created", condition: "5+ issues created in last 7 days" }],
      exit_triggers: [{ event_name: "user_returned", condition: "no activity for 7+ days" }],
      time_window: "14-30 days",
    },
    {
      name: "at_risk",
      definition: "Users showing declining engagement patterns",
      entry_criteria: [{ event_name: "user_returned", condition: "days_since_last > 7" }],
      exit_triggers: [{ event_name: "user_returned", condition: "days_since_last > 30" }],
      time_window: "7+ days inactive",
    },
    {
      name: "dormant",
      definition: "Users who have stopped engaging with the product",
      entry_criteria: [{ event_name: "user_returned", condition: "days_since_last > 30" }],
      exit_triggers: [{ event_name: "user_returned", condition: "days_since_last > 60" }],
      time_window: "30+ days inactive",
    },
    {
      name: "churned",
      definition: "Users who have abandoned the product entirely",
      entry_criteria: [{ event_name: "user_returned", condition: "days_since_last > 60" }],
      exit_triggers: [{ event_name: "user_returned", condition: "returns after 30+ days" }],
      time_window: "60+ days inactive",
    },
    {
      name: "resurrected",
      definition: "Previously churned users who return to the product",
      entry_criteria: [{ event_name: "user_returned", condition: "returns after 30+ days of inactivity" }],
      exit_triggers: [{ event_name: "issue_created", condition: "resumes regular activity" }],
      time_window: "return after 30+ days",
    },
  ],
  transitions: [
    {
      from_state: "new",
      to_state: "activated",
      trigger_conditions: ["creates first board", "invites team member"],
      typical_timeframe: "1-7 days",
    },
    {
      from_state: "at_risk",
      to_state: "dormant",
      trigger_conditions: ["no activity for 30+ days"],
      typical_timeframe: "3-4 weeks",
    },
  ],
  confidence: 0.75,
  sources: ["identity", "activation_levels", "activation_map", "value_moments"],
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
