// CostosProduccionHelper.ts

export type TipoProducto = "rollito_fondo" | "bolsa_camiseta" | "film";
export type MedidaFilm = "30" | "38" | "45";

// Scrap por tipo de producto
const SCRAP_POR_TIPO: Record<TipoProducto, number> = {
  rollito_fondo: 0.035,  // 3.5%
  bolsa_camiseta: 0.12,  // 12%
  film: 0,               // 0%
};

// Configuración de bobinas de film (TODAS 5000 MTS)
export interface BobinaFilmConfig {
  medida: MedidaFilm;
  cm: number;
  metros_totales: number;
  valor_usd: number; // 👈 AHORA LO INGRESA EL USUARIO MANUALMENTE
}

export interface CalcularCostoParams {
  tipo: TipoProducto;
  
  // Para rollito_fondo y bolsa_camiseta (por KG)
  kg_bobina?: number;      // Precio por KG de la bobina
  kg_por_bulto?: number;   // KG que pesa cada bulto
  bultos_producidos?: number; // 👈 NUEVO: Cantidad de bultos que salen en esas horas
  
  // Para film (por METRO)
  medida_film?: MedidaFilm;
  valor_usd_bobina?: number;  // 👈 MANUAL: valor en USD de la bobina
  metros_solicitados?: number;
  valor_dolar?: number;
  metros_por_rollo?: number;  // 👈 NUEVO: Metros que salen por rollo aprox
  
  // Costos generales
  valor_hora_persona?: number;  // Lo que se le paga por hora a la persona
  horas_trabajadas?: number;    // Horas que trabajó
  cantidad_producida_aprox?: number; // 👈 NUEVO: Cantidad aprox de rollos/camisetas/rollos de film que salen
  
  costo_luz_mensual?: number;
  dias_trabajados_mes?: number;
  valor_funda?: number;
  valor_packaging?: number;
  valor_cono?: number;
}

export interface ResultadoCosto {
  // Material
  costo_material_bruto: number;
  scrap: number;
  costo_material_total: number;
  
  // Mano de obra
  costo_persona_total: number;
  costo_persona_por_unidad: number;
  
  // Luz
  costo_luz_total: number;
  costo_luz_por_unidad: number;
  
  // Otros
  costo_funda: number;
  costo_packaging: number;
  costo_cono: number;
  
  // Totales
  costo_total: number;
  costo_por_unidad: number;  // 👈 NUEVO: Costo por rollo/camiseta/rollo de film
  
  desglose: string;
}

