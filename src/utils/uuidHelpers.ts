/**
 * UUID Helpers
 *
 * Utilities for validating UUIDs before sending them to Supabase.
 * Prevents 400 Bad Request errors caused by passing non-UUID strings
 * (e.g. slugs like "api-resume", "profile") to UUID-typed database columns.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the given string is a valid RFC-4122 UUID.
 * Use this before passing an ID to any Supabase `.eq("id", ...)` or
 * `.eq("job_request_id", ...)` call on a UUID column.
 */
export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

/**
 * Known non-UUID sentinel values that the app uses as special identifiers.
 * These must NEVER be sent to a Supabase UUID column.
 */
const SLUG_SENTINELS = new Set(["api-resume", "profile", "all"]);

/**
 * Returns true if the value is a known slug / sentinel that should be
 * handled locally and must NOT be forwarded to a Supabase UUID column.
 */
export function isSlugSentinel(value: string | null | undefined): boolean {
  if (!value) return false;
  return SLUG_SENTINELS.has(value.toLowerCase());
}

/**
 * Returns true if the value is safe to use in a Supabase `.eq("id", value)`
 * call on a UUID-typed column (i.e. it passes UUID validation).
 * This is the primary guard to use before every Supabase query.
 */
export function isSafeUUID(value: string | null | undefined): boolean {
  return isValidUUID(value) && !isSlugSentinel(value);
}
