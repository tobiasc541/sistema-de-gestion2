"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useEffect, useState } from "react";
import "./globals.css";
import { supabase, hasSupabase } from "../lib/supabaseClient";


/* ===== TIPOS NUEVOS ===== */
type Pedido = {
  id: string;
  client_id: string;
  client_name: string;
  client_number: number;
  items: any[];
  total: number;
  status: "pendiente" | "aceptado" | "listo" | "cancelado";
  date_iso: string;
  observaciones?: string;
  accepted_by?: string;
  accepted_at?: string;
  completed_at?: string;
};

// 👇👇👇 AGREGAR ESTE NUEVO TIPO PARA DETALLE DE DEUDAS
type DetalleDeuda = {
  factura_id: string;
  factura_numero: number;
  fecha: string;
  monto_total: number;
  monto_pagado: number;
  monto_debe: number;
  items: any[];
};

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

/* ===== seed inicial (solo UI mientras carga Supabase) ===== */
function seedState() {
  return {
    meta: {
      invoiceCounter: 1,
      budgetCounter: 1,
      lastSavedInvoiceId: null as null | string,
      cashFloat: 0,
      cashFloatByDate: {} as Record<string, number>,
      commissionsByDate: {} as Record<string, number>,
      gabiFundsByDate: {} as Record<string, number>,
    },
    auth: { adminKey: "46892389" },
    vendors: [] as any[],
    clients: [] as any[],
    products: [] as any[],
    invoices: [] as any[],
    budgets: [] as any[],
    gastos: [] as any[],
    devoluciones: [] as any[],
    debt_payments: [] as any[], // 👈 NUEVA LÍNEA - AGREGAR ESTO
    queue: [] as any[],
    gabiFunds: [] as any[],
    pedidos: [] as Pedido[],
  };
}


async function loadFromSupabase(fallback: any) {
  if (!hasSupabase) return fallback;
  const out = clone(fallback);
  
  // meta
  const { data: meta, error: metaErr } = await supabase
    .from("meta").select("*").eq("key","counters").maybeSingle();
  if (metaErr) { console.error("SELECT meta:", metaErr); alert("No pude leer 'meta' de Supabase."); }
  if (meta?.value) out.meta = { ...out.meta, ...meta.value };

  // 👇👇👇 AGREGAR AQUÍ - Cargar comisiones
  const { data: commissionsData, error: commErr } = await supabase
    .from("commissions")
    .select("*");

  if (commErr) {
    console.error("SELECT commissions:", commErr);
  } else if (commissionsData) {
    const commissionsByDate: Record<string, number> = {};
    commissionsData.forEach((row: any) => {
      commissionsByDate[row.day] = parseNum(row.amount);
    });
    out.meta.commissionsByDate = commissionsByDate;
  }
  // 👆👆👆 HASTA AQUÍ
  // 👇👇👇 AGREGAR AQUÍ - Cargar cash_floats
const { data: cashFloatsData, error: cashFloatsErr } = await supabase
  .from("cash_floats")
  .select("*");

if (cashFloatsErr) {
  console.error("SELECT cash_floats:", cashFloatsErr);
} else if (cashFloatsData) {
  const cashFloatByDate: Record<string, number> = {};
  cashFloatsData.forEach((row: any) => {
    cashFloatByDate[row.day] = parseNum(row.amount);
  });
  out.meta.cashFloatByDate = cashFloatByDate;
}
  // 👇👇👇 AGREGAR AQUÍ - Cargar fondos de Gabi
const { data: gabiFundsData, error: gabiErr } = await supabase
  .from("gabi_funds")
  .select("*")
  .order("day", { ascending: false });

if (gabiErr) {
  console.error("SELECT gabi_funds:", gabiErr);
} else if (gabiFundsData) {
  const gabiFundsByDate: Record<string, number> = {};
  gabiFundsData.forEach((row: any) => {
    gabiFundsByDate[row.day] = parseNum(row.initial_amount);
  });
  out.meta.gabiFundsByDate = gabiFundsByDate;
  out.gabiFunds = gabiFundsData;
}

  // vendors (esto ya existe, DEJARLO COMO ESTÁ)
  const { data: vendors, error: vendErr } = await supabase.from("vendors").select("*");
  if (vendErr) { console.error("SELECT vendors:", vendErr); alert("No pude leer 'vendors' de Supabase."); }
  if (vendors) out.vendors = vendors;
  
  // clients
  const { data: clients, error: cliErr } = await supabase.from("clients").select("*");
  if (cliErr) { console.error("SELECT clients:", cliErr); alert("No pude leer 'clients' de Supabase."); }
  if (clients) out.clients = clients;

  // products
  const { data: products, error: prodErr } = await supabase.from("products").select("*");
  if (prodErr) { console.error("SELECT products:", prodErr); alert("No pude leer 'products' de Supabase."); }
  if (products) {
    out.products = products.map((p: any) => ({
      ...p,
      stock_minimo: p.stock_min !== null ? parseNum(p.stock_min) : 0
    }));
  }

  // invoices
  const { data: invoices, error: invErr } = await supabase.from("invoices").select("*").order("number");
  if (invErr) { console.error("SELECT invoices:", invErr); alert("No pude leer 'invoices' de Supabase."); }
  if (invoices) out.invoices = invoices;

  // 👇👇👇 AGREGAR AQUÍ - Cargar devoluciones
  const { data: devoluciones, error: devErr } = await supabase
    .from("devoluciones").select("*").order("date_iso", { ascending: false });
  if (devErr) { 
    console.error("SELECT devoluciones:", devErr); 
    alert("No pude leer 'devoluciones' de Supabase."); 
  }
  if (devoluciones) out.devoluciones = devoluciones;
  // 👆👆👆 HASTA AQUÍ
    // 👇👇👇 AGREGAR AQUÍ - Cargar debt_payments
  const { data: debtPayments, error: dpErr } = await supabase
    .from("debt_payments")
    .select("*")
    .order("date_iso", { ascending: false });

  if (dpErr) { 
    console.error("SELECT debt_payments:", dpErr); 
    alert("No pude leer 'debt_payments' de Supabase."); 
  }
  if (debtPayments) out.debt_payments = debtPayments;
  // 👆👆👆 HASTA AQUÍ

  // budgets
  const { data: budgets, error: budErr } = await supabase.from("budgets").select("*").order("number");
  if (budErr) { console.error("SELECT budgets:", budErr); alert("No pude leer 'budgets' de Supabase."); }
  if (budgets) out.budgets = budgets;
    // 👇👇👇 AGREGAR AQUÍ - Cargar pedidos
  const { data: pedidos, error: pedidosErr } = await supabase
    .from("pedidos")
    .select("*")
    .order("date_iso", { ascending: false });

  if (pedidosErr) {
    console.error("SELECT pedidos:", pedidosErr);
  } else if (pedidos) {
    out.pedidos = pedidos;
  }
  // 👆👆👆 HASTA AQUÍ

  // Si está vacío, NO sembrar datos de ejemplo (nada de demo).
  if (!out.vendors?.length && !out.clients?.length && !out.products?.length) {
    // Solo aseguro counters en meta para que la app no falle.
    await supabase.from("meta").upsert({
      key: "counters",
      value: {
        invoiceCounter: 1,
        budgetCounter: 1,
        cashFloat: out.meta?.cashFloat ?? 0,
        cashFloatByDate: out.meta?.cashFloatByDate ?? {},
        commissionsByDate: out.meta?.commissionsByDate ?? {},
      },
    });
  }

  return out;
}

async function saveCountersSupabase(meta: any) {
  if (!hasSupabase) return;
  await supabase.from("meta").upsert({
    key: "counters",
    value: {
      invoiceCounter: meta.invoiceCounter,
      budgetCounter: meta.budgetCounter,
      cashFloat: meta.cashFloat ?? 0,
      cashFloatByDate: meta.cashFloatByDate ?? {},
       commissionsByDate: meta.commissionsByDate ?? {},   // 👈
    },
  });
}





