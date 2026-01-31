import { TextEncoder, TextDecoder } from "util";

// Simple JWT implementation for Node.js environment
// Format: header.payload.signature

interface JWTPayload {
  userId: string;
  exp: number;
  iat: number;
}

// Use crypto from Node.js
const getNodeCrypto = async () => {
  const crypto = await import("crypto");
  return crypto;
};

export const createJWT = async (
  userId: string,
  expirationDays: number = 30
): Promise<string> => {
  const crypto = await getNodeCrypto();
  const secret = process.env.JWT_SECRET || "your-secret-key";

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expirationDays * 24 * 60 * 60;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: JWTPayload = {
    userId,
    iat: now,
    exp: expiresAt,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const message = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  const signature = hmac.digest("base64url");

  return `${message}.${signature}`;
};

export const verifyJWT = async (token: string): Promise<JWTPayload | null> => {
  const crypto = await getNodeCrypto();
  const secret = process.env.JWT_SECRET || "your-secret-key";

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(message);
    const expectedSignature = hmac.digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const decodedPayload = Buffer.from(encodedPayload, "base64url").toString();
    const payload = JSON.parse(decodedPayload) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
};
