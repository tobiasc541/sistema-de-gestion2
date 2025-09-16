"use client";
import React, { useEffect, useState } from "react";
import "./globals.css";
import { supabase, hasSupabase } from "../lib/supabaseClient";

/* ===== helpers ===== */
const pad = (n: number, width = 8) => String(n).padStart(width, "0");
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(
    isNaN(n as any) ? 0 : n || 0
  );
const parseNum = (v: any) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
  return isNaN(x) ? 0 : x;
};
const todayISO = () => new Date().toISOString();
const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

/* ===== seed inicial ===== */
function seedState() {
  return {
    meta: { invoiceCounter: 1, budgetCounter: 1, lastSavedInvoiceId: null as null | string },
    auth: { adminKey: "46892389" },
    vendors: [],
    clients: [],
    products: [],
    invoices: [] as any[],
    budgets: [] as any[],
  };
}

/* ===== Supabase ===== */
async function loadFromSupabase(fallback: any) {
  if (!hasSupabase) return fallback;
  const out = clone(fallback);

  const { data: meta } = await supabase.from("meta").select("*").eq("key", "counters").maybeSingle();
  if (meta?.value) out.meta = { ...out.meta, ...meta.value };

  const { data: vendors } = await supabase.from("vendors").select("*");
  if (vendors) out.vendors = vendors;

  const { data: clients } = await supabase.from("clients").select("*");
  if (clients) out.clients = clients;

  const { data: products } = await supabase.from("products").select("*");
  if (products) out.products = products;

  const { data: invoices } = await supabase.from("invoices").select("*").order("number");
  if (invoices) out.invoices = invoices;

  const { data: budgets } = await supabase.from("budgets").select("*").order("number");
  if (budgets) out.budgets = budgets;

  return out;
}

async function saveCountersSupabase(meta: any) {
  if (!hasSupabase) return;
  await supabase.from("meta").upsert({
    key: "counters",
    value: { invoiceCounter: meta.invoiceCounter, budgetCounter: meta.budgetCounter },
  });
}

/* ===== UI atoms (Card, Button, Input, etc) ===== */
/* 👇️️ acá dejás exactamente lo que ya tenías, no hace falta cambiar nada 👇️️ */

/* ===== tus Tabs: Facturación, Clientes, Productos, Deudores, Vendedores, Reportes, Presupuestos ===== */
/* 👇️️ también mantenelos como ya están, solo eliminamos la lógica de localStorage 👇️️ */

/* ===== PrintArea y Login también se mantienen 👇️️ */

/* ===== Page principal ===== */
export default function Page() {
  const [state, setState] = useState<any>(seedState());
  const [session, setSession] = useState<any | null>(null);
  const [tab, setTab] = useState("Facturación");

  useEffect(() => {
    if (!hasSupabase) return;
    (async () => {
      const s = await loadFromSupabase(seedState());
      setState(s);
    })();
  }, []);

  function onLogin(user: any) {
    setSession(user);
    setTab("Facturación");
  }
  function onLogout() {
    setSession(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style>{`::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:#0b1220}::-webkit-scrollbar-thumb{background:#22304a;border-radius:8px}::-webkit-scrollbar-thumb:hover{background:#2f436a}`}</style>
      {!session ? (
        <Login onLogin={onLogin} vendors={state.vendors} adminKey={state.auth.adminKey} />
      ) : (
        <>
          <Navbar current={tab} setCurrent={setTab} role={session.role} onLogout={onLogout} />
          {tab === "Facturación" && <FacturacionTab state={state} setState={setState} session={session} />}
          {tab === "Clientes" && <ClientesTab state={state} setState={setState} />}
          {tab === "Productos" && <ProductosTab state={state} setState={setState} role={session.role} />}
          {tab === "Deudores" && <DeudoresTab state={state} setState={setState} />}
          {session.role === "admin" && tab === "Vendedores" && <VendedoresTab state={state} setState={setState} />}
          {session.role === "admin" && tab === "Reportes" && <ReportesTab state={state} setState={setState} />}
          {tab === "Presupuestos" && session.role === "admin" && <PresupuestosTab state={state} setState={setState} session={session} />}
          {tab === "Presupuestos" && session.role !== "admin" && (
            <div className="max-w-3xl mx-auto p-6 text-sm text-slate-300">Los presupuestos se gestionan por Admin.</div>
          )}
          <PrintArea />
          <div className="fixed bottom-3 right-3 text-[10px] text-slate-500 select-none">
            {hasSupabase ? "Supabase activo" : "Datos en navegador"}
          </div>
        </>
      )}
    </div>
  );
}
