import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

// Clerk webhook endpoint
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get Svix headers for verification
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    // Get request body
    const body = await request.text();

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let payload: WebhookPayload;

    try {
      payload = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookPayload;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 401 });
    }

    // Handle the event
    const { type, data } = payload;

    try {
      switch (type) {
        case "user.created": {
          const email = data.email_addresses?.[0]?.email_address;
          const name = [data.first_name, data.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

          await ctx.runMutation(internal.users.createFromWebhook, {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
          });
          break;
        }

        case "user.updated": {
          const email = data.email_addresses?.[0]?.email_address;
          const name = [data.first_name, data.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

          await ctx.runMutation(internal.users.updateFromWebhook, {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
          });
          break;
        }

        case "user.deleted": {
          // Optional: handle user deletion
          // For now, we'll leave the user record (soft delete approach)
          console.log(`User deleted in Clerk: ${data.id}`);
          break;
        }

        default:
          console.log(`Unhandled webhook event type: ${type}`);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error(`Error handling webhook event ${type}:`, err);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

// Type definitions for Clerk webhook payload
interface WebhookPayload {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

export default http;
