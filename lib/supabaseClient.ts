import { createClient } from "@supabase/supabase-js";

// Proyecto Supabase actual de Mitobicel.
// Las credenciales públicas también pueden sobreescribirse desde Vercel.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fqvfemmwdegllkkyjmio.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdmZlbW13ZGVnbGxra3lqbWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTg5MTEsImV4cCI6MjEwNTgzNDkxMX0.RqY-UptiIs54W7UyGMuuyuivHoOkDN3vQoacc_dKjvI";

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
