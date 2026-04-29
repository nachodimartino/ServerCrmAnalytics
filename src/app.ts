import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { orm } from './shared/db/orm.js';
import { RequestContext } from '@mikro-orm/core';
import { analyticsRouter } from './controlador_analytics/analyitics.routes.js';
import { clusterRouter } from './lead_cluster_perfil/lead_cluster_perfil.routes.js';
const app = express();

app.use(express.json());
app.use(cors());

// Middleware para que el Entity Manager esté disponible en cada request
app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

app.get('/ping', (req, res) => {
  res.json({ message: 'Server is running and DB is connected' });
});


app.use('/api/analytics', analyticsRouter)
app.use('/api/cluster', clusterRouter)
export default app;