import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { INTERVIEW_TYPES, type InterviewType } from "./interviewTypes";
import { validateActivityFormat, findDuplicate } from "../src/shared/validation";

const ACTIVITY_FORMAT_SECTION = `
ACTIVITY FORMAT (REQUIRED):
Every activity must follow [Entity] + [Past Tense Action]:
- Entity: The thing acted upon (Account, Project, Trial, Subscription)
- Action: What happened, past tense (Created, Started, Upgraded, Cancelled)

GOOD: Account Created, Trial Started, Project Published, Subscription Cancelled
BAD: Onboarding (no action), Activation (state), User Setup (vague)

When the user describes a phase like "onboarding", ask: "What specific action marks the END of onboarding?"
`;

// Safety limits for agentic loop
const MAX_LOOP_ITERATIONS = 5;
const MAX_TOOL_CALLS = 10;
const FALLBACK_RESPONSE = "What happens next in this journey?";
const MAX_ITERATIONS_RESPONSE = "I've made several updates to the journey. What else should we add?";

// Build tools with dynamic stage context and interview type filtering
function buildJourneyTools(
  stages: Array<{ name: string; entity?: string; action?: string }>,
  interviewType: InterviewType
): Anthropic.Tool[] {
  const typeConfig = INTERVIEW_TYPES[interviewType];
  const existingActivities = stages
    .filter(s => s.entity && s.action)
    .map(s => `${s.entity} ${s.action}`);
  const existingNote = existingActivities.length > 0
    ? `EXISTING ACTIVITIES: [${existingActivities.join(", ")}]. Don't create duplicates.`
    : "No activities added yet.";

  const tools: Anthropic.Tool[] = [];

  // Stage tools only for types that build stages
  if (typeConfig.outputs.stages) {
    tools.push(
      {
        name: "add_stage",
        description: `Add a new activity to the journey. ${existingNote}

REQUIRED FORMAT: Entity + Past Tense Action
- Entity: The thing acted upon (Account, Project, Trial, Subscription)
- Action: What happened, past tense (Created, Started, Upgraded, Cancelled)

Examples: "Account Created", "Trial Started", "Project Published"
NOT: "Onboarding", "Activation", "User Setup"`,
        input_schema: {
          type: "object" as const,
          properties: {
            entity: {
              type: "string",
              description: "The thing acted upon - a single noun (Account, Project, Trial, Subscription, Report)",
            },
            action: {
              type: "string",
              description: "What happened - past tense verb (Created, Started, Upgraded, Cancelled, Sent)",
            },
            type: {
              type: "string",
              enum: ["entry", "activity"],
              description: "Stage type: 'entry' for journey start, 'activity' for user actions",
            },
            description: { type: "string", description: "Optional context about this activity" },
            connect_after: {
              type: "string",
              description: "Name of stage this follows (creates transition)",
            },
          },
          required: ["entity", "action", "type"],
        },
      },
      {
        name: "add_transition",
        description: `Connect two existing stages with a transition. ${existingNote}`,
        input_schema: {
          type: "object" as const,
          properties: {
            from_stage: { type: "string", description: "Source stage name" },
            to_stage: { type: "string", description: "Target stage name" },
            label: { type: "string", description: "Transition label (optional)" },
          },
          required: ["from_stage", "to_stage"],
        },
      },
      {
        name: "update_stage",
        description: `Update an existing stage. ${existingNote}`,
        input_schema: {
          type: "object" as const,
          properties: {
            stage: { type: "string", description: "Current stage name to update" },
            entity: { type: "string", description: "New entity (optional)" },
            action: { type: "string", description: "New action (optional)" },
            description: { type: "string", description: "New description (optional)" },
          },
          required: ["stage"],
        },
      }
    );
  }

  return tools;
}

