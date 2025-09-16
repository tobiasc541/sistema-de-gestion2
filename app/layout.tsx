export const metadata = {
  title: "Sistema de Facturación By: Tobias Carrizo",
  description: "Versión con persistencia en Supabase + fallback local",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
