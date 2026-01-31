import jwt from "jsonwebtoken";

// Use process.env for JWT_SECRET in production
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
const TOKEN_EXPIRATION_DAYS = 30;
const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a JWT token for a user
 */
export function createToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRATION_DAYS}d`,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpirationTime(): number {
  return Date.now() + TOKEN_EXPIRATION_MS;
}
