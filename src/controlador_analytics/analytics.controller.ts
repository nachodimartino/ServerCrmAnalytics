import { Request, Response, NextFunction } from 'express';
import { LeadRepository } from '../leads/lead.repository.js';
import { Lead } from '../leads/lead.entity.js';
import { mensajesLead } from '../mensajesLead/mensajesLead.entity.js';
import { mensajesLeadRepository } from '../mensajesLead/mensajesLead.repository.js';
import { IntentService } from '../shared/services/intent.service.js';
import { leadScoringService } from '../shared/services/lead-scoring.service.js';
import { ValidationError } from '@mikro-orm/core';
const leadrepository = new LeadRepository();
const mensajesLeadrepository = new mensajesLeadRepository();
const intentService= new IntentService
const leadscoringService=new leadScoringService

export function sanitizeanalitycsInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
  
    leadIdExternal: req.body.leadIdExternal, 
    messages:req.body.messages,
    customer_name: req.body.customer_name,
    email:req.body.email,
    phone:req.body.phone,
    channel:req.body.channel,
    ticket_estimate:req.body.ticket_estimate,
    n_mensajes:req.body.n_mensajes,
    avg_response_time:req.body.avg_response_time,
     conversation_days:req.body. conversation_days,
     n_channels:req.body.n_channels,
     fecha_lote:req.body.fecha_lote

 
    };


  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

export async function create(req:Request, res:Response) {

  try{
      const input = req.body.sanitizedInput;
const errors = [];

// 1. Validar Email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!input.email || !emailRegex.test(input.email)) {
    errors.push("El formato del email es inválido.");
}

// 2. Validar Teléfono (que sea numérico)
if (input.phone && isNaN(Number(input.phone))) {
    errors.push("El número de teléfono debe ser un valor numérico.");
}

// 3. Validar Canales (Enum)
const canalesValidos = ['whatsapp', 'web', 'instagram', 'twitter', 'email','facebook'];
if (!canalesValidos.includes(input.channel)) {
    errors.push(`Canal inválido. Valores permitidos: ${canalesValidos.join(', ')}`);
}

// 4. Validar Ticket Estimate (Enum)
const ticketValidos = ['high', 'low', 'medium'];
if (!ticketValidos.includes(input.ticket_estimate)) {
    errors.push(`Ticket estimate inválido. Valores permitidos: ${ticketValidos.join(', ')}`);
}

// 5. Validar Tipos Numéricos
if (typeof input.avg_response_time !== 'number') errors.push("avg_response_time debe ser un número.");
if (typeof input.conversation_days !== 'number') errors.push("conversation_days debe ser un número.");
if (typeof input.n_channels !== 'number') errors.push("n_channels debe ser un número.");

// --- RETORNO DE ERRORES ---
if (errors.length > 0) {
    return res.status(400).json({ 
        message: 'Error de validación en los datos recibidos', 
        errors: errors 
    });
}


// FIN DE VALIDACIÓN 
        const leadIdExternal=req.body.leadIdExternal
        let lead=await leadrepository.getOne(leadIdExternal)
        if(!lead){
            const leadNuevo={
                leadIdExternal:req.body.sanitizedInput.leadIdExternal,
                customerName:req.body.sanitizedInput.customer_name ,
                email:req.body.sanitizedInput.email ,
                phone:req.body.sanitizedInput.phone ,
                channel:req.body.sanitizedInput.channel ,
                ticket_estimate:req.body.sanitizedInput.ticket_estimate ,
                avg_response_time:req.body.sanitizedInput.avg_response_time,
                conversation_days: req.body.sanitizedInput.conversation_days,
                n_channels: req.body.sanitizedInput.n_channels
            }
            lead=await leadrepository.create(leadNuevo)
        }
        else{const leadActualizado={
                channel:req.body.channel ,
                ticket_estimate:req.body.sanitizedInput.ticket_estimate ,
                avg_response_time:req.body.sanitizedInput.avg_response_time,
                conversation_days: req.body.sanitizedInput.conversation_days,
                n_channels: req.body.sanitizedInput.n_channels}
            lead=await leadrepository.update(lead.id,leadActualizado)
        }
        
        const messages= req.body.sanitizedInput.messages
         const mensajesArray = Array.isArray(messages) ? messages : [messages];
          const mensajesCreados = [];
          
          for ( const m of mensajesArray){ // el array sigue
            if(esMensajePrescindible(m.message)){// esto sgiue
              continue;
            }
           
       // const mensaje= await mensajesLeadrepository.create(message)// esto aca no va mas
         const intention = await intentService.predictIntent(m.message)
         const mensaje ={
           lead:lead,
           message:m.message,
           createdAt:m.createdAt,
          fecha_lote:req.body.sanitizedInput.fecha_lote,
          p_compra:intention.p_compra,
          probabilities:intention.probabilities
         }
         mensajesCreados.push(mensaje);
        console.log('Intencion:',intention)
        // deberia crear un objeto mensaje que agregue lo que devuelve la intencion para crear el mensaje
        // luego con ese objeto mensaje que es el mismo que el de arriba solamente que esta completo con la intencion ahora
        // lo guardo en un array de mensajes
        // una vez que tenga todos los mensajes de ese lead en ese arreglo, paso el array completo al repositorio que maneja los datos
          }
       await mensajesLeadrepository.create_mensajes(mensajesCreados)
        const cantidad_mensajes=mensajesCreados.length
        console.log('cantidad mensajes',cantidad_mensajes)
        // entra en juego el primer modelo de clasificacion de intencion
        const avg_p_compra= await calculaAvgIntention(lead.id) 
        const max_p_compra= await calculamaxIntention(lead.id)
        const trend_p_compra= await calcula_trend_intention(lead.id)
        const intent_entropy=await calculaIntentEntropy(lead.id)
        const data={
        avg_p_compra:avg_p_compra,
        max_p_compra:max_p_compra,
        trend_p_compra:trend_p_compra,
        intent_entropy:intent_entropy 

        }
        const leadForScoring={
          ...lead,
          ... data,
          n_mensajes:cantidad_mensajes
        }
        console.log('Lead',leadForScoring)
        
       const leadScoring = await leadscoringService.predictleadScoring(leadForScoring)
        lead=await leadrepository.update(lead.id,{...data,...leadScoring,n_mensajes:cantidad_mensajes})
        console.log('lead scoring',leadScoring,lead)

       
const respuesta = await armar_respuesta(lead)
console.log('RESPUESTA:', JSON.stringify(respuesta))
return res.status(201).json({ message: 'Lead creado con éxito', data: respuesta })
    }catch(error:any){
 return res.status(500).json({ message: 'Error en la capa de datos', error: error.message });
    }
   
}

