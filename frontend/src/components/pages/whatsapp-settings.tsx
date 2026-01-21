/**
 * WhatsApp Settings Page
 * Full page for managing WhatsApp integration with device linking
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildApiUrl } from "@/lib/base-path";
import { useProjectStore } from "@/stores/project-store";
import { MessageCircle, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";

const API_BASE_URL = buildApiUrl("");

interface WhatsAppClient {
  id: string;
  connected: boolean;
  connectedAt?: string;
  qrCode?: string;
  deviceName?: string;
}

interface WhatsAppWSMessage {
  type: 'subscribed' | 'status' | 'qr_code' | 'connected' | 'disconnected' | 'error';
  projectId?: string;
  data?: {
    projectId: string;
    connected?: boolean;
    connectedAt?: string;
    qrCode?: string;
    deviceName?: string;
    error?: string;
  };
}

export function WhatsAppSettings() {
  const { currentProject } = useProjectStore();
  const [client, setClient] = useState<WhatsAppClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load WhatsApp client for current project
  const loadClient = useCallback(async () => {
    if (!currentProject) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setClient(null);
          return;
        }
        throw new Error("Failed to load WhatsApp client");
      }

      const data = await response.json();
      setClient(data.client);

      // If client exists but not connected, fetch QR code
      if (data.client && !data.client.connected) {
        fetchQRCode(data.client.id);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load WhatsApp client";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  // Fetch QR code for device linking
  const fetchQRCode = useCallback(async (clientId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/qr?clientId=${clientId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch QR code");
      }

      const data = await response.json();

      if (!data.success || !data.qrCode) {
        setQrCodeImage(null);
        return;
      }

      // Generate QR code image from the text
      const qrDataUrl = await QRCodeLib.toDataURL(data.qrCode, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrCodeImage(qrDataUrl);
    } catch (err) {
      console.error("Failed to fetch QR code:", err);
      setQrCodeImage(null);
    }
  }, []);

  // Create new WhatsApp client
  const createClient = useCallback(async () => {
    if (!currentProject) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/whatsapp/client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: currentProject.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create WhatsApp client");
      }

      const data = await response.json();
      setClient(data.client);
      toast.success("WhatsApp client created successfully");

      // Fetch QR code for new client
      if (data.client && !data.client.connected) {
        fetchQRCode(data.client.id);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create WhatsApp client";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [currentProject, fetchQRCode]);

  // Delete WhatsApp client
  const deleteClient = useCallback(async () => {
    if (!currentProject || !client) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?clientId=${client.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete WhatsApp client");
      }

      setClient(null);
      setQrCodeImage(null);
      toast.success("WhatsApp client deleted successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete WhatsApp client";
      toast.error(errorMessage);
    }
  }, [currentProject, client]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!currentProject) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsBasePath = buildApiUrl("").replace(/^https?:\/\//, '').replace(/^http?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}${wsBasePath}/api/whatsapp/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WhatsApp WS] Connected');
      // Subscribe to this project's updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId: currentProject.id,
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const message: WhatsAppWSMessage = JSON.parse(event.data);
        console.log('[WhatsApp WS] Message:', message);

        switch (message.type) {
          case 'subscribed':
            console.log('[WhatsApp WS] Subscribed to project:', message.projectId);
            break;

          case 'status':
          case 'connected':
          case 'disconnected':
            if (message.data) {
              setClient({
                id: message.data.projectId,
                connected: message.data.connected || false,
                connectedAt: message.data.connectedAt,
                deviceName: message.data.deviceName,
              });

              // Show notification on status change
              if (message.type === 'connected') {
                toast.success('WhatsApp connected successfully!');
                setQrCodeImage(null);
              } else if (message.type === 'disconnected') {
                toast.error('WhatsApp disconnected');
              }
            }
            break;

          case 'qr_code':
            if (message.data?.qrCode) {
              const qrDataUrl = await QRCodeLib.toDataURL(message.data.qrCode, {
                width: 256,
                margin: 2,
                color: {
                  dark: "#000000",
                  light: "#FFFFFF",
                },
              });
              setQrCodeImage(qrDataUrl);
            }
            break;

          case 'error':
            if (message.data?.error) {
              toast.error(message.data.error);
            }
            break;
        }
      } catch (err) {
        console.error('[WhatsApp WS] Error parsing message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[WhatsApp WS] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WhatsApp WS] Disconnected');
    };

    return () => {
      // Unsubscribe before closing
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          projectId: currentProject.id,
        }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [currentProject]);

  // Load client when project changes
  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Loading WhatsApp settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageCircle className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">WhatsApp Integration</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!client ? (
          <Card>
            <CardHeader>
              <CardTitle>Connect WhatsApp Device</CardTitle>
              <CardDescription>
                Link a WhatsApp device to this project to enable AI
                conversations via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={createClient}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating client...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Link Device
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Device Status</span>
                  {client.connected ? (
                    <span className="text-sm font-normal text-green-600 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-600" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-sm font-normal text-yellow-600 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-600" />
                      Waiting for connection
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {client.connected
                    ? `Connected since ${new Date(client.connectedAt || "").toLocaleString()}`
                    : "Scan the QR code below with WhatsApp to link your device"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.connected ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {client.deviceName || "WhatsApp Device"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Client ID: {client.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteClient}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {qrCodeImage ? (
                      <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-white">
                        <img
                          src={qrCodeImage}
                          alt="WhatsApp QR Code"
                          className="w-64 h-64"
                        />
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Waiting for QR code to be scanned...
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-12 border rounded-lg">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium">How to link your device:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap Menu or Settings and select Linked Devices</li>
                        <li>Tap on Link a Device</li>
                        <li>
                          Point your phone at this screen to scan the QR code
                        </li>
                      </ol>
                    </div>
                    <Button
                      variant="outline"
                      onClick={deleteClient}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Information Card */}
            {client.connected && (
              <Card>
                <CardHeader>
                  <CardTitle>How it works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    When someone sends a message to your WhatsApp number, the AI
                    will automatically respond to them in this project's
                    context.
                  </p>
                  <p>
                    Each WhatsApp contact will get their own unique conversation
                    that persists across sessions.
                  </p>
                  <p>
                    The AI can receive and send text messages, images,
                    locations, and other media types.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
