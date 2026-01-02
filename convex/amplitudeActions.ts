"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Amplitude API base URL
const AMPLITUDE_API_BASE = "https://amplitude.com/api/2";

interface AmplitudeError {
  error?: string;
  message?: string;
}

export const testConnection = action({
  args: {
    apiKey: v.string(),
    secretKey: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use the Taxonomy API to test credentials
      // GET /taxonomy/event returns list of event types
      const auth = btoa(`${args.apiKey}:${args.secretKey}`);

      const response = await fetch(`${AMPLITUDE_API_BASE}/taxonomy/event`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as AmplitudeError;
        if (response.status === 401) {
          return { success: false, error: "Invalid API credentials" };
        }
        if (response.status === 403) {
          return { success: false, error: "Access denied. Check API permissions." };
        }
        return {
          success: false,
          error: errorData.error || errorData.message || `API error: ${response.status}`
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed"
      };
    }
  },
});

export const listEvents = action({
  args: {
    apiKey: v.string(),
    secretKey: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    success: boolean;
    events?: Array<{ name: string; description?: string }>;
    error?: string
  }> => {
    try {
      const auth = btoa(`${args.apiKey}:${args.secretKey}`);

      const response = await fetch(`${AMPLITUDE_API_BASE}/taxonomy/event`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as AmplitudeError;
        return {
          success: false,
          error: errorData.error || errorData.message || `API error: ${response.status}`
        };
      }

      const data = await response.json() as { data?: Array<{ event_type: string; description?: string }> };

      // Amplitude Taxonomy API returns { data: [...events] }
      const events = (data.data || []).map((event: { event_type: string; description?: string }) => ({
        name: event.event_type,
        description: event.description,
      }));

      return { success: true, events };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch events"
      };
    }
  },
});

export const createPipeline = action({
  args: {
    connectionId: v.id("amplitudeConnections"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; workflowUrl?: string }> => {
    // Get connection details
    const connection = await ctx.runQuery(api.amplitude.getById, { id: args.connectionId });

    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Get sync service URL from environment
    const syncServiceUrl = process.env.SYNC_SERVICE_URL;
    const syncServiceApiKey = process.env.SYNC_SERVICE_API_KEY;

    if (!syncServiceUrl || !syncServiceApiKey) {
      console.error("Sync service not configured");
      return { success: false, error: "Sync service not configured" };
    }

    try {
      // Update status to creating
      await ctx.runMutation(api.amplitude.updateStatus, {
        id: args.connectionId,
        status: "creating",
      });

      // Call sync service
      const response = await fetch(`${syncServiceUrl}/create-pipeline`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${syncServiceApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: "dsd_personal",
          source: "amplitude",
          connection_name: connection.name,
          convex_connection_id: args.connectionId,
          credentials: {
            api_key: connection.apiKey,
            secret_key: connection.secretKey,
          },
          selected_events: connection.selectedEvents,
          schedule: {
            enabled: true,
            cron: "0 3 * * *",
          },
          destination: {
            type: "bigquery",
            dataset: "timodata_sources",
            table_prefix: "amplitude_",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const result = await response.json() as {
        status: string;
        config_path: string;
        secret_name: string;
        workflow_run_id?: number;
        workflow_url?: string;
      };

      // Update connection with pipeline info
      await ctx.runMutation(api.amplitude.pipelineCreated, {
        id: args.connectionId,
        configPath: result.config_path,
        secretName: result.secret_name,
        workflowRunId: result.workflow_run_id,
        workflowUrl: result.workflow_url,
      });

      return {
        success: true,
        workflowUrl: result.workflow_url,
      };
    } catch (error) {
      console.error("Failed to create pipeline:", error);

      // Update status to error
      await ctx.runMutation(api.amplitude.updateStatus, {
        id: args.connectionId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Pipeline creation failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Pipeline creation failed",
      };
    }
  },
});