async function calculaAvgIntention(idLead: number) {
  const messagesLead = await mensajesLeadrepository.getMessagesByLead(idLead);
  if (messagesLead.length === 0) return 0;

  // 1. El mensaje más nuevo es nuestra referencia (están ordenados ASC, así que es el último)
  const fechaReferencia = messagesLead[messagesLead.length - 1].createdAt.getTime();
  
  let sumaPonderada = 0;
  let sumaPesos = 0;

  for (const m of messagesLead) {
    // 2. Calcular diferencia en días
    const diffMs = fechaReferencia - m.createdAt.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 3. Calcular peso (usando 0.8 como factor de decaimiento por día)
    const peso = Math.pow(0.8, diffDias);

    sumaPonderada += m.p_compra * peso;
    sumaPesos += peso;
  }

  return sumaPonderada / sumaPesos;
}

 async function calculamaxIntention(idLead:number) {
  const messagesLead= await mensajesLeadrepository.getMessagesByLead(idLead)
    if (messagesLead.length === 0 ){
      return 0
    }
  
const maxPCompra = Math.max(...messagesLead.map(m => m.p_compra));
  return maxPCompra
 }
 
// 1. Nueva función auxiliar para la normalización (la "Pendiente Máxima Teórica")
function calcularPendienteMax(n: number): number {
  if (n < 2) return 1.0;

  let sumX = 0;
  let sumX2 = 0;
  // Para la pendiente máxima, asumimos que todos los mensajes son 0 
  // excepto el último que es 1 (y = [0, 0, ..., 1])
  for (let i = 1; i <= n; i++) {
    sumX += i;
    sumX2 += i * i;
  }
  
  const xUltimo = n; // Es el único mensaje con y=1
  const sumY = 1;
  const sumXY = n;   // n * 1

  const numerador = (n * sumXY) - (sumX * sumY);
  const denominador = (n * sumX2) - (sumX * sumX);

  return numerador / denominador;
}

// 2. Tu función modificada
async function calcula_trend_intention(idLead: number) {
  const messagesLead = await mensajesLeadrepository.getMessagesByLead(idLead);
  
  if (messagesLead.length === 0) return 0;
  const n = messagesLead.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = messagesLead[i].p_compra; // Asegúrate de que este campo exista en tu objeto

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominador = (n * sumX2) - (sumX * sumX);
  if (denominador === 0) return 0;

  const numerador = (n * sumXY) - (sumX * sumY);
  const pendienteCruda = numerador / denominador;

  // --- EL CAMBIO ESTÁ AQUÍ ---
  const pendienteMax = calcularPendienteMax(n);
  
  // Normalizamos dividiendo por la máxima posible y aplicamos el clip [-1, 1]
  const trendNormalizado = Math.max(-1, Math.min(1, pendienteCruda / pendienteMax));

  return trendNormalizado;
}

