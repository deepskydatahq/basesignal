import { describe, it, expect } from "vitest";
import type {
  TaxonomyProperty,
  TaxonomyEvent,
  TaxonomyMetadata,
  AnalyticsTaxonomy,
} from "./taxonomy";

describe("AnalyticsTaxonomy types", () => {
  it("TaxonomyProperty has required fields", () => {
    const prop: TaxonomyProperty = {
      name: "user_id",
      type: "string",
      description: "Unique user identifier",
      required: true,
    };
    expect(prop.name).toBe("user_id");
    expect(prop.type).toBe("string");
    expect(prop.required).toBe(true);
  });

  it("TaxonomyEvent has required and optional fields", () => {
    const event: TaxonomyEvent = {
      name: "page_viewed",
      description: "User viewed a page",
      properties: [
        { name: "url", type: "string", description: "Page URL", required: true },
      ],
      category: "engagement",
      status: "active",
      tags: ["core", "web"],
      volume_last_30d: 12345,
    };
    expect(event.name).toBe("page_viewed");
    expect(event.properties).toHaveLength(1);
    expect(event.category).toBe("engagement");
    expect(event.tags).toContain("core");
    expect(event.volume_last_30d).toBe(12345);
  });

  it("TaxonomyEvent works with minimal fields", () => {
    const event: TaxonomyEvent = {
      name: "signup",
      description: "User signed up",
      properties: [],
      tags: [],
    };
    expect(event.category).toBeUndefined();
    expect(event.status).toBeUndefined();
    expect(event.volume_last_30d).toBeUndefined();
  });

  it("AnalyticsTaxonomy assembles a full taxonomy", () => {
    const taxonomy: AnalyticsTaxonomy = {
      platform: "amplitude",
      project_id: "proj-123",
      extracted_at: "2026-03-06T00:00:00Z",
      events: [
        {
          name: "button_clicked",
          description: "A button was clicked",
          properties: [],
          tags: ["interaction"],
        },
      ],
      metadata: {
        loader_version: "1.0.0",
        extraction_duration_ms: 500,
        event_count: 1,
      },
    };
    expect(taxonomy.platform).toBe("amplitude");
    expect(taxonomy.project_id).toBe("proj-123");
    expect(taxonomy.events).toHaveLength(1);
    expect(taxonomy.metadata?.loader_version).toBe("1.0.0");
  });

  it("AnalyticsTaxonomy works without metadata", () => {
    const taxonomy: AnalyticsTaxonomy = {
      platform: "posthog",
      project_id: "proj-456",
      extracted_at: "2026-03-06T00:00:00Z",
      events: [],
    };
    expect(taxonomy.metadata).toBeUndefined();
  });
});
