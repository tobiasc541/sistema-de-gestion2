"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useEffect, useMemo, useState } from "react";
import { supabase, hasSupabase } from "../../lib/supabaseClient";

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
  counter_name?: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function hourRange(base = new Date()) {
  const s = new Date(base);
  s.setMinutes(0, 0, 0);
  const e = new Date(base);
  e.setMinutes(59, 59, 999);
  return { startISO: s.toISOString(), endISO: e.toISOString() };
}

// Voz opcional al aceptar
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

export default function TVPage() {
  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());

  const { startISO, endISO } = useMemo(() => hourRange(now), [now]);

  async function refresh() {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .gte("date_iso", startISO)
      .lte("date_iso", endISO)
      .order("date_iso", { ascending: true });

    if (error) return;

    const rows = (data || []) as Ticket[];
    setPending(rows.filter((t) => t.status === "En cola"));
    setAccepted(rows.filter((t) => t.status === "Aceptado"));
  }

  // Pull cada 6s y tick del reloj
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 6000);
    const clk = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(i);
      clearInterval(clk);
    };
  }, [startISO, endISO]);

  // Realtime: cuando un ticket se acepta, refrescamos y anunciamos
  useEffect(() => {
    if (!hasSupabase) return;
    const ch = supabase
      .channel("tv-tickets")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload: any) => {
          const newRow = payload.new as Ticket;
          if (newRow.status === "Aceptado") {
            speak(`Cliente ${newRow.client_name}, puede pasar a ${newRow.counter_name || "caja"}`);
          }
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [startISO, endISO]);

  return (
    <div className="min-h-screen w-full bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Turnos — {pad2(now.getHours())}:{pad2(now.getMinutes())}</h1>
          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            onClick={refresh}
          >
            Actualizar
          </button>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-white/10 p-4">
            <h2 className="text-lg font-semibold mb-3">En cola</h2>
            {pending.length === 0 ? (
              <div className="text-sm text-white/60">Sin turnos en esta hora.</div>
            ) : (
              <div className="space-y-3">
                {pending.map((t) => (
                  <div key={t.id} className="rounded-xl border border-white/10 p-3">
                    <div className="text-base font-medium truncate">{t.client_name}</div>
                    <div className="text-xs text-white/60">
                      {t.action} — N° {t.client_number}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 p-4">
            <h2 className="text-lg font-semibold mb-3">Aceptados</h2>
            {accepted.length === 0 ? (
              <div className="text-sm text-white/60">Aún no hay aceptados.</div>
            ) : (
              <div className="space-y-3">
                {accepted.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"
                  >
                    <div className="text-base font-semibold">
                      {t.client_name} — {t.counter_name || "Caja"}
                    </div>
                    <div className="text-xs text-white/70">
                      Aceptado {t.accepted_by ? `por ${t.accepted_by}` : ""} —{" "}
                      {t.accepted_at ? new Date(t.accepted_at).toLocaleTimeString("es-AR") : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
