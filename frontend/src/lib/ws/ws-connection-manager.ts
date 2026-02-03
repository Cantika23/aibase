/**
 * WebSocket Connection Manager
 * Ensures only one WebSocket connection per unique configuration exists
 * Handles React Strict Mode double mounting gracefully
 */

import { WSClient } from "./ws-client";
import type { WSClientOptions } from "../types/model";
import { authenticateEmbedUser } from "../embed-api";
import { logger } from "@/lib/logger";

// Export WSClient for use in other modules
export type { WSClient };

interface ConnectionInfo {
  client: WSClient;
  refCount: number;
  options: WSClientOptions;
}

export class WSConnectionManager {
  private static instance: WSConnectionManager;
  private connections = new Map<string, ConnectionInfo>();

  private constructor() { }

  static getInstance(): WSConnectionManager {
    if (!WSConnectionManager.instance) {
      WSConnectionManager.instance = new WSConnectionManager();
    }
    return WSConnectionManager.instance;
  }

  /**
   * Get or create a WebSocket client for the given options
   * Reuses existing connections when possible
   */
  async getClient(options: WSClientOptions): Promise<WSClient> {
    const connectionKey = this.generateConnectionKey(options);

    let connectionInfo = this.connections.get(connectionKey);

    if (connectionInfo) {
      // Reuse existing connection
      connectionInfo.refCount++;
      logger.websocket.info(`WSConnectionManager: Reusing existing connection`, { connectionKey, refCount: connectionInfo.refCount });
      return connectionInfo.client;
    }

    // Create new connection
    logger.websocket.info(`WSConnectionManager: Creating new WebSocket connection`, { connectionKey });

    // Check if we need to authenticate first (for embed with uid)
    const connectionOptions = { ...options };
    if (options.uid && options.projectId && options.embedToken) {
      try {
        logger.websocket.info(`WSConnectionManager: Authenticating embed user`, { uid: options.uid });
        const authData = await authenticateEmbedUser(options.projectId, options.embedToken, options.uid);
        connectionOptions.token = authData.token;
        logger.websocket.info(`WSConnectionManager: Embed authentication successful, token received`);
      } catch (error) {
        logger.websocket.error(`WSConnectionManager: Embed authentication failed`, { error: String(error) });
        throw error;
      }
    }

    const client = new WSClient(connectionOptions);

    connectionInfo = {
      client,
      refCount: 1,
      options: { ...options }
    };

    this.connections.set(connectionKey, connectionInfo);
    logger.websocket.info(`WSConnectionManager: Total connections updated`, { totalConnections: this.connections.size });

    // Set up cleanup when connection is closed
    client.on("disconnected", () => {
      this.onConnectionDisconnected(connectionKey);
    });

    this.connections.set(connectionKey, connectionInfo);

    return client;
  }

  /**
   * Release a connection (called when component unmounts)
   */
  releaseClient(options: WSClientOptions): void {
    const connectionKey = this.generateConnectionKey(options);
    const connectionInfo = this.connections.get(connectionKey);

    if (connectionInfo) {
      connectionInfo.refCount--;
      logger.websocket.info(`WSConnectionManager: Released connection`, { connectionKey, refCount: connectionInfo.refCount });

      // Only disconnect if no more references, but delay to handle React Strict Mode
      if (connectionInfo.refCount <= 0) {
        logger.websocket.info(`WSConnectionManager: No more references, scheduling disconnect`, { connectionKey });
        setTimeout(() => {
          const currentConnectionInfo = this.connections.get(connectionKey);
          if (currentConnectionInfo && currentConnectionInfo.refCount <= 0) {
            logger.websocket.info(`WSConnectionManager: Confirmed disconnect`, { connectionKey });
            currentConnectionInfo.client.disconnect();
            this.connections.delete(connectionKey);
            logger.websocket.debug(`WSConnectionManager: Total connections updated`, { totalConnections: this.connections.size });
          } else {
            logger.websocket.info(`WSConnectionManager: Disconnect cancelled, still has references`, { connectionKey });
          }
        }, 200); // 200ms delay to allow React Strict Mode remount
      }
    } else {
      logger.websocket.warn(`WSConnectionManager: Attempted to release unknown connection`, { connectionKey });
    }
  }

