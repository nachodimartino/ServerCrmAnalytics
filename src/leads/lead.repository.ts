import { EntityManager } from '@mikro-orm/postgresql';
import { Lead } from './lead.entity.js';
import { orm } from '../shared/db/orm.js';
import { RequestContext } from '@mikro-orm/core';
export class LeadRepository {

  async create(data: any) {
    const em = orm.em; 

    const newLead = em.create(Lead, data);
    await em.persistAndFlush(newLead);

    return newLead;
  }
  async getOne (leadIdExternal:any){
    const em=orm.em
    
    const leadEncontrado=await em.findOne(
        Lead,
        {leadIdExternal}
    )
return leadEncontrado;
  }

  async findAll() {
    return await orm.em.find(Lead, {});
  }

async update(id:number,data:any){
  const em=orm.em
const lead = await em.findOneOrFail(Lead,{id})
const update_lead={
  ...data,
  updatedAt: new Date()
}
em.assign(lead,update_lead)
await em.flush();
return lead
}

}