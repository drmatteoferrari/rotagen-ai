import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Session-free Supabase client for unauthenticated flows (doctor survey).
// storageKey is set to a unique value to prevent GoTrueClient from sharing
// the localStorage lock with the coordinator session client, eliminating
// the "Multiple GoTrueClient instances" warning.
export const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-public-survey-auth',
  }
});