/* ====== UI atoms ====== */
function Card({ title, actions, className = "", children }: any) {
  return (
    <div className={"rounded-2xl border border-slate-800 bg-slate-900/60 p-4 " + className}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
function Button({ children, onClick, type = "button", tone = "emerald", className = "", disabled }: any) {
  const map: any = {
    emerald: "bg-emerald-600 hover:bg-emerald-500 border-emerald-700/50",
    slate: "bg-slate-700 hover:bg-slate-600 border-slate-700",
    red: "bg-red-600 hover:bg-red-500 border-red-700/50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm border disabled:opacity-60 ${map[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
function Input({ label, value, onChange, placeholder = "", type = "text", className = "", disabled }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <input
        value={value}
        type={type}
        onChange={(e) => onChange && onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 ${className}`}
      />
    </label>
  );
}
const NumberInput = (props: any) => <Input {...props} type="text" />;
function Select({ label, value, onChange, options, className = "" }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <select
        value={value}
        onChange={(e) => onChange && onChange((e.target as HTMLSelectElement).value)}
        className={`w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 ${className}`}
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
const Chip = ({ children, tone = "slate" }: any) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
      tone === "emerald" ? "bg-emerald-800/40 text-emerald-200 border-emerald-700/40" : "bg-slate-800/60 text-slate-200 border-slate-700/50"
    } border`}
  >
    {children}
  </span>
);

/* ===== helpers de negocio ===== */
function ensureUniqueNumber(clients: any[]) {
  const max = clients.reduce((m, c) => Math.max(m, c.number || 0), 1000);
  return max + 1;
}

function calcInvoiceTotal(items: any[]) {
  return items.reduce((s, it) => s + parseNum(it.qty) * parseNum(it.unitPrice), 0);
}

function calcInvoiceCost(items: any[]) {
  return items.reduce((s, it) => s + parseNum(it.qty) * parseNum(it.cost || 0), 0);
}

// ✅ NUEVA FUNCIÓN: Validar stock disponible
function validarStockDisponible(products: any[], items: any[]): { valido: boolean; productosSinStock: string[] } {
  const productosSinStock: string[] = [];
  
  for (const item of items) {
    const producto = products.find((p: any) => p.id === item.productId);
    if (producto) {
      const stockActual = parseNum(producto.stock);
      const cantidadRequerida = parseNum(item.qty);
      
      if (stockActual < cantidadRequerida) {
        productosSinStock.push(`${producto.name} (Stock: ${stockActual}, Necesario: ${cantidadRequerida})`);
      }
    }
  }
  
  return {
    valido: productosSinStock.length === 0,
    productosSinStock
  };
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((acc: any, it: any) => {
    const k = it[key] || "Otros";
    (acc[k] = acc[k] || []).push(it);
    return acc;
  }, {} as any);
}
  

// === Gasto del mes por cliente ===
// === Gasto del mes por cliente ===
function gastoMesCliente(state: any, clientId: string, refDate = new Date()) {
  if (!clientId) return 0;
  
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

  // Ventas del mes (solo Facturas)
  const factMes = (state.invoices || [])
    .filter((f: any) => {
      if (f.type !== "Factura" || f.client_id !== clientId) return false;
      
      const invoiceDate = new Date(f.date_iso);
      return invoiceDate >= start && invoiceDate <= end;
    })
    .reduce((s: number, f: any) => s + parseNum(f.total), 0);

  // Devoluciones del mes del cliente
  const devsMes = (state.devoluciones || [])
    .filter((d: any) => {
      if (d.client_id !== clientId) return false;
      
      const devolucionDate = new Date(d.date_iso);
      return devolucionDate >= start && devolucionDate <= end;
    });

  // Restan al gasto si son devolución en efectivo/transferencia/saldo
  const devRestables = devsMes
    .filter((d: any) => ["efectivo", "transferencia", "saldo"].includes(String(d.metodo)))
    .reduce((s: number, d: any) => s + parseNum(d.total), 0);

  // En intercambio por OTRO producto, sumamos solo la diferencia que abonó
  const extrasIntercambio = devsMes
    .filter((d: any) => d.metodo === "intercambio_otro")
    .reduce(
      (s: number, d: any) =>
        s + parseNum(d.extra_pago_efectivo || 0) + parseNum(d.extra_pago_transferencia || 0),
      0
    );

  return Math.max(0, factMes - devRestables + extrasIntercambio);
}
// === Detalle de deudas por cliente ===
function calcularDetalleDeudas(state: any, clientId: string): DetalleDeuda[] {
  if (!clientId) return [];
  
  console.log(`🔍 Calculando deudas para cliente: ${clientId}`);
  
  // Obtener TODAS las facturas del cliente (sin filtrar por status)
  const todasFacturas = (state.invoices || [])
    .filter((f: any) => 
      f.client_id === clientId && 
      f.type === "Factura"
    )
    .sort((a: any, b: any) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime());

  console.log(`📊 Encontradas ${todasFacturas.length} facturas para el cliente`);

  const detalleDeudas = todasFacturas.map((factura: any) => {
    try {
      const totalFactura = parseNum(factura.total);
      const pagosEfectivo = parseNum(factura?.payments?.cash || 0);
      const pagosTransferencia = parseNum(factura?.payments?.transfer || 0);
      const saldoAplicado = parseNum(factura?.payments?.saldo_aplicado || 0);
      
      const totalPagos = pagosEfectivo + pagosTransferencia + saldoAplicado;
      const montoDebe = Math.max(0, totalFactura - totalPagos);

      console.log(`📋 Factura #${factura.number}: Total=${totalFactura}, Pagado=${totalPagos}, Debe=${montoDebe}`);

      // Incluir solo facturas con deuda pendiente
      if (montoDebe > 0) {
        return {
          factura_id: factura.id,
          factura_numero: factura.number,
          fecha: factura.date_iso,
          monto_total: totalFactura,
          monto_pagado: totalPagos,
          monto_debe: montoDebe,
          items: factura.items || []
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error procesando factura ${factura.number}:`, error);
      return null;
    }
  }).filter((deuda): deuda is DetalleDeuda => deuda !== null);

  console.log(`💰 Deudas pendientes encontradas: ${detalleDeudas.length}`);
  
  return detalleDeudas;
}
// === Deuda total del cliente ===
function calcularDeudaTotal(detalleDeudas: DetalleDeuda[]): number {
  return detalleDeudas.reduce((total, deuda) => total + deuda.monto_debe, 0);
}

// 👇👇👇 NUEVA FUNCIÓN: Obtener detalle de pagos aplicados por factura
function obtenerDetallePagosAplicados(pagosDeudores: any[], state: any) {
  const detallePagos: any[] = [];

  pagosDeudores.forEach((pago: any) => {
    // Obtener el cliente
    const cliente = state.clients.find((c: any) => c.id === pago.client_id);
    if (!cliente) return;

    // Obtener facturas pendientes del cliente antes del pago
    const facturasPendientes = (state.invoices || [])
      .filter((f: any) => 
        f.client_id === pago.client_id && 
        f.type === "Factura" && 
        f.status === "No Pagada" &&
        new Date(f.date_iso) <= new Date(pago.date_iso)
      )
      .sort((a: any, b: any) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime());

    let saldoRestante = pago.total_amount;
    const aplicaciones: any[] = [];

    // Aplicar el pago a las facturas más antiguas primero
    for (const factura of facturasPendientes) {
      if (saldoRestante <= 0) break;

      const deudaFactura = parseNum(factura.total) - 
                          parseNum(factura?.payments?.cash || 0) - 
                          parseNum(factura?.payments?.transfer || 0) -
                          parseNum(factura?.payments?.saldo_aplicado || 0);

      if (deudaFactura > 0) {
        const montoAplicado = Math.min(saldoRestante, deudaFactura);
        
        aplicaciones.push({
          factura_numero: factura.number,
          fecha_factura: factura.date_iso,
          total_factura: parseNum(factura.total),
          deuda_antes: deudaFactura,
          monto_aplicado: montoAplicado,
          deuda_despues: deudaFactura - montoAplicado
        });

        saldoRestante -= montoAplicado;
      }
    }

    // Si sobró saldo, se aplicó a saldo a favor
    if (saldoRestante > 0) {
      aplicaciones.push({
        tipo: "saldo_favor",
        monto_aplicado: saldoRestante,
        descripcion: "Acreditado como saldo a favor"
      });
    }

    detallePagos.push({
      pago_id: pago.id,
      cliente: pago.client_name,
      fecha_pago: pago.date_iso,
      total_pagado: pago.total_amount,
      efectivo: pago.cash_amount,
      transferencia: pago.transfer_amount,
      aplicaciones: aplicaciones
    });
  });

  return detallePagos;
}
function Navbar({ current, setCurrent, role, onLogout }: any) {
  const TABS = [
    "Facturación",
    "Clientes", 
    "Productos",
    "Deudores",
    "Vendedores",
    "Reportes",
    "Presupuestos",
    "Gastos y Devoluciones",
    "Cola",
    "Pedidos Online", // 👈 NUEVA PESTAÑA
      "Ingresar Stock", // 👈 NUEVA PESTAÑA

  ];

 const visibleTabs =
  role === "admin"
    ? TABS
    : role === "vendedor"
    ? ["Facturación", "Clientes", "Productos", "Deudores", "Presupuestos", "Gastos y Devoluciones", "Cola", "Pedidos Online", "Ingresar Stock"] // 👈 AGREGAR
    : role === "pedido-online"
    ? ["Hacer Pedido"]
    : ["Panel"];
  return (
    <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-bold tracking-wide">
           Facturación — {hasSupabase ? "By : Tobias carrizo" : "Local"}
        </div>
        <nav className="flex-1 flex gap-1 flex-wrap">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setCurrent(t)}
              className={`px-3 py-1.5 rounded-xl text-sm border ${
                current === t 
                  ? "bg-emerald-600 border-emerald-700" 
                  : "bg-slate-900/60 border-slate-800 hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="ml-auto text-xs text-slate-400 hover:text-slate-200">
          Salir
        </button>
      </div>
    </div>
  );
}

/* ===== Panel del cliente ===== */
function ClientePanel({ state, setState, session }: any) {
  const [accion, setAccion] = useState<"COMPRAR POR MAYOR" | "COMPRAR POR MENOR">("COMPRAR POR MAYOR");

  function genTicketCode() {
    const a = Math.random().toString(36).slice(2, 6);
    const b = Date.now().toString(36).slice(-5);
    return ("T-" + a + "-" + b).toUpperCase();
  }

  async function continuar() {
    const code = genTicketCode();
    const ticket = {
      id: code,
      date_iso: todayISO(),
      client_id: session.id,
      client_number: session.number,
      client_name: session.name,
      action: accion,
      status: "En cola" as const,
    };

    // guardar ticket en la cola local
    const st = clone(state);
    st.queue = Array.isArray(st.queue) ? st.queue : [];
    st.queue.push(ticket);
    setState(st);

    // guardar en Supabase (si está disponible)
    if (hasSupabase) {
      await supabase.from("tickets").insert(ticket);
    }

    // imprimir ticket
    window.dispatchEvent(new CustomEvent("print-ticket", { detail: ticket } as any));
    await nextPaint();
    window.print();
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Card title="Bienvenido/a">
        <div className="text-sm mb-2">
          Cliente: <b>{session.name}</b> — N° <b>{session.number}</b>
        </div>
        <div className="grid gap-3">
          <Select
            label="¿Qué desea hacer?"
            value={accion}
            onChange={setAccion}
            options={[
              { value: "COMPRAR POR MENOR", label: "COMPRAR POR MENOR" },
              { value: "COMPRAR POR MAYOR", label: "COMPRAR POR MAYOR" },
            ]}
          />
          <div className="flex justify-end">
            <Button onClick={continuar}>Continuar</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =====================  TABS  ===================== */
/* Facturación */
function FacturacionTab({ state, setState, session }: any) {
  
  const [clientId, setClientId] = useState(state.clients[0]?.id || "");
  const [vendorId, setVendorId] = useState(session.role === "admin" ? state.vendors[0]?.id : session.id);
  const [priceList, setPriceList] = useState("1");
  const [sectionFilter, setSectionFilter] = useState("Todas");
  const [listFilter, setListFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
 const [payCash, setPayCash] = useState("");
const [payTransf, setPayTransf] = useState("");
const [payChange, setPayChange] = useState(""); // vuelto (opcional)
const [alias, setAlias] = useState("");

  const client = state.clients.find((c: any) => c.id === clientId);
  const vendor = state.vendors.find((v: any) => v.id === vendorId);

  const sections = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.section || "Otros")))];
  const lists = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.list_label || "General")))];

  const filteredProducts = state.products.filter((p: any) => {
    const okS = sectionFilter === "Todas" || p.section === sectionFilter;
    const okL = listFilter === "Todas" || p.list_label === listFilter;
    const okQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
    return okS && okL && okQ;
  });

  function addItem(p: any) {
    const existing = items.find((it: any) => it.productId === p.id);
    const unit = priceList === "1" ? p.price1 : p.price2;
    if (existing) setItems(items.map((it) => (it.productId === p.id ? { ...it, qty: parseNum(it.qty) + 1 } : it)));
    else setItems([...items, { productId: p.id, name: p.name, section: p.section, qty: 1, unitPrice: unit, cost: p.cost }]);
  }

 async function saveAndPrint() {
  if (!client || !vendor) return alert("Seleccioná cliente y vendedor.");
  if (items.length === 0) return alert("Agregá productos al carrito.");
   // ✅ VALIDAR STOCK ANTES DE CONTINUAR
  const validacionStock = validarStockDisponible(state.products, items);
  if (!validacionStock.valido) {
    const mensajeError = `No hay suficiente stock para los siguientes productos:\n\n${validacionStock.productosSinStock.join('\n')}`;
    return alert(mensajeError);
  }
  const total = calcInvoiceTotal(items);
  const cash  = parseNum(payCash);
  const transf = parseNum(payTransf);
  const suggestedChange = Math.max(0, cash - Math.max(0, total - transf));
  const change = payChange.trim() === "" ? suggestedChange : Math.max(0, parseNum(payChange));
  if (change > cash) return alert("El vuelto no puede ser mayor al efectivo entregado.");

  const st = clone(state);
  const number = st.meta.invoiceCounter++;
  const id = "inv_" + number;

  // 1) Consumir saldo a favor del cliente ANTES de calcular deuda
  const cl = st.clients.find((c:any) => c.id === client.id)!;
  const saldoActual = parseNum(cl.saldo_favor || 0);
  const saldoAplicado = Math.min(total, saldoActual);
  const totalTrasSaldo = total - saldoAplicado;

  // 2) Lo efectivamente aplicado por pagos (efectivo+transf - vuelto)
  const applied = Math.max(0, cash + transf - change);

  // 3) Deuda que queda luego de aplicar saldo y pagos
  const debtDelta = Math.max(0, totalTrasSaldo - applied);
  const status = debtDelta > 0 ? "No Pagada" : "Pagada";

  // 4) Actualizar cliente: bajar saldo_favor, subir deuda si corresponde
  cl.saldo_favor = saldoActual - saldoAplicado;
  cl.debt = parseNum(cl.debt) + debtDelta;

  // ⭐⭐⭐⭐ NUEVO: DESCONTAR STOCK DE PRODUCTOS VENDIDOS ⭐⭐⭐⭐⭐
  items.forEach(item => {
    const product = st.products.find((p: any) => p.id === item.productId);
    if (product) {
      product.stock = Math.max(0, parseNum(product.stock) - parseNum(item.qty));
    }
  });

  const invoice = {
    id,
    number,
    date_iso: todayISO(),
    client_id: client.id,
    client_name: client.name,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    items: clone(items),
    total,
    total_after_credit: totalTrasSaldo,
    cost: calcInvoiceCost(items),
    payments: { cash, transfer: transf, change, alias: alias.trim(), saldo_aplicado: saldoAplicado },
    status,
    type: "Factura",
    client_debt_total: cl.debt,
  };

  st.invoices.push(invoice);
  st.meta.lastSavedInvoiceId = id;
  setState(st);

  if (hasSupabase) {
    await supabase.from("invoices").insert(invoice);
    await supabase.from("clients").update({ debt: cl.debt, saldo_favor: cl.saldo_favor }).eq("id", client.id);
    
    // ⭐⭐⭐⭐ ACTUALIZAR STOCK EN SUPABASE ⭐⭐⭐⭐⭐
    for (const item of items) {
      const product = st.products.find((p: any) => p.id === item.productId);
      if (product) {
        await supabase.from("products")
          .update({ stock: product.stock })
          .eq("id", item.productId);
      }
    }
    
    await saveCountersSupabase(st.meta);
  }

  window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
  await nextPaint();
  window.print();
  
  // Limpiar UI
  setPayCash("");
  setPayTransf("");
  setPayChange("");
  setAlias("");
  setItems([]);
}

const total = calcInvoiceTotal(items);
const cash = parseNum(payCash);
const transf = parseNum(payTransf);

// Vuelto sugerido automáticamente: solo sale del EFECTIVO
const suggestedChange = Math.max(0, cash - Math.max(0, total - transf));
// Si el usuario no escribió nada, usamos el sugerido
const change = payChange.trim() === "" ? suggestedChange : Math.max(0, parseNum(payChange));

const paid = cash + transf;                               // lo que ENTREGÓ el cliente
const applied = Math.max(0, cash + transf - change);      // lo que realmente se aplica a la factura
const toPay = Math.max(0, total - applied);

  const grouped = groupBy(filteredProducts, "section");

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Encabezado">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Cliente"
              value={clientId}
              onChange={setClientId}
              options={state.clients.map((c: any) => ({ value: c.id, label: `${c.number} — ${c.name}` }))}
            />
            <Select
              label="Vendedor"
              value={vendorId}
              onChange={setVendorId}
              options={state.vendors.map((v: any) => ({ value: v.id, label: v.name }))}
            />
      <div className="col-span-2 text-xs text-slate-300 mt-1">
  Deuda del cliente: <span className="font-semibold">
    {money(state.clients.find((c:any)=>c.id===clientId)?.debt || 0)}
  </span>
  <span className="mx-2">·</span>
  Saldo a favor: <span className="font-semibold">
    {money(state.clients.find((c:any)=>c.id===clientId)?.saldo_favor || 0)}
  </span>
  <span className="mx-2">·</span>
  Gastado este mes: <span className="font-semibold">{money(gastoMesCliente(state, clientId))}</span>
</div>


            <Select
              label="Lista de precios"
              value={priceList}
              onChange={setPriceList}
              options={[
                { value: "1", label: "Mitobicel" },
                { value: "2", label: "ElshoppingDlc" },
              ]}
            />
          </div>
        </Card>

       <Card title="Pagos">
  <div className="grid grid-cols-2 gap-3 items-end">
    <NumberInput label="Efectivo" value={payCash} onChange={setPayCash} placeholder="0" />
    <NumberInput label="Transferencia" value={payTransf} onChange={setPayTransf} placeholder="0" />

    {/* Vuelto + ayuda (sugerido) */}
    <div className="space-y-1">
      <NumberInput
        label="Vuelto (efectivo)"
        value={payChange}
        onChange={setPayChange}
        placeholder="0"
      />
      {payChange.trim() === "" && (
        <div className="text-[11px] text-slate-400">
          Sugerido: {money(suggestedChange)}
        </div>
      )}
    </div>

    {/* Alias/CVU alineado con Vuelto */}
    <div className="self-end">
      <Input
        label="Alias / CVU destino"
        value={alias}
        onChange={setAlias}
        placeholder="ej: mitobicel.algo.banco"
      />
    </div>

    <div className="col-span-2 text-xs text-slate-300">
      Pagado: <span className="font-semibold">{money(paid)}</span> — Falta:{" "}
      <span className="font-semibold">{money(toPay)}</span> — Vuelto:{" "}
      <span className="font-semibold">{money(change)}</span>
    </div>
  </div>
</Card>


        <Card title="Totales">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button onClick={saveAndPrint} className="shadow-lg">
                Guardar e Imprimir
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Productos">
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <Select label="Sección" value={sectionFilter} onChange={setSectionFilter} options={sections.map((s: any) => ({ value: s, label: s }))} />
          <Select label="Lista" value={listFilter} onChange={setListFilter} options={lists.map((s: any) => ({ value: s, label: s }))} />
          <Input label="Buscar" value={query} onChange={setQuery} placeholder="Nombre del producto..." />
          <div className="pt-6">
            <Chip tone="emerald">Total productos: {filteredProducts.length}</Chip>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {Object.entries(grouped).map(([sec, arr]: any) => (
              <div key={sec} className="border border-slate-800 rounded-xl">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-800/70">{sec}</div>
                <div className="divide-y divide-slate-800">
                  {arr.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-slate-400">
                          Mitobicel: {money(p.price1)} · ElshoppingDlc: {money(p.price2)} <span className="text-[10px] text-slate-500 ml-1">{p.list_label}</span>
                        </div>
                      </div>
                      <Button onClick={() => addItem(p)} tone="slate" className="shrink-0">
                        Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Carrito</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {items.length === 0 && <div className="p-3 text-sm text-slate-400">Vacío</div>}
              {items.map((it, idx) => (
                <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-400">{it.section}</div>
                  </div>
                  <div className="col-span-2">
                    <NumberInput
                      label="Cant."
                      value={it.qty}
                      onChange={(v: any) => {
                        const q = Math.max(0, parseNum(v));
                        setItems(items.map((x, i) => (i === idx ? { ...x, qty: q } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <NumberInput
                      label="Precio"
                      value={it.unitPrice}
                      onChange={(v: any) => {
                        const q = Math.max(0, parseNum(v));
                        setItems(items.map((x, i) => (i === idx ? { ...x, unitPrice: q } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end pb-0.5">
                    <button onClick={() => setItems(items.filter((_: any, i: number) => i !== idx))} className="text-xs text-red-400 hover:text-red-300">
                      ✕
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs text-slate-300 pt-1">
                    Subtotal ítem: {money(parseNum(it.qty) * parseNum(it.unitPrice))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* Clientes */
function ClientesTab({ state, setState }: any) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState(ensureUniqueNumber(state.clients));

  async function addClient() {
    if (!name.trim()) return;
  const newClient = {
  id: "c" + Math.random().toString(36).slice(2, 8),
  number: parseInt(String(number), 10),
  name: name.trim(),
  debt: 0,
  saldo_favor: 0, // <--- NUEVO (saldo a favor)
};


    const st = clone(state);
    st.clients.push(newClient);
    setState(st);
    setName("");
    setNumber(ensureUniqueNumber(st.clients));

    if (hasSupabase) {
      await supabase.from("clients").insert(newClient);
    }
  }

  // Ordeno opcionalmente por número para que quede prolijo
  const clients = Array.isArray(state.clients)
    ? [...state.clients].sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card title="Agregar cliente">
        <div className="grid md:grid-cols-3 gap-3">
          <NumberInput label="N° cliente" value={number} onChange={setNumber} />
          <Input label="Nombre" value={name} onChange={setName} placeholder="Ej: Kiosco 9 de Julio" />
          <div className="pt-6">
            <Button onClick={addClient}>Agregar</Button>
          </div>
        </div>
      </Card>

     <Card title="Listado">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="text-left text-slate-400">
        <tr>
          <th className="py-2 pr-4">N°</th>
          <th className="py-2 pr-4">Nombre</th>
          <th className="py-2 pr-4">Deuda</th>
          <th className="py-2 pr-4">Saldo a favor</th>
          <th className="py-2 pr-4">Gasto mes</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-800">
        {clients.map((c: any) => (
          <tr key={c.id}>
            <td className="py-2 pr-4">{c.number}</td>
            <td className="py-2 pr-4">{c.name}</td>
            <td className="py-2 pr-4">{money(c.debt || 0)}</td>
            <td className="py-2 pr-4">{money(c.saldo_favor || 0)}</td> {/* aquí va */}
            <td className="py-2 pr-4">{money(gastoMesCliente(state, c.id))}</td>
          </tr>
        ))}

        {clients.length === 0 && (
          <tr>
            <td className="py-2 pr-4 text-slate-400" colSpan={5}>
              Sin clientes cargados.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
      </Card>
    </div>
  );
}





/* Productos */
function ProductosTab({ state, setState, role }: any) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [price1, setPrice1] = useState("");
  const [price2, setPrice2] = useState("");
  const [stock, setStock] = useState("");

  const productosBajoStock = state.products.filter(
    (p: any) => parseNum(p.stock) < parseNum(p.stock_minimo || 0)
  );

  async function addProduct() {
    if (!name.trim()) return;

    const product = {
      id: "p" + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      section: section.trim() || "General",
      price1: parseNum(price1),
      price2: parseNum(price2),
      stock: parseNum(stock),
      stock_minimo: 0,
    };
 // 👇👇👇 AGREGAR ESTO JUSTO AQUÍ 👇👇👇
  console.log("🔍 PRODUCTO A GUARDAR:", product);
  console.log("🔍 hasSupabase:", hasSupabase);
  
    
    const st = clone(state);
    st.products.push(product);
    setState(st);
    
    setName("");
    setPrice1("");
    setPrice2("");
    setStock("");
    setSection("");

    if (hasSupabase) {
      
      const { error } = await supabase.from("products").insert({
        id: product.id,
        name: product.name,
        section: product.section,
        list_label: "General",
        price1: product.price1,
        price2: product.price2,
        cost: 0,
        stock: product.stock,
        stock_min: 0
      });

      if (error) {
        console.error("Error guardando producto:", error);
        alert("Error al guardar: " + error.message);
        return;
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {productosBajoStock.length > 0 && (
        <Card title="⚠️ Productos con bajo stock">
          <ul className="list-disc pl-5 text-sm text-red-400">
            {productosBajoStock.map((p: any) => (
              <li key={p.id}>
                {p.name} – Stock actual: {p.stock}, Mínimo: {p.stock_minimo}
              </li>
            ))}
          </ul>
        </Card>
      )}
      
      <Card title="Crear producto">
        <div className="grid md:grid-cols-5 gap-3">
          <Input label="Nombre" value={name} onChange={setName} />
          <Input label="Sección" value={section} onChange={setSection} placeholder="General" />
          <NumberInput label="Precio 1" value={price1} onChange={setPrice1} />
          <NumberInput label="Precio 2" value={price2} onChange={setPrice2} />
          <NumberInput label="Stock" value={stock} onChange={setStock} />
          <div className="md:col-span-5">
            <Button onClick={addProduct}>Agregar</Button>
          </div>
        </div>
      </Card>

      <Card title="Listado de productos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Sección</th>
                <th className="py-2 pr-4">Precio 1</th>
                <th className="py-2 pr-4">Precio 2</th>
                <th className="py-2 pr-4">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.products.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.section}</td>
                  <td className="py-2 pr-4">{money(p.price1)}</td>
                  <td className="py-2 pr-4">{money(p.price2)}</td>
                  <td className="py-2 pr-4">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}



/* Deudores */
function DeudoresTab({ state, setState }: any) {
  // Filtrar clientes que tengan deuda NETO mayor a 0 (deuda - saldo a favor > 0)
  const clients = state.clients.filter((c: any) => {
    const deuda = parseNum(c.debt);
    const saldoFavor = parseNum(c.saldo_favor || 0);
    return (deuda - saldoFavor) > 0;
  });
  
  const [active, setActive] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [transf, setTransf] = useState("");
  const [alias, setAlias] = useState("");
  const [verDetalle, setVerDetalle] = useState<string | null>(null);

  // Función para ver detalle de deudas
  function verDetalleDeudas(clientId: string) {
    setVerDetalle(clientId);
  }

  // Calcular detalle de deudas para un cliente
  const detalleDeudasCliente = verDetalle ? calcularDetalleDeudas(state, verDetalle) : [];
  const deudaTotalCliente = calcularDeudaTotal(detalleDeudasCliente);
  const clienteDetalle = state.clients.find((c: any) => c.id === verDetalle);

async function registrarPago() {
  const cl = state.clients.find((c: any) => c.id === active);
  if (!cl) return;
  const totalPago = parseNum(cash) + parseNum(transf);
  if (totalPago <= 0) return alert("Importe inválido.");

  const st = clone(state);
  const client = st.clients.find((c: any) => c.id === active)!;

  // CALCULAR DEUDA NETA (considerando saldo a favor)
  const deudaBruta = parseNum(client.debt);
  const saldoFavor = parseNum(client.saldo_favor || 0);
  const deudaNeta = Math.max(0, deudaBruta - saldoFavor);

  const aplicado = Math.min(totalPago, deudaNeta);
  
  // Aplicar el pago PRIMERO al saldo a favor si existe, luego a la deuda
  let saldoRestante = saldoFavor;
  let deudaRestante = deudaBruta;
  
  if (saldoFavor > 0) {
    const saldoUsado = Math.min(aplicado, saldoFavor);
    saldoRestante = saldoFavor - saldoUsado;
    deudaRestante = deudaBruta - saldoUsado;
  }
  
  // Aplicar el resto del pago directamente a la deuda
  const pagoRestante = aplicado - (saldoFavor - saldoRestante);
  deudaRestante = Math.max(0, deudaRestante - pagoRestante);

  // Actualizar el cliente
  client.debt = deudaRestante;
  client.saldo_favor = saldoRestante;

  // ⭐⭐ NUEVO: Usar la tabla debt_payments en lugar de invoices
  const number = st.meta.invoiceCounter++; // Seguimos usando el mismo contador
  const id = "dp_" + number;

  const debtPayment = {
    id,
    number,
    date_iso: todayISO(),
    client_id: client.id,
    client_name: client.name,
    vendor_id: "admin",
    vendor_name: "Admin",
    cash_amount: parseNum(cash),
    transfer_amount: parseNum(transf),
    total_amount: aplicado,
    alias: alias.trim(),
    saldo_aplicado: (saldoFavor - saldoRestante),
    debt_before: deudaBruta,
    debt_after: deudaRestante,
  };

  console.log("💾 Guardando pago de deudor en debt_payments:", debtPayment);

  // ⭐⭐ NUEVO: Guardar en debt_payments en lugar de invoices
  st.debt_payments = st.debt_payments || [];
  st.debt_payments.push(debtPayment);
  st.meta.lastSavedInvoiceId = id;
  setState(st);

  // ⭐⭐ NUEVO: Persistencia en la tabla debt_payments
  if (hasSupabase) {
    try {
      console.log("📦 Intentando guardar en debt_payments...");
      
      // 1. Guardar en debt_payments (SOLO con columnas existentes)
      const { data, error } = await supabase
        .from("debt_payments")
        .insert({
          id: debtPayment.id,
          number: debtPayment.number,
          date_iso: debtPayment.date_iso,
          client_id: debtPayment.client_id,
          client_name: debtPayment.client_name,
          vendor_id: debtPayment.vendor_id,
          vendor_name: debtPayment.vendor_name,
          cash_amount: debtPayment.cash_amount,
          transfer_amount: debtPayment.transfer_amount,
          total_amount: debtPayment.total_amount,
          alias: debtPayment.alias,
          saldo_aplicado: debtPayment.saldo_aplicado,
          debt_before: debtPayment.debt_before,
          debt_after: debtPayment.debt_after,
        })
        .select();

      if (error) {
        console.error("❌ ERROR guardando en debt_payments:", error);
        alert("Error al guardar el pago: " + error.message);
        return;
      }
      console.log("✅ Pago guardado en debt_payments:", data);

      // 2. Actualizar cliente en Supabase
      const { error: clientError } = await supabase.from("clients")
        .update({ 
          debt: client.debt, 
          saldo_favor: client.saldo_favor 
        })
        .eq("id", client.id);

      if (clientError) {
        console.error("❌ Error actualizando cliente:", clientError);
      }

      // 3. Actualizar contadores
      await saveCountersSupabase(st.meta);

      console.log("✅ Todo guardado correctamente en debt_payments");

    } catch (error) {
      console.error("💥 Error crítico:", error);
      alert("Error completo: " + error.message);
    }
  }

  setCash("");
  setTransf("");
  setAlias("");
  setActive(null);

  // Recargar datos para sincronizar
  if (hasSupabase) {
    setTimeout(async () => {
      const refreshedState = await loadFromSupabase(seedState());
      setState(refreshedState);
      console.log("🔄 Datos recargados desde Supabase");
    }, 1500);
  }

  // ⭐⭐ NUEVO: Imprimir comprobante de pago de deuda - CORREGIDO
  window.dispatchEvent(new CustomEvent("print-invoice", { 
    detail: { 
      ...debtPayment, 
      type: "Pago de Deuda",
      items: [{ 
        productId: "pago_deuda", 
        name: "Pago de deuda", 
        section: "Finanzas", 
        qty: 1, 
        unitPrice: aplicado, 
        cost: 0 
      }],
      total: aplicado,
      payments: { 
        cash: parseNum(cash), 
        transfer: parseNum(transf), 
        change: 0,
        alias: alias.trim(),
        saldo_aplicado: (saldoFavor - saldoRestante)
      },
      status: "Pagado",
      client_debt_total: deudaRestante
    } 
  } as any));
  await nextPaint();
  window.print();
}

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* MODAL DE DETALLE DE DEUDAS */}
      {verDetalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  📋 Detalle de Deudas - {clienteDetalle?.name}
                </h2>
                <button 
                  onClick={() => setVerDetalle(null)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* RESUMEN */}
              <Card title="Resumen de Deuda" className="mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-amber-400">
                      {money(deudaTotalCliente)}
                    </div>
                    <div className="text-sm text-slate-400">Deuda Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">
                      {detalleDeudasCliente.length}
                    </div>
                    <div className="text-sm text-slate-400">Facturas Pendientes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {money(parseNum(clienteDetalle?.saldo_favor || 0))}
                    </div>
                    <div className="text-sm text-slate-400">Saldo a Favor</div>
                  </div>
                </div>
              </Card>

              {/* DETALLE POR FACTURA */}
              <Card title="Detalle por Factura">
                {detalleDeudasCliente.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    ✅ Cliente al día - No tiene deudas pendientes
                  </div>
                ) : (
                  <div className="space-y-4">
                    {detalleDeudasCliente.map((deuda, index) => (
                      <div key={deuda.factura_id} className="border border-slate-700 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold">
                              Factura #{pad(deuda.factura_numero)}
                            </div>
                            <div className="text-sm text-slate-400">
                              {new Date(deuda.fecha).toLocaleDateString("es-AR")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-amber-400">
                              {money(deuda.monto_debe)}
                            </div>
                            <div className="text-sm text-slate-400">
                              Total: {money(deuda.monto_total)} • Pagado: {money(deuda.monto_pagado)}
                            </div>
                          </div>
                        </div>

                        {/* ITEMS DE LA FACTURA */}
                        <div className="text-sm">
                          <div className="font-medium mb-2">Productos:</div>
                          <div className="space-y-1">
                            {deuda.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>{item.name} × {item.qty}</span>
                                <span>{money(parseNum(item.qty) * parseNum(item.unitPrice))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* TOTAL */}
                    <div className="border-t border-slate-700 pt-4 mt-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>DEUDA TOTAL:</span>
                        <span className="text-amber-400">{money(deudaTotalCliente)}</span>
                      </div>
                    </div>

                    {/* BOTÓN IMPRIMIR DETALLE */}
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => {
                        const data = {
                          type: "DetalleDeuda",
                          cliente: clienteDetalle,
                          detalleDeudas: detalleDeudasCliente,
                          deudaTotal: deudaTotalCliente,
                          saldoFavor: parseNum(clienteDetalle?.saldo_favor || 0)
                        };
                        window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
                        setTimeout(() => window.print(), 0);
                      }}>
                        🖨️ Imprimir Detalle
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      <Card title="Deudores">
        {clients.length === 0 && <div className="text-sm text-slate-400">Sin deudas netas.</div>}
        <div className="divide-y divide-slate-800">
          {clients.map((c: any) => {
            const deudaBruta = parseNum(c.debt);
            const saldoFavor = parseNum(c.saldo_favor || 0);
            const deudaNeta = Math.max(0, deudaBruta - saldoFavor);
            const detalleDeudas = calcularDetalleDeudas(state, c.id);
            const cantidadFacturas = detalleDeudas.length;
            
            return (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div className="text-sm flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Deuda neta: <span className="text-slate-300">{money(deudaNeta)}</span>
                    {saldoFavor > 0 && (
                      <span className="ml-2">
                        (Deuda: {money(deudaBruta)} - Saldo a favor: {money(saldoFavor)})
                      </span>
                    )}
                    <span className="ml-2">• {cantidadFacturas} factura(s) pendiente(s)</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button tone="slate" onClick={() => verDetalleDeudas(c.id)}>
                    📋 Ver Detalle
                  </Button>
                  <Button tone="slate" onClick={() => setActive(c.id)}>
                    Registrar pago
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {active && (
        <Card title="Registrar pago">
          <div className="grid md:grid-cols-4 gap-3">
            <NumberInput label="Efectivo" value={cash} onChange={setCash} />
            <NumberInput label="Transferencia" value={transf} onChange={setTransf} />
            <Input label="Alias/CVU" value={alias} onChange={setAlias} />
            <div className="pt-6">
              <Button onClick={registrarPago}>Guardar e imprimir recibo</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* Cola (vendedor/admin): aceptar / cancelar turnos de la hora actual) */
function ColaTab({ state, setState, session }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Rango de la HORA actual
  function hourRange(d = new Date()) {
    const s = new Date(d);
    s.setMinutes(0, 0, 0);
    const e = new Date(d);
    e.setMinutes(59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }

  async function refresh() {
    setLoading(true);
    const { startISO, endISO } = hourRange();

    if (hasSupabase) {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .gte("date_iso", startISO)
        .lte("date_iso", endISO)
        .order("date_iso", { ascending: true });

      if (!error) setTickets(data || []);
    } else {
      // sin supabase: uso la cola local
      const list = (state.queue || [])
        .filter((t: any) => t.date_iso >= startISO && t.date_iso <= endISO)
        .sort((a: any, b: any) => a.date_iso.localeCompare(b.date_iso));
      setTickets(list);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();

    // Realtime (si hay Supabase)
    if (hasSupabase) {
      const ch = supabase
        .channel("rt-tickets")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => refresh())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, []);

  async function accept(t: any, caja = "1") {
    const now = new Date().toISOString();
    const boxVal = Number(caja);

    if (hasSupabase) {
      // Persistir y traer el row actualizado
      const { data, error } = await supabase
        .from("tickets")
        .update({
          status: "Aceptado",
          box: boxVal,
          accepted_by: session?.name ?? "-",
          accepted_at: now,
        })
        .eq("id", t.id)
        .select("*")
        .single();

      if (error) {
        console.error("Supabase UPDATE tickets error:", error);
        alert("No pude marcar el ticket como ACEPTADO en la base.");
        await refresh();
        return;
      }

      // Sincronizar UI con la verdad del server
      setTickets((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = data;
      setState(st);
    } else {
      // Modo local (sin Supabase)
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) {
        st.queue[i] = {
          ...st.queue[i],
          status: "Aceptado",
          box: boxVal,
          accepted_by: session?.name ?? session?.id ?? "-",
          accepted_at: now,
        };
      }
      setState(st);
      setTickets((prev) =>
        prev.map((x) =>
          x.id === t.id ? { ...x, status: "Aceptado", box: boxVal, accepted_by: session?.name ?? "-", accepted_at: now } : x
        )
      );
    }

    // Aviso a la TV
    try {
      const bc = new BroadcastChannel("turnos-tv");
      bc.postMessage({ type: "announce", client_name: t.client_name, caja: boxVal });
    } catch {}
    alert(`${t.client_name} puede pasar a la CAJA ${boxVal}`);
  }

  async function cancel(t: any) {
    if (hasSupabase) {
      // Persistir y traer el row actualizado
      const { data, error } = await supabase.from("tickets").update({ status: "Cancelado" }).eq("id", t.id).select("*").single();

      if (error) {
        console.error("Supabase UPDATE tickets cancel:", error);
        alert("No pude CANCELAR el ticket en la base.");
        await refresh();
        return;
      }

      // Sincronizar UI con server
      setTickets((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = data;
      setState(st);
    } else {
      // Modo local
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = { ...st.queue[i], status: "Cancelado" };
      setState(st);
      setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "Cancelado" } : x)));
    }
  }

  const pendientes = tickets.filter((t) => t.status === "En cola");
  const aceptados = tickets.filter((t) => t.status === "Aceptado");

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card
        title="Turnos — Hora actual"
        actions={
          <Button tone="slate" onClick={refresh}>
            Actualizar
          </Button>
        }
      >
        {loading && <div className="text-sm text-slate-400">Cargando…</div>}

        {!loading && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold mb-2">En cola</div>
              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
                {pendientes.length === 0 && <div className="p-3 text-sm text-slate-400">Sin turnos en esta hora.</div>}
                {pendientes.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.client_name}</div>
                      <div className="text-xs text-slate-400">
                        #{t.id} · {new Date(t.date_iso).toLocaleTimeString("es-AR")} · {t.action}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <Button onClick={() => accept(t, "1")}>Aceptar (Caja 1)</Button>
                      <Button tone="red" onClick={() => cancel(t)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Aceptados</div>
              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
                {aceptados.length === 0 && <div className="p-3 text-sm text-slate-400">Nadie aceptado aún.</div>}
                {aceptados.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.client_name} — Caja {t.box ?? "1"}</div>
                      <div className="text-xs text-slate-400">
                        Aceptado por {t.accepted_by || "—"} · {t.accepted_at ? new Date(t.accepted_at).toLocaleTimeString("es-AR") : "—"}
                      </div>
                    </div>
                    <Chip tone="emerald">Aceptado</Chip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Vendedores */
function VendedoresTab({ state, setState }: any) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  async function add() {
    if (!name.trim() || !key.trim()) return;
    const vendor = { id: "v" + Math.random().toString(36).slice(2, 8), name: name.trim(), key: key.trim() };
    const st = clone(state);
    st.vendors.push(vendor);
    setState(st);
    setName("");
    setKey("");
    if (hasSupabase) await supabase.from("vendors").insert(vendor);
  }
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card title="Agregar vendedor">
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Nombre" value={name} onChange={setName} />
          <Input label="Clave" value={key} onChange={setKey} />
          <div className="pt-6">
            <Button onClick={add}>Agregar</Button>
          </div>
        </div>
      </Card>
      <Card title="Listado">
        <div className="divide-y divide-slate-800">
          {state.vendors.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between py-2">
              <div className="text-sm">
                <span className="font-semibold">{v.name}</span> <span className="text-slate-500">({v.id})</span>
              </div>
              <span className="inline-flex text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-2 py-0.5">Clave: {v.key}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>

  );
}

/* Reportes */
function ReportesTab({ state, setState, session }: any) {
  // ====== Filtros de fecha ======
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const thisMonthStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState<"dia" | "mes" | "anio">("dia");
  const [dia, setDia] = useState<string>(todayStr);
  const [mes, setMes] = useState<string>(thisMonthStr);
  const [anio, setAnio] = useState<string>(String(today.getFullYear()));
  const [gabiInitial, setGabiInitial] = useState("");
const [gabiSpent, setGabiSpent] = useState("");

  // --- helpers para vuelto por día ---
  const diaClave = dia; // YYYY-MM-DD del selector
  const cashFloatByDate = (state?.meta?.cashFloatByDate ?? {}) as Record<string, number>;
  const cashFloatTarget = periodo === "dia" ? parseNum(cashFloatByDate[diaClave] ?? 0) : 0;

  async function setCashFloatForDay(nuevo: number) {
    const st = clone(state);
    st.meta.cashFloatByDate = st.meta.cashFloatByDate || {};
    st.meta.cashFloatByDate[diaClave] = nuevo;
    setState(st);

    if (hasSupabase) {
      await supabase
        .from("cash_floats")
        .upsert(
          { day: diaClave, amount: nuevo, updated_by: "app" },
          { onConflict: "day" }
        );
    } else {
      await saveCountersSupabase?.(st.meta);
    }
  }

  // --- helpers para comisiones por día ---
  const commissionsByDate = (state?.meta?.commissionsByDate ?? {}) as Record<string, number>;
  const commissionTarget =
    periodo === "dia" ? parseNum(commissionsByDate[diaClave] ?? 0) : 0;

  async function setCommissionForDay(nuevo: number) {
    const st = clone(state);
    st.meta.commissionsByDate = st.meta.commissionsByDate || {};
    st.meta.commissionsByDate[diaClave] = nuevo;
    setState(st);

    if (hasSupabase) {
      await supabase
        .from("commissions")
        .upsert(
          { day: diaClave, amount: nuevo, updated_by: "app" },
          { onConflict: "day" }
        );
    } else {
      await saveCountersSupabase?.(st.meta);
    }
  }

  // Rango según período
  function rangoActual() {
    let start = new Date(0);
    let end = new Date();
    if (periodo === "dia") {
      const d = new Date(`${dia}T00:00:00`);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    } else if (periodo === "mes") {
      const [yStr, mStr] = mes.split("-");
      const y = parseInt(yStr || String(today.getFullYear()), 10);
      const m = (parseInt(mStr || String(today.getMonth() + 1), 10) - 1) as number;
      start = new Date(y, m, 1, 0, 0, 0, 0);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else {
      const y = parseInt(anio || String(today.getFullYear()), 10);
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    }
    return { start: start.getTime(), end: end.getTime() };
  }
  const { start, end } = rangoActual();

  // ===== NUEVO: estados para listados traídos por rango =====
  const [docsEnRango, setDocsEnRango] = useState<any[]>([]);
  const [devolucionesPeriodo, setDevolucionesPeriodo] = useState<any[]>([]);
  const [cargandoListados, setCargandoListados] = useState(false);

  // ===== NUEVO: mismos límites pero en ISO para consultar a Supabase =====
  function rangoActualISO() {
    const { start, end } = rangoActual();
    return { isoStart: new Date(start).toISOString(), isoEnd: new Date(end).toISOString() };
  }

  // ===== NUEVO: traer facturas y devoluciones por rango, con fallback local =====
  useEffect(() => {
    const { isoStart, isoEnd } = rangoActualISO();

    async function fetchListados() {
      setCargandoListados(true);

      if (hasSupabase) {
        // FACTURAS
        const { data: inv, error: e1 } = await supabase
          .from("invoices")
          .select("*")
          .gte("date_iso", isoStart)
          .lte("date_iso", isoEnd)
          .order("date_iso", { ascending: false });
        if (e1) { console.error("SELECT invoices (rango):", e1); alert("No pude leer facturas del período."); }

        // DEVOLUCIONES
        const { data: dev, error: e2 } = await supabase
          .from("devoluciones")
          .select("*")
          .gte("date_iso", isoStart)
          .lte("date_iso", isoEnd)
          .order("date_iso", { ascending: false });
        if (e2) { console.error("SELECT devoluciones (rango):", e2); alert("No pude leer devoluciones del período."); }

        // GASTOS
        const { data: gastosData, error: e3 } = await supabase
          .from("gastos")
          .select("*")
          .gte("date_iso", isoStart)
          .lte("date_iso", isoEnd)
          .order("date_iso", { ascending: false });
        if (e3) { console.error("SELECT gastos (rango):", e3); alert("No pude leer gastos del período."); }

        setDocsEnRango(inv || []);
        setDevolucionesPeriodo(dev || []);
        
        // Actualizar el estado global con los gastos del período
        if (gastosData) {
          const st = clone(state);
          st.gastos = gastosData;
          setState(st);
        }
      } else {
        // Fallback local si no hay Supabase
        const docs = (state.invoices || []).filter((f:any) => {
          const t = new Date(f.date_iso).getTime();
          return t >= start && t <= end;
        });
        const devs = (state.devoluciones || []).filter((d:any) => {
          const t = new Date(d.date_iso).getTime();
          return t >= start && t <= end;
        });
        setDocsEnRango(docs);
        setDevolucionesPeriodo(devs);
      }

      setCargandoListados(false);
    }

    fetchListados();
  }, [periodo, dia, mes, anio, state.meta?.lastSavedInvoiceId, state.gastos?.length]);

  // ✅ Ahora sí: comisiones del período usando start/end
const commissionsPeriodo = Object.entries(commissionsByDate).reduce((sum, [k, v]) => {
  const t = new Date(`${k}T00:00:00`).getTime();
  return t >= start && t <= end ? sum + parseNum(v) : sum;
}, 0);

// Ventas (solo Facturas)
const invoices = docsEnRango.filter((f: any) => f.type === "Factura");
const totalVentas = invoices.reduce((s: number, f: any) => s + parseNum(f.total), 0);

// 👇👇👇 PAGOS DE DEUDORES - AHORA desde debt_payments
const pagosDeudores = (state.debt_payments || []).filter((p: any) => {
  const pagoDate = new Date(p.date_iso).getTime();
  return pagoDate >= start && pagoDate <= end;
});

// 👇👇👇 CÁLCULOS DE PAGOS PARA INCLUIR RECIBOS - ACTUALIZADO
const totalVuelto = docsEnRango.reduce((s: number, f: any) => s + parseNum(f?.payments?.change || 0), 0);
const totalEfectivo = docsEnRango.reduce((s: number, f: any) => s + parseNum(f?.payments?.cash || 0), 0);
const totalEfectivoNeto = totalEfectivo - totalVuelto;
const totalTransf = docsEnRango.reduce((s: number, f: any) => s + parseNum(f?.payments?.transfer || 0), 0);

// 👇👇👇 CÁLCULO ESPECÍFICO PARA PAGOS DE DEUDORES - ACTUALIZADO
const totalPagosDeudores = pagosDeudores.reduce((s: number, p: any) => {
  const efectivo = parseNum(p?.cash_amount || p?.payments?.cash || 0);
  const transferencia = parseNum(p?.transfer_amount || p?.payments?.transfer || 0);
  return s + efectivo + transferencia;
}, 0);

const cantidadPagos = pagosDeudores.length;

// 👇👇👇 EFECTIVO DE PAGOS DE DEUDORES (PARA FLUJO DE CAJA) - ACTUALIZADO
const efectivoPagosDeudores = pagosDeudores.reduce((s: number, p: any) => 
  s + parseNum(p?.cash_amount || p?.payments?.cash || 0), 0);
  // 👇👇👇 TRANSFERENCIAS DE PAGOS DE DEUDORES - NUEVO
const transferenciasPagosDeudores = pagosDeudores.reduce((s: number, p: any) => 
  s + parseNum(p?.transfer_amount || p?.payments?.transfer || 0), 0);


// Vuelto restante para el día (solo aplica si periodo === "dia")
const vueltoRestante = periodo === "dia" ? Math.max(0, cashFloatTarget - totalVuelto) : 0;

// Ganancia estimada
const ganancia = invoices.reduce((s: number, f: any) => s + (parseNum(f.total) - parseNum(f.cost)), 0);

// GASTOS del período
const gastosPeriodo = (state.gastos || []).filter((g: any) => {
  if (!g || !g.date_iso) return false;
  const t = new Date(g.date_iso).getTime();
  return t >= start && t <= end;
});

// Gastos de Gabi del día
const gastosGabi = gastosPeriodo.filter((g: any) => g.tipo === "Gabi");
const totalGastosGabi = gastosGabi.reduce((s: number, g: any) => s + parseNum(g.efectivo) + parseNum(g.transferencia), 0);

// Fondos de Gabi
const gabiFundsByDate = (state?.meta?.gabiFundsByDate ?? {}) as Record<string, number>;
const gabiInitialTarget = periodo === "dia" ? parseNum(gabiFundsByDate[diaClave] ?? 0) : 0;
const fondosGabiRestantes = Math.max(0, gabiInitialTarget - totalGastosGabi);

const totalGastos = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.efectivo) + parseNum(g.transferencia), 0);
const totalGastosEfectivo = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.efectivo), 0);
const totalGastosTransferencia = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.transferencia), 0);

// Transferencias de GASTOS agrupadas por alias
const transferenciasPorAlias = (() => {
  const m: Record<string, number> = {};
  gastosPeriodo.forEach((g: any) => {
    const tr = parseNum(g.transferencia);
    if (tr > 0) {
      const a = String(g.alias ?? "Sin alias");
      m[a] = (m[a] ?? 0) + tr;
    }
  });
  return Object.entries(m).map(([alias, total]) => ({ alias, total }));
})();

const devolucionesMontoEfectivo = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.efectivo), 0);
const devolucionesMontoTransfer = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.transferencia), 0);
const devolucionesMontoTotal = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.total), 0);

// 👇👇👇 FLUJO DE CAJA CORREGIDO - INCLUYE PAGOS DE DEUDORES
const flujoCajaEfectivoFinal =
  totalEfectivoNeto +                    // Efectivo neto de VENTAS (efectivo - vuelto)
  efectivoPagosDeudores -                // Efectivo de PAGOS DE DEUDORES (NUEVO)
  totalGastosEfectivo -                  // Gastos en efectivo
  devolucionesMontoEfectivo -            // Devoluciones en efectivo
  commissionsPeriodo +                   // Comisiones pagadas (se restan)
  vueltoRestante +                       // Vuelto que queda en caja
  fondosGabiRestantes;                   // Fondos restantes de Gabi que vuelven a caja

// 👇👇👇 TRANSFERENCIAS TOTALES INCLUYENDO PAGOS DE DEUDORES - NUEVO
const transferenciasTotales = totalTransf + transferenciasPagosDeudores;
// Agrupados
const porVendedor = Object.values(
  invoices.reduce((acc: any, f: any) => {
    const k = f.vendor_name || "Sin vendedor";
    acc[k] = acc[k] || { vendedor: k, total: 0 };
    acc[k].total += parseNum(f.total);
    return acc;
  }, {})
).sort((a: any, b: any) => b.total - a.total);

const porSeccion = (() => {
  const m: Record<string, number> = {};
  invoices.forEach((f: any) =>
    (f.items || []).forEach((it: any) => {
      m[it.section] = (m[it.section] || 0) + parseNum(it.qty) * parseNum(it.unitPrice);
    })
  );
  return Object.entries(m).map(([section, total]) => ({ section, total })).sort((a, b) => b.total - a.total);
})();

// Transferencias por alias (ventas + pagos de deudores)
const porAlias = (() => {
  const m: Record<string, number> = {};
  
  // Transferencias de ventas
  docsEnRango.forEach((f: any) => {
    const tr = parseNum(f?.payments?.transfer);
    if (tr > 0) {
      const alias = String(f?.payments?.alias || "Sin alias").trim() || "Sin alias";
      m[alias] = (m[alias] || 0) + tr;
    }
  });
  
  // 👇👇👇 AGREGAR TRANSFERENCIAS DE PAGOS DE DEUDORES
  pagosDeudores.forEach((p: any) => {
    const tr = parseNum(p?.transfer_amount || p?.payments?.transfer || 0);
    if (tr > 0) {
      const alias = String(p?.alias || "Sin alias").trim() || "Sin alias";
      m[alias] = (m[alias] || 0) + tr;
    }
  });
  
  return Object.entries(m).map(([alias, total]) => ({ alias, total })).sort((a, b) => b.total - a.total);
})();

 async function imprimirReporte() {
  // 👇👇👇 CALCULAR DEUDA DEL DÍA
  const deudaDelDia = invoices
    .filter((f: any) => f.status === "No Pagada")
    .reduce((s: number, f: any) => s + parseNum(f.total), 0);

  // 👇👇👇 PAGOS DE DEUDORES DEL DÍA (ya lo tienes)
  const pagosDeudoresHoy = pagosDeudores.filter((p: any) => {
    const pagoDate = new Date(p.date_iso).toDateString();
    const hoy = new Date().toDateString();
    return pagoDate === hoy;
  });

  // 👇👇👇 NUEVO: Detalle de aplicación de pagos
  const detalleAplicacionPagos = obtenerDetallePagosAplicados(pagosDeudoresHoy, state);

  // 👇👇👇 DEUDORES ACTIVOS (con deuda neta > 0)
  const deudoresActivos = state.clients
    .filter((c: any) => {
      const deudaBruta = parseNum(c.debt);
      const saldoFavor = parseNum(c.saldo_favor || 0);
      return (deudaBruta - saldoFavor) > 0;
    })
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      deuda: parseNum(c.debt),
      saldoFavor: parseNum(c.saldo_favor || 0),
      deudaNeta: Math.max(0, parseNum(c.debt) - parseNum(c.saldo_favor || 0))
    }))
    .sort((a: any, b: any) => b.deudaNeta - a.deudaNeta);

  const data = {
    type: "Reporte",
    periodo,
    rango: { start, end },
    resumen: {
      ventas: totalVentas,
      deudaDelDia: deudaDelDia, // 👈 NUEVO
      efectivoCobrado: totalEfectivo,
      vueltoEntregado: totalVuelto,
      efectivoNeto: totalEfectivoNeto,
      transferencias: totalTransf,

      gastosTotal: totalGastos,
      gastosEfectivo: totalGastosEfectivo,
      gastosTransfer: totalGastosTransferencia,

      devolucionesCantidad: devolucionesPeriodo.length,
      devolucionesEfectivo: devolucionesMontoEfectivo,
      devolucionesTransfer: devolucionesMontoTransfer,
      devolucionesTotal: devolucionesMontoTotal,

      cashFloatTarget,
      vueltoRestante,

      flujoCajaEfectivo: flujoCajaEfectivoFinal,

      comisionesPeriodo: commissionsPeriodo,
    },

    ventas: invoices,
    gastos: gastosPeriodo,
    devoluciones: devolucionesPeriodo,
    pagosDeudores: pagosDeudoresHoy, // 👈 NUEVO
    deudoresActivos: deudoresActivos, // 👈 NUEVO
      detalleAplicacionPagos: detalleAplicacionPagos, // 👈👈👈 NUEVA LÍNEA - AGREGAR ESTO
    porVendedor,
    porSeccion,
    transferenciasPorAlias: porAlias,
    transferGastosPorAlias: transferenciasPorAlias,
  };

  window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
  await nextPaint();
  window.print();
}
  // Función para guardar fondos iniciales de Gabi
async function setGabiFundsForDay(nuevo: number) {
  const st = clone(state);
  st.meta.gabiFundsByDate = st.meta.gabiFundsByDate || {};
  st.meta.gabiFundsByDate[diaClave] = nuevo;
  setState(st);

  if (hasSupabase) {
    await supabase
      .from("gabi_funds")
      .upsert(
        { 
          id: `gabi_${diaClave}`,
          day: diaClave, 
          initial_amount: nuevo,
          updated_at: todayISO()
        },
        { onConflict: "day" }
      );
  }
}
  // Función para actualizar gastos de Gabi
async function updateGabiSpentForDay(gastado: number) {
  if (!hasSupabase) return;

  const { data: existing } = await supabase
    .from("gabi_funds")
    .select("*")
    .eq("day", diaClave)
    .single();

  if (existing) {
    const remaining = parseNum(existing.initial_amount) - gastado;
    await supabase
      .from("gabi_funds")
      .update({
        spent_amount: gastado,
        remaining_amount: remaining,
        updated_at: todayISO()
      })
      .eq("day", diaClave);
  }
}

  // ===== AQUÍ ESTÁ EL RETURN PRINCIPAL DEL COMPONENTE =====
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="Filtros">
        <div className="grid md:grid-cols-4 gap-3">
          <Select
            label="Período"
            value={periodo}
            onChange={setPeriodo}
            options={[
              { value: "dia", label: "Día" },
              { value: "mes", label: "Mes" },
              { value: "anio", label: "Año" },
            ]}
          />
          {periodo === "dia" && <Input label="Día" type="date" value={dia} onChange={setDia} />}
          {periodo === "mes" && <Input label="Mes" type="month" value={mes} onChange={setMes} />}
          {periodo === "anio" && <Input label="Año" type="number" value={anio} onChange={setAnio} />}
        </div>
      </Card>
      {/* 👇👇👇 AGREGAR ESTA CARD NUEVA - JUSTO DESPUÉS DE LOS FILTROS */}
<Card title="💰 Deuda Actual del Día">
  <div className="text-2xl font-bold text-amber-400">
    {money(
      invoices
        .filter((f: any) => f.status === "No Pagada")
        .reduce((sum: number, f: any) => sum + parseNum(f.total), 0)
    )}
  </div>
  <div className="text-xs text-slate-400 mt-1">
    Total adeudado en facturas del día
  </div>
</Card>

      <Card title="Acciones" actions={
        <div className="flex gap-2">
          <Button tone="slate" onClick={async () => {
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
            alert("Datos actualizados manualmente");
          }}>
            Actualizar datos
          </Button>
          <Button onClick={imprimirReporte}>Imprimir reporte</Button>
        </div>
      }>
        <div className="text-sm text-slate-400">Genera un reporte imprimible con el rango seleccionado.</div>
      </Card>

      {/* ... el resto del JSX del componente permanece igual ... */}
      {periodo === "dia" && (
        <Card
          title="Vuelto en caja (por día)"
          actions={
            <Button onClick={async () => {
              await setCashFloatForDay(cashFloatTarget);
              alert("Vuelto del día guardado.");
            }}>
              Guardar
            </Button>
          }
        >
          <div className="grid md:grid-cols-3 gap-3">
            <NumberInput
              label={`Vuelto configurado para ${diaClave}`}
              value={String(cashFloatTarget)}
              onChange={(v: any) => {
                const st = clone(state);
                st.meta.cashFloatByDate = st.meta.cashFloatByDate || {};
                st.meta.cashFloatByDate[diaClave] = parseNum(v);
                setState(st);
              }}
              placeholder="Ej: 10000"
            />
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Vuelto entregado (en el período)</div>
                <div className="text-xl font-bold">{money(totalVuelto)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Vuelto restante</div>
                <div className="text-xl font-bold">{money(vueltoRestante)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {periodo === "dia" && (
        <Card
          title="Comisiones (por día)"
          actions={
            <Button onClick={async () => {
              await setCommissionForDay(commissionTarget);
              alert("Comisiones del día guardadas.");
            }}>
              Guardar
            </Button>
          }
        >
          <div className="grid md:grid-cols-3 gap-3">
            <NumberInput
              label={`Comisiones configuradas para ${diaClave}`}
              value={String(commissionTarget)}
              onChange={(v: any) => {
                const st = clone(state);
                st.meta.commissionsByDate = st.meta.commissionsByDate || {};
                st.meta.commissionsByDate[diaClave] = parseNum(v);
                setState(st);
              }}
              placeholder="Ej: 5000"
            />
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Comisiones en el período</div>
                <div className="text-xl font-bold">{money(commissionsPeriodo)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Impacto en flujo de caja</div>
                <div className="text-xl font-bold">– {money(commissionsPeriodo)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}
      {/* 👇👇👇 SECCIÓN GABI - AGREGAR JUSTO AQUÍ 👇👇👇 */}
     





{periodo === "dia" && (
  <Card
    title="Fondos de Gabi (por día)"
    actions={
      <Button onClick={async () => {
        await setGabiFundsForDay(parseNum(gabiInitial));
        alert("Fondos de Gabi guardados.");
      }}>
        Guardar
      </Button>
    }
  >
    <div className="grid md:grid-cols-3 gap-3">
      <NumberInput
        label={`Dinero dado a Gabi para ${diaClave}`}
        value={gabiInitial}
        onChange={setGabiInitial}
        placeholder="Ej: 50000"
      />
      <div className="md:col-span-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-400 mb-1">Gastos de Gabi registrados</div>
          <div className="text-xl font-bold">{money(totalGastosGabi)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">Fondos restantes de Gabi</div>
          <div className="text-xl font-bold">{money(fondosGabiRestantes)}</div>
        </div>
      </div>
    </div>
  </Card>
)}

<div className="grid md:grid-cols-4 gap-3">
  <Card title="Ventas totales"><div className="text-2xl font-bold">{money(totalVentas)}</div></Card>
    
  {/* 👇👇👇 NUEVA CARD DE DEUDA */}
  <Card title="💰 Deuda del Día">
    <div className="text-2xl font-bold text-amber-400">
      {money(
        invoices
          .filter((f: any) => f.status === "No Pagada")
          .reduce((sum: number, f: any) => sum + parseNum(f.total), 0)
      )}
    </div>
    <div className="text-xs text-slate-400 mt-1">
      Facturas no pagadas del día
    </div>
  </Card>
  <Card title="Efectivo (cobrado)">
    <div className="text-2xl font-bold">{money(totalEfectivo + efectivoPagosDeudores)}</div>
    <div className="text-xs text-slate-400 mt-1">
      Ventas: {money(totalEfectivo)} + Deudores: {money(efectivoPagosDeudores)}
    </div>
  </Card>
  <Card title="Vuelto entregado">
    <div className="text-2xl font-bold">{money(totalVuelto)}</div>
  </Card>
  <Card title="Transferencias">
    <div className="text-2xl font-bold">{money(transferenciasTotales)}</div>
    <div className="text-xs text-slate-400 mt-1">
      Ventas: {money(totalTransf)} + Deudores: {money(transferenciasPagosDeudores)}
    </div>
  </Card>
  <Card title="Pagos de Deudores">
    <div className="text-2xl font-bold">{money(totalPagosDeudores)}</div>
    <div className="text-xs text-slate-400 mt-1">{cantidadPagos} pago(s)</div>
  </Card>
</div>

{/* === TOP CLIENTES === */}
{(() => {
  const ventasPorCliente = invoices.reduce((acc: any, f: any) => {
    const clienteId = f.client_id;
    const clienteNombre = f.client_name;
    const totalFactura = parseNum(f.total);
    
    if (!acc[clienteId]) {
      acc[clienteId] = {
        nombre: clienteNombre,
        total: 0,
        cantidadFacturas: 0
      };
    }
    
    acc[clienteId].total += totalFactura;
    acc[clienteId].cantidadFacturas += 1;
    
    return acc;
  }, {});

  const clientesTop = Object.entries(ventasPorCliente)
    .map(([id, data]: [string, any]) => ({
      id,
      nombre: data.nombre,
      total: data.total,
      cantidadFacturas: data.cantidadFacturas
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3); // Top 3 clientes

  return (
    <div className="grid md:grid-cols-3 gap-3">
      {/* Top Clientes */}
      <Card title="🏆 Top Clientes">
        {clientesTop.length > 0 ? (
          <div className="space-y-2">
            {clientesTop.map((cliente, index) => (
              <div key={cliente.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-600 rounded-full w-5 h-5 flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="text-sm truncate max-w-[120px]" title={cliente.nombre}>
                    {cliente.nombre}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {money(cliente.total)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            Sin ventas en el período
          </div>
        )}
      </Card>

      {/* Las otras dos cards se mantienen igual */}
      <Card title="Ganancia estimada">
        <div className="text-2xl font-bold">{money(ganancia)}</div>
        <div className="text-xs text-slate-400 mt-1">Total - Costos</div>
      </Card>

      <Card title="Flujo final de caja (efectivo)">
        <div className="text-2xl font-bold">{money(flujoCajaEfectivoFinal)}</div>
        <div className="text-xs text-slate-400 mt-1">
          Efectivo neto - Gastos (ef.) - Devoluciones (ef.) - Comisiones + Vuelto restante + Fondos Gabi restantes + Pago Deudores (ef.)
        </div>
      </Card>
    </div>
  );
})()}

<Card title="Gastos y Devoluciones">
  <div className="space-y-3 text-sm">
    <div>Total de gastos: <b>{money(totalGastos)}</b></div>
    <div>- En efectivo: {money(totalGastosEfectivo)}</div>
    <div>- En transferencia: {money(totalGastosTransferencia)}</div>
    {/* 👇👇👇 SECCIÓN GABI EN GASTOS - AGREGAR JUSTO AQUÍ 👇👇👇 */}
    {periodo === "dia" && (
      <div className="mt-2 p-2 bg-slate-800/30 rounded">
        <div className="font-semibold">Fondos de Gabi</div>
        <div>- Dinero dado: {money(gabiInitialTarget)}</div>
        <div>- Gastado: {money(totalGastosGabi)}</div>
        <div>- Restante: <b>{money(fondosGabiRestantes)}</b></div>
      </div>
    )}
    {/* 👆👆👆 HASTA AQUÍ 👆👆👆 */}

    <h4 className="mt-2 font-semibold">Transferencias por alias</h4>
    {transferenciasPorAlias.length === 0 ? (
      <div className="text-slate-400">Sin transferencias registradas.</div>
    ) : (
      <ul className="list-disc pl-5">
        {transferenciasPorAlias.map((t) => (
          <li key={t.alias}>{t.alias}: {money(t.total)}</li>
        ))}
      </ul>
    )}

          <h4 className="mt-4 font-semibold">Devoluciones registradas</h4>
          <div>Cantidad: <b>{devolucionesPeriodo.length}</b></div>
          <div>- En efectivo: {money(devolucionesMontoEfectivo)}</div>
          <div>- En transferencia: {money(devolucionesMontoTransfer)}</div>
          <div>- Monto total: <b>{money(devolucionesMontoTotal)}</b></div>
        </div>
        <div className="mt-2">Vuelto entregado en el período: <b>{money(totalVuelto)}</b></div>
      </Card>

      <Card title="Por vendedor">
        <div className="grid md:grid-cols-3 gap-3">
          {porVendedor.map((v: any) => (
            <div key={v.vendedor} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
              <div className="text-sm font-medium">{v.vendedor}</div>
              <div className="text-sm">{money(v.total as number)}</div>
            </div>
          ))}
          {porVendedor.length === 0 && <div className="text-sm text-slate-400">Sin datos en el período.</div>}
        </div>
      </Card>

      <Card title="Por sección">
        <div className="grid md:grid-cols-3 gap-3">
          {porSeccion.map((s: any) => (
            <div key={s.section} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
              <div className="text-sm font-medium">{s.section}</div>
              <div className="text-sm">{money(s.total as number)}</div>
            </div>
          ))}
          {porSeccion.length === 0 && <div className="text-sm text-slate-400">Sin datos en el período.</div>}
        </div>
      </Card>

      <Card title="Transferencias por alias (ventas)">
        {porAlias.length === 0 ? (
          <div className="text-sm text-slate-400">Sin transferencias en el período.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {porAlias.map((a: any) => (
              <div key={a.alias} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
                <div className="text-sm font-medium truncate max-w-[60%]">{a.alias}</div>
                <div className="text-sm">{money(a.total as number)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Listado de facturas">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Vendedor</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Efectivo</th>
                <th className="py-2 pr-3">Transf.</th>
                <th className="py-2 pr-3">Vuelto</th>
                <th className="py-2 pr-3">Alias/CVU</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {docsEnRango
                .slice()
                .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())
                .map((f: any) => {
                  const cash = parseNum(f?.payments?.cash);
                  const tr = parseNum(f?.payments?.transfer);
                  const ch = parseNum(f?.payments?.change);
                  const alias = (f?.payments?.alias || "").trim() || "—";

                  // Función para ver PDF usando la misma lógica de presupuestos
                  const viewInvoicePDF = (invoice: any) => {
                    window.dispatchEvent(new CustomEvent("print-invoice", { detail: { ...invoice, type: "Factura" } } as any));
                    setTimeout(() => window.print(), 0);
                  };

                  return (
                    <tr key={f.id}>
                      <td className="py-2 pr-3">{pad(f.number || 0)}</td>
                      <td className="py-2 pr-3">{new Date(f.date_iso).toLocaleString("es-AR")}</td>
                      <td className="py-2 pr-3">{f.client_name}</td>
                      <td className="py-2 pr-3">{f.vendor_name}</td>
                      <td className="py-2 pr-3">{money(parseNum(f.total))}</td>
                      <td className="py-2 pr-3">{money(cash)}</td>
                      <td className="py-2 pr-3">{money(tr)}</td>
                      <td className="py-2 pr-3">{money(ch)}</td>
                      <td className="py-2 pr-3 truncate max-w-[180px]">{alias}</td>
                      <td className="py-2 pr-3">{f.type || "—"}</td>
                      <td className="py-2 pr-3">{f.status || "—"}</td>
                      <td className="py-2 pr-3 space-x-2">
                        {/* Botón ver PDF */}
                        <button
                          onClick={() => viewInvoicePDF(f)}
                          className="text-blue-500 hover:text-blue-700"
                          title="Ver PDF"
                        >
                          📄
                        </button>

{/* Botón eliminar (solo admin) */}
{session?.role === "admin" && (
  <button
    onClick={async () => {
      if (!confirm(`¿Seguro que deseas eliminar la factura Nº ${pad(f.number)}? Esta acción REVERTIRÁ la deuda del cliente y el stock.`)) return;
      
      // 1. Encontrar el cliente afectado
      const cliente = state.clients.find((c: any) => c.id === f.client_id);
      if (!cliente) {
        alert("Error: Cliente no encontrado.");
        return;
      }

      const st = clone(state);
      
      // 2. Cálculo PRECISO de la deuda a revertir
      const totalFactura = parseNum(f.total);
      const pagosEfectivo = parseNum(f?.payments?.cash || 0);
      const pagosTransferencia = parseNum(f?.payments?.transfer || 0);
      const saldoAplicado = parseNum(f?.payments?.saldo_aplicado || 0);
      const totalPagos = pagosEfectivo + pagosTransferencia;
      
      // La deuda que generó esta factura es el total menos lo que ya pagó y el saldo aplicado
      const deudaGeneradaPorFactura = Math.max(0, totalFactura - totalPagos - saldoAplicado);
      
      // Nueva deuda = deuda actual - deuda que generó esta factura
      const deudaActual = parseNum(cliente.debt);
      const nuevaDeuda = Math.max(0, deudaActual - deudaGeneradaPorFactura);
      
      // 3. Restaurar saldo a favor si se usó
      const saldoActual = parseNum(cliente.saldo_favor);
      const nuevoSaldo = saldoActual + saldoAplicado;
      
      // 4. Actualizar cliente
      cliente.debt = nuevaDeuda;
      cliente.saldo_favor = nuevoSaldo;
      
      // 5. Restaurar stock de productos
      f.items.forEach((item: any) => {
        const product = st.products.find((p: any) => p.id === item.productId);
        if (product) {
          product.stock = parseNum(product.stock) + parseNum(item.qty);
        }
      });

      // 6. Eliminar factura del estado local
      st.invoices = st.invoices.filter((x: any) => x.id !== f.id);
      setState(st);
      
      // 7. Persistir en Supabase
      if (hasSupabase) {
        try {
          // Eliminar factura
          await supabase.from("invoices").delete().eq("id", f.id);
          
          // Actualizar cliente
          await supabase.from("clients")
            .update({ 
              debt: nuevaDeuda,
              saldo_favor: nuevoSaldo
            })
            .eq("id", f.client_id);
          
          // Actualizar stock de productos
          for (const item of f.items) {
            const product = st.products.find((p: any) => p.id === item.productId);
            if (product) {
              await supabase.from("products")
                .update({ stock: product.stock })
                .eq("id", item.productId);
            }
          }
          
          alert(`✅ Factura Nº ${pad(f.number)} eliminada.\nDeuda: ${money(deudaActual)} → ${money(nuevaDeuda)}\nStock restaurado.`);
          
        } catch (error) {
          console.error("Error al eliminar factura:", error);
          alert("Error al eliminar la factura. Los datos pueden estar inconsistentes.");
          
          // Recargar para evitar inconsistencias
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }
      } else {
        alert(`✅ Factura Nº ${pad(f.number)} eliminada.\nDeuda: ${money(deudaActual)} → ${money(nuevaDeuda)}\nStock restaurado.`);
      }
    }}
    className="text-red-500 hover:text-red-700"
    title="Eliminar"
  >
    🗑️
  </button>
)}
                      </td>
                    </tr>
                  );
                })}
              {docsEnRango.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-400" colSpan={12}>
                    Sin documentos en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Listado de devoluciones">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Método</th>
                <th className="py-2 pr-3">Efectivo</th>
                <th className="py-2 pr-3">Transf.</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {devolucionesPeriodo
                .slice()
                .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())
                .map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3">{new Date(d.date_iso).toLocaleString("es-AR")}</td>
                    <td className="py-2 pr-3">{d.client_name}</td>
                    <td className="py-2 pr-3 capitalize">{d.metodo}</td>
                    <td className="py-2 pr-3">{money(parseNum(d.efectivo))}</td>
                    <td className="py-2 pr-3">{money(parseNum(d.transferencia))}</td>
                    <td className="py-2 pr-3">{money(parseNum(d.total))}</td>
                    <td className="py-2 pr-3">
                      {(d.items || []).map((it: any, i: number) => (
                        <div key={i} className="text-xs">
                          {it.name} — dev.: {parseNum(it.qtyDevuelta)} × {money(parseNum(it.unitPrice))}
                        </div>
                      ))}
                      {d.metodo === "intercambio_otro" && (
                        <div className="text-xs text-slate-400 mt-1">
                          Dif. abonada: ef. {money(parseNum(d.extra_pago_efectivo || 0))} · tr. {money(parseNum(d.extra_pago_transferencia || 0))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              {devolucionesPeriodo.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-400" colSpan={7}>
                    Sin devoluciones en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
 <Card title="Listado de Pagos de Deudores">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="text-left text-slate-400">
        <tr>
          <th className="py-2 pr-3">Fecha y Hora</th>
          <th className="py-2 pr-3">Cliente</th>
          <th className="py-2 pr-3">Monto Pagado</th>
          <th className="py-2 pr-3">Deuda Antes</th>
          <th className="py-2 pr-3">Deuda Después</th>
          <th className="py-2 pr-3">Método</th>
          <th className="py-2 pr-3">Acciones</th> {/* 👈 NUEVA COLUMNA */}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {pagosDeudores
          .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())
          .map((pago: any) => {
            const efectivo = parseNum(pago?.cash_amount || pago?.payments?.cash || 0);
            const transferencia = parseNum(pago?.transfer_amount || pago?.payments?.transfer || 0);
            const montoTotal = efectivo + transferencia;
            const metodo = efectivo > 0 && transferencia > 0 
              ? "Mixto" 
              : efectivo > 0 
                ? "Efectivo" 
                : "Transferencia";

            return (
              <tr key={pago.id}>
                <td className="py-2 pr-3">
                  {new Date(pago.date_iso).toLocaleString("es-AR")}
                </td>
                <td className="py-2 pr-3">{pago.client_name}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium text-emerald-400">
                    {money(montoTotal)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className="text-amber-400">
                    {money(parseNum(pago.debt_before))}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className={parseNum(pago.debt_after) > 0 ? "text-amber-400" : "text-emerald-400"}>
                    {money(parseNum(pago.debt_after))}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <Chip tone={metodo === "Efectivo" ? "emerald" : "slate"}>
                    {metodo}
                  </Chip>
                </td>
                <td className="py-2 pr-3">
                  {/* 👇👇👇 BOTÓN VER RECIBO */}
                  <button
                    onClick={() => {
                      const reciboData = {
                        ...pago,
                        type: "Pago de Deuda",
                        items: [{ 
                          productId: "pago_deuda", 
                          name: "Pago de deuda", 
                          section: "Finanzas", 
                          qty: 1, 
                          unitPrice: montoTotal, 
                          cost: 0 
                        }],
                        total: montoTotal,
                        payments: { 
                          cash: efectivo, 
                          transfer: transferencia, 
                          change: 0,
                          alias: pago.alias || "",
                          saldo_aplicado: pago.saldo_aplicado || 0
                        },
                        status: "Pagado"
                      };
                      window.dispatchEvent(new CustomEvent("print-invoice", { detail: reciboData } as any));
                      setTimeout(() => window.print(), 0);
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                    title="Ver Recibo"
                  >
                    📄 Ver Recibo
                  </button>
                </td>
              </tr>
            );
          })}
        {pagosDeudores.length === 0 && (
          <tr>
            <td className="py-3 text-slate-400" colSpan={7}>
              No hay pagos registrados en el período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</Card>
    </div>
  );
  
} // ← ESTE CIERRA EL COMPONENTE ReportesTab

     

/* Presupuestos */
function PresupuestosTab({ state, setState, session }: any) {
  const [clientId, setClientId] = useState(state.clients[0]?.id || "");
  const [vendorId, setVendorId] = useState(session.role === "admin" ? state.vendors[0]?.id : session.id);
  const [priceList, setPriceList] = useState("1");
  const [sectionFilter, setSectionFilter] = useState("Todas"); // 👈 NUEVO
  const [listFilter, setListFilter] = useState("Todas"); // 👈 NUEVO
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const client = state.clients.find((c: any) => c.id === clientId);
  const vendor = state.vendors.find((v: any) => v.id === vendorId);
  
  // 👇👇👇 AGREGAR ESTAS LÍNEAS PARA LOS FILTROS
  const sections = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.section || "Otros")))];
  const lists = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.list_label || "General")))];
  
  // 👇👇👇 MODIFICAR ESTA LÍNEA PARA INCLUIR LOS NUEVOS FILTROS
  const filteredProducts = state.products.filter((p: any) => {
    const okS = sectionFilter === "Todas" || p.section === sectionFilter;
    const okL = listFilter === "Todas" || p.list_label === listFilter;
    const okQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
    return okS && okL && okQ;
  });
  
  // 👇👇👇 AGREGAR ESTA LÍNEA PARA AGRUPAR POR SECCIÓN
  const grouped = groupBy(filteredProducts, "section");

  function addItem(p: any) {
    const existing = items.find((it: any) => it.productId === p.id);
    const unit = priceList === "1" ? p.price1 : p.price2;
    if (existing) setItems(items.map((it) => (it.productId === p.id ? { ...it, qty: parseNum(it.qty) + 1 } : it)));
    else setItems([...items, { productId: p.id, name: p.name, section: p.section, qty: 1, unitPrice: unit, cost: p.cost }]);
  }
  
  // ... el resto de tus funciones permanecen EXACTAMENTE igual ...
  async function guardarPresupuesto() {
    if (!client || !vendor || items.length === 0) return;
    const st = clone(state);
    const number = st.meta.budgetCounter++;
    const id = "pr_" + number;
    const total = calcInvoiceTotal(items);
    const b = {
      id,
      number,
      date_iso: todayISO(),
      client_id: client.id,
      client_name: client.name,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      items: clone(items),
      total,
      status: "Pendiente",
    };
    st.budgets.push(b);
    setState(st);
    if (hasSupabase) {
      await supabase.from("budgets").insert(b);
      await saveCountersSupabase(st.meta);
    }
    alert("Presupuesto guardado.");
    setItems([]);
  }

async function convertirAFactura(b: any) {
    // ✅ VALIDAR STOCK ANTES DE CONVERTIR
  const validacionStock = validarStockDisponible(state.products, b.items);
  if (!validacionStock.valido) {
    const mensajeError = `No hay suficiente stock para convertir el presupuesto:\n\n${validacionStock.productosSinStock.join('\n')}`;
    return alert(mensajeError);
  }
  
  const efectivoStr = prompt("¿Cuánto paga en EFECTIVO?", "0") ?? "0";
  const transferenciaStr = prompt("¿Cuánto paga por TRANSFERENCIA?", "0") ?? "0";
  const aliasStr = prompt("Alias/CVU destino de la transferencia (opcional):", "") ?? "";

  const efectivo = parseNum(efectivoStr);
  const transferencia = parseNum(transferenciaStr);
  const alias = aliasStr.trim();

  const st = clone(state);
  const number = st.meta.invoiceCounter++;
  const id = "inv_" + number;

  // ⭐⭐⭐⭐ DESCONTAR STOCK AL CONVERTIR PRESUPUESTO ⭐⭐⭐⭐⭐
  b.items.forEach((item: any) => {
    const product = st.products.find((p: any) => p.id === item.productId);
    if (product) {
      product.stock = Math.max(0, parseNum(product.stock) - parseNum(item.qty));
    }
  });

  const invoice = {
    id,
    number,
    date_iso: todayISO(),
    client_id: b.client_id,
    client_name: b.client_name,
    vendor_id: b.vendor_id,
    vendor_name: b.vendor_name,
    items: clone(b.items),
    total: b.total,
    cost: calcInvoiceCost(b.items),
    payments: { cash: efectivo, transfer: transferencia, alias },
    status: (efectivo + transferencia) >= b.total ? "Pagada" : "No Pagada",
    type: "Factura",
  };

  st.invoices.push(invoice);
  const budget = st.budgets.find((x: any) => x.id === b.id)!;
  budget.status = "Convertido";
  setState(st);

  if (hasSupabase) {
    await supabase.from("invoices").insert(invoice);
    await supabase.from("budgets").update({ status: "Convertido" }).eq("id", b.id);
    
    // ⭐⭐⭐⭐ ACTUALIZAR STOCK EN SUPABASE ⭐⭐⭐⭐⭐
    for (const item of b.items) {
      const product = st.products.find((p: any) => p.id === item.productId);
      if (product) {
        await supabase.from("products")
          .update({ stock: product.stock })
          .eq("id", item.productId);
      }
    }
    
    await saveCountersSupabase(st.meta);
  }

  window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
  await nextPaint();
  window.print();
}

  const total = calcInvoiceTotal(items);
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="Nuevo presupuesto">
        <div className="grid md:grid-cols-4 gap-3">
          <Select label="Cliente" value={clientId} onChange={setClientId} options={state.clients.map((c: any) => ({ value: c.id, label: `${c.number} — ${c.name}` }))} />
          <Select label="Vendedor" value={vendorId} onChange={setVendorId} options={state.vendors.map((v: any) => ({ value: v.id, label: v.name }))} />
          <Select label="Lista de precios" value={priceList} onChange={setPriceList} options={[{ value: "1", label: "Mitobicel" }, { value: "2", label: "ElshoppingDlc" }]} />
          <Input label="Buscar producto" value={query} onChange={setQuery} placeholder="Nombre..." />
        </div>
        
        {/* 👇👇👇 AGREGAR ESTOS NUEVOS FILTROS */}
        <div className="grid md:grid-cols-4 gap-2 mt-3">
          <Select 
            label="Sección" 
            value={sectionFilter} 
            onChange={setSectionFilter} 
            options={sections.map((s: any) => ({ value: s, label: s }))} 
          />
          <Select 
            label="Lista" 
            value={listFilter} 
            onChange={setListFilter} 
            options={lists.map((s: any) => ({ value: s, label: s }))} 
          />
          <div className="md:col-span-2 pt-6">
            <Chip tone="emerald">Total productos: {filteredProducts.length}</Chip>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Productos</div>
            
            {/* 👇👇👇 MODIFICAR LA LISTA DE PRODUCTOS PARA MOSTRAR POR SECCIÓN */}
            <div className="space-y-3">
              {Object.entries(grouped).map(([sec, arr]: any) => (
                <div key={sec} className="border border-slate-800 rounded-xl">
                  <div className="px-3 py-2 text-xs font-semibold bg-slate-800/70">{sec}</div>
                  <div className="divide-y divide-slate-800">
                    {arr.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-slate-400">
                            L1: {money(p.price1)} L2: {money(p.price2)} 
                            <span className="text-[10px] text-slate-500 ml-1">{p.list_label}</span>
                          </div>
                        </div>
                        <Button tone="slate" onClick={() => addItem(p)}>
                          Añadir
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 👆👆👆 HASTA AQUÍ LOS CAMBIOS EN LA LISTA DE PRODUCTOS */}
          
          <div className="space-y-2">
            <div className="text-sm font-semibold">Ítems</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {items.length === 0 && <div className="p-3 text-sm text-slate-400">Vacío</div>}
         {items.map((it: any, idx: number) => (
  <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
    <div className="col-span-6">
      <div className="text-sm font-medium">{it.name}</div>
      <div className="text-xs text-slate-400">{it.section}</div>
    </div>
    <div className="col-span-2">
      <NumberInput
        label="Cant."
        value={it.qty}
        onChange={(v: any) => {
          const q = Math.max(0, parseNum(v));
          setItems(items.map((x: any, i: number) => (i === idx ? { ...x, qty: q } : x)));
        }}
      />
    </div>
    <div className="col-span-3">
      <NumberInput
        label="Precio"
        value={it.unitPrice}
        onChange={(v: any) => {
          const q = Math.max(0, parseNum(v));
          setItems(items.map((x: any, i: number) => (i === idx ? { ...x, unitPrice: q } : x)));
        }}
      />
    </div>
    <div className="col-span-1 flex items-end justify-end pb-0.5">
      <button
        onClick={() => setItems(items.filter((_: any, i: number) => i !== idx))}
        className="text-xs text-red-400 hover:text-red-300"
      >
        ✕
      </button>
    </div>
    <div className="col-span-12 text-right text-xs text-slate-300 pt-1">
      Subtotal ítem: {money(parseNum(it.qty) * parseNum(it.unitPrice))}
    </div>
  </div>
))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm">Total</div>
              <div className="text-lg font-bold">{money(total)}</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={guardarPresupuesto}>Guardar presupuesto</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* EL RESTO DE TU CÓDIGO PERMANECE EXACTAMENTE IGUAL */}
      <Card 
        title="Presupuestos guardados"
        actions={
          <Button tone="slate" onClick={async () => {
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
            alert("Presupuestos actualizados");
          }}>
            Actualizar
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">N°</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Vendedor</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.budgets
                .slice()
                .reverse()
                .map((b: any) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-4">{pad(b.number)}</td>
                    <td className="py-2 pr-4">{new Date(b.date_iso).toLocaleString("es-AR")}</td>
                    <td className="py-2 pr-4">{b.client_name}</td>
                    <td className="py-2 pr-4">{b.vendor_name}</td>
                    <td className="py-2 pr-4">{money(b.total)}</td>
                    <td className="py-2 pr-4 flex gap-2 items-center">
  {/* Botón Editar */}
  <button
    title="Editar"
    onClick={() => {
      setClientId(b.client_id);
      setVendorId(b.vendor_id);
      setItems(clone(b.items));
      alert(`Editando presupuesto Nº ${pad(b.number)}`);
    }}
    className="text-blue-400 hover:text-blue-300 text-lg"
  >
    ✏️
  </button>

  {/* Botón Descargar PDF */}
  <button
    title="Descargar PDF"
    onClick={() => {
      const data = { ...b, type: "Presupuesto" };
      window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
      setTimeout(() => window.print(), 0);
    }}
    className="text-red-400 hover:text-red-300 text-lg"
  >
    📄
  </button>

  {/* Botón Convertir o estado convertido */}
  {b.status === "Pendiente" ? (
    <Button onClick={() => convertirAFactura(b)} tone="emerald">
      Convertir a factura
    </Button>
  ) : (
    <span className="text-xs">Convertido</span>
  )}
{/* Botón Eliminar */}
<button
  title="Eliminar presupuesto"
  onClick={async () => {
    if (!confirm(`¿Seguro que deseas eliminar el presupuesto Nº ${pad(b.number)}?`)) return;
    
    const st = clone(state);
    st.budgets = st.budgets.filter((x: any) => x.id !== b.id);
    setState(st);
    
    if (hasSupabase) {
      const { error } = await supabase.from("budgets").delete().eq("id", b.id);
      if (error) {
        console.error("Error eliminando presupuesto:", error);
        alert("Error al eliminar el presupuesto de la base de datos.");
        // Recargar datos si hay error
        const refreshedState = await loadFromSupabase(seedState());
        setState(refreshedState);
        return;
      }
    }
    alert(`Presupuesto Nº ${pad(b.number)} eliminado correctamente.`);
  }}
  className="text-red-500 hover:text-red-400 text-lg ml-2"
>
  🗑️
</button>
</td>


                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}



// En GastosDevolucionesTab, reemplaza el useEffect completo por este:

/* Gastos y Devoluciones */
function GastosDevolucionesTab({ state, setState, session }: any) {
  const [productoNuevoId, setProductoNuevoId] = useState(""); // Producto elegido para entregar
  const [cantidadNuevo, setCantidadNuevo] = useState("");     // Cantidad a entregar
  const [modo, setModo] = useState("Gasto"); // "Gasto" o "Devolución"
  const [tipoGasto, setTipoGasto] = useState("Proveedor");
  const [detalle, setDetalle] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [alias, setAlias] = useState("");


  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [productosDevueltos, setProductosDevueltos] = useState<any[]>([]);
  const [facturasCliente, setFacturasCliente] = useState<any[]>([]);
  const [metodoDevolucion, setMetodoDevolucion] = useState("efectivo");

  // Cargar facturas cuando se selecciona un cliente
  useEffect(() => {
    if (!clienteSeleccionado) {
      setFacturasCliente([]);
      return;
    }

    // Filtrar facturas del cliente desde el estado local
    const facturasDelCliente = (state.invoices || [])
      .filter((f: any) => 
        f.client_id === clienteSeleccionado && 
        f.type === "Factura" &&
        f.items && 
        Array.isArray(f.items) && 
        f.items.length > 0
      )
      .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime());

    setFacturasCliente(facturasDelCliente);
    
    // Debug: mostrar información
    console.log("Cliente seleccionado:", clienteSeleccionado);
    console.log("Facturas encontradas:", facturasDelCliente.length);
    console.log("Facturas:", facturasDelCliente);

  }, [clienteSeleccionado, state.invoices, state.meta?.lastSavedInvoiceId, state.gastos?.length]);

  // Función para agregar producto a devolver
  const agregarProductoADevolver = (item: any, factura: any, cantidad: number) => {
    if (cantidad <= 0 || cantidad > item.qty) {
      alert("Cantidad inválida");
      return;
    }

    const productoExistente = productosDevueltos.find(
      (p) => p.productId === item.productId && p.facturaId === factura.id
    );

    if (productoExistente) {
      // Actualizar cantidad si ya existe
      setProductosDevueltos(prev =>
        prev.map(p =>
          p.productId === item.productId && p.facturaId === factura.id
            ? { ...p, qtyDevuelta: cantidad }
            : p
        )
      );
    } else {
      // Agregar nuevo producto a devolver
      setProductosDevueltos(prev => [
        ...prev,
        {
          ...item,
          facturaId: factura.id,
          facturaNumero: factura.number,
          qtyDevuelta: cantidad,
          qtyOriginal: item.qty
        }
      ]);
    }
  };

  // Función para quitar producto de la devolución
  const quitarProductoDevolucion = (productId: string, facturaId: string) => {
    setProductosDevueltos(prev =>
      prev.filter(p => !(p.productId === productId && p.facturaId === facturaId))
    );
  };

  // ==============================
  // Funciones para guardar Gasto y Devolución
  // ==============================
  async function guardarGasto() {
    if (!detalle.trim()) {
      alert("El campo 'Detalle' es obligatorio.");
      return;
    }

    const efectivoFinal = montoEfectivo.trim() === "" ? 0 : parseNum(montoEfectivo);
    const transferenciaFinal = montoTransferencia.trim() === "" ? 0 : parseNum(montoTransferencia);

    if (efectivoFinal === 0 && transferenciaFinal === 0) {
      alert("Debes ingresar al menos un monto en efectivo o transferencia.");
      return;
    }

    const gasto = {
      id: "g" + Math.random().toString(36).slice(2, 8),
      tipo: tipoGasto,
      detalle,
      efectivo: efectivoFinal,
      transferencia: transferenciaFinal,
      alias,
      date_iso: todayISO(),
    };

    const st = clone(state);
    st.gastos = st.gastos || [];
    st.gastos.push(gasto);
    setState(st);

    if (hasSupabase) await supabase.from("gastos").insert(gasto);

    alert("Gasto guardado correctamente.");
    setDetalle("");
    setMontoEfectivo("");
    setMontoTransferencia("");
    setAlias("");
  }

  async function guardarDevolucion() {
  if (!clienteSeleccionado) {
    alert("Selecciona un cliente antes de guardar la devolución.");
    return;
  }

  if (productosDevueltos.length === 0) {
    alert("Debes seleccionar al menos un producto para devolver.");
    return;
  }

  // Intercambio por otro producto - validación
  if (metodoDevolucion === "intercambio_otro") {
    if (!productoNuevoId || parseNum(cantidadNuevo) <= 0) {
      alert("Debes seleccionar un producto nuevo y la cantidad.");
      return;
    }
  }

  const clientName = state.clients.find((c: any) => c.id === clienteSeleccionado)?.name || "Cliente desconocido";

  // Total calculado según cantidades devueltas
  const totalDevolucion = productosDevueltos.reduce(
    (s, it) => s + parseNum(it.qtyDevuelta) * parseNum(it.unitPrice),
    0
  );

  const devolucion = {
    id: "d" + Math.random().toString(36).slice(2, 8),
    client_id: clienteSeleccionado,
    client_name: clientName,
    items: productosDevueltos,
    metodo: metodoDevolucion,
    efectivo: metodoDevolucion === "efectivo" ? parseNum(montoEfectivo) : 0,
    transferencia: metodoDevolucion === "transferencia" ? parseNum(montoTransferencia) : 0,
    extra_pago_efectivo: metodoDevolucion === "intercambio_otro" ? parseNum(montoEfectivo) : 0,
    extra_pago_transferencia: metodoDevolucion === "intercambio_otro" ? parseNum(montoTransferencia) : 0,
    extra_pago_total: (metodoDevolucion === "intercambio_otro" ? parseNum(montoEfectivo) + parseNum(montoTransferencia) : 0),
    total: totalDevolucion,
    date_iso: todayISO(),
  };

  const st = clone(state);
  st.devoluciones.push(devolucion);

  // OBTENER EL CLIENTE
  const cli = st.clients.find((c: any) => c.id === clienteSeleccionado);
  
  if (!cli) {
    alert("Error: Cliente no encontrado.");
    return;
  }

  // ===== NUEVA LÓGICA: APLICAR SALDO A FAVOR A LA DEUDA =====
  if (metodoDevolucion === "saldo") {
    // 1) Acreditar saldo a favor
    cli.saldo_favor = parseNum(cli.saldo_favor) + parseNum(totalDevolucion);
    
    // 2) Aplicar saldo a favor a la deuda (si hay deuda)
    const saldoAFavor = cli.saldo_favor;
    const deudaActual = parseNum(cli.debt);
    
    if (deudaActual > 0 && saldoAFavor > 0) {
      const montoAAplicar = Math.min(saldoAFavor, deudaActual);
      
      // Reducir tanto la deuda como el saldo a favor
      cli.debt = Math.max(0, deudaActual - montoAAplicar);
      cli.saldo_favor = Math.max(0, saldoAFavor - montoAAplicar);
      
      console.log(`✅ Aplicado $${montoAAplicar} de saldo a favor a la deuda. Deuda restante: $${cli.debt}, Saldo a favor restante: $${cli.saldo_favor}`);
    }
  }

  // Stock: entra lo devuelto
  productosDevueltos.forEach((it) => {
    const prod = st.products.find((p: any) => p.id === it.productId);
    if (prod) prod.stock = parseNum(prod.stock) + parseNum(it.qtyDevuelta);
  });

  // Stock: sale lo entregado en intercambio_otro
  if (metodoDevolucion === "intercambio_otro" && productoNuevoId) {
    const nuevo = st.products.find((p: any) => p.id === productoNuevoId);
    if (nuevo) nuevo.stock = parseNum(nuevo.stock) - parseNum(cantidadNuevo);
  }

  // Actualizar las facturas originales
  productosDevueltos.forEach((productoDevuelto) => {
    const factura = st.invoices.find((f: any) => f.id === productoDevuelto.facturaId);
    if (factura) {
      const itemFactura = factura.items.find((item: any) => item.productId === productoDevuelto.productId);
      if (itemFactura) {
        // Restar la cantidad devuelta de la factura original
        itemFactura.qty = Math.max(0, parseNum(itemFactura.qty) - parseNum(productoDevuelto.qtyDevuelta));
        
        // Recalcular el total de la factura
        factura.total = calcInvoiceTotal(factura.items);
        factura.cost = calcInvoiceCost(factura.items);
        
        // Si la cantidad queda en 0, eliminar el item de la factura
        if (itemFactura.qty <= 0) {
          factura.items = factura.items.filter((item: any) => item.productId !== productoDevuelto.productId);
        }
      }
    }
  });

  setState(st);

  // Persistencia
  if (hasSupabase) {
    await supabase.from("devoluciones").insert(devolucion);

    // Actualizar cliente (deuda y saldo_favor)
    await supabase.from("clients")
      .update({ 
        debt: cli.debt,
        saldo_favor: cli.saldo_favor
      })
      .eq("id", clienteSeleccionado);

    // Persistir stocks tocados
    for (const it of productosDevueltos) {
      const nuevoStock = st.products.find((p: any) => p.id === it.productId)?.stock;
      await supabase.from("products").update({ stock: nuevoStock }).eq("id", it.productId);
    }
    
    if (metodoDevolucion === "intercambio_otro" && productoNuevoId) {
      const stockNuevo = st.products.find((p: any) => p.id === productoNuevoId)?.stock;
      await supabase.from("products").update({ stock: stockNuevo }).eq("id", productoNuevoId);
    }

    // Actualizar facturas en Supabase
    for (const productoDevuelto of productosDevueltos) {
      const factura = st.invoices.find((f: any) => f.id === productoDevuelto.facturaId);
      if (factura) {
        await supabase.from("invoices")
          .update({ 
            items: factura.items,
            total: factura.total,
            cost: factura.cost
          })
          .eq("id", factura.id);
      }
    }
  }

  // Imprimir comprobante de devolución
  window.dispatchEvent(new CustomEvent("print-devolucion", { detail: devolucion } as any));
  await nextPaint();
  window.print();

  // Mensaje informativo sobre la aplicación del saldo a la deuda
  if (metodoDevolucion === "saldo") {
    const mensaje = `Devolución registrada con éxito. 
    
Saldo a favor acreditado: $${totalDevolucion}
${cli.debt > 0 ? `Se aplicó saldo a favor a la deuda existente. Deuda actual: $${cli.debt}` : 'La deuda ha sido completamente saldada con el saldo a favor.'}`;
    
    alert(mensaje);
  } else {
    alert("Devolución registrada con éxito.");
  }

  // Limpiar formulario
  setProductosDevueltos([]);
  setClienteSeleccionado("");
  setMontoEfectivo("");
  setMontoTransferencia("");
  setMetodoDevolucion("efectivo");
  setProductoNuevoId("");
  setCantidadNuevo("");
}
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card 
        title="Gastos y Devoluciones"
        actions={
          <Button tone="slate" onClick={async () => {
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
            alert("Datos actualizados");
          }}>
            Actualizar datos
          </Button>
        }
      >
        <div className="grid md:grid-cols-2 gap-3">
          <Select
            label="Modo"
            value={modo}
            onChange={setModo}
            options={[
              { value: "Gasto", label: "Registrar Gasto" },
              { value: "Devolución", label: "Registrar Devolución" },
            ]}
          />
        </div>
      </Card>

      {modo === "Gasto" && (
        <Card title="Registrar Gasto">
          <div className="grid md:grid-cols-2 gap-3">
            <Select
              label="Tipo de gasto"
              value={tipoGasto}
              onChange={setTipoGasto}
              options={[
                { value: "Proveedor", label: "Proveedor" },
                { value: "Otro", label: "Otro" },
              ]}
            />
            <Input
              label="Detalle"
              value={detalle}
              onChange={setDetalle}
              placeholder="Ej: Coca-Cola, Luz, Transporte..."
            />
            <Select
  label="Tipo de gasto"
  value={tipoGasto}
  onChange={setTipoGasto}
  options={[
    { value: "Proveedor", label: "Proveedor" },
    { value: "Gabi", label: "Gabi" }, // 👈 NUEVA OPCIÓN
    { value: "Otro", label: "Otro" },
  ]}
/>
            <NumberInput
              label="Monto en efectivo"
              value={montoEfectivo}
              onChange={setMontoEfectivo}
              placeholder="0"
            />
            <NumberInput
              label="Monto en transferencia"
              value={montoTransferencia}
              onChange={setMontoTransferencia}
              placeholder="0"
            />
            <Input
              label="Alias / CVU (opcional)"
              value={alias}
              onChange={setAlias}
              placeholder="alias.cuenta.banco"
            />
            <div className="pt-6">
              <Button onClick={guardarGasto}>Guardar gasto</Button>
            </div>
          </div>
        </Card>
      )}

      {modo === "Devolución" && (
        <Card title="Registrar Devolución">
          {/* Selección de cliente */}
          <div className="grid md:grid-cols-2 gap-3">
            <Select
              label="Cliente"
              value={clienteSeleccionado}
              onChange={setClienteSeleccionado}
              options={[
                { value: "", label: "— Seleccionar cliente —" },
                ...state.clients.map((c: any) => ({
                  value: c.id,
                  label: `${c.number} - ${c.name}`,
                }))
              ]}
            />
          </div>

          {/* Listado de productos de facturas */}
          {clienteSeleccionado && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Facturas del cliente</h4>
              
              {facturasCliente.length > 0 ? (
                facturasCliente.map((factura) => (
                  <div
                    key={factura.id}
                    className="mb-4 border border-slate-800 rounded-lg p-3"
                  >
                    <div className="text-sm font-medium mb-2">
                      Factura #{factura.number} — {new Date(factura.date_iso).toLocaleDateString("es-AR")} — Total: {money(factura.total)}
                    </div>
                    
                    <table className="min-w-full text-sm">
                      <thead className="text-slate-400 bg-slate-800/50">
                        <tr>
                          <th className="text-left py-2 px-2">Producto</th>
                          <th className="text-center py-2 px-2">Cant. Original</th>
                          <th className="text-center py-2 px-2">Precio Unit.</th>
                          <th className="text-center py-2 px-2">Cant. a Devolver</th>
                          <th className="text-center py-2 px-2">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factura.items.map((item: any, idx: number) => {
                          const productoEnDevolucion = productosDevueltos.find(
                            p => p.productId === item.productId && p.facturaId === factura.id
                          );
                          
                          return (
                            <tr key={`${factura.id}-${item.productId}`} className="border-t border-slate-700">
                              <td className="py-2 px-2">{item.name}</td>
                              <td className="text-center py-2 px-2">{item.qty}</td>
                              <td className="text-center py-2 px-2">{money(item.unitPrice)}</td>
                              <td className="text-center py-2 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.qty}
                                  defaultValue={productoEnDevolucion?.qtyDevuelta || 0}
                                  className="w-16 text-center border border-slate-700 rounded bg-slate-900 px-1 py-1"
                                  onChange={(e) => {
                                    const cantidad = parseInt(e.target.value) || 0;
                                    if (cantidad > 0) {
                                      agregarProductoADevolver(item, factura, cantidad);
                                    } else if (productoEnDevolucion) {
                                      quitarProductoDevolucion(item.productId, factura.id);
                                    }
                                  }}
                                />
                              </td>
                              <td className="text-center py-2 px-2">
                                {productoEnDevolucion ? (
                                  <button
                                    onClick={() => quitarProductoDevolucion(item.productId, factura.id)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                  >
                                    Quitar
                                  </button>
                                ) : (
                                  <span className="text-slate-500 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 p-3 border border-slate-800 rounded-lg">
                  Este cliente no tiene facturas registradas.
                </div>
              )}
            </div>
          )}

          {/* Resumen de productos a devolver */}
          {productosDevueltos.length > 0 && (
            <div className="mt-6 border-t border-slate-700 pt-4">
              <h4 className="text-sm font-semibold mb-2">Productos a devolver</h4>
              <div className="space-y-2">
                {productosDevueltos.map((producto, index) => (
                  <div key={index} className="flex justify-between items-center text-sm p-2 bg-slate-800/30 rounded">
                    <div>
                      <span className="font-medium">{producto.name}</span>
                      <span className="text-slate-400 ml-2">
                        (Factura #{producto.facturaNumero})
                      </span>
                    </div>
                    <div>
                      <span>{producto.qtyDevuelta} × {money(producto.unitPrice)} = </span>
                      <span className="font-medium">{money(producto.qtyDevuelta * producto.unitPrice)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center font-semibold border-t border-slate-700 pt-2 mt-2">
                  <span>Total devolución:</span>
                  <span>
                    {money(productosDevueltos.reduce((sum, p) => sum + (p.qtyDevuelta * p.unitPrice), 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Selección del método de devolución */}
          {productosDevueltos.length > 0 && (
            <div className="mt-6 border-t border-slate-700 pt-4">
              <h4 className="text-sm font-semibold mb-2">Método de devolución</h4>
              <Select
                label="Seleccionar método"
                value={metodoDevolucion}
                onChange={setMetodoDevolucion}
                options={[
                  { value: "efectivo", label: "Efectivo" },
                  { value: "transferencia", label: "Transferencia" },
                  { value: "saldo", label: "Saldo a favor" },
                  { value: "intercambio_mismo", label: "Intercambio mismo producto" },
                  { value: "intercambio_otro", label: "Intercambio por otro producto" },
                ]}
              />

              {/* Campos para intercambio por otro producto */}
              {metodoDevolucion === "intercambio_otro" && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-semibold">Producto nuevo a entregar</h4>
                  <Select
                    label="Seleccionar producto nuevo"
                    value={productoNuevoId}
                    onChange={setProductoNuevoId}
                    options={[
                      { value: "", label: "— Seleccionar producto —" },
                      ...state.products.map((p: any) => ({
                        value: p.id,
                        label: `${p.name} — Stock: ${p.stock || 0}`,
                      }))
                    ]}
                  />
                  <NumberInput
                    label="Cantidad"
                    value={cantidadNuevo}
                    onChange={setCantidadNuevo}
                    placeholder="0"
                  />

                  <h4 className="text-sm font-semibold mt-4">Pago de diferencia (opcional)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Pago en efectivo"
                      value={montoEfectivo}
                      onChange={setMontoEfectivo}
                      placeholder="0"
                    />
                    <NumberInput
                      label="Pago en transferencia"
                      value={montoTransferencia}
                      onChange={setMontoTransferencia}
                      placeholder="0"
                    />
                    <Input
                      className="col-span-2"
                      label="Alias / CVU destino"
                      value={alias}
                      onChange={setAlias}
                      placeholder="ej: mitobicel.banco"
                    />
                  </div>
                </div>
              )}

              {/* Campos para efectivo/transferencia */}
              {(metodoDevolucion === "efectivo" || metodoDevolucion === "transferencia") && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <NumberInput
                    label="Monto en efectivo"
                    value={montoEfectivo}
                    onChange={setMontoEfectivo}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Monto en transferencia"
                    value={montoTransferencia}
                    onChange={setMontoTransferencia}
                    placeholder="0"
                  />
                </div>
              )}

              {/* Botón para confirmar devolución */}
              <div className="mt-4 text-right">
                <Button onClick={guardarDevolucion} tone="emerald">
                  Confirmar devolución
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// 👇👇👇 NUEVO COMPONENTE: Panel de Pedidos Online
function PedidosOnlineTab({ state, setState, session }: any) {
  const [priceList, setPriceList] = useState("1");
  const [sectionFilter, setSectionFilter] = useState("Todas");
  const [listFilter, setListFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [observaciones, setObservaciones] = useState("");

  const sections = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.section || "Otros")))];
  const lists = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.list_label || "General")))];

  const filteredProducts = state.products.filter((p: any) => {
    const okS = sectionFilter === "Todas" || p.section === sectionFilter;
    const okL = listFilter === "Todas" || p.list_label === listFilter;
    const okQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
    return okS && okL && okQ;
  });

  const grouped = groupBy(filteredProducts, "section");

function addItem(p: any) {
  // ✅ VERIFICAR STOCK ANTES DE AGREGAR
  const stockActual = parseNum(p.stock);
  if (stockActual <= 0) {
    return alert(`No hay stock disponible de ${p.name}. Stock actual: ${stockActual}`);
  }
  
  const existing = items.find((it: any) => it.productId === p.id);
  const unit = priceList === "1" ? p.price1 : p.price2;
  
  if (existing) {
    // Verificar si al agregar una unidad más supera el stock
    const nuevaCantidad = parseNum(existing.qty) + 1;
    if (nuevaCantidad > stockActual) {
      return alert(`No hay suficiente stock de ${p.name}. Stock disponible: ${stockActual}`);
    }
    setItems(items.map((it) => (it.productId === p.id ? { ...it, qty: nuevaCantidad } : it)));
  } else {
    setItems([...items, { productId: p.id, name: p.name, section: p.section, qty: 1, unitPrice: unit, cost: p.cost }]);
  }
}

  async function hacerPedido() {
    if (items.length === 0) return alert("Agregá productos al pedido.");
    
    const st = clone(state);
    const pedidoId = "ped_" + Math.random().toString(36).slice(2, 9);
    const total = calcInvoiceTotal(items);

    const pedido: Pedido = {
      id: pedidoId,
      client_id: session.id,
      client_name: session.name,
      client_number: session.number,
      items: clone(items),
      total,
      status: "pendiente",
      date_iso: todayISO(),
      observaciones: observaciones.trim() || undefined,
    };

    st.pedidos.push(pedido);
    setState(st);

    if (hasSupabase) {
      await supabase.from("pedidos").insert(pedido);
    }

    // Limpiar el carrito
    setItems([]);
    setObservaciones("");
    
    alert("✅ Pedido enviado correctamente. Te contactaremos cuando esté listo.");
  }

  const total = calcInvoiceTotal(items);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title={`Hacer Pedido Online - Cliente: ${session.name} (N° ${session.number})`}>
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <Select
            label="Lista de precios"
            value={priceList}
            onChange={setPriceList}
            options={[
              { value: "1", label: "Mitobicel" },
              { value: "2", label: "ElshoppingDlc" },
            ]}
          />
          <Select 
            label="Sección" 
            value={sectionFilter} 
            onChange={setSectionFilter} 
            options={sections.map((s: any) => ({ value: s, label: s }))} 
          />
          <Select 
            label="Lista" 
            value={listFilter} 
            onChange={setListFilter} 
            options={lists.map((s: any) => ({ value: s, label: s }))} 
          />
          <Input label="Buscar" value={query} onChange={setQuery} placeholder="Nombre del producto..." />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Lista de productos */}
          <div className="space-y-4">
            <div className="text-sm font-semibold">Productos Disponibles</div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {Object.entries(grouped).map(([sec, arr]: any) => (
                <div key={sec} className="border border-slate-800 rounded-xl">
                  <div className="px-3 py-2 text-xs font-semibold bg-slate-800/70">{sec}</div>
                  <div className="divide-y divide-slate-800">
                    {arr.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-slate-400">
                            Precio: {money(priceList === "1" ? p.price1 : p.price2)} · 
                            Stock: {p.stock || 0}
                          </div>
                        </div>
                        <Button onClick={() => addItem(p)} tone="slate" className="shrink-0">
                          Agregar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Carrito del pedido */}
          <div className="space-y-4">
            <div className="text-sm font-semibold">Tu Pedido</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
              {items.length === 0 && (
                <div className="p-4 text-sm text-slate-400 text-center">
                  Tu carrito está vacío. Agregá productos del listado.
                </div>
              )}
              {items.map((it, idx) => (
                <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-400">{it.section}</div>
                  </div>
                  <div className="col-span-3">
                    <NumberInput
                      label="Cant."
                      value={it.qty}
                      onChange={(v: any) => {
                        const q = Math.max(0, parseNum(v));
                        setItems(items.map((x, i) => (i === idx ? { ...x, qty: q } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button 
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 text-lg"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs text-slate-300 pt-1">
                    Subtotal: {money(parseNum(it.qty) * parseNum(it.unitPrice))}
                  </div>
                </div>
              ))}
            </div>

            {/* Observaciones y total */}
            <div className="space-y-3">
              <Input
                label="Observaciones (opcional)"
                value={observaciones}
                onChange={setObservaciones}
                placeholder="Ej: Urgente, color específico, etc."
              />
              
              <div className="flex items-center justify-between text-lg font-bold border-t border-slate-700 pt-3">
                <span>Total del Pedido:</span>
                <span>{money(total)}</span>
              </div>

              <Button 
                onClick={hacerPedido} 
                disabled={items.length === 0}
                className="w-full py-3 text-base"
              >
                🚀 Hacer Pedido
              </Button>

              <div className="text-xs text-slate-400 text-center">
                Tu pedido será revisado y te contactaremos para coordinar el pago y entrega.
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Pedidos anteriores del cliente */}
      <Card title="Tus Pedidos Anteriores">
        <div className="space-y-3">
          {state.pedidos
            .filter((p: Pedido) => p.client_id === session.id)
            .slice(0, 5) // Mostrar solo los últimos 5
            .map((pedido: Pedido) => (
              <div key={pedido.id} className="border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Pedido #{pedido.id.slice(-6)}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(pedido.date_iso).toLocaleString("es-AR")}
                    </div>
                    <div className="text-sm mt-1">
                      {pedido.items.length} producto(s) - Total: {money(pedido.total)}
                    </div>
                    {pedido.observaciones && (
                      <div className="text-xs text-slate-400 mt-1">
                        Observaciones: {pedido.observaciones}
                      </div>
                    )}
                  </div>
                  <Chip tone={
                    pedido.status === "pendiente" ? "slate" :
                    pedido.status === "aceptado" ? "emerald" :
                    pedido.status === "listo" ? "emerald" : "red"
                  }>
                    {pedido.status === "pendiente" && "⏳ Pendiente"}
                    {pedido.status === "aceptado" && "✅ Aceptado"}
                    {pedido.status === "listo" && "🚀 Listo para retirar"}
                    {pedido.status === "cancelado" && "❌ Cancelado"}
                  </Chip>
                </div>
              </div>
            ))}
          
          {state.pedidos.filter((p: Pedido) => p.client_id === session.id).length === 0 && (
            <div className="text-center text-slate-400 py-4">
              No tenés pedidos anteriores.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// 👇👇👇 NUEVO COMPONENTE: Gestión de Pedidos (para admin/vendedores)
function GestionPedidosTab({ state, setState, session }: any) {
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const pedidosFiltrados = state.pedidos.filter((pedido: Pedido) => {
    if (filtroEstado === "todos") return true;
    return pedido.status === filtroEstado;
  });

  async function cambiarEstado(pedidoId: string, nuevoEstado: Pedido["status"]) {
    const st = clone(state);
    const pedido = st.pedidos.find((p: Pedido) => p.id === pedidoId);
    
    if (pedido) {
      pedido.status = nuevoEstado;
      
      if (nuevoEstado === "aceptado") {
        pedido.accepted_by = session.name;
        pedido.accepted_at = todayISO();
      } else if (nuevoEstado === "listo") {
        pedido.completed_at = todayISO();
      }
      
      setState(st);

      if (hasSupabase) {
        await supabase
          .from("pedidos")
          .update({
            status: nuevoEstado,
            accepted_by: pedido.accepted_by,
            accepted_at: pedido.accepted_at,
            completed_at: pedido.completed_at
          })
          .eq("id", pedidoId);
      }

      alert(`Pedido ${pedidoId} actualizado a: ${nuevoEstado}`);
    }
  }

async function convertirAFactura(pedido: Pedido) {
  try {
    // 1. Preguntar por los datos de pago
    const efectivoStr = prompt("¿Cuánto paga en EFECTIVO?", "0") ?? "0";
    const transferenciaStr = prompt("¿Cuánto paga por TRANSFERENCIA?", "0") ?? "0";
    const aliasStr = prompt("Alias/CVU destino de la transferencia (opcional):", "") ?? "";

    const efectivo = parseNum(efectivoStr);
    const transferencia = parseNum(transferenciaStr);
    const alias = aliasStr.trim();

    // Validaciones básicas
    if (efectivo < 0 || transferencia < 0) {
      return alert("Los montos no pueden ser negativos.");
    }

    const totalPagos = efectivo + transferencia;
    const totalPedido = parseNum(pedido.total);

    if (totalPagos > totalPedido) {
      const vuelto = totalPagos - totalPedido;
      if (!confirm(`El cliente pagó de más. ¿Dar vuelto de ${money(vuelto)}?`)) {
        return;
      }
    }

    // 2. Usar la misma lógica que FacturacionTab
    const st = clone(state);
    const number = st.meta.invoiceCounter++;
    const id = "inv_" + number;

    // Obtener el cliente para manejar saldo a favor y deuda
    const cliente = st.clients.find((c: any) => c.id === pedido.client_id);
    if (!cliente) {
      return alert("Error: Cliente no encontrado.");
    }

    // ⭐⭐ SOLUCIÓN: USAR SIEMPRE "Vendedor Online" ⭐⭐
    let vendorId = "";
    let vendorName = "Vendedor Online";

  // Buscar el vendedor "Vendedor Online" en la lista usando la función auxiliar
const vendedorOnline = obtenerVendedorOnline(st);

    if (vendedorOnline) {
      vendorId = vendedorOnline.id;
      vendorName = vendedorOnline.name;
      console.log("🔄 Usando Vendedor Online:", vendorId, vendorName);
    } else {
      // Fallback: usar el primer vendedor disponible
      const primerVendedor = st.vendors[0];
      if (primerVendedor) {
        vendorId = primerVendedor.id;
        vendorName = primerVendedor.name;
        console.warn("⚠️ Vendedor Online no encontrado, usando:", vendorId, vendorName);
      } else {
        throw new Error("No hay vendedores disponibles en el sistema");
      }
    }

    // Validar que el vendor_id existe
    const vendorExiste = st.vendors.find((v: any) => v.id === vendorId);
    if (!vendorExiste) {
      console.error("❌ Vendor ID no válido:", vendorId);
      throw new Error(`Vendedor con ID ${vendorId} no existe`);
    }

    // Calcular saldo a favor aplicado
    const saldoActual = parseNum(cliente.saldo_favor || 0);
    const saldoAplicado = Math.min(totalPedido, saldoActual);
    const totalTrasSaldo = totalPedido - saldoAplicado;

    // Calcular pagos aplicados
    const vueltoSugerido = Math.max(0, efectivo - Math.max(0, totalTrasSaldo - transferencia));
    const vuelto = vueltoSugerido;
    const applied = Math.max(0, efectivo + transferencia - vuelto);

    // Calcular deuda resultante
    const debtDelta = Math.max(0, totalTrasSaldo - applied);
    const status = debtDelta > 0 ? "No Pagada" : "Pagada";

    // ACTUALIZAR CLIENTE
    const deudaAnterior = parseNum(cliente.debt);
    cliente.saldo_favor = saldoActual - saldoAplicado;
    cliente.debt = deudaAnterior + debtDelta;

    // DESCONTAR STOCK
    pedido.items.forEach((item: any) => {
      const product = st.products.find((p: any) => p.id === item.productId);
      if (product) {
        product.stock = Math.max(0, parseNum(product.stock) - parseNum(item.qty));
      }
    });

    // Crear la factura con VENDEDOR CORRECTO
    const invoice = {
      id,
      number,
      date_iso: todayISO(),
      client_id: pedido.client_id,
      client_name: pedido.client_name,
      vendor_id: vendorId, // ⭐ Usamos el vendedor asignado
      vendor_name: vendorName, // ⭐ Nombre del vendedor
      items: pedido.items,
      total: totalPedido,
      total_after_credit: totalTrasSaldo,
      cost: calcInvoiceCost(pedido.items),
      payments: { 
        cash: efectivo, 
        transfer: transferencia, 
        change: vuelto, 
        alias: alias,
        saldo_aplicado: saldoAplicado 
      },
      status,
      type: "Factura",
      client_debt_total: cliente.debt
    };

    console.log("🔍 Factura con vendedor:", vendorId, vendorName);

    // ACTUALIZAR ESTADO LOCAL PRIMERO
    st.invoices.push(invoice);
    
    // Marcar pedido como completado
    const pedidoObj = st.pedidos.find((p: Pedido) => p.id === pedido.id);
    if (pedidoObj) {
      pedidoObj.status = "listo";
      pedidoObj.completed_at = todayISO();
    }
    
    // ACTUALIZAR ESTADO
    setState(st);

    // PERSISTIR EN SUPABASE
    if (hasSupabase) {
      console.log("📦 Intentando guardar en Supabase...");
      
      // 1. Guardar factura
      const { data: facturaData, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoice)
        .select();

      if (invoiceError) {
        console.error("❌ ERROR al guardar factura:", invoiceError);
        throw new Error(`No se pudo guardar la factura: ${invoiceError.message}`);
      }
      console.log("✅ Factura guardada:", facturaData);

      // 2. Actualizar pedido
      const { error: pedidoError } = await supabase
        .from("pedidos")
        .update({ 
          status: "listo",
          completed_at: todayISO()
        })
        .eq("id", pedido.id);

      if (pedidoError) {
        console.error("❌ ERROR al actualizar pedido:", pedidoError);
      } else {
        console.log("✅ Pedido actualizado");
      }

      // 3. Actualizar cliente
      const { error: clientError } = await supabase
        .from("clients")
        .update({ 
          debt: cliente.debt, 
          saldo_favor: cliente.saldo_favor 
        })
        .eq("id", pedido.client_id);

      if (clientError) {
        console.error("❌ ERROR al actualizar cliente:", clientError);
      } else {
        console.log("✅ Cliente actualizado");
      }

      // 4. Actualizar stock
      for (const item of pedido.items) {
        const product = st.products.find((p: any) => p.id === item.productId);
        if (product) {
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock: product.stock })
            .eq("id", item.productId);
          
          if (stockError) {
            console.warn(`⚠️ No se pudo actualizar stock de ${item.name}:`, stockError);
          } else {
            console.log(`✅ Stock actualizado: ${item.name}`);
          }
        }
      }
      
      // 5. Actualizar contadores
      await saveCountersSupabase(st.meta);
      console.log("✅ Contadores actualizados");
    }

    // IMPRIMIR FACTURA
    window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
    await nextPaint();
    window.print();

    // ACTUALIZAR DATOS PARA REPORTES
    if (hasSupabase) {
      setTimeout(async () => {
        const refreshedState = await loadFromSupabase(seedState());
        setState(refreshedState);
      }, 1500);
    }

    // MENSAJE DE ÉXITO
    alert(`✅ Pedido online convertido a Factura Nº ${number}\nCliente: ${pedido.client_name}\nTotal: ${money(totalPedido)}\nVendedor: ${vendorName}\nEstado: ${status}`);

  } catch (error) {
    console.error("💥 ERROR CRÍTICO:", error);
    alert(`❌ Error al guardar: ${error.message}\n\nRevisa la consola para más detalles.`);
  }
}
  function obtenerVendedorOnline(state: any) {
  // Buscar por nombre exacto o similar
  const vendedores = state.vendors || [];
  
  // Primero buscar por nombre exacto
  let vendedor = vendedores.find((v: any) => 
    v.name.toLowerCase() === "vendedor online"
  );
  
  // Si no existe, buscar por coincidencia parcial
  if (!vendedor) {
    vendedor = vendedores.find((v: any) => 
      v.name.toLowerCase().includes("online") || 
      v.name.toLowerCase().includes("vendedor")
    );
  }
  
  // Si aún no existe, usar el primer vendedor
  if (!vendedor && vendedores.length > 0) {
    vendedor = vendedores[0];
  }
  
  return vendedor;
}
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card 
        title="Gestión de Pedidos Online"
        actions={
          <div className="flex gap-2">
            <Select
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={[
                { value: "todos", label: "Todos los estados" },
                { value: "pendiente", label: "Pendientes" },
                { value: "aceptado", label: "Aceptados" },
                { value: "listo", label: "Listos" },
                { value: "cancelado", label: "Cancelados" },
              ]}
            />
            <Button tone="slate" onClick={async () => {
              const refreshedState = await loadFromSupabase(seedState());
              setState(refreshedState);
            }}>
              Actualizar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No hay pedidos {filtroEstado !== "todos" ? `con estado "${filtroEstado}"` : ""}.
            </div>
          ) : (
            pedidosFiltrados.map((pedido: Pedido) => (
              <div key={pedido.id} className="border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">
                      Pedido #{pedido.id.slice(-6)} - {pedido.client_name} (N° {pedido.client_number})
                    </div>
                    <div className="text-sm text-slate-400">
                      {new Date(pedido.date_iso).toLocaleString("es-AR")}
                    </div>
                    {pedido.observaciones && (
                      <div className="text-sm text-slate-300 mt-1">
                        <strong>Observaciones:</strong> {pedido.observaciones}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{money(pedido.total)}</div>
                    <Chip tone={
                      pedido.status === "pendiente" ? "slate" :
                      pedido.status === "aceptado" ? "emerald" :
                      pedido.status === "listo" ? "emerald" : "red"
                    }>
                      {pedido.status === "pendiente" && "⏳ Pendiente"}
                      {pedido.status === "aceptado" && "✅ Aceptado"}
                      {pedido.status === "listo" && "🚀 Listo para retirar"}
                      {pedido.status === "cancelado" && "❌ Cancelado"}
                    </Chip>
                  </div>
                </div>

                {/* Items del pedido */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">Productos:</div>
                  <div className="grid gap-2">
                    {pedido.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name} × {item.qty}</span>
                        <span>{money(parseNum(item.qty) * parseNum(item.unitPrice))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 flex-wrap">
                  {pedido.status === "pendiente" && (
                    <>
                      <Button onClick={() => cambiarEstado(pedido.id, "aceptado")}>
                        ✅ Aceptar Pedido
                      </Button>
                      <Button tone="red" onClick={() => cambiarEstado(pedido.id, "cancelado")}>
                        ❌ Cancelar
                      </Button>
                    </>
                  )}
                  
                  {pedido.status === "aceptado" && (
                    <>
                      <Button onClick={() => cambiarEstado(pedido.id, "listo")}>
                        🚀 Marcar como Listo
                      </Button>
                      <Button onClick={() => convertirAFactura(pedido)}>
                        📄 Convertir a Factura
                      </Button>
                    </>
                  )}
                  
                  {pedido.status === "listo" && (
                    <Button onClick={() => convertirAFactura(pedido)}>
                      📄 Convertir a Factura
                    </Button>
                  )}
                  
                  <Button tone="slate" onClick={() => {
                    // Ver detalles del pedido
                    alert(`Detalles del pedido ${pedido.id}\nCliente: ${pedido.client_name}\nTotal: ${money(pedido.total)}\nProductos: ${pedido.items.length}`);
                  }}>
                    👁️ Ver Detalles
                  </Button>
                </div>

                {/* Información de procesamiento */}
                {(pedido.accepted_by || pedido.completed_at) && (
                  <div className="text-xs text-slate-400 mt-3">
                    {pedido.accepted_by && `Aceptado por: ${pedido.accepted_by} · `}
                    {pedido.accepted_at && `el ${new Date(pedido.accepted_at).toLocaleString("es-AR")}`}
                    {pedido.completed_at && ` · Listo: ${new Date(pedido.completed_at).toLocaleString("es-AR")}`}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

/* ===== helpers para impresión ===== */
const APP_TITLE = "Sistema de Gestión y Facturación — By Tobias Carrizo";
function nextPaint() {
  return new Promise<void>((res) =>
    requestAnimationFrame(() => requestAnimationFrame(() => res()))
  );
}


/* ===== Área de impresión ===== */
function PrintArea() {
  const [inv, setInv] = useState<any | null>(null);
  const [ticket, setTicket] = useState<any | null>(null);

 useEffect(() => {
  const hInv = (e: any) => {
    setTicket(null);
    setInv(e.detail);
  };
  const hTic = (e: any) => {
    setInv(null);
    setTicket(e.detail);
  };
  const hDev = (e: any) => {
    setInv(null);
    setTicket(null);
    setInv({ ...e.detail, type: "Devolucion" });
  };
  
  window.addEventListener("print-invoice", hInv);
  window.addEventListener("print-ticket", hTic);
  window.addEventListener("print-devolucion", hDev);
  
  return () => {
    window.removeEventListener("print-invoice", hInv);
    window.removeEventListener("print-ticket", hTic);
    window.removeEventListener("print-devolucion", hDev);
  };
}, []);

  if (!inv && !ticket) return null;
// ==== PLANTILLA: REPORTE ====
if (inv?.type === "Reporte") {
  const fmt = (n: number) => money(parseNum(n));
  const rangoStr = (() => {
    const s = new Date(inv?.rango?.start || Date.now());
    const e = new Date(inv?.rango?.end || Date.now());
    const toDate = (d: Date) => d.toLocaleString("es-AR");
    return `${toDate(s)}  —  ${toDate(e)}`;
  })();

  return (
    <div className="only-print print-area p-14">
      <div className="max-w-[780px] mx-auto text-black">
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1 }}>REPORTE</div>
            <div style={{ marginTop: 2 }}>MITOBICEL</div>
          </div>
          <div className="text-right">
            <div><b>Período:</b> {rangoStr}</div>
            <div><b>Tipo:</b> {inv.periodo}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        {/* RESUMEN PRINCIPAL */}
        {/* RESUMEN PRINCIPAL */}
<div className="grid grid-cols-4 gap-3 text-sm mb-4">
  <div>
    <div style={{ fontWeight: 700 }}>Ventas totales</div>
    <div>{fmt(inv.resumen.ventas)}</div>
  </div>
  <div>
    <div style={{ fontWeight: 700 }}>Deuda del día</div>
    <div>{fmt(inv.resumen.deudaDelDia)}</div>
  </div>
  <div>
    <div style={{ fontWeight: 700 }}>Efectivo neto</div>
    <div>{fmt(inv.resumen.efectivoNeto)}</div>
  </div>
  <div>
    <div style={{ fontWeight: 700 }}>Transferencias</div>
    <div>{fmt(inv.resumen.transferencias)}</div>
  </div>
</div>

        {/* SECCIÓN: VENTAS */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Ventas del período</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>#</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th style={{ width: "14%" }}>Total</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "12%" }}>Vuelto</th>
            </tr>
          </thead>
          <tbody>
            {(inv.ventas || []).map((f: any, i: number) => {
              const c = parseNum(f?.payments?.cash || 0);
              const t = parseNum(f?.payments?.transfer || 0);
              const vu = parseNum(f?.payments?.change || 0);
              return (
                <tr key={f.id}>
                  <td style={{ textAlign: "right" }}>{String(f.number || i + 1).padStart(4, "0")}</td>
                  <td>{f.client_name}</td>
                  <td>{f.vendor_name}</td>
                  <td style={{ textAlign: "right" }}>{fmt(f.total)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(c)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(t)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(vu)}</td>
                </tr>
              );
            })}
            {(!inv.ventas || inv.ventas.length === 0) && (
              <tr><td colSpan={7}>Sin ventas en el período.</td></tr>
            )}
          </tbody>
        </table>
            {/* 👇👇👇 NUEVA SECCIÓN: DETALLE DE APLICACIÓN DE PAGOS DE DEUDORES */}
{(inv.detalleAplicacionPagos || []).length > 0 && (
  <>
    <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
    <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>
      DETALLE DE APLICACIÓN DE PAGOS DE DEUDORES
    </div>
    
    {inv.detalleAplicacionPagos.map((pagoDetalle: any, index: number) => (
      <div key={pagoDetalle.pago_id} style={{ marginBottom: 16, border: "1px solid #000", padding: 10 }}>
        {/* Encabezado del pago */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <div style={{ fontWeight: 700 }}>Pago de {pagoDetalle.cliente}</div>
            <div style={{ fontSize: 11 }}>
              {new Date(pagoDetalle.fecha_pago).toLocaleString("es-AR")}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontWeight: 700, fontSize: 16, color: "#10b981" }}>
              {fmt(pagoDetalle.total_pagado)}
            </div>
            <div style={{ fontSize: 11 }}>
              Efectivo: {fmt(pagoDetalle.efectivo)} • Transferencia: {fmt(pagoDetalle.transferencia)}
            </div>
          </div>
        </div>

        {/* Detalle de aplicación por factura */}
        <table className="print-table text-sm" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", width: "15%" }}>Factura</th>
              <th style={{ textAlign: "left", width: "20%" }}>Fecha Factura</th>
              <th style={{ textAlign: "right", width: "15%" }}>Total Factura</th>
              <th style={{ textAlign: "right", width: "15%" }}>Deuda Antes</th>
              <th style={{ textAlign: "right", width: "15%" }}>Monto Aplicado</th>
              <th style={{ textAlign: "right", width: "15%" }}>Deuda Después</th>
            </tr>
          </thead>
          <tbody>
            {pagoDetalle.aplicaciones
              .filter((app: any) => app.factura_numero)
              .map((app: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ textAlign: "left" }}>#{pad(app.factura_numero)}</td>
                  <td style={{ textAlign: "left" }}>
                    {new Date(app.fecha_factura).toLocaleDateString("es-AR")}
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(app.total_factura)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(app.deuda_antes)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                    {fmt(app.monto_aplicado)}
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(app.deuda_despues)}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Saldo a favor aplicado */}
        {pagoDetalle.aplicaciones.filter((app: any) => app.tipo === "saldo_favor").length > 0 && (
          <div className="mt-2 text-sm">
            <div style={{ fontWeight: 600 }}>Saldo a favor acreditado:</div>
            {pagoDetalle.aplicaciones
              .filter((app: any) => app.tipo === "saldo_favor")
              .map((app: any, idx: number) => (
                <div key={idx} style={{ color: "#3b82f6" }}>
                  {fmt(app.monto_aplicado)} - {app.descripcion}
                </div>
              ))}
          </div>
        )}

        {/* Resumen del pago */}
        <div style={{ borderTop: "1px solid #000", marginTop: 8, paddingTop: 8 }}>
          <div className="flex justify-between items-center text-sm">
            <span style={{ fontWeight: 700 }}>TOTAL APLICADO:</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>
              {fmt(pagoDetalle.aplicaciones.reduce((sum: number, app: any) => sum + app.monto_aplicado, 0))}
            </span>
          </div>
        </div>
      </div>
    ))}
  </>
)}

{(!inv.detalleAplicacionPagos || inv.detalleAplicacionPagos.length === 0) && (
  <>
    <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
    <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Pagos de Deudores del Día</div>
    <div className="text-sm text-slate-400">Sin pagos de deudores en el día.</div>
  </>
)}

        {/* SECCIÓN: GASTOS */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Gastos</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Fecha</th>
              <th>Detalle</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "24%" }}>Alias</th>
            </tr>
          </thead>
          <tbody>
            {(inv.gastos || []).map((g: any, i: number) => (
              <tr key={g.id || i}>
                <td>{new Date(g.date_iso).toLocaleString("es-AR")}</td>
                <td>{g.tipo} — {g.detalle}</td>
                <td style={{ textAlign: "right" }}>{fmt(g.efectivo)}</td>
                <td style={{ textAlign: "right" }}>{fmt(g.transferencia)}</td>
                <td>{g.alias || "—"}</td>
              </tr>
            ))}
            {(!inv.gastos || inv.gastos.length === 0) && (
              <tr><td colSpan={5}>Sin gastos.</td></tr>
            )}
          </tbody>
        </table>

        {/* SECCIÓN: DEVOLUCIONES */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Devoluciones</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Fecha</th>
              <th>Cliente</th>
              <th style={{ width: "14%" }}>Método</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "14%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.devoluciones || []).map((d: any, i: number) => (
              <tr key={d.id || i}>
                <td>{new Date(d.date_iso).toLocaleString("es-AR")}</td>
                <td>{d.client_name}</td>
                <td style={{ textTransform: "capitalize" }}>{d.metodo}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.efectivo)}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.transferencia)}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.total)}</td>
              </tr>
            ))}
            {(!inv.devoluciones || inv.devoluciones.length === 0) && (
              <tr><td colSpan={6}>Sin devoluciones.</td></tr>
            )}
          </tbody>
        </table>

        {/* SECCIÓN: Transferencias por alias (ventas) */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Transferencias por alias (ventas)</div>
        
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th>Alias</th>
              <th style={{ width: "18%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.transferenciasPorAlias || []).map((a: any, i: number) => (
              <tr key={a.alias || i}>
                <td>{a.alias}</td>
                <td style={{ textAlign: "right" }}>{fmt(a.total)}</td>
              </tr>
            ))}
            {(!inv.transferenciasPorAlias || inv.transferenciasPorAlias.length === 0) && (
              <tr><td colSpan={2}>Sin transferencias en ventas.</td></tr>
            )}
          </tbody>
        </table>
        {/* 👇👇👇 NUEVA SECCIÓN: DEUDORES ACTIVOS */}
<div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
<div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Deudores Activos</div>
<table className="print-table text-sm">
  <thead>
    <tr>
      <th>Cliente</th>
      <th style={{ width: "18%" }}>Deuda Actual</th>
      <th style={{ width: "18%" }}>Saldo a Favor</th>
      <th style={{ width: "18%" }}>Deuda Neta</th>
    </tr>
  </thead>
  <tbody>
    {(inv.deudoresActivos || []).map((deudor: any, i: number) => (
      <tr key={deudor.id || i}>
        <td>{deudor.name}</td>
        <td style={{ textAlign: "right" }}>{fmt(deudor.deuda)}</td>
        <td style={{ textAlign: "right" }}>{fmt(deudor.saldoFavor)}</td>
        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(deudor.deudaNeta)}</td>
      </tr>
    ))}
    {(!inv.deudoresActivos || inv.deudoresActivos.length === 0) && (
      <tr><td colSpan={4}>No hay deudores activos.</td></tr>
    )}
  </tbody>
</table>

        {/* FINAL: FLUJO DE CAJA (EFECTIVO) */}
        <div style={{ borderTop: "1px solid #000", margin: "14px 0 8px" }} />
        <div className="text-center" style={{ fontWeight: 900, fontSize: 24, letterSpacing: 1 }}>
          FLUJO DE CAJA (EFECTIVO): {fmt(inv.resumen.flujoCajaEfectivo)}
        </div>

        <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
      </div>
    </div>
  );
}
  // ==== PLANTILLA: DETALLE DE DEUDAS ====
if (inv?.type === "DetalleDeuda") {
  const fmt = (n: number) => money(parseNum(n));
  
  return (
    <div className="only-print print-area p-14">
      <div className="max-w-[780px] mx-auto text-black">
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1 }}>DETALLE DE DEUDAS</div>
            <div style={{ marginTop: 2 }}>MITOBICEL</div>
          </div>
          <div className="text-right">
            <div><b>Fecha:</b> {new Date().toLocaleString("es-AR")}</div>
            <div><b>Cliente:</b> {inv.cliente.name}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        {/* RESUMEN */}
        <div className="grid grid-cols-3 gap-4 text-sm mb-6" style={{ border: "1px solid #000", padding: 12 }}>
          <div className="text-center">
            <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(inv.deudaTotal)}</div>
            <div>Deuda Total</div>
          </div>
          <div className="text-center">
            <div style={{ fontWeight: 700, fontSize: 18 }}>{inv.detalleDeudas.length}</div>
            <div>Facturas Pendientes</div>
          </div>
          <div className="text-center">
            <div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(inv.saldoFavor)}</div>
            <div>Saldo a Favor</div>
          </div>
        </div>

        {/* DETALLE POR FACTURA */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Detalle por Factura</div>
        
        {inv.detalleDeudas.map((deuda: any, index: number) => (
          <div key={index} style={{ border: "1px solid #000", marginBottom: 12, padding: 10 }}>
            {/* ENCABEZADO FACTURA */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <div style={{ fontWeight: 700 }}>Factura #{pad(deuda.factura_numero)}</div>
                <div style={{ fontSize: 11 }}>{new Date(deuda.fecha).toLocaleDateString("es-AR")}</div>
              </div>
              <div className="text-right">
                <div style={{ fontWeight: 700, fontSize: 16, color: "#f59e0b" }}>
                  {fmt(deuda.monto_debe)}
                </div>
                <div style={{ fontSize: 11 }}>
                  Total: {fmt(deuda.monto_total)} • Pagado: {fmt(deuda.monto_pagado)}
                </div>
              </div>
            </div>

            {/* ITEMS */}
            <table className="print-table text-sm" style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: "60%" }}>Producto</th>
                  <th style={{ textAlign: "center", width: "15%" }}>Cant.</th>
                  <th style={{ textAlign: "right", width: "25%" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {deuda.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "left" }}>{item.name}</td>
                    <td style={{ textAlign: "center" }}>{item.qty}</td>
                    <td style={{ textAlign: "right" }}>
                      {money(parseNum(item.qty) * parseNum(item.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* TOTAL FINAL */}
        <div style={{ borderTop: "2px solid #000", margin: "16px 0 8px", paddingTop: 8 }}>
          <div className="flex justify-between items-center" style={{ fontWeight: 900, fontSize: 18 }}>
            <span>DEUDA TOTAL DEL CLIENTE:</span>
            <span>{fmt(inv.deudaTotal)}</span>
          </div>
        </div>

        <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
      </div>
    </div>
  );
}

// ==== PLANTILLA: COMPROBANTE DE DEVOLUCIÓN ====
if (inv?.type === "Devolucion") {
  const fmt = (n: number) => money(parseNum(n));
  
  return (
    <div className="only-print print-area p-14">
      <div className="max-w-[780px] mx-auto text-black">
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1 }}>COMPROBANTE DE DEVOLUCIÓN</div>
            <div style={{ marginTop: 2 }}>MITOBICEL</div>
          </div>
          <div className="text-right">
            <div><b>Fecha:</b> {new Date(inv.date_iso).toLocaleString("es-AR")}</div>
            <div><b>N° Comprobante:</b> {inv.id}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div style={{ fontWeight: 700 }}>Cliente</div>
            <div>{inv.client_name}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Método de Devolución</div>
            <div className="capitalize">{inv.metodo}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Productos Devueltos</div>
        
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>#</th>
              <th>Descripción</th>
              <th style={{ width: "12%" }}>Cant. Dev.</th>
              <th style={{ width: "18%" }}>Precio Unit.</th>
              <th style={{ width: "18%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
          {inv.items.map((it: any, i: number) => (
  <tr key={i}>
    <td style={{ textAlign: "right" }}>{i + 1}</td>
    
    <td>
      {it.name}
      {/* 👇 AQUÍ ESTÁ EL CAMBIO - Agregar la sección */}
      <div style={{ fontSize: "10px", color: "#666", fontStyle: "italic" }}>
        {it.section || "General"}
      </div>
    </td>
    
    <td style={{ textAlign: "right" }}>{parseNum(it.qtyDevuelta)}</td>
    <td style={{ textAlign: "right" }}>{money(parseNum(it.unitPrice))}</td>
    <td style={{ textAlign: "right" }}>
      {money(parseNum(it.qtyDevuelta) * parseNum(it.unitPrice))}
    </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                Total Devolución
              </td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{money(inv.total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Información de pagos/diferencias */}
        {(inv.efectivo > 0 || inv.transferencia > 0 || inv.extra_pago_total > 0) && (
          <>
            <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
            <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Detalles de Pago</div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              {inv.efectivo > 0 && (
                <div>
                  <div>Efectivo Devuelto:</div>
                  <div style={{ fontWeight: 600 }}>{money(inv.efectivo)}</div>
                </div>
              )}
              {inv.transferencia > 0 && (
                <div>
                  <div>Transferencia Devuelta:</div>
                  <div style={{ fontWeight: 600 }}>{money(inv.transferencia)}</div>
                </div>
              )}
              {inv.extra_pago_efectivo > 0 && (
                <div>
                  <div>Pago Diferencia (Efectivo):</div>
                  <div style={{ fontWeight: 600 }}>{money(inv.extra_pago_efectivo)}</div>
                </div>
              )}
              {inv.extra_pago_transferencia > 0 && (
                <div>
                  <div>Pago Diferencia (Transferencia):</div>
                  <div style={{ fontWeight: 600 }}>{money(inv.extra_pago_transferencia)}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Información específica por método */}
        {inv.metodo === "saldo" && (
          <div className="mt-4 p-3 bg-slate-100 rounded text-sm">
            <div style={{ fontWeight: 700 }}>Acreditado como Saldo a Favor</div>
            <div>El monto de {money(inv.total)} ha sido acreditado al saldo a favor del cliente.</div>
          </div>
        )}

        {inv.metodo === "intercambio_otro" && inv.extra_pago_total > 0 && (
          <div className="mt-4 p-3 bg-slate-100 rounded text-sm">
            <div style={{ fontWeight: 700 }}>Diferencia Pagada</div>
            <div>El cliente abonó {money(inv.extra_pago_total)} por la diferencia del intercambio.</div>
          </div>
        )}

        <div className="mt-6 text-center text-sm">
          <div style={{ fontWeight: 700 }}>¡Gracias por su confianza!</div>
          <div>Para consultas o reclamos, presente este comprobante</div>
        </div>

        <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
      </div>
    </div>
  );
}

       



  // ==== PLANTILLA: TICKET ====
  if (ticket) {
    return (
      <div className="only-print print-area p-14">
        <div className="max-w-[520px] mx-auto text-black">
          <div className="text-center">
            <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 20 }}>TICKET DE TURNO</div>
            <div style={{ marginTop: 2, fontSize: 12 }}>MITOBICEL</div>
          </div>

          <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

          <div className="text-sm space-y-1">
            <div>
              <b>Código:</b> {ticket.id}
            </div>
            <div>
              <b>Cliente:</b> {ticket.client_name} (N° {ticket.client_number})
            </div>
            <div>
              <b>Acción:</b> {ticket.action}
            </div>
            <div>
              <b>Fecha:</b> {new Date(ticket.date_iso).toLocaleString("es-AR")}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

          <div className="text-sm" style={{ lineHeight: 1.35 }}>
            POR FAVOR ESPERE A VER SU NÚMERO EN PANTALLA PARA INGRESAR A HACER SU PEDIDO
            O GESTIONAR SU DEVOLUCIÓN.
          </div>

          <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
        </div>
      </div>
    );
  }

  // ==== PLANTILLA: FACTURA ====
  const paidCash = parseNum(inv?.payments?.cash || 0);
  const paidTransf = parseNum(inv?.payments?.transfer || 0);
 const change = parseNum(inv?.payments?.change || 0);
const paid   = paidCash + paidTransf;                   // lo que entregó
const net    = Math.max(0, paid - change);              // lo que aplica
const balance = Math.max(0, parseNum(inv.total) - net);
const fullyPaid = balance <= 0.009;

 
  const clientDebtTotal = parseNum(inv?.client_debt_total ?? 0);

 return (
  <div className="only-print print-area p-14">
    <div className="max-w-[780px] mx-auto text-black">
      <div className="flex items-start justify-between">
        <div>
          <div style={{ fontWeight: 800, letterSpacing: 1 }}>
            {inv?.type === "Presupuesto" ? "PRESUPUESTO" : "FACTURA"}
          </div>
          <div style={{ marginTop: 2 }}>MITOBICEL</div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #000", margin: "10px 0 6px" }} />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div style={{ fontWeight: 700 }}>Cliente</div>
          <div>{inv.client_name}</div>
        </div>
        <div className="text-right">
          <div>
            <b>Factura Nº:</b> {pad(inv.number)}
          </div>
          <div>
            <b>Fecha:</b> {new Date(inv.date_iso).toLocaleDateString("es-AR")}
          </div>
          <div>
            <b>Estado del pago:</b> {fullyPaid ? "Pagado" : "Pendiente"}
          </div>
        </div>
      </div>

      <table className="print-table text-sm" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th style={{ width: "6%" }}>#</th>
            <th>Descripción de artículo</th>
            <th style={{ width: "12%" }}>Cantidad</th>
            <th style={{ width: "18%" }}>Precio</th>
            <th style={{ width: "18%" }}>Total</th>
          </tr>
        </thead>
  <tbody>
  {inv.items.map((it: any, i: number) => (
    <tr key={i}>
      <td style={{ textAlign: "right" }}>{i + 1}</td>
      
      <td>
        {it.name}
        {/* 👇 AQUÍ ESTÁ EL CAMBIO - Agregar la sección */}
        <div style={{ fontSize: "10px", color: "#666", fontStyle: "italic" }}>
          {it.section || "General"}
        </div>
      </td>
      
      <td style={{ textAlign: "right" }}>{parseNum(it.qty)}</td>
      <td style={{ textAlign: "right" }}>{money(parseNum(it.unitPrice))}</td>
      <td style={{ textAlign: "right" }}>
        {money(parseNum(it.qty) * parseNum(it.unitPrice))}
      </td>
    </tr>
  ))}
</tbody>

        {/* ===== tfoot corregido (un solo tfoot, sin anidar) ===== */}
        <tfoot>
          <tr>
            <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
              Total
            </td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{money(inv.total)}</td>
          </tr>

          {/* debajo de la fila Total */}
          {typeof inv?.payments?.saldo_aplicado === "number" &&
            inv.payments.saldo_aplicado > 0 && (
              <>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right" }}>
                    Saldo a favor aplicado
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {money(parseNum(inv.payments.saldo_aplicado))}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                    Total luego de saldo
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {money(
                      parseNum(
                        inv.total_after_credit ??
                          (inv.total - inv.payments.saldo_aplicado)
                      )
                    )}
                  </td>
                </tr>
              </>
            )}
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-2 text-sm" style={{ marginTop: 8 }}>
        <div />
        <div>
          <div>
            <b>Método de pago:</b>
          </div>
          <div>CONTADO: {money(paidCash)}</div>
          <div>TRANSFERENCIA: {money(paidTransf)}</div>
          {inv?.payments?.change ? (
            <div>VUELTO: {money(parseNum(inv.payments.change))}</div>
          ) : null}
          {inv?.payments?.alias && (
            <div>Alias/CVU destino: {inv.payments.alias}</div>
          )}
          <div style={{ marginTop: 6 }}>
            <b>Cantidad pagada:</b> {money(paid)}
          </div>

          <div>
            <b>Cantidad adeudada:</b> {money(balance)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Total adeudado como cliente:</b> {money(clientDebtTotal)}
          </div>
        </div>
      </div>

      {fullyPaid && (
        <div
          style={{
            position: "fixed",
            top: "55%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-20deg)",
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: 4,
            opacity: 0.08,
          }}
        >
          PAGADO
        </div>
      )}

      <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
    </div>
  </div>
);
  } 

function Login({ onLogin, vendors, adminKey, clients }: any) {
  const [role, setRole] = useState("vendedor");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [clientNumber, setClientNumber] = useState("");

  const APP_TITLE = "Sistema de Gestión y Facturación — By Tobias Carrizo";

  function handleSubmit(e: any) {
    e.preventDefault();

    if (role === "admin") {
      if (key === adminKey) onLogin({ role: "admin", name: "Admin", id: "admin" });
      else alert("Clave de administrador incorrecta.");
      return;
    }

    if (role === "vendedor") {
      const v = vendors.find(
        (v: any) =>
          (v.name.toLowerCase() === name.trim().toLowerCase() || v.id === name.trim()) &&
          v.key === key
      );
      if (v) onLogin({ role: "vendedor", name: v.name, id: v.id });
      else alert("Vendedor o clave incorrecta.");
      return;
    }

    // CLIENTE - Panel normal
    if (role === "cliente") {
      const num = parseInt(String(clientNumber), 10);
      if (!num) {
        alert("Ingrese un número de cliente válido.");
        return;
      }
      const cl = clients.find((c: any) => parseInt(String(c.number), 10) === num);
      if (!cl) {
        alert("N° de cliente no encontrado.");
        return;
      }
      onLogin({ role: "cliente", name: cl.name, id: cl.id, number: cl.number });
      return;
    }

    // 👇👇👇 NUEVO: PEDIDO ONLINE
    if (role === "pedido-online") {
      const num = parseInt(String(clientNumber), 10);
      if (!num) {
        alert("Ingrese un número de cliente válido.");
        return;
      }
      const cl = clients.find((c: any) => parseInt(String(c.number), 10) === num);
      if (!cl) {
        alert("N° de cliente no encontrado.");
        return;
      }
      onLogin({ 
        role: "pedido-online", 
        name: cl.name, 
        id: cl.id, 
        number: cl.number 
      });
      return;
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold">{APP_TITLE}</h1>
          <p className="text-slate-400 text-sm">
            {hasSupabase ? "Conectado a Supabase" : "Datos en navegador"}
          </p>
        </div>

    
        <Card title="Ingreso">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Select
              label="Rol"
              value={role}
              onChange={setRole}
              options={[
                { value: "vendedor", label: "Vendedor" },
                { value: "admin", label: "Admin" },
                { value: "cliente", label: "Cliente - Panel Presencial" },
                { value: "pedido-online", label: "Hacer Pedido Online" }, // 👈 NUEVA OPCIÓN
              ]}
            />

            {role === "vendedor" && (
              <>
                <Input
                  label="Vendedor (nombre o ID)"
                  value={name}
                  onChange={setName}
                  placeholder="Ej: Tobi o v1"
                />
                <Input
                  label="Clave"
                  value={key}
                  onChange={setKey}
                  placeholder="Clave asignada"
                  type="password"
                />
              </>
            )}

            {role === "admin" && (
              <Input
                label="Clave admin"
                value={key}
                onChange={setKey}
                placeholder="Clave de administrador"
                type="password"
              />
            )}

            {(role === "cliente" || role === "pedido-online") && (
              <NumberInput
                label="N° de cliente"
                value={clientNumber}
                onChange={setClientNumber}
                placeholder="Ej: 1001"
              />
            )}

            <div className="flex items-center justify-end">
              <Button type="submit">Entrar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ===== Página principal ===== */
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

    // Agregar esta parte para sincronización en tiempo real:
    if (hasSupabase) {
      // Suscripción para presupuestos
      const budgetSubscription = supabase
        .channel('budgets-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets'
          },
          async () => {
            // Recargar los presupuestos cuando haya cambios
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
          }
        )
        .subscribe();

      // 👇👇👇 AGREGAR ESTA SUSCRIPCIÓN PARA FACTURAS
      const invoicesSubscription = supabase
        .channel('invoices-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'invoices'
          },
          async () => {
            // Recargar las facturas cuando haya cambios
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
          }
        )
        .subscribe();

      // 👇👇👇 NUEVA SUSCRIPCIÓN PARA PEDIDOS ONLINE
      const pedidosSubscription = supabase
        .channel('pedidos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pedidos'
          },
          async () => {
            // Recargar los pedidos cuando haya cambios
            const refreshedState = await loadFromSupabase(seedState());
            setState(refreshedState);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(budgetSubscription);
        supabase.removeChannel(invoicesSubscription);
        supabase.removeChannel(pedidosSubscription); // 👈 AGREGAR ESTA LÍNEA
      };
    }
  }, []);

  function onLogin(user: any) {
    setSession(user);
    // 👇👇👇 MODIFICAR ESTA LÍNEA para manejar el nuevo rol
    if (user.role === "pedido-online") {
      setTab("Hacer Pedido");
    } else {
      setTab(user.role === "cliente" ? "Panel" : "Facturación");
    }
  }

  function onLogout() {
    setSession(null);
  }
 /* ===== Ingresar Stock ===== */
function IngresarStockTab({ state, setState, session }: any) {
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [cantidadIngresar, setCantidadIngresar] = useState("");
  const [precioCosto, setPrecioCosto] = useState("");
  const [mensajeAlerta, setMensajeAlerta] = useState("");
  const [filtroSeccion, setFiltroSeccion] = useState("Todas"); // 👈 NUEVO FILTRO
  const [busqueda, setBusqueda] = useState(""); // 👈 NUEVA BÚSQUEDA

  // Obtener todas las secciones únicas
  const secciones = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.section || "General")))];

  // Filtrar productos por sección y búsqueda
  const productosFiltrados = state.products.filter((p: any) => {
    const coincideSeccion = filtroSeccion === "Todas" || p.section === filtroSeccion;
    const coincideBusqueda = !busqueda || 
      p.name.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.section && p.section.toLowerCase().includes(busqueda.toLowerCase()));
    
    return coincideSeccion && coincideBusqueda;
  });

  // Obtener el producto seleccionado
  const producto = state.products.find((p: any) => p.id === productoSeleccionado);

  // Cuando se selecciona un producto, cargar su precio de costo actual
  useEffect(() => {
    if (producto) {
      setPrecioCosto(String(producto.cost || ""));
    } else {
      setPrecioCosto("");
    }
    setMensajeAlerta("");
  }, [productoSeleccionado]);

  // Verificar si el precio es mayor al actual
  useEffect(() => {
    if (producto && precioCosto) {
      const costoActual = parseNum(producto.cost || 0);
      const costoNuevo = parseNum(precioCosto);
      
      if (costoNuevo > costoActual && costoActual > 0) {
        const diferencia = costoNuevo - costoActual;
        const porcentaje = ((diferencia / costoActual) * 100).toFixed(1);
        setMensajeAlerta(`⚠️ ATENCIÓN: El nuevo costo es ${porcentaje}% MAYOR al actual (${money(costoActual)} → ${money(costoNuevo)})`);
      } else if (costoNuevo < costoActual && costoActual > 0) {
        const diferencia = costoActual - costoNuevo;
        const porcentaje = ((diferencia / costoActual) * 100).toFixed(1);
        setMensajeAlerta(`✅ El nuevo costo es ${porcentaje}% MENOR al actual (${money(costoActual)} → ${money(costoNuevo)})`);
      } else {
        setMensajeAlerta("");
      }
    }
  }, [precioCosto, producto]);

  async function ingresarStock() {
    if (!productoSeleccionado) {
      alert("Seleccioná un producto.");
      return;
    }
    
    const cantidad = parseNum(cantidadIngresar);
    const costo = parseNum(precioCosto);
    
    if (cantidad <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }
    
    if (costo <= 0) {
      alert("El precio de costo debe ser mayor a 0.");
      return;
    }

    // Confirmar si el costo es mucho mayor
    const costoActual = parseNum(producto.cost || 0);
    if (costo > costoActual * 1.5 && costoActual > 0) { // 50% más caro
      const confirmar = confirm(
        `¿Estás seguro? El costo nuevo es más del 50% mayor:\n\n` +
        `Costo actual: ${money(costoActual)}\n` +
        `Costo nuevo: ${money(costo)}\n\n` +
        `¿Ingresar igualmente?`
      );
      if (!confirmar) return;
    }

    const st = clone(state);
    const productoActualizado = st.products.find((p: any) => p.id === productoSeleccionado);
    
    if (productoActualizado) {
      // Actualizar stock
      productoActualizado.stock = parseNum(productoActualizado.stock) + cantidad;
      // Actualizar costo
      productoActualizado.cost = costo;
      
      setState(st);

      // Persistir en Supabase
      if (hasSupabase) {
        await supabase
          .from("products")
          .update({
            stock: productoActualizado.stock,
            cost: productoActualizado.cost
          })
          .eq("id", productoSeleccionado);
      }

      alert(`✅ Stock actualizado:\n${producto.name}\nStock: +${cantidad} unidades\nNuevo costo: ${money(costo)}`);

      // Limpiar formulario
      setCantidadIngresar("");
      setPrecioCosto("");
      setProductoSeleccionado("");
      setMensajeAlerta("");
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4"> {/* 👈 Aumenté el max-width */}
      <Card title="Ingresar Stock">
        <div className="space-y-4">
          {/* Filtros de búsqueda */}
          <div className="grid md:grid-cols-3 gap-3"> {/* 👈 NUEVOS FILTROS */}
            <Select
              label="Filtrar por Sección"
              value={filtroSeccion}
              onChange={setFiltroSeccion}
              options={secciones.map((sec: any) => ({ value: sec, label: sec }))}
            />
            <Input
              label="Buscar Producto"
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Nombre o sección..."
            />
            <div className="pt-6">
              <Chip tone="emerald">
                {productosFiltrados.length} producto(s)
              </Chip>
            </div>
          </div>

          {/* Selección de producto */}
          <Select
            label="Seleccionar Producto"
            value={productoSeleccionado}
            onChange={setProductoSeleccionado}
            options={[
              { value: "", label: "— Seleccionar producto —" },
              ...productosFiltrados.map((p: any) => ({
                value: p.id,
                label: `${p.name} - ${p.section} - Stock: ${p.stock || 0} - Costo: ${money(p.cost || 0)}`
              }))
            ]}
          />

          {/* Información del producto seleccionado */}
          {producto && (
            <div className="p-3 bg-slate-800/30 rounded-lg">
              <div className="text-sm font-semibold">Información del Producto</div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div>Nombre: <span className="font-medium">{producto.name}</span></div>
                <div>Sección: <span className="font-medium">{producto.section}</span></div>
                <div>Stock actual: <span className="font-medium">{producto.stock || 0} unidades</span></div>
                <div>Costo actual: <span className="font-medium">{money(producto.cost || 0)}</span></div>
              </div>
            </div>
          )}

          {/* Campos para ingresar datos */}
          <div className="grid md:grid-cols-2 gap-3">
            <NumberInput
              label="Cantidad a Ingresar"
              value={cantidadIngresar}
              onChange={setCantidadIngresar}
              placeholder="Ej: 100"
            />
            <NumberInput
              label="Precio de Costo Unitario"
              value={precioCosto}
              onChange={setPrecioCosto}
              placeholder="Ej: 150.50"
            />
          </div>

          {/* Alerta de precio */}
          {mensajeAlerta && (
            <div className={`p-3 rounded-lg text-sm ${
              mensajeAlerta.includes("MAYOR") 
                ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-200" 
                : "bg-green-500/20 border border-green-500/50 text-green-200"
            }`}>
              {mensajeAlerta}
            </div>
          )}

          {/* Resumen */}
          {producto && cantidadIngresar && precioCosto && (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm font-semibold">Resumen del Ingreso</div>
              <div className="text-sm mt-2 space-y-1">
                <div>Stock actual: <span className="font-medium">{producto.stock || 0}</span></div>
                <div>+ Cantidad a ingresar: <span className="font-medium">{parseNum(cantidadIngresar)}</span></div>
                <div>= Stock final: <span className="font-medium text-emerald-400">
                  {(producto.stock || 0) + parseNum(cantidadIngresar)}
                </span></div>
                <div className="mt-2">Inversión total: <span className="font-medium text-amber-400">
                  {money(parseNum(cantidadIngresar) * parseNum(precioCosto))}
                </span></div>
              </div>
            </div>
          )}

          {/* Botón de acción */}
          <div className="flex justify-end">
            <Button 
              onClick={ingresarStock}
              disabled={!productoSeleccionado || !cantidadIngresar || !precioCosto}
            >
              ✅ Ingresar Stock y Actualizar Costo
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de productos con bajo stock - TAMBIÉN CON FILTROS */}
      <Card title="Productos con Bajo Stock">
        {/* Filtros para productos con bajo stock */}
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <Select
            label="Filtrar por Sección"
            value={filtroSeccion}
            onChange={setFiltroSeccion}
            options={secciones.map((sec: any) => ({ value: sec, label: sec }))}
          />
          <Input
            label="Buscar Producto"
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Nombre o sección..."
          />
        </div>

        <div className="space-y-2">
          {productosFiltrados
            .filter((p: any) => parseNum(p.stock) < parseNum(p.stock_minimo || 10))
            .map((p: any) => (
              <div key={p.id} className="flex justify-between items-center p-2 bg-red-500/10 border border-red-500/30 rounded">
                <div className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-slate-400 ml-2">({p.section})</span>
                </div>
                <div className="text-sm text-red-300">
                  Stock: {p.stock || 0} / Mínimo: {p.stock_minimo || 10}
                </div>
              </div>
            ))}
          
          {productosFiltrados.filter((p: any) => parseNum(p.stock) < parseNum(p.stock_minimo || 10)).length === 0 && (
            <div className="text-center text-slate-400 py-4">
              No hay productos con bajo stock ✅
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

  return (
    <>
      {/* App visible (no se imprime) */}
      <div className="min-h-screen bg-slate-950 text-slate-100 no-print">
        <style>{`::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:#0b1220}::-webkit-scrollbar-thumb{background:#22304a;border-radius:8px}::-webkit-scrollbar-thumb:hover{background:#2f436a}`}</style>

        {!session ? (
          <Login
            onLogin={onLogin}
            vendors={state.vendors}
            adminKey={state.auth.adminKey}
            clients={state.clients}
          />
        ) : (
          <>
            <Navbar current={tab} setCurrent={setTab} role={session.role} onLogout={onLogout} />

            {/* Panel de cliente */}
            {session.role === "cliente" && tab === "Panel" && (
              <ClientePanel state={state} setState={setState} session={session} />
            )}

            {/* 👇👇👇 NUEVO: Panel de Pedidos Online */}
            {session.role === "pedido-online" && tab === "Hacer Pedido" && (
              <PedidosOnlineTab state={state} setState={setState} session={session} />
            )}

            {/* Vendedor / Admin */}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Facturación" && (
              <FacturacionTab state={state} setState={setState} session={session} />
            )}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Clientes" && (
              <ClientesTab state={state} setState={setState} />
            )}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Productos" && (
              <ProductosTab state={state} setState={setState} role={session.role} />
            )}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Deudores" && (
              <DeudoresTab state={state} setState={setState} />
            )}
            {/* Cola */}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Cola" && (
              <ColaTab state={state} setState={setState} session={session} />
            )}
            {session.role === "admin" && session.role !== "pedido-online" && tab === "Vendedores" && (
              <VendedoresTab state={state} setState={setState} />
            )}
            {session.role === "admin" && session.role !== "pedido-online" && tab === "Reportes" && (
              <ReportesTab state={state} setState={setState} session={session} />
            )}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Presupuestos" && (
              <PresupuestosTab state={state} setState={setState} session={session} />
            )}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Gastos y Devoluciones" && (
              <GastosDevolucionesTab state={state} setState={setState} session={session} />
            )}
            {/* 👇👇👇 NUEVA PESTAÑA: Gestión de Pedidos Online */}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Pedidos Online" && (
              <GestionPedidosTab state={state} setState={setState} session={session} />
            )}
           {/* 👇👇👇 NUEVA PESTAÑA: Ingresar Stock */}
{session.role !== "cliente" && session.role !== "pedido-online" && tab === "Ingresar Stock" && (
  <IngresarStockTab state={state} setState={setState} session={session} />
)}


            <div className="fixed bottom-3 right-3 text-[10px] text-slate-500 select-none">
              {hasSupabase ? "Supabase activo" : "Datos en navegador"}
            </div>
          </>
        )}
      </div>
      

      {/* Plantillas que sí se imprimen */}
      <PrintArea />
    </>
  );
}

