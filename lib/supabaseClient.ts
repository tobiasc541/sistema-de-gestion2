import { createClient } from "@supabase/supabase-js";

// Proyecto Supabase actual de Mitobicel.
// IMPORTANTE: createClient necesita la raíz del proyecto; supabase-js agrega /rest/v1.
const supabaseUrl = "https://fqvfemmwdegllkkyjmio.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdmZlbW13ZGVnbGxra3lqbWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTg5MTEsImV4cCI6MjEwNTgzNDkxMX0.RqY-UptiIs54W7UyGMuuyuivHoOkDN3vQoacc_dKjvI";

export const hasSupabase = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
