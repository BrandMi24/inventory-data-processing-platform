/**
 * Supabase Client Configuration
 * Singleton Supabase client instance for the application
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment variables - these must be set in .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. ' +
    'Please copy .env.example to .env and configure your Supabase credentials.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
    'Please copy .env.example to .env and configure your Supabase credentials.'
  );
}

/**
 * Supabase client instance
 * Typed with our database schema for full type safety
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable auto-refresh for now (no auth in MVP)
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    // Use public schema
    schema: 'public',
  },
});

/**
 * Helper to check if Supabase is configured and reachable
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    // Simple query to check connectivity
    const { error } = await supabase.from('products').select('id').limit(1);
    
    if (error) {
      return { connected: false, error: error.message };
    }
    
    return { connected: true };
  } catch (err) {
    return { 
      connected: false, 
      error: err instanceof Error ? err.message : 'Unknown connection error' 
    };
  }
}

export default supabase;
