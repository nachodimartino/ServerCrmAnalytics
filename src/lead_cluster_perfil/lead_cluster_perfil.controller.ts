import { Request, Response, NextFunction, response } from 'express';
import { ClusterService } from '../shared/services/cluster.service.js';
import { Lead_cluster_perfil } from './lead_cluster_perfil.entity.js';
import { lead_cluster_perfilRepository } from './lead_cluster_perfil.repository.js';
import { LeadRepository } from '../leads/lead.repository.js';
import { mensajesLeadRepository } from '../mensajesLead/mensajesLead.repository.js';
import { Reference, ValidationError } from '@mikro-orm/core';
import { mensajesLead } from '../mensajesLead/mensajesLead.entity.js';


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

 const mensajesLead=await mensajes_lead_repository.getMessagesByLead(l.id)

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
const perfilesActualizados = [];
for (const cp of cluster_profile.perfil_completo) { // por cada lead debo crear un perfil, si ya existe entonces lo actualizo con todo lo q le paso
  const perfil = {
    lead: l,
    cluster_id: Number(cp.cluster_id),
    intencion: cp.intencion,
    score_total: cp.score_total,
    cantidad_mensajes: cp.cantidad_mensajes,
    disparar_anuncio: cp.disparar_anuncio
  }
  console.log('score',cp.score_total)

  const savedPerfil=await lead_cluster_perfil_repository.upsert(perfil) // ver esto 
  perfilesActualizados.push(savedPerfil);
  
    }
    resultadosFinales.push({
        lead_id: l.id,
        customer_name: l.customerName,
        perfil_de_interes: perfilesActualizados
      });
 
    // Retornamos el array con todos los leads y sus respectivos perfiles
   
}
const respuesta=armar_respuesta(resultadosFinales)
return res.status(200).json(respuesta);
}
   catch(error:any){
     return res.status(500).json({ message: 'Error en la capa de datos', error: error.message });
   } 
}

 function armar_respuesta(data: any) {
  return data.map((leadEntry: any) => {
    const perfilesValidos = leadEntry.perfil_de_interes.filter((perfil: any) => 
      perfil.intencion !== "indeterminado" && perfil.cantidad_mensajes > 0
    );

    if (perfilesValidos.length === 0) return null;

    const leadData = leadEntry.perfil_de_interes[0].lead;

    return {
      cliente: leadEntry.customer_name,
      contacto: leadData.email,
      // 1. Clasificación de Temperatura basada en Percentile
      temperatura: leadData.percentile > 90 ? 'Crítico/Inmediato' : 
                   leadData.percentile > 70 ? 'Interés Alto' : 'En Seguimiento',
      
      // 2. Resumen de intereses con interpretación
      perfil_comercial: perfilesValidos.map((p: any) => {
        let etiqueta = "";
        let accion = "";

        // Lógica de negocio por intención y score
        if (p.intencion === 'compra_residencial' && p.score_total > 0.7) {
          etiqueta = "Comprador Decidido";
          accion = "Enviar ficha técnica y coordinar visita urgente.";
        } else if (p.intencion === 'inversion') {
          etiqueta = "Inversionista";
          accion = "Enviar reporte de ROI y oportunidades de pozo.";
        } else if (p.intencion === 'alquiler') {
          etiqueta = "Buscador de Alquiler";
          accion = "Validar requisitos de garantía y presupuesto.";
        } else if (p.intencion === 'soporte_contrato') {
          etiqueta = "Post-Venta / Administrativo";
          accion = "Derivar a legales o administración.";
        } else {
          etiqueta = "Interés General";
          accion = "Nutrir con contenido del barrio y zona.";
        }

        return {
          interes: p.intencion.replace('_', ' ').toUpperCase(),
          perfil: etiqueta,
          accion_sugerida: accion,
          score: Math.round(p.score_total * 100) + "%", // Más legible como porcentaje
          campaña_ads: p.disparar_anuncio ? "APTO RETARGETING" : "SOLO ORGANICO"
        };
      })
    };
  }).filter((item: any) => item !== null);
}