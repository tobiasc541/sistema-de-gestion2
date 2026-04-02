// CostosProduccionHelper.ts
// 👇 PEGAR TODO ESTE CÓDIGO EN EL NUEVO ARCHIVO

// Tipos para los diferentes productos
export type TipoProducto = "rollito_fondo" | "bolsa_camiseta" | "film";

export type MedidaFilm = "30" | "38" | "45";

// Configuración de scrap por tipo
const SCRAP_POR_TIPO: Record<TipoProducto, number> = {
  rollito_fondo: 0.035, // 3.5%
  bolsa_camiseta: 0.12, // 12%
  film: 0, // 0%
};

// Medidas de bobinas de film (todas 5000m)
const MEDIDAS_FILM: Record<MedidaFilm, { cm: number; metros: number; precio_usd_estimado: number }> = {
  "30": { cm: 30, metros: 5000, precio_usd_estimado: 80 },
  "38": { cm: 38, metros: 5000, precio_usd_estimado: 90 },
  "45": { cm: 45, metros: 5000, precio_usd_estimado: 100 },
};

// Función principal para calcular costo de producción
export interface CalcularCostoParams {
  tipo: TipoProducto;
  // Para rollito y bolsa (por kg)
  kg_bobina?: number;
  kg_por_bulto?: number;
  // Para film (por metro)
  medida_film?: MedidaFilm;
  metros_solicitados?: number;
  valor_dolar?: number;
  // Costos generales
  valor_hora_persona?: number;
  horas_trabajadas?: number;
  costo_luz_mensual?: number;
  dias_trabajados_mes?: number;
  valor_funda?: number;
  valor_packaging?: number;
  valor_cono?: number;
}

export interface ResultadoCosto {
  costo_material: number;
  costo_persona: number;
  costo_luz: number;
  costo_funda: number;
  costo_packaging: number;
  costo_cono: number;
  scrap: number;
  costo_total: number;
  desglose: string;
}

export function calcularCostoProduccion(params: CalcularCostoParams): ResultadoCosto {
  const {
    tipo,
    kg_bobina = 0,
    kg_por_bulto = 0,
    medida_film = "45",
    metros_solicitados = 0,
    valor_dolar = 1000,
    valor_hora_persona = 0,
    horas_trabajadas = 0,
    costo_luz_mensual = 520000,
    dias_trabajados_mes = 26,
    valor_funda = 0,
    valor_packaging = 0,
    valor_cono = 0,
  } = params;

  let costo_material = 0;
  let scrap = 0;
  let desglose = "";

  // 1. CALCULAR COSTO DE MATERIAL según tipo
  if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
    // Costo por kg de bobina * kg por bulto
    const costo_base = kg_bobina * kg_por_bulto;
    const porcentaje_scrap = SCRAP_POR_TIPO[tipo];
    scrap = costo_base * porcentaje_scrap;
    costo_material = costo_base + scrap;
    desglose = `Material: ${money(costo_base)} + ${porcentaje_scrap * 100}% scrap (${money(scrap)}) = ${money(costo_material)}`;
  } 
  else if (tipo === "film") {
    // Film: valor por metro según medida
    const medidaInfo = MEDIDAS_FILM[medida_film];
    const valor_bobina_usd = medidaInfo.precio_usd_estimado;
    const valor_bobina_ars = valor_bobina_usd * valor_dolar;
    const valor_por_metro = valor_bobina_ars / medidaInfo.metros;
    costo_material = valor_por_metro * metros_solicitados;
    desglose = `Film ${medida_film}cm: ${valor_bobina_usd} USD × ${valor_dolar} = ${money(valor_bobina_ars)} / ${medidaInfo.metros}m = ${money(valor_por_metro)}/m × ${metros_solicitados}m = ${money(costo_material)}`;
  }

  // 2. CALCULAR COSTO DE PERSONA (por hora)
  const costo_persona = valor_hora_persona * horas_trabajadas;
  desglose += `\nPersona: ${money(valor_hora_persona)}/h × ${horas_trabajadas}h = ${money(costo_persona)}`;

  // 3. CALCULAR COSTO DE LUZ (por hora)
  const costo_luz_por_hora = costo_luz_mensual / (dias_trabajados_mes * 24);
  const costo_luz = costo_luz_por_hora * horas_trabajadas;
  desglose += `\nLuz: ${money(costo_luz_por_hora)}/h × ${horas_trabajadas}h = ${money(costo_luz)}`;

  // 4. OTROS COSTOS
  const costo_funda = valor_funda;
  const costo_packaging = valor_packaging;
  const costo_cono = valor_cono;

  // 5. COSTO TOTAL
  const costo_total = costo_material + costo_persona + costo_luz + costo_funda + costo_packaging + costo_cono;
  desglose += `\nTotal: ${money(costo_total)}`;

  return {
    costo_material,
    costo_persona,
    costo_luz,
    costo_funda,
    costo_packaging,
    costo_cono,
    scrap,
    costo_total,
    desglose,
  };
}

// Helper para formatear dinero
function money(n: number): string {
  return new Intl.NumberFormat("es-AR", { 
    style: "currency", 
    currency: "ARS", 
    maximumFractionDigits: 2 
  }).format(n || 0);
}
