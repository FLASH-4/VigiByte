/**
 * SUPABASE CLIENT CONFIGURATION
 * Purpose: This module initializes the connection to the Supabase backend.
 * It serves as the primary interface for the application to interact with 
 * the database, handle authentication, and manage cloud storage.
 * 
 * Two clients are exported:
 * 1. `supabase` — Base client for non-scoped operations (health checks, system queries)
 * 2. `createScopedClient(userId)` — User-scoped client that sends x-user-id header
 *    so Supabase RLS policies can enforce per-user data isolation at the DB level.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * BASE CLIENT
 * Used for operations that don't require user context:
 * - System health checks
 * - Connection verification
 * - Any query that doesn't touch user-owned data
 * 
 * @param {string} VITE_SUPABASE_URL - The unique project URL provided by Supabase.
 * @param {string} VITE_SUPABASE_ANON_KEY - The anonymous public key for secure client-side requests.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/**
 * SCOPED CLIENT FACTORY
 * Creates a Supabase client that automatically attaches the user's ID
 * as a custom header (x-user-id) on every request.
 * 
 * This header is read by Supabase RLS policies to enforce data isolation:
 * - Users can only SELECT their own criminals
 * - Users can only INSERT with their own user_id
 * - Users can only UPDATE/DELETE their own records
 * 
 * Usage: const scopedSupabase = createScopedClient(user?.id)
 * 
 * @param {string} userId - The authenticated user's unique ID (user_XXXXXX from browserAuth)
 * @returns {SupabaseClient} A fully configured client with user context injected
 */
export function createScopedClient(userId) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          'x-user-id': userId  // ← RLS policies read this to scope queries
        }
      }
    }
  )
}