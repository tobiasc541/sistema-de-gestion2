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
   comprobante_url?: string;
  comprobante_subido_at?: string;
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
type Comprobante = {
  id: string;
  factura_id?: string;
  debt_payment_id?: string;
  comprobante_url: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
};

// 👇👇👇 AGREGAR ESTE NUEVO TIPO PARA PAGOS DE DEUDA
type DebtPayment = {
  id: string;
  number: number;
  date_iso: string;
  client_id: string;
  client_name: string;
  vendor_id?: string;
  vendor_name?: string;
  cash_amount: number;
  transfer_amount: number;
  total_amount: number;
  alias?: string;
  saldo_aplicado?: number;
  debt_before: number;
  debt_after: number;
  aplicaciones?: any[];  // 👈 ESTA LÍNEA ES CRÍTICA
  deuda_real_antes?: number;
   comprobante_url?: string;
  comprobante_subido_at?: string;
};
type Cliente = {
  id: string;
  number: number;
  name: string;
  debt: number;
  saldo_favor: number;
  creado_por?: string; // Para saber quién creó el cliente
  fecha_creacion?: string;
  deuda_manual?: boolean; // Para identificar si la deuda fue asignada manualmente
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
    debt_payments: [] as DebtPayment[], // 👈 ESTA LÍNEA DEBE USAR EL TIPO DebtPayment
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
if (cliErr) { 
  console.error("SELECT clients:", cliErr); 
  alert("No pude leer 'clients' de Supabase."); 
}
if (clients) {
  out.clients = clients.map((c: any) => ({
    ...c,
    creado_por: c.creado_por || "sistema",
    fecha_creacion: c.fecha_creacion || c.date_iso || todayISO(),
    deuda_manual: c.deuda_manual || false
  }));
}

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
  // 👇👇👇 DESCOMENTAR Y CORREGIR ESTA SECCIÓN - Cargar debt_payments
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
/* ===== COMPONENTE SUBIR COMPROBANTE ===== */
function SubirComprobante({ tipo, id, session, onComprobanteSubido }: {
  tipo: 'factura' | 'debt_payment';
  id: string;
  session: any;
  onComprobanteSubido: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);

  const manejarSubida = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    // Validar que sea imagen
    if (!archivo.type.startsWith('image/')) {
      alert('Por favor, sube solo archivos de imagen (JPG, PNG, etc.)');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (archivo.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 5MB.');
      return;
    }

    setSubiendo(true);

    try {
      // 1. Subir archivo a Storage
      const comprobanteUrl = await subirComprobante(archivo, tipo, id);
      
      // 2. Asociar comprobante al registro
      await asociarComprobante(tipo, id, comprobanteUrl, session);
      
      alert('✅ Comprobante subido correctamente');
      onComprobanteSubido();
    } catch (error: any) {
      console.error('Error:', error);
      alert(`❌ Error al subir comprobante: ${error.message}`);
    } finally {
      setSubiendo(false);
      // Limpiar input
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept="image/*"
        onChange={manejarSubida}
        disabled={subiendo}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        title="Subir comprobante"
      />
      <button
        disabled={subiendo}
        className={`text-sm px-2 py-1 border rounded ${
          subiendo 
            ? 'bg-slate-600 text-slate-400 border-slate-700' 
            : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-500'
        }`}
      >
        {subiendo ? '📤 Subiendo...' : '📎 Comprobante'}
      </button>
    </div>
  );
}

/* ===== helpers de negocio ===== */
function ensureUniqueNumber(clients: any[]) {
  if (!clients || clients.length === 0) return 1000;
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
/* ===== FUNCIONES PARA COMPROBANTES ===== */
// Función para subir comprobante a Supabase Storage
async function subirComprobante(archivo: File, tipo: 'factura' | 'debt_payment', id: string): Promise<string> {
  if (!hasSupabase) {
    throw new Error('Supabase no está configurado');
  }

  try {
    // Crear nombre único para el archivo
    const extension = archivo.name.split('.').pop();
    const nombreArchivo = `${tipo}_${id}_${Date.now()}.${extension}`;
    const rutaStorage = `comprobantes/${nombreArchivo}`;

    // Subir archivo a Supabase Storage
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .upload(rutaStorage, archivo);

    if (error) {
      throw new Error(`Error al subir archivo: ${error.message}`);
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(rutaStorage);

    if (!urlData.publicUrl) {
      throw new Error('No se pudo obtener la URL pública del archivo');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error subiendo comprobante:', error);
    throw error;
  }
}

// Función para asociar comprobante a factura o debt_payment
async function asociarComprobante(
  tipo: 'factura' | 'debt_payment', 
  id: string, 
  comprobanteUrl: string,
  session: any
) {
  if (!hasSupabase) return;

  try {
    const ahora = todayISO();
    
    if (tipo === 'factura') {
      const { error } = await supabase
        .from('invoices')
        .update({
          comprobante_url: comprobanteUrl,
          comprobante_subido_at: ahora
        })
        .eq('id', id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('debt_payments')
        .update({
          comprobante_url: comprobanteUrl,
          comprobante_subido_at: ahora
        })
        .eq('id', id);

      if (error) throw error;
    }

    // También guardar en tabla comprobantes
    const { error: compError } = await supabase
      .from('comprobantes')
      .insert({
        [tipo === 'factura' ? 'factura_id' : 'debt_payment_id']: id,
        comprobante_url: comprobanteUrl,
        file_name: comprobanteUrl.split('/').pop() || 'comprobante.jpg',
        file_size: 0,
        uploaded_by: session?.name || 'sistema'
      });

    if (compError) console.warn('Error guardando en tabla comprobantes:', compError);

  } catch (error) {
    console.error('Error asociando comprobante:', error);
    throw error;
  }
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
// === Detalle de deudas por cliente - CORREGIDA ===
// === Detalle de deudas por cliente - CORREGIDA DEFINITIVAMENTE ===
function calcularDetalleDeudas(state: any, clientId: string): DetalleDeuda[] {
  if (!clientId) return [];
  
  const todasFacturas = (state.invoices || [])
    .filter((f: any) => 
      f.client_id === clientId && 
      f.type === "Factura"
    )
    .sort((a: any, b: any) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime());

  const detalleDeudas = todasFacturas.map((factura: any) => {
    const totalFactura = parseNum(factura.total);
    
    // 1. Pagos DIRECTOS de la factura (al momento de la compra)
    const pagosDirectos = 
      parseNum(factura?.payments?.cash || 0) + 
      parseNum(factura?.payments?.transfer || 0) + 
      parseNum(factura?.payments?.saldo_aplicado || 0);

    // 2. Pagos ADICIONALES desde debt_payments para ESTA factura específica
    const pagosAdicionales = (state.debt_payments || [])
      .filter((pago: any) => {
        return pago.client_id === clientId && 
               pago.aplicaciones?.some((app: any) => app.factura_id === factura.id);
      })
      .reduce((sum: number, pago: any) => {
        const aplicacion = pago.aplicaciones?.find((app: any) => app.factura_id === factura.id);
        return aplicacion ? sum + parseNum(aplicacion.monto_aplicado) : sum;
      }, 0);

    // 3. Devoluciones que afectan esta factura específica
    const devolucionesFactura = (state.devoluciones || [])
      .filter((dev: any) => {
        if (dev.client_id !== clientId) return false;
        // Buscar si esta devolución incluye productos de esta factura
        return dev.items?.some((item: any) => item.facturaId === factura.id);
      })
      .reduce((sum: number, dev: any) => {
        const itemsEstaFactura = dev.items?.filter((item: any) => item.facturaId === factura.id) || [];
        return sum + itemsEstaFactura.reduce((s: number, item: any) => 
          s + (parseNum(item.qtyDevuelta) * parseNum(item.unitPrice)), 0);
      }, 0);

    const totalPagos = pagosDirectos + pagosAdicionales;
    const montoDebe = Math.max(0, totalFactura - totalPagos - devolucionesFactura);

    return {
      factura_id: factura.id,
      factura_numero: factura.number,
      fecha: factura.date_iso,
      monto_total: totalFactura,
      monto_pagado: totalPagos,
      monto_debe: montoDebe,
      items: factura.items || [],
      devoluciones: devolucionesFactura
    };
  });

  // ✅ Filtrar solo facturas con deuda pendiente REAL
  return detalleDeudas.filter(deuda => deuda.monto_debe > 0.01);
}
// === Deuda total del cliente - CORREGIDA DEFINITIVAMENTE ===
// === Deuda total del cliente - CON SALDO A FAVOR APLICADO ===
function calcularDeudaTotal(detalleDeudas: DetalleDeuda[], cliente: any): number {
  if (!cliente) return 0;
  
  // ✅ Deuda de facturas pendientes
  const deudaFacturas = detalleDeudas.reduce((total, deuda) => total + deuda.monto_debe, 0);
  
  // ✅ Deuda manual del cliente
  const deudaManual = parseNum(cliente.debt || 0);
  
  // ✅ Saldo a favor del cliente
  const saldoFavor = parseNum(cliente.saldo_favor || 0);
  
  // ✅ CALCULAR DEUDA NETA: (Deuda total - Saldo a favor) - No puede ser negativo
  const deudaBruta = deudaFacturas + deudaManual;
  const deudaNeta = Math.max(0, deudaBruta - saldoFavor);
  
  console.log(`💰 Cliente ${cliente.name}: Facturas=${deudaFacturas}, Manual=${deudaManual}, SaldoFavor=${saldoFavor}, Bruta=${deudaBruta}, Neta=${deudaNeta}`);
  
  return deudaNeta; // ← Devuelve la DEUDA NETA después de aplicar saldo a favor
}
// 👇👇👇 AGREGAR ESTA FUNCIÓN NUEVA
function obtenerDetallePagosAplicados(pagosDeudores: any[], state: any) {
  const detallePagos: any[] = [];

  pagosDeudores.forEach((pago: any) => {
    const cliente = state.clients.find((c: any) => c.id === pago.client_id);
    if (!cliente) return;

    // Obtener el detalle REAL de deudas del cliente para este pago
    const detalleDeudasCliente = calcularDetalleDeudas(state, pago.client_id);
    
    // Calcular deuda total ANTES del pago
const deudaTotalAntes = cliente ? calcularDeudaTotal(detalleDeudasCliente, cliente) : 0;
    
    // Reconstruir las aplicaciones con información completa
    const aplicacionesCompletas = pago.aplicaciones?.map((app: any) => {
      const factura = state.invoices.find((f: any) => f.id === app.factura_id);
      const deudaFactura = detalleDeudasCliente.find((d: any) => d.factura_id === app.factura_id);
      
      return {
        factura_id: app.factura_id,
        factura_numero: app.factura_numero || factura?.number || "N/E",
        fecha_factura: factura?.date_iso || pago.date_iso,
        total_factura: deudaFactura?.monto_total || factura?.total || 0,
        deuda_antes: app.deuda_antes || deudaFactura?.monto_debe || 0,
        monto_aplicado: app.monto_aplicado,
        deuda_despues: app.deuda_despues || Math.max(0, (deudaFactura?.monto_debe || 0) - app.monto_aplicado),
        tipo: "pago_factura"
      };
    }) || [];

    // Si no hay aplicaciones específicas, crear aplicación global
    if (aplicacionesCompletas.length === 0) {
      aplicacionesCompletas.push({
        factura_numero: "No especificado",
        fecha_factura: pago.date_iso,
        total_factura: 0,
        deuda_antes: pago.debt_before || 0,
        monto_aplicado: pago.total_amount,
        deuda_despues: pago.debt_after || 0,
        descripcion: "Pago aplicado globalmente",
        tipo: "global"
      });
    }

    // Calcular total aplicado y deuda pendiente
    const totalAplicado = aplicacionesCompletas.reduce((sum: number, app: any) => sum + app.monto_aplicado, 0);
    const deudaPendiente = Math.max(0, deudaTotalAntes - totalAplicado);

    detallePagos.push({
      pago_id: pago.id,
      cliente: pago.client_name,
      cliente_id: pago.client_id,
      fecha_pago: pago.date_iso,
      total_pagado: pago.total_amount,
      efectivo: pago.cash_amount,
      transferencia: pago.transfer_amount,
      alias: pago.alias || "",
      
      // INFORMACIÓN COMPLETA DE LA DEUDA
      deuda_total_antes: deudaTotalAntes, // Deuda total antes del pago
      total_aplicado: totalAplicado,      // Total realmente aplicado
      deuda_pendiente: deudaPendiente,    // Lo que queda pendiente
      
      deuda_antes_pago: pago.debt_before,
      deuda_despues_pago: pago.debt_after,
      
      // DETALLE POR FACTURA
      aplicaciones: aplicacionesCompletas,
      
      // PARA FILTRAR - solo mostrar si tiene deuda pendiente
      tiene_deuda_pendiente: deudaPendiente > 1,
      saldado_completamente: deudaPendiente <= 0.01
    });
  });

  // ✅ FILTRAR: Solo devolver pagos de clientes que aún tengan deuda pendiente
  return detallePagos.filter(pago => pago.tiene_deuda_pendiente);
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
  ];

  const visibleTabs =
    role === "admin"
      ? TABS
      : role === "vendedor"
      ? ["Facturación", "Clientes", "Productos", "Deudores", "Presupuestos", "Gastos y Devoluciones", "Cola", "Pedidos Online"] // 👈 AGREGAR
      : role === "pedido-online"
      ? ["Hacer Pedido"] // 👈 Solo para clientes haciendo pedidos online
      : ["Panel"];

  return (
    <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-bold tracking-wide">
          💼 Facturación — {hasSupabase ? "By : Tobias carrizo" : "Local"}
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
  
  // ✅ CORRECCIÓN: NO sumar deuda manualmente si ya se calcula automáticamente
  // Solo actualizar si realmente hay deuda pendiente
  const status = debtDelta > 0 ? "No Pagada" : "Pagada";

  // 4) Actualizar cliente: bajar saldo_favor, NO sumar deuda manualmente
  cl.saldo_favor = saldoActual - saldoAplicado;
  
  // ✅ CORRECCIÓN IMPORTANTE: No modificar cl.debt aquí
  // La deuda se calculará automáticamente desde las facturas pendientes
  
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
    // ✅ REMOVER: client_debt_total: cl.debt, // Esto causa duplicación
  };

  st.invoices.push(invoice);
  st.meta.lastSavedInvoiceId = id;
  setState(st);

  if (hasSupabase) {
    await supabase.from("invoices").insert(invoice);
    
    // ✅ CORRECCIÓN: Solo actualizar saldo_favor, NO la deuda
    await supabase.from("clients").update({ 
      saldo_favor: cl.saldo_favor 
      // ❌ NO actualizar debt aquí
    }).eq("id", client.id);
    
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
    {(() => {
      const cliente = state.clients.find((c:any) => c.id === clientId);
      if (!cliente) return "✅ Al día";
      const detalleDeudas = calcularDetalleDeudas(state, clientId);
      const deudaNeta = calcularDeudaTotal(detalleDeudas, cliente);
      return deudaNeta > 0 ? money(deudaNeta) : "✅ Al día";
    })()}
  </span>
  <span className="mx-2">·</span>
  Saldo a favor: <span className="font-semibold text-emerald-400">
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
function ClientesTab({ state, setState, session }: any) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState(ensureUniqueNumber(state.clients));
  const [deudaInicial, setDeudaInicial] = useState(""); // 👈 NUEVO ESTADO
  const [saldoFavorInicial, setSaldoFavorInicial] = useState(""); // 👈 NUEVO ESTADO
  const [modoAdmin, setModoAdmin] = useState(false); // 👈 NUEVO ESTADO
   // 👇👇👇 PEGA LA FUNCIÓN AQUÍ - JUSTO DESPUÉS DE LOS useState
  async function limpiarDeudasInconsistentes() {
    if (!confirm("¿Estás seguro de limpiar todas las deudas inconsistentes? Esto revisará todos los clientes y ajustará las deudas según los pagos registrados.")) return;

    const st = clone(state);
    let clientesCorregidos = 0;

    st.clients.forEach((cliente: any) => {
      const detalleDeudas = calcularDetalleDeudas(st, cliente.id);
      const deudaReal = calcularDeudaTotal(detalleDeudas, cliente);
      const deudaActual = parseNum(cliente.debt);
      
      // Si hay diferencia, corregir
      if (Math.abs(deudaReal - deudaActual) > 0.01) {
        console.log(`🔧 Corrigiendo ${cliente.name}: ${money(deudaActual)} → ${money(deudaReal)}`);
        cliente.debt = deudaReal;
        clientesCorregidos++;
      }
    });

    setState(st);

    if (hasSupabase && clientesCorregidos > 0) {
      try {
        // Actualizar todos los clientes corregidos
        for (const cliente of st.clients) {
          await supabase
            .from("clients")
            .update({ debt: cliente.debt })
            .eq("id", cliente.id);
        }
        
        alert(`✅ ${clientesCorregidos} clientes corregidos. Deudas actualizadas según pagos registrados.`);
      } catch (error) {
        console.error("Error al actualizar clientes:", error);
        alert("Error al guardar las correcciones en la base de datos.");
        
        // Recargar para evitar inconsistencias
        const refreshedState = await loadFromSupabase(seedState());
        setState(refreshedState);
      }
    } else if (clientesCorregidos === 0) {
      alert("✅ No se encontraron deudas inconsistentes.");
    }
  }

  async function addClient() {
    if (!name.trim()) return;
    
    const newClient = {
      id: "c" + Math.random().toString(36).slice(2, 8),
      number: parseInt(String(number), 10),
      name: name.trim(),
      debt: modoAdmin ? parseNum(deudaInicial) : 0,
      saldo_favor: modoAdmin ? parseNum(saldoFavorInicial) : 0,
      creado_por: session?.name || "admin",
      fecha_creacion: todayISO(),
deuda_manual: modoAdmin && parseNum(deudaInicial) > 0
    };

    const st = clone(state);
    st.clients.push(newClient);
    setState(st);
    
    // Limpiar formulario
    setName("");
    setNumber(ensureUniqueNumber(st.clients));
    setDeudaInicial("");
    setSaldoFavorInicial("");
    setModoAdmin(false);

    if (hasSupabase) {
      await supabase.from("clients").insert(newClient);
    }

    alert(`Cliente agregado ${modoAdmin ? 'con deuda/saldo manual' : 'correctamente'}`);
  }

// Función para que admin agregue deuda manualmente a cliente existente - CORREGIDA
async function agregarDeudaManual(clienteId: string) {
  const deuda = prompt("Ingrese el monto de deuda a agregar:", "0");
  if (deuda === null) return;
  
  const montoDeuda = parseNum(deuda);
  if (montoDeuda < 0) return alert("El monto no puede ser negativo");

  const st = clone(state);
  const cliente = st.clients.find((c: any) => c.id === clienteId);
  
  if (cliente) {
    const deudaAnterior = parseNum(cliente.debt);
    
    // ✅ CORRECCIÓN: SIMPLEMENTE SUMAR LA DEUDA SIN COMPENSAR
    cliente.debt = deudaAnterior + montoDeuda;
// Solo marcar como deuda manual si realmente se está agregando deuda manualmente
cliente.deuda_manual = montoDeuda > 0;    
    setState(st);

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .update({ 
            debt: cliente.debt,
            deuda_manual: true 
          })
          .eq("id", clienteId);

        if (error) {
          console.error("❌ Error al guardar deuda manual:", error);
          alert("Error al guardar la deuda en la base de datos.");
          // Recargar para evitar inconsistencias
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
          return;
        }
        
        console.log("✅ Deuda manual guardada en Supabase");
      } catch (error) {
        console.error("💥 Error crítico:", error);
        alert("Error al guardar la deuda.");
        return;
      }
    }

    alert(`Deuda agregada: ${money(deudaAnterior)} → ${money(cliente.debt)}`);
  }
}
 // Función para que admin ajuste saldo a favor manualmente
async function ajustarSaldoFavor(clienteId: string) {
  const saldo = prompt("Ingrese el nuevo saldo a favor:", "0");
  if (saldo === null) return;
  
  const montoSaldo = parseNum(saldo);
  if (montoSaldo < 0) return alert("El monto no puede ser negativo");

  const st = clone(state);
  const cliente = st.clients.find((c: any) => c.id === clienteId);
  
  if (cliente) {
    const saldoAnterior = parseNum(cliente.saldo_favor);
    cliente.saldo_favor = montoSaldo;
    
    setState(st);

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .update({ saldo_favor: cliente.saldo_favor })
          .eq("id", clienteId);

        if (error) {
          console.error("❌ Error al guardar saldo:", error);
          alert("Error al guardar el saldo en la base de datos.");
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
          return;
        }
        
        console.log("✅ Saldo guardado en Supabase");
      } catch (error) {
        console.error("💥 Error crítico:", error);
        alert("Error al guardar el saldo.");
        return;
      }
    }

    alert(`Saldo a favor ajustado: ${money(saldoAnterior)} → ${money(cliente.saldo_favor)}`);
  }
}

 // Función para que admin cancele deuda manualmente
async function cancelarDeuda(clienteId: string) {
  const cliente = state.clients.find((c: any) => c.id === clienteId);
  if (!cliente) return;
  
  const confirmacion = confirm(
    `¿Está seguro de cancelar la deuda de ${cliente.name}?\nDeuda actual: ${money(cliente.debt)}`
  );
  
  if (!confirmacion) return;

  const st = clone(state);
  const clienteActualizado = st.clients.find((c: any) => c.id === clienteId);
  
  if (clienteActualizado) {
    const deudaCancelada = parseNum(clienteActualizado.debt);
    clienteActualizado.debt = 0;
    
    setState(st);

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .update({ debt: 0 })
          .eq("id", clienteId);

        if (error) {
          console.error("❌ Error al cancelar deuda:", error);
          alert("Error al cancelar la deuda en la base de datos.");
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
          return;
        }
        
        console.log("✅ Deuda cancelada en Supabase");
      } catch (error) {
        console.error("💥 Error crítico:", error);
        alert("Error al cancelar la deuda.");
        return;
      }
    }

    alert(`Deuda cancelada: ${money(deudaCancelada)} → $0`);
  }
}

  const clients = Array.isArray(state.clients)
    ? [...state.clients].sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Card para agregar cliente normal */}
      <Card title="Agregar cliente">
        <div className="space-y-3">
          {/* Solo admin puede activar modo avanzado */}
          {session?.role === "admin" && (
            <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
              <input
                type="checkbox"
                id="modoAdmin"
                checked={modoAdmin}
                onChange={(e) => setModoAdmin(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="modoAdmin" className="text-sm font-medium">
                Modo Admin: Agregar con deuda/saldo inicial
              </label>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <NumberInput 
              label="N° cliente" 
              value={number} 
              onChange={setNumber} 
            />
            <Input 
              label="Nombre" 
              value={name} 
              onChange={setName} 
              placeholder="Ej: Kiosco 9 de Julio" 
            />
            <div className="pt-6">
              <Button onClick={addClient}>
                Agregar
              </Button>
            </div>
          </div>

          {/* Campos solo para admin en modo avanzado */}
          {session?.role === "admin" && modoAdmin && (
            <div className="grid md:grid-cols-2 gap-3 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <NumberInput
                label="Deuda inicial"
                value={deudaInicial}
                onChange={setDeudaInicial}
                placeholder="0"
              />
              <NumberInput
                label="Saldo a favor inicial"
                value={saldoFavorInicial}
                onChange={setSaldoFavorInicial}
                placeholder="0"
              />
              <div className="md:col-span-2 text-xs text-amber-300">
                ⚠️ Solo usar para casos especiales. La deuda manual se registrará en el sistema.
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Listado de clientes */}
      <Card title="Listado de Clientes">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">N°</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Deuda</th>
                <th className="py-2 pr-4">Saldo a favor</th>
                <th className="py-2 pr-4">Gasto mes</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {clients.map((c: any) => (
                <tr key={c.id} className={c.deuda_manual ? "bg-amber-900/10" : ""}>
                  <td className="py-2 pr-4">{c.number}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {c.name}
                      {c.deuda_manual && (
                        <span 
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-800 text-amber-200 border border-amber-700"
                          title="Deuda manualmente asignada"
                        >
                          ⚠️ Manual
                        </span>
                      )}
                    </div>
                    {session?.role === "admin" && c.creado_por && (
                      <div className="text-xs text-slate-500">
                        Creado por: {c.creado_por}
                      </div>
                    )}
                  </td>
       <td className="py-2 pr-4">
  <div className={`font-medium ${
    (() => {
      const detalleDeudas = calcularDetalleDeudas(state, c.id);
      const deudaNeta = calcularDeudaTotal(detalleDeudas, c);
      return deudaNeta > 0 ? "text-amber-400" : "text-emerald-400";
    })()
  }`}>
    {(() => {
      const detalleDeudas = calcularDetalleDeudas(state, c.id);
      const deudaNeta = calcularDeudaTotal(detalleDeudas, c);
      return deudaNeta > 0 ? money(deudaNeta) : "✅ Al día";
    })()}
  </div>
</td>
                  <td className="py-2 pr-4">
                    <div className={`font-medium ${
                      c.saldo_favor > 0 ? "text-emerald-400" : "text-slate-300"
                    }`}>
                      {money(c.saldo_favor || 0)}
                    </div>
                  </td>
                  <td className="py-2 pr-4">{money(gastoMesCliente(state, c.id))}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-1">
                      {/* Solo admin puede gestionar deuda manual */}
                      {session?.role === "admin" && (
                        <>
                          <button
                            onClick={() => agregarDeudaManual(c.id)}
                            className="text-amber-400 hover:text-amber-300 text-sm px-2 py-1 border border-amber-700 rounded"
                            title="Agregar deuda manual"
                          >
                            + Deuda
                          </button>
                          <button
                            onClick={() => ajustarSaldoFavor(c.id)}
                            className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 border border-blue-700 rounded"
                            title="Ajustar saldo a favor"
                          >
                            💰 Saldo
                          </button>
                          {c.debt > 0 && (
                            <button
                              onClick={() => cancelarDeuda(c.id)}
                              className="text-red-400 hover:text-red-300 text-sm px-2 py-1 border border-red-700 rounded"
                              title="Cancelar deuda"
                            >
                              ✕ Deuda
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {clients.length === 0 && (
                <tr>
                  <td className="py-2 pr-4 text-slate-400" colSpan={6}>
                    Sin clientes cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

{session?.role === "admin" && (
  <Card title="🛠️ Panel de Control - Administrador">
    <div className="space-y-3">
      <div className="text-sm text-slate-300">
        Gestión avanzada de clientes y deudas
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 text-sm">
<div className="p-3 bg-slate-800/50 rounded-lg">
  <div className="font-semibold">Clientes con deuda manual</div>
  <div className="text-amber-400 font-bold">
    {clients.filter((c: any) => c.deuda_manual && parseNum(c.debt) > 0).length}
  </div>
</div>
        
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="font-semibold">Deuda manual total</div>
          <div className="text-amber-400 font-bold">
            {money(
              clients
                .filter((c: any) => c.deuda_manual)
                .reduce((sum: number, c: any) => sum + parseNum(c.debt), 0)
            )}
          </div>
        </div>
        
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="font-semibold">Saldo a favor total</div>
          <div className="text-emerald-400 font-bold">
            {money(
              clients.reduce((sum: number, c: any) => sum + parseNum(c.saldo_favor), 0)
            )}
          </div>
        </div>
      </div>

      {/* 👇👇👇 AQUÍ VA EL BOTÓN NUEVO - VERSIÓN CORREGIDA */}
      <div className="border-t border-slate-700 pt-3">
        <div className="text-xs text-slate-400 mb-2">
          Herramientas de mantenimiento:
        </div>
        <Button 
          tone="red" 
          onClick={async () => {
            if (!confirm("¿Estás seguro de limpiar todas las deudas inconsistentes? Esto revisará todos los clientes y ajustará las deudas según los pagos registrados.")) return;

            const st = clone(state);
            let clientesCorregidos = 0;

            st.clients.forEach((cliente: any) => {
              const detalleDeudas = calcularDetalleDeudas(st, cliente.id);
              const deudaReal = calcularDeudaTotal(detalleDeudas, cliente);
              const deudaActual = parseNum(cliente.debt);
              
              // Si hay diferencia, corregir
              if (Math.abs(deudaReal - deudaActual) > 0.01) {
                console.log(`🔧 Corrigiendo ${cliente.name}: ${money(deudaActual)} → ${money(deudaReal)}`);
                cliente.debt = deudaReal;
                clientesCorregidos++;
              }
            });

            setState(st);

            if (hasSupabase && clientesCorregidos > 0) {
              try {
                // Actualizar todos los clientes corregidos
                for (const cliente of st.clients) {
                  await supabase
                    .from("clients")
                    .update({ debt: cliente.debt })
                    .eq("id", cliente.id);
                }
                
                alert(`✅ ${clientesCorregidos} clientes corregidos. Deudas actualizadas según pagos registrados.`);
              } catch (error) {
                console.error("Error al actualizar clientes:", error);
                alert("Error al guardar las correcciones en la base de datos.");
                
                // Recargar para evitar inconsistencias
                const refreshedState = await loadFromSupabase(seedState());
                setState(refreshedState);
              }
            } else if (clientesCorregidos === 0) {
              alert("✅ No se encontraron deudas inconsistentes.");
            }
          }}
          className="w-full"
        >
          🧹 Limpiar Deudas Inconsistentes
        </Button>
      </div>
      {/* 👆👆👆 HASTA AQUÍ EL BOTÓN NUEVO */}

      <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
        💡 Las deudas manuales se marcan con ⚠️ y solo deben usarse para casos especiales 
        (ej: deudas heredadas, ajustes contables, etc.)
      </div>
    </div>
  </Card>
)}
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
  const [stockMinimo, setStockMinimo] = useState("");
  const [cost, setCost] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  
  // 👇👇👇 ESTADO PARA INGRESO DE STOCK
  const [ingresoStock, setIngresoStock] = useState({ 
    productoId: "", 
    cantidad: "", 
    costo: "" 
  });

  const productosBajoStock = state.products.filter(
    (p: any) => parseNum(p.stock) < parseNum(p.stock_minimo || 0)
  );

  // 👇👇👇 FUNCIÓN COMPLETA DE INGRESO DE STOCK CON COMPARACIONES
  async function agregarStock() {
    const producto = state.products.find((p: any) => p.id === ingresoStock.productoId);
    if (!producto) return alert("Selecciona un producto");
    
    const cantidad = parseNum(ingresoStock.cantidad);
    const nuevoCosto = parseNum(ingresoStock.costo);
    
    if (cantidad <= 0) return alert("La cantidad debe ser mayor a 0");
    if (nuevoCosto < 0) return alert("El costo no puede ser negativo");

    const st = clone(state);
    const prod = st.products.find((p: any) => p.id === ingresoStock.productoId);
    
    if (prod) {
      const stockAnterior = parseNum(prod.stock);
      const costoAnterior = parseNum(prod.cost || 0);
      
      // Actualizar stock
      prod.stock = stockAnterior + cantidad;
      
      // Manejar costo - solo actualizar si se ingresó un valor > 0
      let mensajeCosto = "";
      if (nuevoCosto > 0) {
        if (costoAnterior > 0 && nuevoCosto !== costoAnterior) {
          mensajeCosto = `\n⚠️ ATENCIÓN: Costo cambiado\nAnterior: ${money(costoAnterior)}\nNuevo: ${money(nuevoCosto)}`;
          prod.cost = nuevoCosto;
        } else if (costoAnterior === 0) {
          mensajeCosto = `\n✅ Costo asignado: ${money(nuevoCosto)}`;
          prod.cost = nuevoCosto;
        }
      }
      
      setState(st);

      if (hasSupabase) {
        await supabase
          .from("products")
          .update({ 
            stock: prod.stock,
            ...(nuevoCosto > 0 && { cost: nuevoCosto })
          })
          .eq("id", ingresoStock.productoId);
      }
      
      // Mostrar comparación COMPLETA
      const mensaje = `✅ STOCK ACTUALIZADO\n\n📦 ${producto.name}\n\n📊 Stock:\nAnterior: ${stockAnterior}\nAgregado: +${cantidad}\nNuevo: ${prod.stock}\nMínimo: ${prod.stock_minimo || 0}\n\n${mensajeCosto}\n\n${prod.stock >= (prod.stock_minimo || 0) ? '✅ Stock suficiente' : '⚠️ Stock por debajo del mínimo'}`;
      
      alert(mensaje);
      
      // Limpiar formulario
      setIngresoStock({ productoId: "", cantidad: "", costo: "" });
    }
  }

  async function addProduct() {
    if (!name.trim()) return;

    const product = {
      id: editando || "p" + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      section: section.trim() || "General",
      price1: parseNum(price1),
      price2: parseNum(price2),
      stock: parseNum(stock),
      stock_minimo: parseNum(stockMinimo),
      cost: parseNum(cost),
      list_label: "General"
    };

    const st = clone(state);
    
    if (editando) {
      // Editar producto existente
      const index = st.products.findIndex((p: any) => p.id === editando);
      if (index !== -1) {
        st.products[index] = { ...st.products[index], ...product };
      }
    } else {
      // Agregar nuevo producto
      st.products.push(product);
    }
    
    setState(st);
    
    // Limpiar formulario
    setName("");
    setPrice1("");
    setPrice2("");
    setStock("");
    setStockMinimo("");
    setCost("");
    setSection("");
    setEditando(null);

    if (hasSupabase) {
      if (editando) {
        await supabase
          .from("products")
          .update({
            name: product.name,
            section: product.section,
            price1: product.price1,
            price2: product.price2,
            stock: product.stock,
            stock_min: product.stock_minimo,
            cost: product.cost
          })
          .eq("id", product.id);
      } else {
        await supabase.from("products").insert(product);
      }
    }
  }

  function editarProducto(producto: any) {
    setName(producto.name);
    setSection(producto.section);
    setPrice1(String(producto.price1));
    setPrice2(String(producto.price2));
    setStock(String(producto.stock));
    setStockMinimo(String(producto.stock_minimo || ""));
    setCost(String(producto.cost || ""));
    setEditando(producto.id);
  }

  async function eliminarProducto(productoId: string) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    
    const st = clone(state);
    st.products = st.products.filter((p: any) => p.id !== productoId);
    setState(st);

    if (hasSupabase) {
      await supabase.from("products").delete().eq("id", productoId);
    }
    
    alert("Producto eliminado correctamente");
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
      
      {/* 👇👇👇 SECCIÓN DE INGRESO DE STOCK RESTAURADA */}
      <Card title="📦 Ingresar Stock">
        <div className="grid md:grid-cols-4 gap-3">
          <Select
            label="Producto"
            value={ingresoStock.productoId}
            onChange={(v: string) => setIngresoStock({...ingresoStock, productoId: v})}
            options={[
              { value: "", label: "— Seleccionar —" },
              ...state.products.map((p: any) => ({
                value: p.id,
                label: `${p.name} (Stock: ${p.stock})`
              }))
            ]}
          />
          <NumberInput
            label="Cantidad a agregar"
            value={ingresoStock.cantidad}
            onChange={(v: string) => setIngresoStock({...ingresoStock, cantidad: v})}
            placeholder="0"
          />
          <NumberInput
            label="Costo unitario (opcional)"
            value={ingresoStock.costo}
            onChange={(v: string) => setIngresoStock({...ingresoStock, costo: v})}
            placeholder="0"
          />
          <div className="pt-6">
            <Button 
              onClick={agregarStock} 
              disabled={!ingresoStock.productoId || !ingresoStock.cantidad}
            >
              Ingresar Stock
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          💡 El costo solo se actualizará si es diferente al actual o si no tenía costo asignado.
        </div>
      </Card>

      <Card title={editando ? "✏️ Editar producto" : "➕ Crear producto"}>
        <div className="grid md:grid-cols-6 gap-3">
          <Input label="Nombre" value={name} onChange={setName} />
          <Input label="Sección" value={section} onChange={setSection} placeholder="General" />
          <NumberInput label="Precio 1" value={price1} onChange={setPrice1} />
          <NumberInput label="Precio 2" value={price2} onChange={setPrice2} />
          <NumberInput label="Stock inicial" value={stock} onChange={setStock} />
          <NumberInput label="Stock mínimo" value={stockMinimo} onChange={setStockMinimo} placeholder="0" />
          <NumberInput label="Costo" value={cost} onChange={setCost} placeholder="0" />
          <div className="md:col-span-6 flex gap-2">
            <Button onClick={addProduct}>
              {editando ? "Actualizar" : "Agregar"}
            </Button>
            {editando && (
              <Button tone="slate" onClick={() => {
                setEditando(null);
                setName("");
                setPrice1("");
                setPrice2("");
                setStock("");
                setStockMinimo("");
                setCost("");
                setSection("");
              }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card title="📋 Listado de productos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Sección</th>
                <th className="py-2 pr-4">Precio 1</th>
                <th className="py-2 pr-4">Precio 2</th>
                <th className="py-2 pr-4">Stock</th>
                <th className="py-2 pr-4">Mínimo</th>
                <th className="py-2 pr-4">Costo</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.products.map((p: any) => (
                <tr key={p.id} className={parseNum(p.stock) < parseNum(p.stock_minimo || 0) ? "bg-red-900/20" : ""}>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.section}</td>
                  <td className="py-2 pr-4">{money(p.price1)}</td>
                  <td className="py-2 pr-4">{money(p.price2)}</td>
                  <td className="py-2 pr-4">
                    <span className={parseNum(p.stock) < parseNum(p.stock_minimo || 0) ? "text-red-400 font-bold" : ""}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{p.stock_minimo || 0}</td>
                  <td className="py-2 pr-4">{money(p.cost || 0)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarProducto(p)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => eliminarProducto(p.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
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

function DeudoresTab({ state, setState, session }: any) {
// ✅ FILTRAR MEJORADO: Incluye deuda manual Y deuda de facturas
// ✅ FILTRAR: Solo clientes con deuda NETA > 0 (después de aplicar saldo)
const clients = state.clients.filter((c: any) => {
  if (!c || !c.id) return false;
  
  const detalleDeudas = calcularDetalleDeudas(state, c.id);
  const deudaNeta = calcularDeudaTotal(detalleDeudas, c); // ← Esto YA aplica saldo
  
  // Mostrar solo si tiene deuda NETA pendiente
  return deudaNeta > 0.01;
});
  const [active, setActive] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [transf, setTransf] = useState("");
  const [alias, setAlias] = useState("");
  const [verDetalle, setVerDetalle] = useState<string | null>(null);

  // Función para ver detalle de deudas - CORREGIDA
  function verDetalleDeudas(clientId: string) {
    setVerDetalle(clientId);
  }

  // Calcular detalle de deudas para un cliente
  const detalleDeudasCliente = verDetalle ? calcularDetalleDeudas(state, verDetalle) : [];
  const clienteDetalle = state.clients.find((c: any) => c.id === verDetalle);
  const deudaTotalCliente = calcularDeudaTotal(detalleDeudasCliente, clienteDetalle);
    // 👇👇👇 AGREGAR ESTA FUNCIÓN NUEVA - SOLO PARA ADMIN
  // 👇👇👇 REEMPLAZAR LA FUNCIÓN ELIMINAR DEUDA CON ESTA VERSIÓN MEJORADA
async function eliminarDeudaCliente(clienteId: string) {
  const cliente = state.clients.find((c: any) => c.id === clienteId);
  if (!cliente) return;
  
  // Calcular deuda REAL antes de eliminar
  const detalleDeudas = calcularDetalleDeudas(state, clienteId);
  const deudaReal = calcularDeudaTotal(detalleDeudas, cliente);
  
  const confirmacion = confirm(
    `¿Está seguro de ELIMINAR COMPLETAMENTE la deuda de ${cliente.name}?\n\n` +
    `Deuda actual en sistema: ${money(cliente.debt)}\n` +
    `Deuda real calculada: ${money(deudaReal)}\n\n` +
    `⚠️ Esta acción NO se puede deshacer.`
  );
  
  if (!confirmacion) return;

  const st = clone(state);
  const clienteActualizado = st.clients.find((c: any) => c.id === clienteId);
  
  if (clienteActualizado) {
    const deudaEliminada = parseNum(clienteActualizado.debt);
    
    // ✅ CORRECCIÓN COMPLETA: Resetear completamente la deuda
    clienteActualizado.debt = 0;
    clienteActualizado.deuda_manual = false; // También quitamos el flag de deuda manual
    
    setState(st);

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .update({ 
            debt: 0,
            deuda_manual: false 
          })
          .eq("id", clienteId);

        if (error) {
          console.error("❌ Error al eliminar deuda:", error);
          alert("Error al eliminar la deuda en la base de datos.");
          
          // Recargar para evitar inconsistencias
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
          return;
        }
        
        console.log("✅ Deuda eliminada en Supabase");
        
        // ✅ FORZAR ACTUALIZACIÓN DEL ESTADO para que el cliente desaparezca de deudores
        setTimeout(async () => {
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }, 500);
        
      } catch (error) {
        console.error("💥 Error crítico:", error);
        alert("Error al eliminar la deuda.");
        return;
      }
    }

    alert(`✅ Deuda eliminada completamente\nCliente: ${cliente.name}\nDeuda eliminada: ${money(deudaEliminada)}`);
    
    // ✅ ACTUALIZAR INMEDIATAMENTE LA VISTA
    setState({...st});
  }
}
  // 👇👇👇 NUEVA FUNCIÓN: Imprimir detalle de deudas
  async function imprimirDetalleDeudas() {
    if (!verDetalle || !clienteDetalle) return;
    
    const detalleData = {
      type: "DetalleDeuda",
      cliente: clienteDetalle,
      detalleDeudas: detalleDeudasCliente,
      deudaTotal: deudaTotalCliente,
      saldoFavor: parseNum(clienteDetalle.saldo_favor || 0)
    };

    window.dispatchEvent(new CustomEvent("print-invoice", { detail: detalleData } as any));
    await nextPaint();
    window.print();
  }

  async function registrarPago() {
    const cl = state.clients.find((c: any) => c.id === active);
    if (!cl) return;
    
    const totalPago = parseNum(cash) + parseNum(transf);
    if (totalPago <= 0) return alert("Importe inválido.");

    const st = clone(state);
    const client = st.clients.find((c: any) => c.id === active)!;

    // Calcular deuda REAL del cliente (facturas + manual)
    const detalleDeudas = calcularDetalleDeudas(st, active);
    const deudaReal = calcularDeudaTotal(detalleDeudas, client);
    
    console.log(`💳 Pago: ${totalPago}, Deuda real: ${deudaReal}`);

    if (totalPago > deudaReal) {
      return alert(`El pago (${money(totalPago)}) supera la deuda real (${money(deudaReal)})`);
    }

    // Aplicar el pago PRIMERO a la deuda manual
    let saldoRestante = totalPago;
    const aplicaciones: any[] = [];

    // 1. Pagar deuda manual primero
    const deudaManual = parseNum(client.debt);
    if (deudaManual > 0) {
      const montoAplicadoManual = Math.min(saldoRestante, deudaManual);
      
      aplicaciones.push({
        tipo: "deuda_manual",
        descripcion: "Pago de deuda manual",
        monto_aplicado: montoAplicadoManual,
        deuda_antes: deudaManual,
        deuda_despues: deudaManual - montoAplicadoManual
      });

      // Reducir deuda manual
      client.debt = Math.max(0, deudaManual - montoAplicadoManual);
      saldoRestante -= montoAplicadoManual;
    }

    // 2. Si sobra saldo, aplicar a facturas
    if (saldoRestante > 0) {
      for (const deuda of detalleDeudas) {
        if (saldoRestante <= 0) break;

        if (deuda.monto_debe > 0) {
          const montoAplicado = Math.min(saldoRestante, deuda.monto_debe);
          
          aplicaciones.push({
            factura_id: deuda.factura_id,
            factura_numero: deuda.factura_numero,
            monto_aplicado: montoAplicado,
            deuda_antes: deuda.monto_debe,
            deuda_despues: deuda.monto_debe - montoAplicado,
            tipo: "pago_factura"
          });

          saldoRestante -= montoAplicado;
        }
      }
    }

    console.log(`📊 Deuda actualizada: Manual ${deudaManual} -> ${client.debt}`);

    // Guardar en debt_payments
    const number = st.meta.invoiceCounter++;
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
      total_amount: totalPago,
      alias: alias.trim(),
      aplicaciones: aplicaciones,
      debt_before: deudaReal,
debt_after: Math.max(0, deudaReal - totalPago), // Calcular correctamente      deuda_real_antes: deudaReal,
    };

    // Guardar en debt_payments LOCAL
    st.debt_payments = st.debt_payments || [];
    st.debt_payments.push(debtPayment);
    st.meta.lastSavedInvoiceId = id;
    
    // ACTUALIZAR ESTADO PRIMERO
    setState(st);

    // Persistencia en Supabase
    if (hasSupabase) {
      try {
        console.log("💾 Guardando pago en Supabase...", debtPayment);
        
        const { data, error } = await supabase
          .from("debt_payments")
          .insert([debtPayment])
          .select();

        if (error) throw new Error(`No se pudo guardar el pago: ${error.message}`);
        
        console.log("✅ Pago guardado en Supabase:", data);

        // Actualizar cliente (deuda manual)
        const { error: clientError } = await supabase
          .from("clients")
          .update({ debt: client.debt })
          .eq("id", client.id);

        if (clientError) {
          console.error("❌ Error al actualizar cliente:", clientError);
        }

        await saveCountersSupabase(st.meta);

      } catch (error: any) {
        console.error("💥 ERROR CRÍTICO:", error);
        alert("Error al guardar el pago: " + error.message);
        
        const refreshedState = await loadFromSupabase(seedState());
        setState(refreshedState);
        return;
      }
    }

    // Limpiar UI e imprimir
    setCash("");
    setTransf("");
    setAlias("");
    setActive(null);

    window.dispatchEvent(new CustomEvent("print-invoice", { 
      detail: { 
        ...debtPayment, 
        type: "Pago de Deuda",
        items: [{ 
          productId: "pago_deuda", 
          name: "Pago de deuda", 
          section: "Finanzas", 
          qty: 1, 
          unitPrice: totalPago, 
          cost: 0 
        }],
        total: totalPago,
        payments: { 
          cash: parseNum(cash), 
          transfer: parseNum(transf), 
          change: 0,
          alias: alias.trim()
        },
        status: "Pagado",
        aplicaciones: aplicaciones,
client_debt_total: Math.max(0, deudaReal - totalPago)
      } 
    } as any));
    
    await nextPaint();
    window.print();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* MODAL DE DETALLE DE DEUDAS - NUEVO */}
      {verDetalle && clienteDetalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">
                    Detalle de Deudas - {clienteDetalle.name}
                  </h2>
                  <p className="text-slate-400">
                    N° Cliente: {clienteDetalle.number} | 
                    Deuda Total: <span className="text-amber-400 font-semibold">{money(deudaTotalCliente)}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={imprimirDetalleDeudas}>
                    📄 Imprimir Detalle
                  </Button>
                  <Button tone="slate" onClick={() => setVerDetalle(null)}>
                    ✕ Cerrar
                  </Button>
                </div>
              </div>

              {/* DETALLE DE FACTURAS PENDIENTES */}
              <div className="space-y-4">
                {detalleDeudasCliente.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No hay facturas pendientes
                  </div>
                ) : (
                  detalleDeudasCliente.map((deuda: any, index: number) => (
                    <div key={deuda.factura_id} className="border border-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">
                            Factura #{pad(deuda.factura_numero)}
                          </h3>
                          <p className="text-sm text-slate-400">
                            Fecha: {new Date(deuda.fecha).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-400">
                            {money(deuda.monto_debe)}
                          </div>
                          <div className="text-sm text-slate-400">
                            Total: {money(deuda.monto_total)} | Pagado: {money(deuda.monto_pagado)}
                          </div>
                        </div>
                      </div>

                      {/* ITEMS DE LA FACTURA */}
                      <div className="text-sm">
                        <div className="font-semibold mb-2">Productos:</div>
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
                  ))
                )}
              </div>

              {/* RESUMEN FINAL */}
              <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-amber-400">
                      {money(deudaTotalCliente)}
                    </div>
                    <div className="text-sm text-slate-400">Deuda Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {detalleDeudasCliente.length}
                    </div>
                    <div className="text-sm text-slate-400">Facturas Pendientes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {money(parseNum(clienteDetalle.saldo_favor || 0))}
                    </div>
                    <div className="text-sm text-slate-400">Saldo a Favor</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card title="Deudores">
        {clients.length === 0 && <div className="text-sm text-slate-400">Sin deudas.</div>}
        <div className="divide-y divide-slate-800">
   {clients.map((c: any) => {
  const detalleDeudas = calcularDetalleDeudas(state, c.id);
  const deudaNeta = calcularDeudaTotal(detalleDeudas, c); // ← Esto YA aplica saldo a favor
  const deudaManual = parseNum(c.debt || 0);
  const saldoFavor = parseNum(c.saldo_favor || 0);
  
  // Calcular deuda BRUTA (sin aplicar saldo) para mostrar el desglose
  const deudaFacturas = detalleDeudas.reduce((sum, deuda) => sum + deuda.monto_debe, 0);
  const deudaBruta = deudaFacturas + deudaManual;

  return (
    <div key={c.id} className="border border-slate-700 rounded-lg p-4 mb-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-semibold flex items-center gap-2">
            {c.name} (N° {c.number})
            {c.deuda_manual && deudaManual > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-800 text-amber-200 border border-amber-700">
                ⚠️ Deuda Manual
              </span>
            )}
            {saldoFavor > 0 && deudaNeta === 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-emerald-800 text-emerald-200 border border-emerald-700">
                💰 Saldo a favor
              </span>
            )}
          </div>
          
          {/* ✅ INFORMACIÓN CLARA CON SALDO APLICADO */}
          <div className="text-sm text-slate-400 mt-1">
            {/* DEUDA NETA (después de saldo) */}
            <span className={`font-semibold ${
              deudaNeta > 0 ? "text-red-400" : "text-emerald-400"
            }`}>
              {deudaNeta > 0 ? `Deuda pendiente: ${money(deudaNeta)}` : "✅ Al día"}
            </span>
            
            {/* Desglose SOLO si hay deuda bruta */}
            {deudaBruta > 0 && (
              <>
                <span className="ml-2 text-slate-500">
                  (Bruta: {money(deudaBruta)})
                </span>
                
                {deudaManual > 0 && deudaFacturas > 0 && (
                  <>
                    <span className="ml-2 text-amber-400">
                      (Manual: {money(deudaManual)})
                    </span>
                    <span className="ml-2 text-blue-400">
                      (Facturas: {money(deudaFacturas)})
                    </span>
                  </>
                )}
                
                {deudaManual > 0 && deudaFacturas === 0 && (
                  <span className="ml-2 text-amber-400">
                    ← Solo deuda manual
                  </span>
                )}
                
                {deudaManual === 0 && deudaFacturas > 0 && (
                  <span className="ml-2 text-blue-400">
                    ← Solo deuda de facturas
                  </span>
                )}
              </>
            )}
            
            {/* INFORMACIÓN DE SALDO A FAVOR */}
            {saldoFavor > 0 && (
              <div className="mt-1">
                {deudaNeta === 0 ? (
                  <span className="text-emerald-400">
                    💰 Saldo a favor: {money(saldoFavor)} (no aplicado - cliente al día)
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    💰 Saldo a favor: {money(saldoFavor)} (aplicado - reduce deuda)
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Detalle de facturas pendientes - solo si tiene */}
          {deudaFacturas > 0 && (
            <div className="mt-2 text-xs">
              {detalleDeudas.slice(0, 3).map((deuda, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>Factura #{deuda.factura_numero}</span>
                  <span>{money(deuda.monto_debe)}</span>
                </div>
              ))}
              {detalleDeudas.length > 3 && (
                <div className="text-slate-500">
                  +{detalleDeudas.length - 3} facturas más...
                </div>
              )}
            </div>
          )}
          
          {/* Mostrar si solo tiene deuda manual */}
          {deudaManual > 0 && deudaFacturas === 0 && (
            <div className="mt-2 text-xs text-amber-400">
              ⚠️ Deuda asignada manualmente
            </div>
          )}
        </div>
        
        <div className="flex gap-2 shrink-0">
          <Button tone="slate" onClick={() => verDetalleDeudas(c.id)}>
            📋 Detalle
          </Button>
          <Button tone="slate" onClick={() => setActive(c.id)}>
            💳 Pagar
          </Button>
          {session?.role === "admin" && (
            <Button 
              tone="red" 
              onClick={() => eliminarDeudaCliente(c.id)}
              title="Eliminar completamente la deuda"
            >
              🗑️ Eliminar Deuda
            </Button>
          )}
        </div>
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
       // 👇👇👇 NUEVA SUSCRIPCIÓN PARA DEBT_PAYMENTS
    const debtPaymentsSubscription = supabase
      .channel('debt-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debt_payments'
        },
        async () => {
          console.log("🔄 Cambios en debt_payments detectados, recargando...");
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }
      )
      .subscribe();


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
  // 👇👇👇 CALCULAR DEUDA DEL DÍA CORRECTAMENTE
  const deudaDelDia = invoices
    .filter((f: any) => {
      const total = parseNum(f.total);
      const pagos = parseNum(f?.payments?.cash || 0) + 
                   parseNum(f?.payments?.transfer || 0) + 
                   parseNum(f?.payments?.saldo_aplicado || 0);
      return (total - pagos) > 0.01; // Tiene deuda pendiente
    })
    .reduce((s: number, f: any) => {
      const total = parseNum(f.total);
      const pagos = parseNum(f?.payments?.cash || 0) + 
                   parseNum(f?.payments?.transfer || 0) + 
                   parseNum(f?.payments?.saldo_aplicado || 0);
      return s + (total - pagos);
    }, 0);

  // 👇👇👇 DEUDORES ACTIVOS CON DETALLE COMPLETO
const deudoresActivos = state.clients
  .filter((c: any) => {
    const detalleDeudasCliente = calcularDetalleDeudas(state, c.id);
    const deudaNeta = calcularDeudaTotal(detalleDeudasCliente, c); // ← AGREGAR 'c' COMO SEGUNDO PARÁMETRO
    return deudaNeta > 0.01;
  })
  .map((c: any) => {
      const detalleDeudasCliente = calcularDetalleDeudas(state, c.id);
const deudaNeta = calcularDeudaTotal(detalleDeudasCliente, c);      const saldoFavor = parseNum(c.saldo_favor || 0);
      
      return {
        id: c.id,
        name: c.name,
        number: c.number,
        deuda_bruta: parseNum(c.debt),
        saldo_favor: saldoFavor,
        deuda_neta: deudaNeta,
        detalle_facturas: detalleDeudasCliente,
        cantidad_facturas: detalleDeudasCliente.length
      };
    })
    .sort((a: any, b: any) => b.deuda_neta - a.deuda_neta);

  // 👇👇👇 PAGOS DE DEUDORES CON DETALLE DE APLICACIÓN
  const pagosDeudoresDetallados = pagosDeudores.map((pago: any) => {
    const cliente = state.clients.find((c: any) => c.id === pago.client_id);
    const detalleDeudasAntes = calcularDetalleDeudas(state, pago.client_id);
    
    return {
      pago_id: pago.id,
      fecha_pago: pago.date_iso,
      cliente: pago.client_name,
      total_pagado: pago.total_amount,
      efectivo: pago.cash_amount,
      transferencia: pago.transfer_amount,
      alias: pago.alias || "",
      deuda_antes_pago: pago.debt_before,
      deuda_despues_pago: pago.debt_after,
      aplicaciones: pago.aplicaciones || [],
      detalle_deuda_antes: detalleDeudasAntes
    };
  });

  const data = {
    type: "Reporte",
    periodo,
    rango: { start, end },
    
    // RESUMEN PRINCIPAL
    resumen: {
      ventas: totalVentas,
      deudaDelDia: deudaDelDia, // 👈 AHORA SÍ INCLUIDA
      efectivoCobrado: totalEfectivo,
      vueltoEntregado: totalVuelto,
      efectivoNeto: totalEfectivoNeto,
      transferencias: totalTransf,
      pagosDeudores: totalPagosDeudores,
      cantidadPagosDeudores: pagosDeudores.length,

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

    // DETALLES COMPLETOS
    ventas: invoices,
    gastos: gastosPeriodo,
    devoluciones: devolucionesPeriodo,
    
    // 👇👇👇 NUEVAS SECCIONES CON DETALLE
    deudaDelDiaDetalle: invoices.filter((f: any) => {
      const total = parseNum(f.total);
      const pagos = parseNum(f?.payments?.cash || 0) + 
                   parseNum(f?.payments?.transfer || 0) + 
                   parseNum(f?.payments?.saldo_aplicado || 0);
      return (total - pagos) > 0.01;
    }),
    
    deudoresActivos: deudoresActivos, // 👈 CON DETALLE COMPLETO
    pagosDeudoresDetallados: pagosDeudoresDetallados, // 👈 CON DETALLE DE APLICACIÓN
    
    porVendedor,
    porSeccion,
    transferenciasPorAlias: porAlias,
    transferGastosPorAlias: transferenciasPorAlias,
  };

  window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
  await nextPaint();
  window.print();
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
    <th className="py-2 pr-3">Comprobante</th> {/* 👈 NUEVA COLUMNA */}
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
                  <td className="py-2 pr-3">
  {/* COMPROBANTE - Solo si tiene transferencia */}
  {(parseNum(f?.payments?.transfer) > 0) && (
    <div className="flex gap-1 mb-1">
      <SubirComprobante 
        tipo="factura"
        id={f.id}
        session={session}
        onComprobanteSubido={async () => {
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }}
      />
      {f.comprobante_url && (
        <a 
          href={f.comprobante_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-green-400 hover:text-green-300 text-sm px-2 py-1 border border-green-700 rounded"
          title="Ver comprobante"
        >
          👁️ Ver
        </a>
      )}
    </div>
  )}
</td>

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
    <th className="py-2 pr-3">Comprobante</th> {/* 👈 NUEVA COLUMNA */}
    <th className="py-2 pr-3">Acciones</th>
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
  <span className={(() => {
    const cliente = state.clients.find((c: any) => c.id === pago.client_id);
    if (cliente) {
      const detalleDeudas = calcularDetalleDeudas(state, pago.client_id);
      const deudaActual = calcularDeudaTotal(detalleDeudas, cliente);
      return deudaActual > 0 ? "text-amber-400" : "text-emerald-400";
    }
    return parseNum(pago.debt_after) > 0 ? "text-amber-400" : "text-emerald-400";
  })()}>
    {(() => {
      const cliente = state.clients.find((c: any) => c.id === pago.client_id);
      if (cliente) {
        const detalleDeudas = calcularDetalleDeudas(state, pago.client_id);
        const deudaActual = calcularDeudaTotal(detalleDeudas, cliente);
        return money(deudaActual);
      }
      return money(parseNum(pago.debt_after));
    })()}
  </span>
</td>
                <td className="py-2 pr-3">
                  <Chip tone={metodo === "Efectivo" ? "emerald" : "slate"}>
                    {metodo}
                  </Chip>
                </td>
                <td className="py-2 pr-3">
  {/* COMPROBANTE - Solo si tiene transferencia */}
  {(parseNum(pago?.transfer_amount || pago?.payments?.transfer || 0) > 0) && (
    <div className="flex gap-1 mb-1">
      <SubirComprobante 
        tipo="debt_payment"
        id={pago.id}
        session={session}
        onComprobanteSubido={async () => {
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }}
      />
      {pago.comprobante_url && (
        <a 
          href={pago.comprobante_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-green-400 hover:text-green-300 text-sm px-2 py-1 border border-green-700 rounded"
          title="Ver comprobante"
        >
          👁️ Ver
        </a>
      )}
    </div>
  )}
</td>
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
function PrintArea({ state }: any) {
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
// ==== PLANTILLA: REPORTE MEJORADO ====
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
            <div style={{ fontWeight: 800, letterSpacing: 1 }}>REPORTE COMPLETO</div>
            <div style={{ marginTop: 2 }}>MITOBICEL</div>
          </div>
          <div className="text-right">
            <div><b>Período:</b> {rangoStr}</div>
            <div><b>Tipo:</b> {inv.periodo}</div>
            <div><b>Fecha:</b> {new Date().toLocaleString("es-AR")}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

        {/* RESUMEN PRINCIPAL MEJORADO */}
        <div className="grid grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <div style={{ fontWeight: 700 }}>Ventas totales</div>
            <div>{fmt(inv.resumen.ventas)}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Deuda del día</div>
            <div style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(inv.resumen.deudaDelDia)}</div>
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

        {/* 👇👇👇 SECCIÓN: DEUDA DEL DÍA */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>📋 Facturas con Deuda del Día</div>
        
        {inv.deudaDelDiaDetalle && inv.deudaDelDiaDetalle.length > 0 ? (
          <table className="print-table text-sm">
            <thead>
              <tr>
                <th style={{ width: "10%" }}>Factura</th>
                <th style={{ width: "25%" }}>Cliente</th>
                <th style={{ width: "20%" }}>Total</th>
                <th style={{ width: "20%" }}>Pagado</th>
                <th style={{ width: "25%" }}>Debe</th>
              </tr>
            </thead>
            <tbody>
              {inv.deudaDelDiaDetalle.map((f: any, i: number) => {
                const total = parseNum(f.total);
                const pagos = parseNum(f?.payments?.cash || 0) + 
                             parseNum(f?.payments?.transfer || 0) + 
                             parseNum(f?.payments?.saldo_aplicado || 0);
                const debe = total - pagos;
                
                return (
                  <tr key={f.id}>
                    <td style={{ textAlign: "right" }}>#{pad(f.number)}</td>
                    <td>{f.client_name}</td>
                    <td style={{ textAlign: "right" }}>{fmt(total)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(pagos)}</td>
                    <td style={{ textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>
                      {fmt(debe)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-slate-500 p-2">No hay facturas con deuda pendiente en el día</div>
        )}

        {/* 👇👇👇 SECCIÓN: DEUDORES ACTIVOS */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>👥 Deudores Activos</div>
        
        {inv.deudoresActivos && inv.deudoresActivos.length > 0 ? (
          inv.deudoresActivos.map((deudor: any, idx: number) => (
            <div key={deudor.id} style={{ border: "1px solid #000", marginBottom: 12, padding: 10, pageBreakInside: 'avoid' }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div style={{ fontWeight: 700 }}>{deudor.name} (N° {deudor.number})</div>
                  <div style={{ fontSize: 11 }}>
                    Deuda bruta: {fmt(deudor.deuda_bruta)} • Saldo favor: {fmt(deudor.saldo_favor)} • Facturas: {deudor.cantidad_facturas}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#f59e0b" }}>
                  {fmt(deudor.deuda_neta)}
                </div>
              </div>

              {/* DETALLE POR FACTURA (igual que en DeudoresTab) */}
              {deudor.detalle_facturas.map((deuda: any, factIdx: number) => (
                <div key={factIdx} style={{ marginBottom: 8, padding: 6, border: "1px dashed #ccc" }}>
                  <div className="flex justify-between text-sm">
                    <span>Factura #{pad(deuda.factura_numero)}</span>
                    <span style={{ fontWeight: 600, color: "#f59e0b" }}>
                      {fmt(deuda.monto_debe)}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#666" }}>
                    Fecha: {new Date(deuda.fecha).toLocaleDateString("es-AR")} • 
                    Total: {fmt(deuda.monto_total)} • 
                    Pagado: {fmt(deuda.monto_pagado)}
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500 p-2">No hay deudores activos</div>
        )}

        {/* 👇👇👇 SECCIÓN: PAGOS DE DEUDORES CON DETALLE */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>💳 Pagos de Deudores Registrados</div>
        
        {inv.pagosDeudoresDetallados && inv.pagosDeudoresDetallados.length > 0 ? (
          inv.pagosDeudoresDetallados.map((pago: any, idx: number) => (
            <div key={pago.pago_id} style={{ border: "1px solid #000", marginBottom: 12, padding: 10, pageBreakInside: 'avoid' }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div style={{ fontWeight: 700 }}>{pago.cliente}</div>
                  <div style={{ fontSize: 11 }}>
                    {new Date(pago.fecha_pago).toLocaleString("es-AR")} • 
                    Efectivo: {fmt(pago.efectivo)} • 
                    Transferencia: {fmt(pago.transferencia)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: "#10b981" }}>Pagado: {fmt(pago.total_pagado)}</div>
                  <div style={{ fontSize: 11 }}>
                    Deuda: {fmt(pago.deuda_antes_pago)} → {fmt(pago.deuda_despues_pago)}
                  </div>
                </div>
              </div>

              {/* DETALLE DE APLICACIÓN DEL PAGO */}
              {pago.aplicaciones && pago.aplicaciones.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Aplicado a:</div>
                  {pago.aplicaciones.map((app: any, appIdx: number) => (
                    <div key={appIdx} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Factura #{pad(app.factura_numero)}:</span>
                      <span>{fmt(app.monto_aplicado)} (Deuda: {fmt(app.deuda_antes)} → {fmt(app.deuda_despues)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500 p-2">No hay pagos de deudores en el período</div>
        )}

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

const clientDebtTotal = (() => {
  if (inv?.client_id) {
    const cliente = state.clients.find((c: any) => c.id === inv.client_id);
    if (cliente) {
      const detalleDeudas = calcularDetalleDeudas(state, inv.client_id);
      return calcularDeudaTotal(detalleDeudas, cliente);
    }
  }
  return parseNum(inv?.client_debt_total ?? 0);
})();

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
       // 👇👇👇 NUEVA SUSCRIPCIÓN PARA DEBT_PAYMENTS
    const debtPaymentsSubscription = supabase
      .channel('debt-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debt_payments'
        },
        async () => {
          console.log("🔄 Cambios en debt_payments detectados, recargando...");
          const refreshedState = await loadFromSupabase(seedState());
          setState(refreshedState);
        }
      )
      .subscribe();

      return () => {
        supabase.removeChannel(budgetSubscription);
        supabase.removeChannel(invoicesSubscription);
        supabase.removeChannel(pedidosSubscription); // 👈 AGREGAR ESTA LÍNEA
         supabase.removeChannel(debtPaymentsSubscription);
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
  <ClientesTab state={state} setState={setState} session={session} /> // 👈 Agregar session aquí
)}
            {session.role !== "cliente" && session.role !== "pedido-online" && tab === "Productos" && (
              <ProductosTab state={state} setState={setState} role={session.role} />
            )}
{session.role !== "cliente" && session.role !== "pedido-online" && tab === "Deudores" && (
  <DeudoresTab state={state} setState={setState} session={session} /> // 👈 AGREGAR session={session}
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

            <div className="fixed bottom-3 right-3 text-[10px] text-slate-500 select-none">
              {hasSupabase ? "Supabase activo" : "Datos en navegador"}
            </div>
          </>
        )}
      </div>

      {/* Plantillas que sí se imprimen */}
<PrintArea state={state} />
    </>
  );
}
