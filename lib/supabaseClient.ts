import { createClient } from "@supabase/supabase-js";

// CLAVES CORREGIDAS
const supabaseUrl = 'https://jqixjcydhfdazztrxglb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxaXhqY3lkaGZkYXp6dHJ4Z2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTUyMTgsImV4cCI6MjA3MzUzMTIxOH0.Ug1KFnwr8HgKpJx-pSCOW1o7I5ly6iYPM5lDpn96790';

export const hasSupabase = !!(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : (null as any);

// Tus funciones adicionales se mantienen igual...
export const getCurrentSession = async () => {
  if (!hasSupabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const signInWithPassword = async (email, password) => {
  if (!hasSupabase) return { error: new Error('Supabase no configurado') };
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  if (!hasSupabase) return { error: new Error('Supabase no configurado') };
  return await supabase.auth.signOut();
};
