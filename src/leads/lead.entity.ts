import { Entity, Property, PrimaryKey, OneToMany,Rel } from '@mikro-orm/core';
import { mensajesLead } from '../mensajesLead/mensajesLead.entity.js';

@Entity({ tableName: 'leads' })
export class Lead {
  @PrimaryKey()
  id!: number;

  @Property({ fieldName: 'lead_id_external', unique: true })
  leadIdExternal!: string;

  @Property({ fieldName: 'customer_name', nullable: true })
  customerName?: string;

  @Property({ fieldName: 'email', nullable: true })
  email?: string;

  @Property({ fieldName: 'phone', nullable: true })
  phone?: string;

    @Property({ fieldName: 'channel', nullable: true }) // Canal actual del lead
  channel?: string;

   @Property({ fieldName: 'ticket_estimate', nullable: true })
  ticket_estimate?: string

  @Property({ fieldName: 'n_mensajes', type: 'float', default: 0.0 })
  n_mensajes!: number;

  @Property({ fieldName: 'avg_response_time', type: 'float', default: 0.0 })
  avg_response_time!: number;

   @Property({ fieldName: 'conversation_days', type: 'float', default: 0.0 })
  conversation_days!: number;

  @Property({ fieldName: 'n_channels', type: 'float', default: 0.0 })
  n_channels!: number;


   @Property({ fieldName: 'avg_p_compra', type: 'float', default: 0.0 })
  avg_p_compra!: number;

  @Property({ fieldName: 'max_p_compra', type: 'float', default: 0.0 })
  max_p_compra!: number;

   @Property({ fieldName: 'trend_p_compra', type: 'float', default: 0.0 })
  trend_p_compra!: number;

  @Property({ fieldName: 'intent_entropy', type: 'float', default: 0.0 })
  intent_entropy!: number;

  @Property({ fieldName: 'probability', type: 'float', default: 0.0 })
   probability!: number;

   @Property({ fieldName: 'percentile', type: 'float', default: 0.0 })
  percentile!: number;

@Property({ fieldName: 'created_at', defaultRaw: 'now()' })
createdAt: Date = new Date(); // Al asignarle un valor aquí, deja de ser requerida en em.create()

@Property({fieldName:'updated_at',type:'timestamp with time zone',nullable:true})
updatedAt?:Date

}