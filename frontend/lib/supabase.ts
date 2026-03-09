/**
 * DEPRECATED — Supabase has been replaced by the Vapor backend.
 * Auth: use /auth/login and /auth/register on the Vapor API.
 * Data: all stored in SQLite via Fluent on the Vapor backend.
 *
 * This file is a no-op stub kept to avoid breaking any stale imports
 * during the migration period.
 */

export const supabase = null as any;
export function getServiceSupabase() { return null as any; }