// Build tools for Overview Interview (activity-focused)
function buildOverviewTools(
  activities: Array<{ entity?: string; action?: string; lifecycleSlot?: string }>
): Anthropic.Tool[] {
  const existingActivities = activities
    .filter((a) => a.entity && a.action)
    .map((a) => `${a.entity} ${a.action} (${a.lifecycleSlot})`);

  const existingNote = existingActivities.length > 0
    ? `EXISTING ACTIVITIES: [${existingActivities.join(", ")}]. Don't create duplicates.`
    : "No activities added yet.";

  return [
    {
      name: "add_activity",
      description: `Add an activity to a lifecycle slot. ${existingNote}`,
      input_schema: {
        type: "object" as const,
        properties: {
          entity: {
            type: "string",
            description: "The entity (noun) - e.g., Account, Project, Subscription, Report",
          },
          action: {
            type: "string",
            description: "The action (past tense verb) - e.g., Created, Verified, Upgraded, Cancelled",
          },
          slot: {
            type: "string",
            enum: ["account_creation", "activation", "core_usage", "revenue", "churn"],
            description: "Which lifecycle stage this activity belongs to",
          },
          description: {
            type: "string",
            description: "Optional context about this activity",
          },
        },
        required: ["entity", "action", "slot"],
      },
    },
    {
      name: "update_activity",
      description: `Update an existing activity. ${existingNote}`,
      input_schema: {
        type: "object" as const,
        properties: {
          entity: { type: "string", description: "Current entity name" },
          action: { type: "string", description: "Current action name" },
          newEntity: { type: "string", description: "New entity name (optional)" },
          newAction: { type: "string", description: "New action name (optional)" },
          description: { type: "string", description: "New description (optional)" },
        },
        required: ["entity", "action"],
      },
    },
    {
      name: "remove_activity",
      description: `Remove an activity if the user corrects themselves. ${existingNote}`,
      input_schema: {
        type: "object" as const,
        properties: {
          entity: { type: "string", description: "Entity name to remove" },
          action: { type: "string", description: "Action name to remove" },
        },
        required: ["entity", "action"],
      },
    },
  ];
}

// Serialize graph state for Claude context
function serializeGraph(
  journey: { name: string } | null,
  stages: Array<{ _id: string; name: string; type: string; description?: string }>,
  transitions: Array<{ fromStageId: string; toStageId: string }>
): string {
  if (!journey) return "JOURNEY: (untitled)\nSTAGES (0): none\nTRANSITIONS (0): none";

  let result = `JOURNEY: ${journey.name}\n`;
  result += `STAGES (${stages.length}):\n`;

  if (stages.length === 0) {
    result += "- none\n";
  } else {
    for (const stage of stages) {
      result += `- ${stage.name} [${stage.type}]`;
      if (stage.description) result += ` - ${stage.description}`;
      result += "\n";
    }
  }

  result += `\nTRANSITIONS (${transitions.length}):\n`;

  if (transitions.length === 0) {
    result += "- none\n";
  } else {
    // Build lookup for stage names by ID
    const idToName = new Map(stages.map((s: any) => [s._id, s.name]));
    for (const t of transitions) {
      const from = idToName.get(t.fromStageId) || "?";
      const to = idToName.get(t.toStageId) || "?";
      result += `- ${from} → ${to}\n`;
    }
  }

  return result;
}

// Build type-specific system prompt
function buildInterviewPrompt(
  type: InterviewType,
  graphContext: string
): string {
  const prompts: Record<InterviewType, string> = {
    first_value: `You are helping identify the activation moment - the first time a user experiences value.

FOCUS ON:
- What does "success" look like for a new user?
- What's the first meaningful action they take?
- How quickly should this happen after signup?

GOALS:
1. Build the journey path from signup to first value
2. Each stage must be a specific user action, not a phase

Ask concrete questions. When you identify an action, add it using entity + action format.`,

    retention: `You are defining what "active" and "retained" mean for this product.

FOCUS ON:
- What actions indicate ongoing engagement?
- How often should users return? (daily, weekly, monthly)
- What's the minimum activity to count as "active"?

GOALS:
1. Understand the retention behaviors
2. Define what "active" means as specific actions

You're focused on defining behaviors as concrete actions.`,

    value_outcomes: `You are mapping the behaviors that create value for users and the business.

FOCUS ON:
- What actions indicate a user is getting value?
- What are the high-value behaviors? (upgrades, purchases, invites)
- What's the path from activation to these outcomes?

GOALS:
1. Build journey paths showing value-creating behaviors
2. Each stage must be a specific action, not a state

Start from early engagement and explore what comes next.`,

    value_capture: `You are linking user behaviors to revenue and business metrics.

FOCUS ON:
- Which activities drive revenue?
- What's the relationship between engagement and conversion?
- How do you measure business value?

GOALS:
1. Understand how behaviors connect to business metrics
2. Identify revenue-driving actions

Focus on specific actions that lead to revenue.`,

    churn: `You are mapping the path to churn and identifying at-risk signals.

FOCUS ON:
- What signals indicate a user is at risk?
- What does inactivity look like for this product?
- Are there specific events that predict churn?

GOALS:
1. Build journey paths showing churn scenarios
2. Identify early warning signs as specific actions (or lack thereof)

Use what you know about activation to identify the inverse.`,

    overview: `You are helping define the key activities that make up this product's user journey.

FOCUS ON:
- What are the core user activities in this product?
- What entity performs each action? (User, Account, Team, etc.)
- Which lifecycle stage does each activity belong to?

GOALS:
1. Identify activities for: account_creation, activation, core_usage, revenue, churn
2. At minimum, fill account_creation, activation, and core_usage slots

Ask about specific user actions and help categorize them into lifecycle slots.`,
  };

  const basePrompt = prompts[type];

  return `${basePrompt}
${ACTIVITY_FORMAT_SECTION}
CURRENT JOURNEY STATE:
${graphContext}

GUIDELINES:
- Ask ONE question at a time
- Use concrete, memory-based questions ("What did the user DO?")
- When the user describes a phase, ask what action marks that phase
- Always use add_stage with entity + action format

TONE:
- Neutral and professional
- Efficient — no filler
- Acknowledge briefly: "Noted." "Got it."
- Probe for specifics: "What action marks that?" "What did they DO?"

RULES:
- BEFORE creating a stage, check existing activities for duplicates
- Always use tools to modify the graph - never just describe changes
- After using tools, ask about the next step

Begin appropriately based on the current state.`;
}