function calcularEntropia(probabilities: Record<string, number>): number {

  

const keys = Object.keys(probabilities);
  if (keys.length === 0) return 0;

  // H_MAX = ln(k) donde k es el número de categorías
  // Si usas 5 clústeres, es Math.log(5). Si usas 7, Math.log(7).
  const k = keys.length;
  const hMax = Math.log(k);

  let entropy = 0;
  for (const p of Object.values(probabilities)) {
    if (p > 0) {
      // Usamos logaritmo natural (Math.log) para ser consistentes con Python (np.log)
      entropy -= p * Math.log(p);
    }
  }

  // Normalizamos: H / H_MAX y aseguramos el rango [0, 1]
  const normalizedH = hMax > 0 ? entropy / hMax : 0;
  return Math.max(0, Math.min(1, normalizedH));
}
async function calculaIntentEntropy(idLead: number) {

  const messagesLead = await mensajesLeadrepository.getMessagesByLead(idLead)

  if (messagesLead.length === 0) return 0

  let sumaEntropia = 0
  let contador = 0

  for (const m of messagesLead) {

    if (!m.probabilities) continue

    const entropy = calcularEntropia(m.probabilities)

    sumaEntropia += entropy
    contador++
  }

  if (contador === 0) return 0

  return sumaEntropia / contador
}
function esMensajePrescindible(texto:string) {
    const ruido = new Set(['hola', 'buenas', 'buen dia', 'chau', 'gracias', 'ok', 'dale','muchas gracias','despues te aviso','me avisas','hasta luego','nos hablamos']);
    
    // 1. Limpiamos el texto (minúsculas y quitamos signos como ¡! ¿?)
    const limpio = texto.toLowerCase().replace(/[¡!¿?.,]/g, "").trim();
    
    // 2. Si el mensaje limpio es exactamente una palabra de ruido -> VERDADERO
    if (ruido.has(limpio)) return true;

    // 3. Opcional: Si el mensaje tiene menos de X caracteres y no tiene números
    // (A veces ayuda a filtrar emojis o puntos suspensivos)
    if (limpio.length < 5 && !/\d/.test(limpio)) return true;

    return false;
}

