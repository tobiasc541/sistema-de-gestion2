// CostosProduccionHelper.ts

export type TipoProducto = "rollito_fondo" | "bolsa_camiseta" | "film";
export type MedidaFilm = "30" | "38" | "45";

const SCRAP_POR_TIPO: Record<TipoProducto, number> = {
  rollito_fondo: 0.035,
  bolsa_camiseta: 0.12,
  film: 0,
};

export interface CalcularCostoParams {
  tipo: TipoProducto;
  
  // Para rollito_fondo y bolsa_camiseta
  kg_bobina?: number;
  kg_por_bulto?: number;
  bultos_producidos?: number;
  
  // Para film
  medida_film?: MedidaFilm;
  valor_usd_bobina?: number;
  metros_solicitados?: number;
  valor_dolar?: number;
  metros_por_rollo?: number;
  
  // Costos generales
  valor_hora_persona?: number;
  horas_trabajadas?: number;
  cantidad_total_producida?: number;  // 👈 TOTAL de unidades que salen en esas horas
  costo_luz_mensual?: number;
  dias_trabajados_mes?: number;
  valor_funda?: number;
  valor_packaging?: number;
  valor_cono?: number;
}

export interface ResultadoCosto {
  costo_material_bruto: number;
  scrap: number;
  costo_material_total: number;
  costo_material_por_unidad: number;
  costo_persona_total: number;
  costo_persona_por_unidad: number;
  costo_luz_total: number;
  costo_luz_por_unidad: number;
  costo_funda_por_unidad: number;
  costo_packaging_por_unidad: number;
  costo_cono_por_unidad: number;
  unidades_producidas: number;
  costo_total: number;
  costo_por_unidad: number;
  desglose: string;
}

