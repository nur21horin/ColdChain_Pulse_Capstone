import { Response } from 'express';

export interface SSEClient {
  id: string;
  shipmentId?: string;
  res: Response;
}

export class SSEService {
  private static clients: SSEClient[] = [];

  public static addClient(id: string, res: Response, shipmentId?: string): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client: SSEClient = { id, shipmentId, res };
    this.clients.push(client);

    // Initial greeting
    this.sendEventToClient(client, 'connected', {
      clientId: id,
      shipmentId: shipmentId || 'ALL',
      message: 'Subscribed to ColdChain Pulse real-time telemetry stream.'
    });

    res.on('close', () => {
      this.removeClient(id);
    });
  }

  public static removeClient(id: string): void {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  public static broadcast(eventType: string, data: any, targetShipmentId?: string): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      if (!client.shipmentId || client.shipmentId === targetShipmentId) {
        try {
          client.res.write(payload);
        } catch (err) {
          console.error(`[SSEService] Failed to write to client ${client.id}:`, err);
        }
      }
    }
  }

  private static sendEventToClient(client: SSEClient, eventType: string, data: any): void {
    try {
      client.res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`[SSEService] Error sending initial event to ${client.id}:`, err);
    }
  }

  public static getActiveClientCount(): number {
    return this.clients.length;
  }
}
