/**
 * WhatsApp WebSocket endpoint for real-time status updates
 * Uses Bun's native WebSocket API
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('WhatsAppWS');

interface WhatsAppWSMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  projectId?: string;
}

interface WhatsAppWSResponse {
  type: 'status' | 'qr_code' | 'qr_timeout' | 'connected' | 'disconnected' | 'error' | 'subscribed';
  data: {
    projectId: string;
    connected?: boolean;
    connectedAt?: string;
    qrCode?: string;
    deviceName?: string;
    error?: string;
  };
}

// Store active WebSocket connections per project
const projectConnections = new Map<string, Set<any>>();

// Store WebSocket by socket for cleanup
const socketToProjects = new WeakMap<any, Set<string>>();

/**
 * Broadcast status to all subscribers of a project
 */
function broadcastStatus(projectId: string, data: Omit<WhatsAppWSResponse['data'], 'projectId'>) {
  const connections = projectConnections.get(projectId);
  if (!connections) {
    logger.info({ projectId }, '[WhatsApp WS] No connections found for project');
    logger.info({ activeProjects: Array.from(projectConnections.keys()) }, '[WhatsApp WS] Active projects');
    return;
  }

  const message: WhatsAppWSResponse = {
    type: 'status',
    data: { projectId, ...data },
  };

  logger.info({ connectionCount: connections.size, projectId }, '[WhatsApp WS] Broadcasting to connections');
  connections.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast QR code to all subscribers of a project
 */
function broadcastQRCode(projectId: string, qrCode: string) {
  const connections = projectConnections.get(projectId);
  if (!connections) return;

  const message: WhatsAppWSResponse = {
    type: 'qr_code',
    data: { projectId, qrCode },
  };

  connections.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  });
}

// Export for use by other modules (whatsapp-handler.ts)
export function notifyWhatsAppStatus(projectId: string, status: Omit<WhatsAppWSResponse['data'], 'projectId'>) {
  broadcastStatus(projectId, status);
}

export function notifyWhatsAppQRCode(projectId: string, qrCode: string) {
  broadcastQRCode(projectId, qrCode);
}

export function notifyWhatsAppQRTimeout(projectId: string) {
  const connections = projectConnections.get(projectId);
  if (!connections) return;

  const message: WhatsAppWSResponse = {
    type: 'qr_timeout',
    data: { projectId },
  };

  connections.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Handle WebSocket connection open
 */
function handleOpen(ws: any) {
  logger.info('[WhatsApp WS] New connection established');
}

/**
 * Handle WebSocket message
 */
async function handleMessage(ws: any, message: string | Buffer) {
  try {
    const data: WhatsAppWSMessage = JSON.parse(message.toString());

    switch (data.type) {
      case 'subscribe':
        if (data.projectId) {
          logger.info({ projectId: data.projectId }, '[WhatsApp WS] Client subscribed for project');

          // Add to project connections
          if (!projectConnections.has(data.projectId)) {
            projectConnections.set(data.projectId, new Set());
          }
          projectConnections.get(data.projectId)!.add(ws);
          logger.info({ connectionCount: projectConnections.get(data.projectId)!.size }, '[WhatsApp WS] Connection added. Total connections for project');

          // Track which projects this socket is subscribed to
          if (!socketToProjects.has(ws)) {
            socketToProjects.set(ws, new Set());
          }
          socketToProjects.get(ws)!.add(data.projectId);

          // Send subscribed confirmation
          ws.send(JSON.stringify({
            type: 'subscribed',
            projectId: data.projectId,
          }));

          // Fetch and send current WhatsApp client status
          try {
            const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "http://localhost:7031/api/v1";
            const response = await fetch(`${WHATSAPP_API_URL}/clients`);

            if (response.ok) {
              const clientsData = await response.json() as any;
              const clientsArray = Array.isArray(clientsData) ? clientsData : clientsData.clients;
              const client = clientsArray?.find((c: any) => c.id === data.projectId);

              if (client) {
                const isConnected = client.isConnected || false;
                logger.info({
                  projectId: data.projectId,
                  phone: client.phone,
                  connected: isConnected,
                  deviceName: client.osName || 'WhatsApp Device',
                }, '[WhatsApp WS] Sending current status to new subscriber');

                // Send current status immediately
                ws.send(JSON.stringify({
                  type: 'status',
                  data: {
                    projectId: data.projectId,
                    phone: client.phone,
                    connected: isConnected,
                    connectedAt: client.connectedAt,
                    deviceName: client.osName || 'WhatsApp Device',
                  },
                }));
              } else {
                logger.info({ projectId: data.projectId }, '[WhatsApp WS] No client found for project');
              }
            }
          } catch (err) {
            logger.error({ err }, '[WhatsApp WS] Error fetching client status');
          }
        }
        break;

      case 'unsubscribe':
        if (data.projectId) {
          logger.info({ projectId: data.projectId }, '[WhatsApp WS] Client unsubscribed from project');
          const connections = projectConnections.get(data.projectId);
          if (connections) {
            connections.delete(ws);
            if (connections.size === 0) {
              projectConnections.delete(data.projectId);
            }
          }

          // Remove from socket's project tracking
          const projects = socketToProjects.get(ws);
          if (projects) {
            projects.delete(data.projectId);
          }
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        logger.warn({ type: data.type }, '[WhatsApp WS] Unknown message type');
    }
  } catch (err) {
    logger.error({ err }, '[WhatsApp WS] Error handling message');
  }
}

/**
 * Handle WebSocket connection close
 */
function handleClose(ws: any) {
  logger.info('[WhatsApp WS] Connection closed');

  // Cleanup connection from all projects
  const projects = socketToProjects.get(ws);
  if (projects) {
    for (const projectId of projects) {
      const connections = projectConnections.get(projectId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          projectConnections.delete(projectId);
        }
      }
    }
    socketToProjects.delete(ws);
  }
}

/**
 * Get WebSocket handlers for Bun.serve()
 */
export function getWhatsAppWebSocketHandlers() {
  return {
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  };
}

// Export individual handlers for direct access
export { handleOpen as handleWhatsAppOpen, handleMessage as handleWhatsAppMessage, handleClose as handleWhatsAppClose };