// Build prompt for Overview Interview
function buildOverviewPrompt(activitiesBySlot: Record<string, unknown[]>): string {
  const slotStatus = Object.entries(activitiesBySlot)
    .map(([slot, activities]) => {
      const count = (activities as unknown[]).length;
      const required = ["account_creation", "activation", "core_usage"].includes(slot);
      return `- ${slot}: ${count} activities${required ? " (required)" : " (optional)"}`;
    })
    .join("\n");

  return `You are conducting an Overview Interview to map the user's product journey.

YOUR GOAL: Capture the key activities across 5 lifecycle stages:
1. account_creation (required) - How users get into the product
2. activation (required) - The first core action that signals value
3. core_usage (required) - Key repeated actions
4. revenue (optional) - When/how users convert or expand
5. churn (optional) - How users leave

CURRENT STATE:
${slotStatus}
${ACTIVITY_FORMAT_SECTION}
APPROACH:
1. Start with a story-based question: "Walk me through what happens from when someone discovers your product to when they become a successful, paying customer."
2. As they narrate, extract activities and add them to appropriate slots
3. After the initial story, check for gaps in required slots
4. Ask targeted follow-ups: "How does someone cancel?" "When do they first pay?"
5. Once all 3 required slots have activities, offer to wrap up

TONE:
- Neutral and professional
- Efficient — no filler
- Brief acknowledgments: "Got it." "Noted."
- Probe deeper: "What happens after that?" "How do they do that?"

RULES:
- Use add_activity tool as soon as you identify an activity
- Don't ask about the same slot twice unless unclear
- When required slots are filled, ask if they want to add optional slots or finish`;
}

// Fuzzy match stage name
function resolveStage(
  reference: string,
  stages: Array<{ _id: string; name: string }>
): { _id: string; name: string } | null {
  const ref = reference.toLowerCase().trim();

  // Exact match
  let match = stages.find((s) => s.name === reference);
  if (match) return match;

  // Case-insensitive
  match = stages.find((s) => s.name.toLowerCase() === ref);
  if (match) return match;

  // Partial match
  match = stages.find(
    (s) =>
      s.name.toLowerCase().includes(ref) || ref.includes(s.name.toLowerCase())
  );
  if (match) return match;

  return null;
}

// Format message history for Claude
function formatHistory(
  messages: Array<{ role: string; content: string }>,
  newMessage: string
): Anthropic.MessageParam[] {
  const formatted: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  formatted.push({ role: "user", content: newMessage });
  return formatted;
}

