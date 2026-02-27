import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials not found. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUp = (email, password, name) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

export const signOutUser = () => supabase.auth.signOut();

export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

export const resendConfirmation = (email) =>
  supabase.auth.resend({ type: 'signup', email });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Display name from Supabase user object */
export const getUserName = (user) =>
  user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
