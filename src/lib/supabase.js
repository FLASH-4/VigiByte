/**
 * SUPABASE CLIENT CONFIGURATION
 * Purpose: This module initializes the connection to the Supabase backend.
 * It serves as the primary interface for the application to interact with 
 * the database, handle authentication, and manage cloud storage.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Initialize the Supabase Client
 * Accesses environment variables for secure connectivity. 
 * These must be defined in the .env file to ensure the application 
 * can reach the correct cloud project.
 * * @param {string} VITE_SUPABASE_URL - The unique project URL provided by Supabase.
 * @param {string} VITE_SUPABASE_ANON_KEY - The anonymous public key for secure client-side requests.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)