  /**
   * Force disconnect all connections
   */
  disconnectAll(): void {
    logger.websocket.info(`WSConnectionManager: Disconnecting all connections`, { count: this.connections.size });
    for (const [, connectionInfo] of this.connections) {
      connectionInfo.client.disconnect();
    }
    this.connections.clear();
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connections: Array<{
      key: string;
      refCount: number;
      url: string;
      isConnected: boolean;
    }>;
  } {
    const connections = Array.from(this.connections.entries()).map(([key, info]) => ({
      key,
      refCount: info.refCount,
      url: info.options.url,
      isConnected: info.client.isConnected()
    }));

    return {
      totalConnections: this.connections.size,
      connections
    };
  }

  private generateConnectionKey(options: WSClientOptions): string {
    // Create a unique key based on URL and key options, including projectId, subClientId, and convId
    const keyParts = [
      options.url,
      options.projectId || 'no-project', // Include projectId in the key
      options.subClientId || 'no-subclient', // Include subClientId in the key
      options.convId || 'no-conv', // Include convId in the key (for embed mode)
      options.uid || 'no-uid', // Include uid in the key
      options.reconnectAttempts?.toString() || '5',
      options.reconnectDelay?.toString() || '1000',
      options.heartbeatInterval?.toString() || '30000',
      options.timeout?.toString() || '10000'
    ];

    return keyParts.join('|');
  }

  private onConnectionDisconnected(connectionKey: string): void {
    const connectionInfo = this.connections.get(connectionKey);
    if (connectionInfo && connectionInfo.refCount <= 0) {
      logger.websocket.info(`WSConnectionManager: Connection disconnected and cleaned up`, { connectionKey });
      this.connections.delete(connectionKey);
    }
  }
}

/**
 * React hook for using WebSocket connection manager
 */
import { useEffect, useRef, useMemo, useState } from "react";

export function useWSConnection(options: WSClientOptions) {
  const clientRef = useRef<WSClient | null>(null);
  const managerRef = useRef<WSConnectionManager>(WSConnectionManager.getInstance());
  const [, forceUpdate] = useState({});

  // Memoize options to prevent unnecessary recreations
  const memoizedOptions = useMemo(() => options, [
    options.url,
    options.projectId, // Include projectId so connection is recreated when project changes
    options.subClientId, // Include subClientId so connection is recreated when sub-client changes
    options.convId, // Include convId (embed mode)
    options.uid, // Include uid (embed auth)
    options.embedToken, // Include embedToken
    options.reconnectAttempts,
    options.reconnectDelay,
    options.heartbeatInterval,
    options.timeout,
    options.protocols
  ]);

  // Initialize and manage connection in useEffect
  useEffect(() => {
    logger.websocket.debug(`useWSConnection: useEffect triggered`, { url: memoizedOptions.url });
    let isMounted = true;

    // Get or create client (async)
    const initConnection = async () => {
      try {
        const client = await managerRef.current.getClient(memoizedOptions);

        if (isMounted) {
          if (client !== clientRef.current) {
            clientRef.current = client;
            // Force re-render to update the returned client value
            forceUpdate({});
          }
        } else {
          // If unmounted before completion, release immediately
          managerRef.current.releaseClient(memoizedOptions);
        }
      } catch (error) {
        logger.websocket.error(`useWSConnection: Failed to initialize connection`, { error: String(error) });
      }
    };

    initConnection();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (clientRef.current) {
        logger.websocket.debug(`useWSConnection: Cleaning up connection`);
        managerRef.current.releaseClient(memoizedOptions);
        clientRef.current = null;
      }
    };
  }, [memoizedOptions]);

  return clientRef.current;
}