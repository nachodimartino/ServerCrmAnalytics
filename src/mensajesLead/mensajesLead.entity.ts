import { Entity, Property, PrimaryKey,ManyToOne,Rel } from '@mikro-orm/core';
import { Lead } from '../leads/lead.entity.js';


@Entity ({ tableName: 'mensajesLead' })
export class mensajesLead{

@PrimaryKey()
  id!: number;

@ManyToOne(() => Lead, { nullable: false })
  lead!: Rel<Lead>;

@Property({ fieldName: 'message', nullable:false })
  message!: string;

@Property({ type: 'json', nullable: true })
probabilities!: Record<string, number>;

@Property({ fieldName: 'p_compra',type:'float', default: 0.0 })
  p_compra!: number;

@Property({ fieldName: 'created_at',type:'timestamp with time zone', defaultRaw: 'now()' })
createdAt: Date = new Date(); // Al asignarle un valor aquí, deja de ser requerida en em.create(

@Property({fieldName:'fecha_lote',type:'timestamp with time zone'})
fecha_lote!:Date

}