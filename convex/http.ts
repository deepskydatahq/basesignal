import { httpRouter } from "convex/server";

const http = httpRouter();

// Clerk handles auth externally - no HTTP routes needed here

export default http;
