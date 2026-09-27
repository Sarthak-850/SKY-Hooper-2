/**
 * WebSocket Real-Time Leaderboard Server
 * Broadcasts 'leaderboard:update' events to connected desktop and mobile clients
 * whenever a new valid high score or rank change occurs.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { gameService } from '../services/gameService.ts';

export class LeaderboardWebSocketServer {
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    console.log('📡 Real-time WebSocket server attached at /ws');

    this.wss.on('connection', (ws: WebSocket & { isAlive?: boolean }, req) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Send initial welcome & connection confirmation
      ws.send(
        JSON.stringify({
          event: 'connection:ready',
          data: {
            message: 'Connected to Sky Hopper Real-Time Leaderboard Stream',
            serverTime: Date.now(),
          },
        })
      );

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.event === 'ping') {
            ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
          }
        } catch {
          // ignore non-json messages
        }
      });

      ws.on('error', (err) => {
        console.warn('WebSocket client error:', err.message);
      });
    });

    // Subscribe to gameService high score events and broadcast to all connected clients
    gameService.onLeaderboardUpdate((event) => {
      this.broadcast('leaderboard:update', event);
    });

    // Ping all clients every 30s to detect broken connections
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      for (const client of this.wss.clients) {
        const wsClient = client as WebSocket & { isAlive?: boolean };
        if (wsClient.isAlive === false) {
          wsClient.terminate();
          continue;
        }
        wsClient.isAlive = false;
        wsClient.ping();
      }
    }, 30000);
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(event: string, data: any): void {
    if (!this.wss) return;

    const payload = JSON.stringify({
      event,
      data,
    });

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const wsServer = new LeaderboardWebSocketServer();
