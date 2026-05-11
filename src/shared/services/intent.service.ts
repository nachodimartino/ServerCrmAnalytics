// src/services/intent.service.ts

export class IntentService {

private baseUrl = process.env.NLP_SERVICE_URL || 'http://localhost:8000';

  async predictIntent(message: string) {

    const response = await fetch(`${this.baseUrl}/clasificar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error('Error en microservicio de intent');
    }

    return await response.json();
  }
}