import { Entity, Property, PrimaryKey,ManyToOne,Rel } from '@mikro-orm/core';
import { Lead } from '../leads/lead.entity.js';

@Entity ({ tableName: 'lead_cluster_perfil' })
export class Lead_cluster_perfil{

@PrimaryKey()
  id!: number;

@ ManyToOne(() => Lead, { nullable: false })
  lead!: Rel<Lead>;

@Property({ fieldName: 'cluster_id', nullable:false })
  cluster_id!: number;

@Property({ fieldName: 'intencion', nullable:false })
  intencion!: string;

@Property({ fieldName: 'score_total',type:'float', nullable:false })
  score_total!: number;

@Property({ fieldName: 'cantidad_mensajes', nullable:false })
  cantidad_mensajes!: number;

@Property({ fieldName: 'disparar_anuncio', nullable:false })
  disparar_anuncio!: boolean;

@Property({ fieldName: 'updated_at', defaultRaw: 'now()' })
updated_at: Date = new Date();  

// Al asignarle un valor aquí, deja de ser requerida en em.create(
}