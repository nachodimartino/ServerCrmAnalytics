
import { Router } from 'express'
import { create, sanitizeanalitycsInput } from './analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.post('/creaMensaje',sanitizeanalitycsInput, create);