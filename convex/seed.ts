import { internalMutation } from "./_generated/server";

export default internalMutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existingOrg = await ctx.db
      .query("orgs")
      .filter((q) => q.eq(q.field("slug"), "timo"))
      .first();

    if (existingOrg) {
      console.log("Already seeded, skipping");
      return { alreadySeeded: true };
    }

    // Create Timo org
    const orgId = await ctx.db.insert("orgs", {
      name: "Timo Data Platform",
      slug: "timo",
      githubRepoUrl: "https://github.com/timo/tenant-timo",
      createdAt: Date.now(),
    });

    console.log("Created org:", orgId);

    // Seed standard entities
    const entities = [
      { name: "orders", sourceType: "api" },
      { name: "subscriptions", sourceType: "api" },
      { name: "leads", sourceType: "bigquery" },
      { name: "newsletter_subscribers", sourceType: "api" },
    ];

    for (const { name, sourceType } of entities) {
      await ctx.db.insert("entities", {
        orgId,
        name,
        sourceType,
        fields: [],
        computedColumns: [],
        lastModified: Date.now(),
      });
      console.log("Created entity:", name);
    }

    return {
      orgId,
      entityCount: entities.length
    };
  },
});
