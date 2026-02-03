import { createClient } from "@supabase/supabase-js";

// Safely access environment variables
// Cast import.meta to any to avoid TS errors if types aren't set up, 
// and default to empty object if env is undefined.
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Check .env file.");
}

// Initialize with placeholder if missing to prevent crash during module load.
// Operations will fail if keys are invalid, but app will start.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);