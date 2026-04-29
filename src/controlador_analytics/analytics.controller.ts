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
          
          for ( const m of mensajesArray){
            if(esMensajePrescindible(m.message)){
              continue;
            }
            const message={
            lead:lead,
            message:m.message,
            createdAt:m.createdAt,
            fecha_lote:req.body.sanitizedInput.fecha_lote
        }
        const mensaje= await mensajesLeadrepository.create(message)
         mensajesCreados.push(mensaje);
         const intention = await intentService.predictIntent(m.message)
        console.log('Intencion:',intention)
        await mensajesLeadrepository.update(mensaje.id,intention)
          }
        const cantidad_mensajes=mensajesCreados.length
        console.log('cantidad mensajes',cantidad_mensajes)
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
       const respuesta=await armar_respuesta(lead)
        return res.status(201).json({ message: 'Lead creado con éxito', data:respuesta });
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

async function armar_respuesta(lead:Lead){
try{
  let status_lead
  const ultimo_mensaje_lead=await mensajesLeadrepository.getUltimoMensajeByLead(lead.id)
  if(!ultimo_mensaje_lead){
    throw new ValidationError('El ultimo mensaje no se encontro')
  }
if(lead.percentile>85 && ultimo_mensaje_lead.probabilities.desistimiento<0.65){
    status_lead='caliente'
}
else if(lead.percentile>60 && lead.percentile<=85){
status_lead='tibio'
}
else status_lead='frio'

if(ultimo_mensaje_lead.probabilities.desistimiento >= 0.65){
  status_lead='frio'
  const frio_desistimiento=true
}
let trend
if(lead.percentile>85 && lead.trend_p_compra>0.4 &&ultimo_mensaje_lead.probabilities.desistimiento<0.65){
trend='Lead con interes en alza'
}
else if(lead.percentile>85 && lead.trend_p_compra>0.4 &&ultimo_mensaje_lead.probabilities.desistimiento>=0.65){
  trend='lead perdiendo interes'
}
else trend='lead estable'
let entropia
if (status_lead === 'caliente' && lead.intent_entropy < 0.2) {
      entropia = "Prioridad máxima: Cliente decidido. Coordinar visita o cierre.";
    } else if (lead.intent_entropy > 0.5) {
      entropia = "Cliente confuso: Ofrecer asesoramiento general para definir búsqueda.";
    } else if (status_lead.includes('FRÍO')) {
      entropia = "No requiere acción inmediata. Mantener en base de datos.";
    } else {
      entropia = "Realizar seguimiento preventivo del lead";
    }

    let recomendacion: string;

    if (ultimo_mensaje_lead.probabilities.desistimiento >= 0.65 ) {
      recomendacion = "⛔ No contactar: El cliente desistió o expresó falta de fondos.";
    }  
    else if (status_lead === 'caliente' && lead.intent_entropy < 0.25) {
      recomendacion = "🚀 CIERRE INMINENTE: Cliente decidido y con objetivo claro. Llamar ya.";
    } 
    else if (status_lead === 'caliente' && lead.intent_entropy >= 0.25) {
      recomendacion = "🔥 ALTO INTERÉS: Está muy interesado pero tiene dudas. Ayudar a decidir.";
    } 
    else if (lead.intent_entropy > 0.5) {
      recomendacion = "🌀 LEAD DISPERSO: No tiene claro qué busca. Enviar catálogo general.";
    } 
    else if (status_lead === 'tibio' && lead.trend_p_compra > 0) {
      recomendacion = "📞 SEGUIMIENTO: Interés moderado en ascenso. Contactar en 24hs.";
    } 
    else {
      recomendacion = "😴 MANTENIMIENTO: Sin apuro. Dejar en flujo de nutrición automática.";
    }
   const respuesta={
      status_lead:status_lead,
      score:lead.percentile,
      tendencia:trend,
      incertidumbre_lead:entropia,
      recomendacion:recomendacion
    }
    return respuesta
}
catch(error:any){
console.error("Error al procesar reporte:", error.message);
    return "Error al generar reporte de inteligencia.";
}
}