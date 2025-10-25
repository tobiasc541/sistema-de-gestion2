import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://jqixjcydhfdazztrxglb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxaXhqY3lkaGZkYXp6dHJ4Z2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTUyMTgsImV4cCI6MjA3MzUzMTIxOH0.Ug1KFnwr8HgKpJx-pSCOW1o7I5ly6iYPM5lDpn96790';

// VERIFICACIÓN INMEDIATA
console.log('🔍 Verificando credenciales:');
console.log('URL:', supabaseUrl);
console.log('API Key length:', supabaseAnonKey.length);
console.log('API Key starts with:', supabaseAnonKey.substring(0, 20));

export const hasSupabase = !!(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : (null as any);

// TEST DE CONEXIÓN INMEDIATO
if (hasSupabase) {
  console.log('🧪 Probando conexión a Supabase...');
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Error de conexión:', error);
      } else {
        console.log('✅ Conexión exitosa!');
      }
    })
    .catch(err => {
      console.error('❌ Error fatal:', err);
    });
}
