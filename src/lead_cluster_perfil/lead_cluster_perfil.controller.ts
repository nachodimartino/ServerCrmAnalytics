import { Request, Response, NextFunction, response } from 'express';
import { ClusterService } from '../shared/services/cluster.service.js';
import { lead_cluster_perfilRepository } from './lead_cluster_perfil.repository.js';
import { LeadRepository } from '../leads/lead.repository.js';
import { mensajesLeadRepository } from '../mensajesLead/mensajesLead.repository.js';
import { Reference, ValidationError } from '@mikro-orm/core';



const clusterService= new ClusterService();
const lead_cluster_perfil_repository=new lead_cluster_perfilRepository()
const lead_repository=new LeadRepository()
const mensajes_lead_repository=new mensajesLeadRepository();

export function sanitizelead_cluster_perfil_Input(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {

  lead_id:req.body.lead_id,
  messages:req.body.messages

}

Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();

}
// cuando desde chatwoot me pidan por info del cluster para campañas, ,expongo la api que llama este metodo, entonces debo traer los mensajes de todos
// los leads del ultimo lote del lead dias. este metodo es un get.
export async function createCluster_profile_byLead(req:Request,res:Response) {
   try{
const leads=await lead_repository.findAll()
if(leads.length==0){
throw new ValidationError('No hay leads cargados')
}
const resultadosFinales=[]
for (const l of leads){

 const mensajesLead=await mensajes_lead_repository.getMessagesByLead(l.id) // aca veo si traigo mensajes de cada cuanto quiero campaña

// 2. Transformamos al formato requerido: { text, timestamp }
const mensajesFormateado = mensajesLead.map(m => ({
   text: m.message,
   timestamp: m.createdAt
      }));

const lead_payload = {
        lead_id: l.id,
        messages: mensajesFormateado
      };
const cluster_profile = await clusterService.predictCluster(lead_payload);
      // resolvés el desistimiento acá, donde tenés acceso al repo
      const ultimo_mensaje = await mensajes_lead_repository.getUltimoMensajeByLead(l.id);
      const hay_desistimiento = ultimo_mensaje
        ? ultimo_mensaje.probabilities.desistimiento >= 0.65
        : false;

const perfilesActualizados = [];
for (const cp of cluster_profile.perfil_completo) { // por cada lead debo crear un perfil, si ya existe entonces lo actualizo con todo lo q le paso
  if ( cp.cantidad_mensajes===0) continue
  
  const perfil = {
    lead: l,
    cluster_id: Number(cp.cluster_id),
    intencion: cp.intencion,
    score_total: cp.score_total,
    cantidad_mensajes: cp.cantidad_mensajes,
    disparar_anuncio: cp.disparar_anuncio
  }
  console.log('score',cp.score_total)

  const savedPerfil=await lead_cluster_perfil_repository.upsert(perfil) // si el lead no tiene perfil, entonces lo creo, si ya tenia actualizo
  perfilesActualizados.push(savedPerfil);
  
    }
    resultadosFinales.push({  // esto es por lead que lo creo
        lead_id: l.id,
        lead_data:l,
        hay_desistimiento:hay_desistimiento,
        customer_name: l.customerName,
        perfil_de_interes: perfilesActualizados
      });
 
    // Retorna el array con todos los leads y sus respectivos perfiles
   
}
const respuesta=armar_respuesta_campanas(resultadosFinales)
return res.status(200).json(respuesta);
}
   catch(error:any){
     return res.status(500).json({ message: 'Error en la capa de datos', error: error.message });
   } 
}

 // armar_respuesta — ahora lee hay_desistimiento del entry, sin necesitar el repo
