export class ClusterService {

  private baseUrl = 'http://localhost:5000'; // puerto de FastAPI

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