// Execute a single tool call
async function executeToolCall(
  ctx: any,
  journeyId: any,
  stages: Array<{ _id: string; name: string; entity?: string; action?: string }>,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "add_stage": {
      const entity = args.entity as string;
      const action = args.action as string;
      const type = args.type as string;
      const description = args.description as string | undefined;
      const connectAfter = args.connect_after as string | undefined;

      // Validate format
      const formatResult = validateActivityFormat(entity, action);
      if (!formatResult.valid) {
        return `error: ${formatResult.error}. Please try again with format: [Entity] [Past Tense Action]`;
      }

      // Check for duplicates
      const duplicate = findDuplicate(entity, action, stages);
      if (duplicate) {
        return `skipped: "${entity} ${action}" matches existing "${duplicate.entity} ${duplicate.action}"`;
      }

      // Derive stage name from entity + action
      const name = `${entity} ${action}`;

      // Calculate position
      const position = { x: 250, y: stages.length * 100 + 50 };

      // Create the stage
      const stageId = await ctx.runMutation(api.stages.create, {
        journeyId,
        name,
        type,
        description,
        position,
        entity,
        action,
      });

      // Create transition if connect_after specified
      let result = `success: added stage "${name}"`;
      if (connectAfter) {
        const fromStage = resolveStage(connectAfter, stages);
        if (fromStage) {
          await ctx.runMutation(api.transitions.create, {
            journeyId,
            fromStageId: fromStage._id,
            toStageId: stageId,
          });
        } else {
          result += ` (warning: stage "${connectAfter}" not found for connection)`;
        }
      }

      return result;
    }

    case "add_transition": {
      const fromName = args.from_stage as string;
      const toName = args.to_stage as string;
      const label = args.label as string | undefined;

      // Need fresh stages list since we might have added some
      const currentStages = await ctx.runQuery(api.stages.listByJourney, {
        journeyId,
      });

      const fromStage = resolveStage(fromName, currentStages);
      const toStage = resolveStage(toName, currentStages);

      if (!fromStage) return `error: stage "${fromName}" not found`;
      if (!toStage) return `error: stage "${toName}" not found`;

      await ctx.runMutation(api.transitions.create, {
        journeyId,
        fromStageId: fromStage._id,
        toStageId: toStage._id,
        label,
      });

      return `success: connected "${fromStage.name}" → "${toStage.name}"`;
    }

    case "update_stage": {
      const stageName = args.stage as string;
      const entity = args.entity as string | undefined;
      const action = args.action as string | undefined;
      const description = args.description as string | undefined;

      const stage = resolveStage(stageName, stages);
      if (!stage) return `error: stage "${stageName}" not found`;

      // If updating entity/action, validate the new values
      if (entity || action) {
        const currentStage = stages.find(s => s._id === stage._id) as any;
        const newEntity = entity || currentStage?.entity || '';
        const newAction = action || currentStage?.action || '';

        const formatResult = validateActivityFormat(newEntity, newAction);
        if (!formatResult.valid) {
          return `error: ${formatResult.error}`;
        }

        // Check for duplicates (excluding current stage)
        const otherStages = stages.filter(s => s._id !== stage._id);
        const duplicate = findDuplicate(newEntity, newAction, otherStages);
        if (duplicate) {
          return `error: "${newEntity} ${newAction}" would duplicate existing "${duplicate.entity} ${duplicate.action}"`;
        }
      }

      // Build updates object with entity/action fields
      const updates: Record<string, unknown> = {};
      if (entity) updates.entity = entity;
      if (action) updates.action = action;
      if (entity || action) {
        // Construct name from existing or new values
        const currentStage = stages.find(s => s._id === stage._id) as any;
        const newEntity = entity || currentStage?.entity || '';
        const newAction = action || currentStage?.action || '';
        if (newEntity && newAction) {
          updates.name = `${newEntity} ${newAction}`;
        }
      }
      if (description !== undefined) updates.description = description;

      await ctx.runMutation(api.stages.update, {
        id: stage._id,
        ...updates,
      });

      return `success: updated stage "${stage.name}"`;
    }

    default:
      return `error: unknown tool "${toolName}"`;
  }
}

// Execute Overview Interview tool calls
async function executeOverviewToolCall(
  ctx: any,
  journeyId: any,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "add_activity": {
      const result = await ctx.runMutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: args.entity as string,
        action: args.action as string,
        slot: args.slot as string,
        description: args.description as string | undefined,
      });
      return result.message;
    }

    case "update_activity": {
      const result = await ctx.runMutation(api.overviewInterview.updateActivity, {
        journeyId,
        entity: args.entity as string,
        action: args.action as string,
        newEntity: args.newEntity as string | undefined,
        newAction: args.newAction as string | undefined,
        description: args.description as string | undefined,
      });
      return result.message;
    }

    case "remove_activity": {
      const result = await ctx.runMutation(api.overviewInterview.removeActivity, {
        journeyId,
        entity: args.entity as string,
        action: args.action as string,
      });
      return result.message;
    }

    default:
      return `error: unknown tool "${toolName}"`;
  }
}