async function armar_respuesta(lead: Lead) {
  try {
    const ultimo_mensaje = await mensajesLeadrepository.getUltimoMensajeByLead(lead.id);
    if (!ultimo_mensaje) {
      throw new ValidationError('El ultimo mensaje no se encontro');
    }

    const hay_desistimiento = ultimo_mensaje.probabilities.desistimiento >= 0.65;

    // evaluacion por percentil
    let status_lead: 'caliente' | 'tibio' | 'frio';
    if (hay_desistimiento) {
      status_lead = 'frio';
    } else if (lead.percentile > 85) {
      status_lead = 'caliente';
    } else if (lead.percentile > 60) {
      status_lead = 'tibio';
    } else {
      status_lead = 'frio';
    }

    // evalucion por tendencia
    let trend: string;

    if (hay_desistimiento) {
      // desistimiento pisa cualquier otra señal
      trend = 'Lead abandonando: expresó falta de interés o fondos en el último mensaje';

    } else if (status_lead === 'caliente' && lead.trend_p_compra > 0.4) {
      trend = 'Lead caliente en alza: intención de compra creciendo, prioridad máxima';

    } else if (status_lead === 'caliente' && lead.trend_p_compra >= 0 && lead.trend_p_compra <= 0.4) {
      trend = 'Lead caliente estabilizado: alto interés pero sin aceleración reciente, mantener un seguimiento';

    } else if (status_lead === 'caliente' && lead.trend_p_compra < 0) {
      trend = 'Lead caliente enfriándose: tuvo alto interés pero está bajando, actuar antes de que se pierda';

    } else if (status_lead === 'tibio' && lead.trend_p_compra > 0.4) {
      trend = 'Lead tibio en aceleración: crecimiento rápido, puede pasar a caliente en las proximas interacciones';

    } else if (status_lead === 'tibio' && lead.trend_p_compra >= 0 && lead.trend_p_compra <= 0.4) {
      trend = 'Lead tibio estable: interés moderado sin cambios relevantes, seguimiento estándar';

    } else if (status_lead === 'tibio' && lead.trend_p_compra < 0) {
      trend = 'Lead tibio enfriándose: el interés está bajando';

    } else if (status_lead === 'frio' && lead.trend_p_compra > 0.3) {
      trend = 'Lead frío con señales de rescate: bajo percentil pero tendencia positiva, llevar un monitoreo en las proximas interacciones';

    } else if (status_lead === 'frio' && lead.trend_p_compra >= 0 && lead.trend_p_compra <= 0.3) {
      trend = 'Lead frío sin actividad relevante: mantener en base, sin acción inmediata';

    } else {
     
      trend = 'Lead frío y en descenso: probabilidad de conversión muy baja, no invertir recursos';
    }

    // --- ENTROPÍA: 
    let incertidumbre_lead: string;

    if (hay_desistimiento) {
      incertidumbre_lead = 'No aplica: el lead expresó desistimiento explícito';

    } else if (status_lead === 'caliente' && lead.intent_entropy < 0.2) {
      incertidumbre_lead = 'Objetivo muy claro: sabe lo que busca y cómo avanzar. Mínima fricción esperada en el cierre';

    } else if (status_lead === 'caliente' && lead.intent_entropy >= 0.2 && lead.intent_entropy <= 0.5) {
      incertidumbre_lead = 'Objetivo claro con algunas dudas: tiene intención de compra pero puede necesitar ayuda para decidir';

    } else if (status_lead === 'tibio' && lead.intent_entropy < 0.3) {
      incertidumbre_lead = 'Interés moderado con foco definido: sabe qué quiere pero aún no está decidido a avanzar';

    } else if (lead.intent_entropy > 0.5) {
      incertidumbre_lead = 'Búsqueda dispersa: no tiene claro qué tipo de propiedad o zona busca, ofrecer asesoramiento general';

    } else if (status_lead === 'frio') {
      incertidumbre_lead = 'Lead frío: sin señales de intención definida, no requiere acción inmediata';

    } else {
      incertidumbre_lead = 'Seguimiento preventivo: perfil mixto, evaluar en el próximo lote';
    }

    // RECOMENDACIÓN: cruza status + trend + entropía ---
    let recomendacion_final: string;

    if (hay_desistimiento) {
      recomendacion_final = 'NO CONTACTAR: El lead expresó desistimiento o falta de fondos. Archivar o pasar a lista de reactivación a 90 días';

    } else if (status_lead === 'caliente' && lead.intent_entropy < 0.25 && lead.trend_p_compra > 0) {
      recomendacion_final = 'CIERRE INMEDIATO: Lead decidido, objetivo claro y en alza. Llamar hoy, no mañana';

    } else if (status_lead === 'caliente' && lead.intent_entropy < 0.25 && lead.trend_p_compra <= 0) {
      recomendacion_final = 'RESCATAR CALIENTE: Lead decidido pero perdiendo un poco el interes. Contactar urgente con propuesta concreta antes de que enfríe';

    } else if (status_lead === 'caliente' && lead.intent_entropy >= 0.25) {
      recomendacion_final = 'ALTO INTERÉS CON DUDAS: Está muy interesado pero disperso. Contactar para acotar opciones y guiarlo al cierre';

    } else if (status_lead === 'tibio' && lead.trend_p_compra > 0.4) {
      recomendacion_final = 'OPORTUNIDAD EN DESARROLLO: Tibio acelerando fuerte. Priorizar sobre otros tibios, puede cerrar en 48-72hs';

    } else if (status_lead === 'tibio' && lead.trend_p_compra >= 0) {
      recomendacion_final = 'SEGUIMIENTO ESTÁNDAR: Interés moderado estable. Contactar en 24hs con propiedades similares a las consultadas';

    } else if (status_lead === 'tibio' && lead.trend_p_compra < 0) {
      recomendacion_final = 'PREVENIR PÉRDIDA: Tibio enfriándose. Un contacto oportuno puede revertir la tendencia antes del próximo lote';

    } else if (status_lead === 'frio' && lead.trend_p_compra > 0.3) {
      recomendacion_final = 'MONITOREAR: Frío pero con tendencia positiva. No invertir recursos aún, revisar en el próximo lote';

    } else {
      recomendacion_final = 'NO REQUIERE DE ATENCIÓN INMEDIATA: Sin señales de conversión próxima. Dejar en flujo del sistema';
    }
const reporte_unificado = [
  `ESTADO: ${status_lead.toUpperCase()} (Score: ${lead.percentile.toFixed(2)})`,
  `TENDENCIA: ${trend}`,
  `CERTEZA: ${incertidumbre_lead}`,
  `ACCIÓN: ${recomendacion_final}`
].join(' | ');

return {
  recomendacion: reporte_unificado
};

  } catch (error: any) {
    console.error('Error al procesar reporte:', error.message);
    
    return { 
      recomendacion: 'Error interno: No se pudo generar el reporte de inteligencia.' 
    };
  }}