# Sistema de Facturación — Next.js + Supabase (con fallback local)

- **Modo Supabase**: si defines `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, todos los datos se leen/escriben en Supabase.
- **Modo Local**: si no hay variables, funciona 100% en memoria + localStorage (preview).

## Instalación
```bash
npm install
npm run dev
```

## Configurar Supabase
1. Crea un proyecto en Supabase.
2. Copia `.env.local.example` a `.env.local` con tu URL y ANON KEY.
3. En el **SQL Editor** ejecuta `supabase/schema.sql` para crear tablas y políticas (demo).
4. Inicia la app. La primera vez se ejecutará un **seed** automático si las tablas están vacías.

## Accesos de prueba
- Admin: `46892389`
- Vendedor: `Tobi / 1234`

> Seguridad: Las políticas incluidas permiten lectura/escritura total para `anon` por simplicidad de demo. Fortalécelas antes de producción.
