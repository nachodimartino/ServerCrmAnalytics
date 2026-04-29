import { EntityManager } from '@mikro-orm/postgresql';
import { mensajesLead } from './mensajesLead.entity.js';
import { orm } from '../shared/db/orm.js';
import { RequestContext, RequiredEntityData } from '@mikro-orm/core';
import e from 'express';
import { Lead } from '../leads/lead.entity.js';
import { EntityData } from '@mikro-orm/core';

export class mensajesLeadRepository {

     async create(data: any) {
        const em = orm.em; 
    
        const newmessage = em.create(mensajesLead, data);
        await em.persistAndFlush(newmessage);
    
        return newmessage;
      }

async update (id:number,data:any){
const em=orm.em
const message= await em.findOneOrFail(mensajesLead,{id})
em.assign(message,data) // le pasas el objeto a actualizar y los campos actualizados
await em.flush();
}

async getMessagesByLead(id_Lead:number){
  const em=orm.em
  const ultimo_mensaje=await em.findOne(mensajesLead,{lead : id_Lead} ,{ orderBy: { fecha_lote:'DESC' } })// sirve para obtener la ultima fecha de lote
  // que se cargaron mensajes de ese lead.
  const ultima_fecha_lote=ultimo_mensaje?.fecha_lote
  const messages= await em.find(mensajesLead, { lead: id_Lead,fecha_lote:ultima_fecha_lote }, { orderBy: { createdAt: 'ASC' } })// todos los mensajes
  // del lead que se cargaron en esa fecha lote
  return messages
}
 
async get_mensajes_ultimos_dias_byLead(idLead:number){
  const em=orm.em
  const fechaCorte = new Date();
  fechaCorte.setDate(fechaCorte.getDate() - 30);

  const messagesLead= await em.find(mensajesLead,{lead:idLead,createdAt: { $gte: fechaCorte }}) // me trae los mensajes de los ultimos 30 dias
  // de ese lead

  return messagesLead

  }
  async cuenta_mensajes_lead_lote(id_Lead:number){
    const em=orm.em
  const ultimo_mensaje=await em.findOne(mensajesLead,{lead : id_Lead} ,{ orderBy: { fecha_lote:'DESC' } })// sirve para obtener la ultima fecha de lote
  // que se cargaron mensajes de ese lead.
  const ultima_fecha_lote=ultimo_mensaje?.fecha_lote
  const messages= await em.find(mensajesLead, { lead: id_Lead,fecha_lote:ultima_fecha_lote }, { orderBy: { createdAt: 'DESC' } })// todos los mensajes
  // del lead que se cargaron en esa fecha lote
return messages.length
  }

  async getUltimoMensajeByLead(idLead:number){
    const em=orm.em
    const ultimo_mensaje=await em.findOne(mensajesLead,{lead : idLead} ,{ orderBy: { createdAt:'DESC' } })
    return ultimo_mensaje
  }
}