// Extract text content from Claude response
function extractTextFromResponse(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Extract tool use blocks from Claude response
function extractToolUseBlocks(response: Anthropic.Message): Anthropic.ToolUseBlock[] {
  return response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
}

// Build tool result message for Claude
function buildToolResultMessage(
  toolUseBlocks: Anthropic.ToolUseBlock[],
  results: string[]
): Anthropic.ToolResultBlockParam[] {
  return toolUseBlocks.map((block, i) => ({
    type: "tool_result" as const,
    tool_use_id: block.id,
    content: results[i],
  }));
}

// Types for the chat action response
type ChatResponse = {
  content: string;
  toolCalls: Array<{
    name: string;
    arguments: unknown;
    result?: string;
  }>;
};

// Main chat action with agentic loop
export const chat = action({
  args: {
    sessionId: v.id("interviewSessions"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<ChatResponse> => {
    // 1. Get session and journey data
    const session = await ctx.runQuery(api.interviews.getSession, {
      sessionId: args.sessionId,
    });
    if (!session) throw new Error("Session not found");

    const journey = await ctx.runQuery(api.journeys.get, {
      id: session.journeyId,
    });
    const transitions = await ctx.runQuery(api.transitions.listByJourney, {
      journeyId: session.journeyId,
    });
    const history: Array<{ role: string; content: string }> = await ctx.runQuery(
      api.interviews.getMessages,
      { sessionId: args.sessionId }
    );

    // 2. Save user message first
    await ctx.runMutation(api.interviews.addMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.message,
    });

    // 3. Initialize loop state
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const messages: Anthropic.MessageParam[] = formatHistory(history, args.message);
    const allToolCalls: Array<{ name: string; arguments: unknown; result?: string }> = [];
    let finalTextContent = "";
    let iterations = 0;
    let totalToolCalls = 0;

    // Get interview type from session
    const interviewType = (session.interviewType || "first_value") as InterviewType;
    const isOverview = interviewType === "overview";

    // 4. Agentic loop - continue until Claude responds with text only
    while (iterations < MAX_LOOP_ITERATIONS && totalToolCalls < MAX_TOOL_CALLS) {
      // Get fresh stage list each iteration (may have changed from tool calls)
      const stages = await ctx.runQuery(api.stages.listByJourney, {
        journeyId: session.journeyId,
      });

      // Build type-specific tools and prompt
      let tools: Anthropic.Tool[];
      let systemPrompt: string;

      if (isOverview) {
        // Overview uses activity-focused tools
        const activitiesBySlot = await ctx.runQuery(api.overviewInterview.getActivitiesBySlot, {
          journeyId: session.journeyId,
        });
        tools = buildOverviewTools(stages);
        systemPrompt = buildOverviewPrompt(activitiesBySlot);
      } else {
        // Detailed interviews use stage/transition tools
        const graphContext = serializeGraph(journey, stages, transitions);
        systemPrompt = buildInterviewPrompt(interviewType, graphContext);
        tools = buildJourneyTools(stages, interviewType);
      }

      // Call Claude
      const response: Anthropic.Message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      });

      // Extract tool use blocks
      const toolUseBlocks = extractToolUseBlocks(response);

      // If no tool calls, we're done - extract final text
      if (toolUseBlocks.length === 0) {
        finalTextContent = extractTextFromResponse(response);
        break;
      }

      // Execute each tool call
      const toolResults: string[] = [];
      for (const toolUse of toolUseBlocks) {
        // Get fresh stages for each tool (previous tool may have added one)
        const currentStages = await ctx.runQuery(api.stages.listByJourney, {
          journeyId: session.journeyId,
        });

        try {
          const result = isOverview
            ? await executeOverviewToolCall(
                ctx,
                session.journeyId,
                toolUse.name,
                toolUse.input as Record<string, unknown>
              )
            : await executeToolCall(
                ctx,
                session.journeyId,
                currentStages,
                toolUse.name,
                toolUse.input as Record<string, unknown>
              );
          toolResults.push(result);
          allToolCalls.push({
            name: toolUse.name,
            arguments: toolUse.input,
            result,
          });
        } catch (error) {
          const errorResult = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
          toolResults.push(errorResult);
          allToolCalls.push({
            name: toolUse.name,
            arguments: toolUse.input,
            result: errorResult,
          });
        }
        totalToolCalls++;
      }

      // Append assistant response and tool results to messages for next iteration
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: buildToolResultMessage(toolUseBlocks, toolResults),
      });

      iterations++;
    }

    // 5. Handle edge cases
    if (!finalTextContent) {
      if (iterations >= MAX_LOOP_ITERATIONS || totalToolCalls >= MAX_TOOL_CALLS) {
        finalTextContent = MAX_ITERATIONS_RESPONSE;
      } else {
        finalTextContent = FALLBACK_RESPONSE;
      }
    }

    // 6. Save assistant message with all aggregated tool calls
    await ctx.runMutation(api.interviews.addMessage, {
      sessionId: args.sessionId,
      role: "assistant",
      content: finalTextContent,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    });

    return { content: finalTextContent, toolCalls: allToolCalls };
  },
});
