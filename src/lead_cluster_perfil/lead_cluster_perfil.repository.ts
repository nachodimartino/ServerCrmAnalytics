import { Lead_cluster_perfil } from "./lead_cluster_perfil.entity.js";
import { orm } from "../shared/db/orm.js";
import { EntityData } from "@mikro-orm/core";
import cluster from "node:cluster";

export class lead_cluster_perfilRepository{

    async create(data:any){
        const em=orm.em

const cluster_perfil=em.create(Lead_cluster_perfil,data)
await em.persistAndFlush(cluster_perfil)
 return cluster_perfil
    }
    
async upsert(data: any) {
  const em = orm.em

  let existing = await em.findOne(Lead_cluster_perfil, {
    lead: data.lead,
    cluster_id: data.cluster_id
  })

  if (existing) {
    existing.intencion = data.intencion
    existing.score_total = data.score_total
    existing.cantidad_mensajes = data.cantidad_mensajes
    existing.disparar_anuncio = data.disparar_anuncio
    existing.updated_at = new Date()

    await em.persistAndFlush(existing)
    return existing
  }

  const nuevo = em.create(Lead_cluster_perfil, data)
  await em.persistAndFlush(nuevo)
  return nuevo
}


}