export class ClusterService {

private baseUrl = process.env.CLUSTERING_SERVICE_URL || 'http://localhost:8005';

  async predictCluster(lead_payload: any) {

    const response = await fetch(`${this.baseUrl}/score-lead-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify( 
        lead_payload
      )
    });

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      console.error('Error detallado de FastAPI:', errorDetail);
      throw new Error('Error en microservicio de cluster');
    }

    return await response.json();
  }
}