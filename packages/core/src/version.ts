/**
 * The current schema version for Basesignal ProductProfiles.
 *
 * Follows semver conventions:
 * - Major bump (1.0 -> 2.0): breaking changes (removed fields, type changes, renames)
 * - Minor bump (1.0 -> 1.1): additive changes (new optional fields, new enum values)
 */
export const SCHEMA_VERSION = "1.0";

/**
 * Compatibility status returned by checkVersion().
 *
 * - "compatible": profile uses same or older minor version; all fields understood
 * - "needs_migration": profile has higher minor version; may contain unknown fields
 * - "incompatible": different major version; profile shape may be fundamentally different
 */
export type VersionCompatibility =
  | "compatible"
  | "needs_migration"
  | "incompatible";

/**
 * Check whether a profile's schema version is compatible with this library version.
 *
 * @param profileVersion - The basesignal_version string from a ProductProfile
 * @returns Compatibility status
 */
export function checkVersion(profileVersion: string): VersionCompatibility {
  const [profileMajor, profileMinor] = profileVersion.split(".").map(Number);
  const [currentMajor, currentMinor] = SCHEMA_VERSION.split(".").map(Number);

  if (profileMajor !== currentMajor) {
    return "incompatible";
  }
  if (profileMinor > currentMinor) {
    return "needs_migration";
  }
  return "compatible";
}
