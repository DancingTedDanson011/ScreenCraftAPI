// WebSocket Handler for Real-time Admin Metrics

import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { metricsService } from '../services/metrics.service.js';
import { validateAdminToken } from '../middleware/admin-auth.middleware.js';
import type { OverviewMetrics, WebSocketMessage } from '../types/admin.types.js';

interface ConnectedClient {
  socket: any;
  adminId: string;
  connectedAt: Date;
}

// Store connected clients
const connectedClients: Map<string, ConnectedClient> = new Map();

/**
 * Setup Admin WebSocket for real-time metrics
 */
export async function setupAdminWebSocket(fastify: FastifyInstance): Promise<void> {
  // Register WebSocket plugin
  await fastify.register(websocket);

  // WebSocket endpoint for metrics
  fastify.get('/admin/ws', { websocket: true }, async (socket, req) => {
    // Extract token from query parameter
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      sendMessage(socket, {
        type: 'alert',
        data: { error: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
      socket.close(1008, 'Authentication required');
      return;
    }

    // Validate admin token
    const adminInfo = await validateAdminToken(token);
    if (!adminInfo) {
      sendMessage(socket, {
        type: 'alert',
        data: { error: 'Invalid or expired token' },
        timestamp: new Date().toISOString(),
      });
      socket.close(1008, 'Invalid token');
      return;
    }

    // Generate client ID
    const clientId = `${adminInfo.adminId}-${Date.now()}`;

    // Store client
    connectedClients.set(clientId, {
      socket,
      adminId: adminInfo.adminId,
      connectedAt: new Date(),
    });

    fastify.log.info({ clientId, adminId: adminInfo.adminId }, 'Admin WebSocket client connected');

    // Send initial metrics
    try {
      const metrics = await metricsService.getOverviewMetrics();
      sendMessage(socket, {
        type: 'metrics',
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to send initial metrics');
    }

    // Start sending metrics every 5 seconds
    const metricsInterval = setInterval(async () => {
      try {
        const metrics = await metricsService.getOverviewMetrics();
        sendMessage(socket, {
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to send metrics update');
      }
    }, 5000);

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(socket, message, adminInfo.adminId, fastify);
      } catch (error) {
        fastify.log.error(error, 'Failed to parse WebSocket message');
      }
    });

    // Handle close
    socket.on('close', () => {
      clearInterval(metricsInterval);
      connectedClients.delete(clientId);
      fastify.log.info({ clientId }, 'Admin WebSocket client disconnected');
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      clearInterval(metricsInterval);
      connectedClients.delete(clientId);
      fastify.log.error(error, 'WebSocket error');
    });
  });
}

/**
 * Send a message to a WebSocket client
 */
function sendMessage(socket: any, message: WebSocketMessage): void {
  try {
    if (socket.readyState === 1) { // OPEN
      socket.send(JSON.stringify(message));
    }
  } catch (error) {
    console.error('Failed to send WebSocket message:', error);
  }
}

/**
 * Handle incoming messages from clients
 */
async function handleClientMessage(
  socket: any,
  message: any,
  adminId: string,
  fastify: FastifyInstance
): Promise<void> {
  switch (message.type) {
    case 'ping':
      sendMessage(socket, {
        type: 'alert',
        data: { pong: true },
        timestamp: new Date().toISOString(),
      });
      break;

    case 'subscribe':
      // Could be used to subscribe to specific metric types
      fastify.log.info({ adminId, subscription: message.data }, 'Client subscription request');
      break;

    case 'refresh':
      // Force refresh metrics
      try {
        const metrics = await metricsService.getOverviewMetrics();
        sendMessage(socket, {
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to refresh metrics');
      }
      break;

    default:
      fastify.log.warn({ type: message.type }, 'Unknown WebSocket message type');
  }
}

/**
 * Broadcast a message to all connected admin clients
 */
export function broadcastToAdmins(message: WebSocketMessage): void {
  for (const client of connectedClients.values()) {
    sendMessage(client.socket, message);
  }
}

/**
 * Broadcast a job update to all connected admins
 */
export function broadcastJobUpdate(
  jobId: string,
  type: 'screenshot' | 'pdf',
  status: string,
  details?: any
): void {
  broadcastToAdmins({
    type: 'job_update',
    data: {
      jobId,
      type,
      status,
      ...details,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a user activity event
 */
export function broadcastUserActivity(
  accountId: string,
  action: string,
  details?: any
): void {
  broadcastToAdmins({
    type: 'user_activity',
    data: {
      accountId,
      action,
      ...details,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast an alert to all admins
 */
export function broadcastAlert(
  level: 'info' | 'warning' | 'error',
  title: string,
  message: string,
  details?: any
): void {
  broadcastToAdmins({
    type: 'alert',
    data: {
      level,
      title,
      message,
      ...details,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connected clients count
 */
export function getConnectedClientsCount(): number {
  return connectedClients.size;
}

/**
 * Get connected clients info
 */
export function getConnectedClientsInfo(): Array<{
  adminId: string;
  connectedAt: Date;
}> {
  return Array.from(connectedClients.values()).map((client) => ({
    adminId: client.adminId,
    connectedAt: client.connectedAt,
  }));
}
