import { Router } from 'express'
import { sanitizelead_cluster_perfil_Input,createCluster_profile_byLead } from './lead_cluster_perfil.controller.js'

export const clusterRouter = Router();

clusterRouter.get('/clusterProfile',createCluster_profile_byLead);