export function calcularCostoProduccion(params: CalcularCostoParams): ResultadoCosto {
  const {
    tipo,
    // Rollito y bolsa
    kg_bobina = 0,
    kg_por_bulto = 0,
    bultos_producidos = 0,
    // Film
    medida_film = "45",
    valor_usd_bobina = 0,
    metros_solicitados = 0,
    valor_dolar = 1000,
    metros_por_rollo = 0,
    // Generales
    valor_hora_persona = 0,
    horas_trabajadas = 0,
    cantidad_producida_aprox = 0,
    costo_luz_mensual = 520000,
    dias_trabajados_mes = 26,
    valor_funda = 0,
    valor_packaging = 0,
    valor_cono = 0,
  } = params;

  let costo_material_bruto = 0;
  let scrap = 0;
  let costo_material_total = 0;
  let unidades_producidas = 0;
  let desglose = "";

  // ============================================
  // 1. CALCULAR COSTO DE MATERIAL según tipo
  // ============================================
  if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
    // Costo por KG de bobina × KG por bulto × cantidad de bultos
    const costo_por_bulto = kg_bobina * kg_por_bulto;
    costo_material_bruto = costo_por_bulto * bultos_producidos;
    const porcentaje_scrap = SCRAP_POR_TIPO[tipo];
    scrap = costo_material_bruto * porcentaje_scrap;
    costo_material_total = costo_material_bruto + scrap;
    
    // Unidades producidas = bultos
    unidades_producidas = bultos_producidos;
    
    desglose = `📦 MATERIAL (${tipo === "rollito_fondo" ? "Rollito Fondo" : "Bolsa Camiseta"}):\n`;
    desglose += `   Costo por bulto: ${money(kg_bobina)}/kg × ${kg_por_bulto}kg = ${money(costo_por_bulto)}\n`;
    desglose += `   × ${bultos_producidos} bultos = ${money(costo_material_bruto)}\n`;
    desglose += `   + ${porcentaje_scrap * 100}% scrap (${money(scrap)}) = ${money(costo_material_total)}\n`;
  } 
  else if (tipo === "film") {
    // Film: valor en USD de la bobina × cotización dólar
    const valor_bobina_ars = valor_usd_bobina * valor_dolar;
    // Todas las bobinas traen 5000 metros
    const metros_totales_bobina = 5000;
    const valor_por_metro = valor_bobina_ars / metros_totales_bobina;
    costo_material_bruto = valor_por_metro * metros_solicitados;
    scrap = 0; // Film no tiene scrap
    costo_material_total = costo_material_bruto;
    
    // Unidades producidas = cantidad de rollos de film (metros solicitados / metros por rollo)
    unidades_producidas = metros_por_rollo > 0 ? Math.floor(metros_solicitados / metros_por_rollo) : 0;
    
    desglose = `📦 FILM ${medida_film}cm:\n`;
    desglose += `   Bobina: ${valor_usd_bobina} USD × ${valor_dolar} = ${money(valor_bobina_ars)}\n`;
    desglose += `   / ${metros_totales_bobina}m = ${money(valor_por_metro)}/m\n`;
    desglose += `   × ${metros_solicitados}m = ${money(costo_material_bruto)}\n`;
    if (metros_por_rollo > 0) {
      desglose += `   → Salen ${unidades_producidas} rollos de ${metros_por_rollo}m c/u\n`;
    }
  }

  // ============================================
  // 2. CALCULAR COSTO DE PERSONA
  // ============================================
  const costo_persona_total = valor_hora_persona * horas_trabajadas;
  // Costo por unidad = costo_persona_total / cantidad_producida_aprox
  const costo_persona_por_unidad = cantidad_producida_aprox > 0 
    ? costo_persona_total / cantidad_producida_aprox 
    : 0;
  
  desglose += `\n👤 MANO DE OBRA:\n`;
  desglose += `   ${money(valor_hora_persona)}/h × ${horas_trabajadas}h = ${money(costo_persona_total)}\n`;
  if (cantidad_producida_aprox > 0) {
    desglose += `   / ${cantidad_producida_aprox} unidades = ${money(costo_persona_por_unidad)} por unidad\n`;
  }

  // ============================================
  // 3. CALCULAR COSTO DE LUZ
  // ============================================
  // Costo luz por hora = costo_mensual / (días_trabajados × 24hs)
  const costo_luz_por_hora = costo_luz_mensual / (dias_trabajados_mes * 24);
  const costo_luz_total = costo_luz_por_hora * horas_trabajadas;
  // Costo luz por unidad
  const costo_luz_por_unidad = cantidad_producida_aprox > 0 
    ? costo_luz_total / cantidad_producida_aprox 
    : 0;
  
  desglose += `\n💡 LUZ:\n`;
  desglose += `   ${money(costo_luz_por_hora)}/h × ${horas_trabajadas}h = ${money(costo_luz_total)}\n`;
  if (cantidad_producida_aprox > 0) {
    desglose += `   / ${cantidad_producida_aprox} unidades = ${money(costo_luz_por_unidad)} por unidad\n`;
  }

  // ============================================
  // 4. OTROS COSTOS
  // ============================================
  const costo_funda = valor_funda;
  const costo_packaging = valor_packaging;
  const costo_cono = valor_cono;
  
  if (costo_funda > 0) desglose += `\n📦 Funda: ${money(costo_funda)}`;
  if (costo_packaging > 0) desglose += `\n📦 Packaging: ${money(costo_packaging)}`;
  if (costo_cono > 0) desglose += `\n🧵 Cono: ${money(costo_cono)}`;

  // ============================================
  // 5. COSTO TOTAL
  // ============================================
  const costo_total = costo_material_total + costo_persona_total + costo_luz_total + costo_funda + costo_packaging + costo_cono;
  
  // Costo por unidad final
  const costo_por_unidad = unidades_producidas > 0 
    ? costo_total / unidades_producidas 
    : (cantidad_producida_aprox > 0 ? costo_total / cantidad_producida_aprox : costo_total);
  
  desglose += `\n\n💰 COSTO TOTAL: ${money(costo_total)}`;
  if (unidades_producidas > 0) {
    desglose += `\n💰 COSTO POR UNIDAD: ${money(costo_por_unidad)} (${unidades_producidas} unidades)`;
  } else if (cantidad_producida_aprox > 0) {
    desglose += `\n💰 COSTO POR UNIDAD APROX: ${money(costo_por_unidad)} (aprox ${cantidad_producida_aprox} unidades)`;
  }

  return {
    costo_material_bruto,
    scrap,
    costo_material_total,
    costo_persona_total,
    costo_persona_por_unidad,
    costo_luz_total,
    costo_luz_por_unidad,
    costo_funda,
    costo_packaging,
    costo_cono,
    costo_total,
    costo_por_unidad,
    desglose,
  };
}

function money(n: number): string {
  return new Intl.NumberFormat("es-AR", { 
    style: "currency", 
    currency: "ARS", 
    maximumFractionDigits: 2 
  }).format(n || 0);
}
