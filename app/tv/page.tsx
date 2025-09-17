"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase, hasSupabase } from "../../lib/supabaseClient";

/** ===== Tipos ===== */
type Ticket = {
  id: string;
  date_iso: string;
  client_id: string;
  client_number: number;
  client_name: string;
  action: string;
  status: "En cola" | "Aceptado";
  accepted_at?: string | null;
  accepted_by?: string | null;
  counter_name?: string | null; // p.ej. "Caja 1"
};

/** ===== Utils ===== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const hourRange = (base = new Date()) => {
  const s = new Date(base);
  s.setMinutes(0, 0, 0);
  const e = new Date(base);
  e.setMinutes(59, 59, 999);
  return { startISO: s.toISOString(), endISO: e.toISOString() };
};

// Anuncio opcional por voz en la TV
function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/** ===== Pantalla TV ===== */
export default function TVPage() {
  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());
  const spoken = useRef<Set<string>>(new Set()); // para no repetir anuncios
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    if (!hasSupabase) return;
    const { startISO, endISO } = hourRange(new Date());
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .gte("date_iso", startISO)
      .lte("date_iso", endISO)
      .order("date_iso", { ascending: true });

    if (error || !data) return;

    const pend = data.filter((t) => t.status !== "Aceptado");
    const acc = data.filter((t) => t.status === "Aceptado");

    setPending(pend);
    setAccepted(acc);

    // Anunciar sólo los nuevos aceptados que aún no se anunciaron
    const nuevos = acc.filter((t) => !spoken.current.has(t.id));
    nuevos.forEach((t) => {
      spoken.current.add(t.id);
      const caja = t.counter_name || "Caja 1";
      speak(`Cliente ${t.client_name}, puede pasar a la ${caja}`);
    });
  }, []);

  useEffect(() => {
    // Reloj en pantalla
    const clock = setInterval(() => setNow(new Date()), 1000);

    // Primer carga
    refresh();

    // Suscripción realtime (requiere Realtime habilitado en la tabla tickets)
    if (hasSupabase) {
      const ch = supabase
        .channel("tv-tickets")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets" },
          () => refresh()
        )
        .subscribe();
      channelRef.current = ch;
    }

    // Polling de respaldo cada 15s
    const poll = setInterval(refresh, 15000);

    return () => {
      clearInterval(clock);
      clearInterval(poll);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [refresh]);

  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Turnos — <span className="tabular-nums">{hhmm}</span>
          </h1>
          <button
            onClick={refresh}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* EN COLA */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-slate-300">En cola</h2>
            <div className="space-y-4">
              {pending.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
                  Sin turnos en esta hora.
                </div>
              )}

              {pending.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
                >
                  <div className="text-2xl font-extrabold tracking-tight truncate">
                    {t.client_name}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {t.action} — N° {t.client_number}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ACEPTADOS */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-slate-300">Aceptados</h2>
            <div className="space-y-4">
              {accepted.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
                  Aún no hay aceptados.
                </div>
              )}

              {accepted.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-emerald-800/40 bg-emerald-900/20 p-5 shadow-sm"
                >
                  <div className="text-2xl font-extrabold tracking-tight truncate">
                    {t.client_name}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {t.action} — N° {t.client_number}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-700/30 px-3 py-1 text-sm font-semibold text-emerald-100">
                    ✅ Puede pasar a <span className="font-bold">{t.counter_name || "Caja 1"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500 select-none">
          Sistema de Gestión — Pantalla de Turnos
        </div>
      </div>
    </div>
  );
}
