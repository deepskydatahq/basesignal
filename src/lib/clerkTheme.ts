import type { Theme, Appearance } from "@clerk/types";

/**
 * Clerk theme configuration mapping to Basesignal design system.
 *
 * CSS variable reference (from src/index.css):
 * - --primary: 0 0% 0% (black)
 * - --background: 0 0% 100% (white)
 * - --foreground: 0 0% 7% (near black)
 * - --secondary: 0 0% 96% (light gray)
 * - --destructive: 0 84% 60% (red)
 * - --border: 0 0% 90% (light gray)
 * - --radius: 0.375rem (6px)
 */
export const clerkTheme: Theme = {
  variables: {
    colorPrimary: "hsl(0, 0%, 0%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInputBackground: "hsl(0, 0%, 96%)",
    colorText: "hsl(0, 0%, 7%)",
    colorTextSecondary: "hsl(0, 0%, 45%)",
    colorDanger: "hsl(0, 84%, 60%)",
    borderRadius: "0.375rem",
  },
};

/**
 * Shared appearance configuration for SignIn and SignUp components.
 * Uses Tailwind classes for element-specific styling.
 */
export const clerkAppearance: Appearance = {
  elements: {
    rootBox: "w-full",
    card: "shadow-none w-full",
    headerTitle: "text-2xl font-semibold",
    headerSubtitle: "text-neutral-500",
    socialButtonsBlockButton: "h-12 text-base",
    formFieldInput: "h-12",
    formButtonPrimary: "h-12 text-base bg-neutral-900 hover:bg-neutral-800",
    footerAction: "hidden",
  },
};
