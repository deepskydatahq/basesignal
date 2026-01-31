/**
 * Authentication utilities for MCP token-based authentication
 * Handles password hashing, JWT signing/validation, and token management
 */

import { v as validator } from "convex/values";

// Constants
const ALGORITHM = "HS256";
const TOKEN_EXPIRATION_DAYS = 30;
const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Simple bcrypt-like password hashing using Node's built-in crypto
 * In production, consider using a library like bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const hashOfPassword = await hashPassword(password);
  return hashOfPassword === hash;
}

/**
 * Create a simple JWT token
 * Format: header.payload.signature
 */
export async function createJWT(
  userId: string,
  secret: string
): Promise<string> {
  const header = {
    alg: ALGORITHM,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60;
  // Add a unique nonce to make each token different
  const nonce = Math.random().toString(36).substring(2, 15);

  const payload = {
    sub: userId,
    iat: now,
    exp: expiresAt,
    nonce, // Ensures each token is unique
  };

  // Encode header and payload
  const headerStr = btoa(JSON.stringify(header));
  const payloadStr = btoa(JSON.stringify(payload));
  const message = `${headerStr}.${payloadStr}`;

  // Create signature
  const encoder = new TextEncoder();
  const data = encoder.encode(`${message}.${secret}`);
  const signatureBuffer = await crypto.subtle.digest("SHA-256", data);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureStr = btoa(
    String.fromCharCode.apply(null, signatureArray as any)
  );

  return `${message}.${signatureStr}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<{ userId: string; isValid: boolean; isExpired: boolean }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { userId: "", isValid: false, isExpired: false };
    }

    const [headerStr, payloadStr, signatureStr] = parts;

    // Verify signature
    const message = `${headerStr}.${payloadStr}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${message}.${secret}`);
    const signatureBuffer = await crypto.subtle.digest("SHA-256", data);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignatureStr = btoa(
      String.fromCharCode.apply(null, signatureArray as any)
    );

    if (signatureStr !== expectedSignatureStr) {
      return { userId: "", isValid: false, isExpired: false };
    }

    // Decode and verify payload
    const payloadJson = atob(payloadStr);
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < now;

    return {
      userId: payload.sub,
      isValid: true,
      isExpired,
    };
  } catch (error) {
    return { userId: "", isValid: false, isExpired: false };
  }
}

/**
 * Get the JWT secret from environment
 */
export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // For development, use a default secret
    // In production, always set JWT_SECRET
    return "dev-secret-change-in-production";
  }
  return secret;
}

/**
 * Validator schemas for authentication args
 */
export const authValidators = {
  email: validator.string(),
  password: validator.string(),
  token: validator.string(),
};

/**
 * Get token expiration timestamp
 */
export function getTokenExpirationTime(): number {
  return Date.now() + TOKEN_EXPIRATION_MS;
}