export function calcularCostoProduccion(params: CalcularCostoParams): ResultadoCosto {
  const {
    tipo,
    kg_bobina = 0,
    kg_por_bulto = 0,
    bultos_producidos = 0,
    medida_film = "45",
    valor_usd_bobina = 0,
    metros_solicitados = 0,
    valor_dolar = 1000,
    metros_por_rollo = 0,
    valor_hora_persona = 0,
    horas_trabajadas = 0,
    cantidad_total_producida = 0,
    costo_luz_mensual = 520000,
    dias_trabajados_mes = 26,
    valor_funda = 0,
    valor_packaging = 0,
    valor_cono = 0,
  } = params;

  let costo_material_bruto = 0;
  let scrap = 0;
  let costo_material_total = 0;
  let unidades_material = 0;  // Unidades según el material (bultos o rollos de film)
  let desglose = "";

  // ============================================
  // 1. MATERIAL
  // ============================================
  if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
    const costo_por_bulto = kg_bobina * kg_por_bulto;
    costo_material_bruto = costo_por_bulto * bultos_producidos;
    const porcentaje_scrap = SCRAP_POR_TIPO[tipo];
    scrap = costo_material_bruto * porcentaje_scrap;
    costo_material_total = costo_material_bruto + scrap;
    unidades_material = bultos_producidos;
    
    desglose = `📦 MATERIAL (${tipo === "rollito_fondo" ? "Rollito Fondo" : "Bolsa Camiseta"}):\n`;
    desglose += `   Costo por bulto: ${money(kg_bobina)}/kg × ${kg_por_bulto}kg = ${money(costo_por_bulto)}\n`;
    desglose += `   × ${bultos_producidos} bultos = ${money(costo_material_bruto)}\n`;
    desglose += `   + ${porcentaje_scrap * 100}% scrap (${money(scrap)}) = ${money(costo_material_total)}\n`;
    desglose += `   → Salen ${unidades_material} bultos\n`;
  } 
  else if (tipo === "film") {
    const valor_bobina_ars = valor_usd_bobina * valor_dolar;
    const metros_totales_bobina = 5000;
    const valor_por_metro = valor_bobina_ars / metros_totales_bobina;
    costo_material_bruto = valor_por_metro * metros_solicitados;
    scrap = 0;
    costo_material_total = costo_material_bruto;
    
    if (metros_por_rollo > 0 && metros_solicitados > 0) {
      unidades_material = metros_solicitados / metros_por_rollo;
    } else {
      unidades_material = 0;
    }
    
    desglose = `📦 FILM ${medida_film}cm:\n`;
    desglose += `   Bobina: ${valor_usd_bobina} USD × ${valor_dolar} = ${money(valor_bobina_ars)}\n`;
    desglose += `   / ${metros_totales_bobina}m = ${money(valor_por_metro)}/m\n`;
    desglose += `   × ${metros_solicitados}m = ${money(costo_material_bruto)}\n`;
    desglose += `   → Salen ${unidades_material.toFixed(2)} rollos de ${metros_por_rollo}m c/u\n`;
  }

  // ============================================
  // 2. CALCULAR UNIDADES POR HORA (según cantidad_total_producida)
  // ============================================
  // 🔥 CLAVE: Usamos la cantidad que el usuario ingresó en "Cantidad aprox producida"
  const unidades_por_hora = cantidad_total_producida > 0 && horas_trabajadas > 0
    ? cantidad_total_producida / horas_trabajadas
    : 0;
  
  // ============================================
  // 3. COSTO DE MATERIAL POR UNIDAD
  // ============================================
  const costo_material_por_unidad = unidades_material > 0
    ? costo_material_total / unidades_material
    : 0;

  // ============================================
  // 4. MANO DE OBRA - POR UNIDAD
  // ============================================
  const costo_persona_total = valor_hora_persona * horas_trabajadas;
  
  // 🔥 Costo de mano de obra por unidad = (valor hora) / (unidades por hora)
  const costo_persona_por_unidad = unidades_por_hora > 0
    ? valor_hora_persona / unidades_por_hora
    : 0;
  
  desglose += `\n👤 MANO DE OBRA:\n`;
  desglose += `   Valor hora: ${money(valor_hora_persona)}/h\n`;
  desglose += `   En ${horas_trabajadas}h salen ${cantidad_total_producida} unidades\n`;
  desglose += `   → Unidades por hora: ${unidades_por_hora.toFixed(2)}\n`;
  desglose += `   → Costo mano de obra por unidad: ${money(valor_hora_persona)} ÷ ${unidades_por_hora.toFixed(2)} = ${money(costo_persona_por_unidad)}\n`;

  // ============================================
  // 5. LUZ - POR UNIDAD
  // ============================================
  const costo_luz_por_hora = costo_luz_mensual / (dias_trabajados_mes * 24);
  const costo_luz_total = costo_luz_por_hora * horas_trabajadas;
  
  // 🔥 Costo de luz por unidad = (costo luz por hora) / (unidades por hora)
  const costo_luz_por_unidad = unidades_por_hora > 0
    ? costo_luz_por_hora / unidades_por_hora
    : 0;
  
  desglose += `\n💡 LUZ:\n`;
  desglose += `   Costo luz mensual: ${money(costo_luz_mensual)}\n`;
  desglose += `   Días trabajados: ${dias_trabajados_mes}\n`;
  desglose += `   Costo luz por hora: ${money(costo_luz_por_hora)}/h\n`;
  desglose += `   → Costo luz por unidad: ${money(costo_luz_por_hora)} ÷ ${unidades_por_hora.toFixed(2)} = ${money(costo_luz_por_unidad)}\n`;

  // ============================================
  // 6. OTROS COSTOS (son por unidad, directos)
  // ============================================
  desglose += `\n📦 OTROS COSTOS (por unidad):\n`;
  desglose += `   Funda: ${money(valor_funda)}\n`;
  desglose += `   Packaging: ${money(valor_packaging)}\n`;
  desglose += `   Cono: ${money(valor_cono)}\n`;

  // ============================================
  // 7. COSTO POR UNIDAD (suma de todos)
  // ============================================
  const costo_por_unidad = costo_material_por_unidad + costo_persona_por_unidad + costo_luz_por_unidad + valor_funda + valor_packaging + valor_cono;
  
  // Unidades finales que se producen (para el total)
  const unidades_producidas_final = unidades_material > 0 ? unidades_material : cantidad_total_producida;
  
  // Costo total = costo por unidad × unidades producidas
  const costo_total = costo_por_unidad * unidades_producidas_final;
  
  desglose += `\n📊 RESUMEN COSTO POR UNIDAD:\n`;
  desglose += `   Material por unidad: ${money(costo_material_por_unidad)}\n`;
  desglose += `   Mano de obra por unidad: + ${money(costo_persona_por_unidad)}\n`;
  desglose += `   Luz por unidad: + ${money(costo_luz_por_unidad)}\n`;
  desglose += `   Funda: + ${money(valor_funda)}\n`;
  desglose += `   Packaging: + ${money(valor_packaging)}\n`;
  desglose += `   Cono: + ${money(valor_cono)}\n`;
  desglose += `   = ${money(costo_por_unidad)} por unidad\n`;
  desglose += `\n💰 COSTO TOTAL (${unidades_producidas_final.toFixed(2)} unidades): ${money(costo_total)}`;

  return {
    costo_material_bruto,
    scrap,
    costo_material_total,
    costo_material_por_unidad,
    costo_persona_total,
    costo_persona_por_unidad,
    costo_luz_total,
    costo_luz_por_unidad,
    costo_funda_por_unidad: valor_funda,
    costo_packaging_por_unidad: valor_packaging,
    costo_cono_por_unidad: valor_cono,
    unidades_producidas: unidades_producidas_final,
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