// armar_respuesta_campanas — versión recortada
// Solo devuelve lo que necesita el CRM: segmentación por lead, sin datos de contacto ni resumen global.
function armar_respuesta_campanas(data: any[]) {

  const leads = data
    .map((leadEntry: any) => {
      const lead = leadEntry.lead_data;
      const hay_desistimiento: boolean = leadEntry.hay_desistimiento;

      const perfilesValidos = leadEntry.perfil_de_interes.filter((p: any) =>
        p.intencion !== 'indeterminado' && p.cantidad_mensajes > 0
      );

      if (perfilesValidos.length === 0) return null;

      // --- TEMPERATURA ---
      let temperatura: string;
      let apto_campana: boolean;

      if (hay_desistimiento) {
        temperatura  = 'Descartado';
        apto_campana = false;
      } else if (lead.percentile > 85 && lead.trend_p_compra > 0.4) {
        temperatura  = 'Crítico — actuar hoy';
        apto_campana = true;
      } else if (lead.percentile > 85) {
        temperatura  = 'Caliente estabilizado';
        apto_campana = true;
      } else if (lead.percentile > 60 && lead.trend_p_compra > 0.4) {
        temperatura  = 'Tibio acelerando';
        apto_campana = true;
      } else if (lead.percentile > 60) {
        temperatura  = 'Tibio';
        apto_campana = true;
      } else if (lead.trend_p_compra > 0.3) {
        temperatura  = 'Frío con potencial';
        apto_campana = false;
      } else {
        temperatura  = 'Frío';
        apto_campana = false;
      }

      // --- PERFIL PRIMARIO: mayor score ---
      const perfil_primario = [...perfilesValidos].sort(
        (a: any, b: any) => b.score_total - a.score_total
      )[0];

      // --- FIX SOPORTE: nunca es apto para campaña comercial ---
      // El percentil puede ser alto porque el lead interactuó mucho,
      // pero soporte no es intención de compra — no se impacta con ads.
      if (perfil_primario.intencion === 'soporte_contrato') {
        apto_campana = false;
        temperatura  = 'No apto — post-venta';
      }

      // --- SCORE NORMALIZADO: perfil primario = 100%, resto relativo ---
      // score_total del clustering es suma acumulada de puntos, no probabilidad.
      // Puede superar 1.0 con muchos mensajes. Normalizamos contra el máximo
      // del lead para que sea legible en el CRM.
      const scoreMax = Math.max(...perfilesValidos.map((p: any) => p.score_total));

      // --- RECOMENDACIÓN GLOBAL ---
      let recomendacion: string;

      if (!apto_campana) {
        if (hay_desistimiento) {
          recomendacion = 'Excluir de campaña activa. Reactivar en 90 días.';
        } else if (perfil_primario.intencion === 'soporte_contrato') {
          recomendacion = 'Derivar a área administrativa. No impactar con campaña comercial.';
        } else {
          recomendacion = 'Sin campaña paga. Mantener en flujo orgánico.';
        }
      } else if (lead.percentile > 85 && lead.trend_p_compra > 0.4) {
        recomendacion = 'Campaña de alto impacto. Contacto directo prioritario.';
      } else if (lead.percentile > 85) {
        recomendacion = 'Campaña estándar. No sobre-impactar.';
      } else {
        recomendacion = 'Campaña de nurturing. Contenido de valor, sin presión.';
      }

      // --- SEGMENTOS ---
      const segmentos = perfilesValidos.map((p: any) => {

        const scoreNormalizado = Math.round((p.score_total / scoreMax) * 100) + '%';

        if (!apto_campana) {
          return {
            intencion:          p.intencion,
            segmento:           hay_desistimiento ? 'Descartado' : 'No apto aún',
            score:              scoreNormalizado,
            es_perfil_primario: p.intencion === perfil_primario.intencion,
            apto_retargeting:   false,
            accion:             hay_desistimiento
                                  ? 'Sin acción. En lista de reactivación.'
                                  : 'Sin acción. Esperar señal de interés.',
            canal_sugerido:     'Ninguno',
            tipo_contenido:     'Sin campaña',
          };
        }

        const score_alto    = p.score_total > scoreMax * 0.7;
        const lead_disperso = lead.intent_entropy > 0.5;

        let segmento:       string;
        let accion:         string;
        let canal_sugerido: string;
        let tipo_contenido: string;

        switch (p.intencion) {

          case 'compra_residencial':
            if (score_alto && !lead_disperso) {
              segmento       = 'Comprador decidido';
              accion         = 'Propiedades disponibles con visita coordinada. Oferta por tiempo limitado.';
              canal_sugerido = 'WhatsApp directo + llamada';
              tipo_contenido = 'Ficha técnica + video recorrido';
            } else if (score_alto && lead_disperso) {
              segmento       = 'Comprador interesado sin foco';
              accion         = 'Ayudar al cliente a definir zona y metraje antes de enviar opciones.';
              canal_sugerido = 'WhatsApp con formulario de preferencias';
              tipo_contenido = 'Form de búsqueda + comparador de zonas';
            } else {
              segmento       = 'Comprador en exploración';
              accion         = 'Nutrir con contenido de barrios y tendencias de precio.';
              canal_sugerido = 'Email + Instagram retargeting';
              tipo_contenido = 'Newsletter de mercado + testimonios';
            }
            break;

          case 'inversion':
            if (score_alto) {
              segmento       = 'Inversor activo';
              accion         = 'Oportunidades de pozo con rendimiento proyectado. Casos de éxito recientes.';
              canal_sugerido = 'Email personalizado + reunión con asesor senior';
              tipo_contenido = 'Reporte de ROI + comparativo de proyectos';
            } else {
              segmento       = 'Inversor exploratorio';
              accion         = 'Educar sobre rentabilidad antes de ofrecer productos.';
              canal_sugerido = 'Email ';
              tipo_contenido = 'Informe de mercado + webinar de inversión';
            }
            break;

          case 'alquiler':
            if (score_alto) {
              segmento       = 'Inquilino listo para cerrar';
              accion         = 'Propiedades disponibles con requisitos de garantía claros.';
              canal_sugerido = 'WhatsApp + llamada de verificación';
              tipo_contenido = 'Listado filtrado por presupuesto + guía de garantías';
            } else {
              segmento       = 'Inquilino en evaluación';
              accion         = 'Mostrar opciones por zona y rango de precio sin presionar.';
              canal_sugerido = 'Email + Facebook retargeting';
              tipo_contenido = 'Comparador de alquileres por barrio';
            }
            break;

          case 'soporte_contrato':
            segmento       = 'Cliente post-venta';
            accion         = 'Derivar a área administrativa. Sin campaña comercial.';
            canal_sugerido = 'Email interno — sin ads';
            tipo_contenido = 'Sin campaña — gestión interna';
            break;

          default:
            segmento       = 'Interés general';
            accion         = 'Nutrir con contenido de valor sin propuesta concreta.';
            canal_sugerido = 'Email + redes orgánicas';
            tipo_contenido = 'Blog + novedades del mercado';
        }

        return {
          intencion:          p.intencion,
          segmento,
          score:              scoreNormalizado,
          es_perfil_primario: p.intencion === perfil_primario.intencion,
          apto_retargeting:   p.disparar_anuncio && apto_campana,
          accion,
          canal_sugerido,
          tipo_contenido,
        };
      });

      return {
        lead_id:         leadEntry.lead_id,
        cliente:         leadEntry.customer_name,
        temperatura,
        apto_campana,
        perfil_primario: perfil_primario.intencion,
        recomendacion,
        segmentos,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { leads };
}