import { Lead } from "../../leads/lead.entity.js";

export class leadScoringService {

private baseUrl = process.env.SCORING_SERVICE_URL || 'http://localhost:8001';

 async predictleadScoring(lead: Lead) {

  const response = await fetch(`${this.baseUrl}/predict_scoring`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avg_p_compra: lead.avg_p_compra,
      max_p_compra: lead.max_p_compra,
      trend_p_compra: lead.trend_p_compra,
      intent_entropy: lead.intent_entropy,
      n_mensajes: lead.n_mensajes,
      avg_response_time: lead.avg_response_time,
      conversation_days: lead.conversation_days,
      n_channels: lead.n_channels,
      channel: lead.channel,
      ticket_estimate: lead.ticket_estimate
    })
  });

  if (!response.ok) {
    throw new Error('Error en microservicio de scoring');
  }

  return await response.json();
}
}