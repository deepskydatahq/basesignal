import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");
const productId = "nh78n36ve9dt5q0z2pnj9gadnx80mm54"; // Linear

const profile = await client.query(api.productProfiles.getForTest, { productId });
console.log("Full profile:");
console.log(JSON.stringify(profile, null, 2));
