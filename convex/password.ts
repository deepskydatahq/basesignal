import bcryptjs from "bcryptjs";

// Hash password using bcryptjs
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcryptjs.hash(password, saltRounds);
};

// Verify password against hash
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcryptjs.compare(password, hash);
};

// Validate password strength (basic rules)
export const validatePasswordStrength = (password: string): string | null => {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};
