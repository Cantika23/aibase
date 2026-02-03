/**
 * Sub-Client Detail Page
 * Shows users, WhatsApp integration, and settings for a specific sub-client
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildApiUrl } from "@/lib/base-path";
import { useProjectStore } from "@/stores/project-store";
import type { SubClientUser, SubClientUserRole } from "@/stores/sub-client-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  Building2,
  Users,
  MessageCircle,
  RefreshCw,
  Smartphone,
  Trash2,
  Plus,
  ChevronLeft,
  MoreVertical,
  Shield,
  Link,
  Loader2,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const API_BASE_URL = buildApiUrl("");

interface WhatsAppClient {
  id: string;
  phone?: string | null;
  connected: boolean;
  connectedAt?: string;
  qrCode?: string;
  deviceName?: string;
}

interface WhatsAppWSMessage {
  type: 'subscribed' | 'status' | 'qr_code' | 'qr_timeout' | 'connected' | 'disconnected' | 'error';
  subClientId?: string;
  data?: {
    subClientId: string;
    phone?: string;
    connected?: boolean;
    connectedAt?: string;
    qrCode?: string;
    deviceName?: string;
    error?: string;
  };
}

type TabType = 'users' | 'whatsapp';

export function SubClientDetailPage() {
  const navigate = useNavigate();
  const { projectId, subClientId } = useParams<{ projectId: string; subClientId: string }>();
  const { currentProject } = useProjectStore();
  const { user: currentUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [subClient, setSubClient] = useState<{
    id: string;
    name: string;
    description: string | null;
    short_id: string | null;
    pathname: string | null;
    custom_domain: string | null;
    users: SubClientUser[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User management state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SubClientUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<SubClientUserRole>('user');
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // WhatsApp state
  const [whatsappClient, setWhatsappClient] = useState<WhatsAppClient | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isQrExpired, setIsQrExpired] = useState(false);
  const [isCreatingWhatsApp, setIsCreatingWhatsApp] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef<boolean>(false);

  // Fetch sub-client details
  const fetchSubClient = useCallback(async () => {
    if (!projectId || !subClientId) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sub-client");
      }

      const data = await response.json();
      if (data.success) {
        setSubClient(data.data.subClient);
      } else {
        throw new Error(data.error || "Failed to fetch sub-client");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sub-client";
      toast.error(errorMessage);
      console.error("Error fetching sub-client:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, subClientId]);

  // Fetch available users (not in this sub-client)
  const fetchAvailableUsers = useCallback(async () => {
    if (!projectId || !subClientId) return;

    setIsLoadingUsers(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/users`);

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      if (data.success) {
        // Filter out users already in the sub-client using current state
        const currentUserIds = subClient?.users.map(u => u.id) || [];
        const available = data.users.filter((u: { id: number }) => !currentUserIds.includes(u.id));
        setAvailableUsers(available);
      }
    } catch (err) {
      console.error("Error fetching available users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [projectId, subClientId]); // Remove subClient?.users and log from deps

  // Add user to sub-client
  const handleAddUser = async () => {
    if (!projectId || !subClientId || !selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add user");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("User added successfully");
        setAddUserDialogOpen(false);
        setSelectedUserId(null);
        setSelectedRole('user');
        fetchSubClient();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  };

  // Open delete user dialog
  const openDeleteUserDialog = (user: SubClientUser) => {
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
  };

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!projectId || !subClientId || !userToDelete) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users/${userToDelete.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove user");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("User removed successfully");
        setDeleteUserDialogOpen(false);
        setUserToDelete(null);
        fetchSubClient();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  // Update user role
  const handleUpdateRole = async (user: SubClientUser, newRole: SubClientUserRole) => {
    if (!projectId || !subClientId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users/${user.id}/role`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update role");
      }

      const data = await response.json();
      if (data.success) {
        toast.success("Role updated successfully");
        fetchSubClient();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  // Format phone number
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "Unknown Device";
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return digits.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
    } else if (digits.startsWith('62')) {
      return '+62 ' + digits.substring(2).replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return '+' + digits;
  };

  // WhatsApp functions
  const loadWhatsAppClient = useCallback(async () => {
    if (!subClientId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?subClientId=${subClientId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setWhatsappClient(null);
          return;
        }
        throw new Error("Failed to load WhatsApp client");
      }

      const data = await response.json();
      setWhatsappClient(data.client);

      if (data.client && !data.client.connected && wsConnectedRef.current !== true) {
        fetchQRCode(data.client.id);
      } else if (data.client && data.client.connected) {
        wsConnectedRef.current = true;
        setQrCodeImage(null);
        setIsQrExpired(false);
      }
    } catch (err) {
      console.error("Error loading WhatsApp client:", err);
    }
  }, [subClientId]);

  const fetchQRCode = useCallback(async (clientId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/whatsapp/qr?clientId=${clientId}`);
      setIsQrExpired(false);

      if (!response.ok) throw new Error("Failed to fetch QR code");

      const data = await response.json();
      if (wsConnectedRef.current) {
        setQrCodeImage(null);
        return;
      }

      if (!data.success || !data.qrCode) {
        setQrCodeImage(null);
        return;
      }

      if (wsConnectedRef.current) {
        setQrCodeImage(null);
        return;
      }

      const qrDataUrl = await QRCodeLib.toDataURL(data.qrCode, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      if (!wsConnectedRef.current) {
        setQrCodeImage(qrDataUrl);
      }
    } catch (err) {
      console.error("Error fetching QR code:", err);
      setQrCodeImage(null);
    }
  }, []); // Remove log dependency

  const createWhatsAppClient = useCallback(async () => {
    if (!subClientId || !currentProject) return;

    setIsCreatingWhatsApp(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/whatsapp/client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProject.id, subClientId }),
      });

      if (!response.ok) throw new Error("Failed to create WhatsApp client");

      const data = await response.json();
      setWhatsappClient(data.client);
      toast.success("WhatsApp client created successfully");

      if (data.client && !data.client.connected) {
        fetchQRCode(data.client.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create WhatsApp client");
    } finally {
      setIsCreatingWhatsApp(false);
    }
  }, [subClientId, currentProject?.id, fetchQRCode]); // Use currentProject?.id instead

  const deleteWhatsAppClient = useCallback(async () => {
    if (!subClientId || !whatsappClient) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?clientId=${whatsappClient.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete WhatsApp client");

      setWhatsappClient(null);
      setQrCodeImage(null);
      setIsQrExpired(false);
      wsConnectedRef.current = false;
      toast.success("WhatsApp client deleted successfully");

      setTimeout(() => loadWhatsAppClient(), 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete WhatsApp client");
    }
  }, [subClientId]); // Remove whatsappClient and loadWhatsAppClient deps

  // WebSocket connection for WhatsApp
  useEffect(() => {
    if (!subClientId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsBasePath = buildApiUrl("").replace(/^https?:\/\//, '').replace(/^http?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}${wsBasePath}/api/whatsapp/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', subClientId }));
    };

    ws.onmessage = async (event) => {
      try {
        const message: WhatsAppWSMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'subscribed':
            break;
          case 'status':
          case 'connected':
          case 'disconnected':
            if (message.data?.subClientId === subClientId) {
              const isConnected = message.data.connected || false;
              wsConnectedRef.current = isConnected;
              setWhatsappClient({
                id: message.data.subClientId,
                phone: message.data.phone,
                connected: isConnected,
                connectedAt: message.data.connectedAt,
                deviceName: message.data.deviceName,
              });
              if (isConnected) {
                setQrCodeImage(null);
                setIsQrExpired(false);
              }
              if (message.type === 'connected') toast.success('WhatsApp connected successfully!');
              else if (message.type === 'disconnected') toast.error('WhatsApp disconnected');
            }
            break;
          case 'qr_code':
            if (message.data?.subClientId === subClientId && message.data?.qrCode) {
              const qrDataUrl = await QRCodeLib.toDataURL(message.data.qrCode, {
                width: 256,
                margin: 2,
                color: { dark: "#000000", light: "#FFFFFF" },
              });
              setQrCodeImage(qrDataUrl);
              setIsQrExpired(false);
            }
            break;
          case 'qr_timeout':
            if (message.data?.subClientId === subClientId) {
              setQrCodeImage(null);
              setIsQrExpired(true);
              toast.error("QR Code expired. Please regenerate.");
            }
            break;
          case 'error':
            if (message.data?.error) toast.error(message.data.error);
            break;
        }
      } catch (err) {
        console.error("Error parsing WhatsApp WebSocket message", err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', subClientId }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [subClientId]);

  // Load data on mount
  useEffect(() => {
    fetchSubClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, subClientId]); // Run when projectId or subClientId changes

  // Load WhatsApp when switching to WhatsApp tab
  useEffect(() => {
    if (activeTab === 'whatsapp') {
      loadWhatsAppClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, subClientId]); // Run when tab or subClientId changes

  // Load available users when opening add dialog
  useEffect(() => {
    if (addUserDialogOpen) {
      fetchAvailableUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addUserDialogOpen, projectId, subClientId]); // Run when dialog opens or IDs change

  // Get public URL for sub-client
  const getPublicUrl = () => {
    if (!subClient?.short_id || !subClient?.pathname) return null;
    const basePath = import.meta.env.VITE_PUBLIC_BASE_PATH || '';
    return `${window.location.origin}${basePath}/s/${subClient.short_id}-${subClient.pathname}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen-mobile items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading sub-client...</p>
        </div>
      </div>
    );
  }

  if (!subClient) {
    return (
      <div className="flex h-screen-mobile items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sub-Client not found</h2>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/sub-clients/management`)}
          >
            Back to Sub-Clients
          </Button>
        </div>
      </div>
    );
  }

  const publicUrl = getPublicUrl();

  return (
    <div className="flex h-screen-mobile flex-col">
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 pt-[60px] md:px-6 pb-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/projects/${projectId}/sub-clients/management`)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{subClient.name}</h1>
                    {publicUrl && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link className="h-3 w-3" />
                        <span className="font-mono">{publicUrl}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {subClient.description && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{subClient.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-6">
              <TabsList>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-2" />
                  Users ({subClient.users.length})
                </TabsTrigger>
                <TabsTrigger value="whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Team Members</h2>
                  <Button onClick={() => setAddUserDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>

                {subClient.users.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No users in this sub-client yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {subClient.users.map((user) => (
                      <Card key={user.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                {user.role === 'admin' ? (
                                  <Shield className="h-5 w-5 text-primary" />
                                ) : (
                                  <Users className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{user.username}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                user.role === 'admin'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {user.role === 'admin' ? 'Admin' : 'User'}
                              </span>
                              {user.id !== currentUser?.id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleUpdateRole(user, user.role === 'admin' ? 'user' : 'admin')}>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Change to {user.role === 'admin' ? 'User' : 'Admin'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteUserDialog(user)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* WhatsApp Tab */}
              <TabsContent value="whatsapp" className="space-y-4">
                {!whatsappClient ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Connect WhatsApp</CardTitle>
                      <CardDescription>
                        Link a WhatsApp device to this sub-client for AI-powered conversations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={createWhatsAppClient}
                        disabled={isCreatingWhatsApp}
                        className="w-full"
                      >
                        {isCreatingWhatsApp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  <div className="space-y-4">
                    {/* Connection Status */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Device Status</span>
                          {whatsappClient.connected ? (
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
                          {whatsappClient.connected
                            ? `Connected since ${new Date(whatsappClient.connectedAt || "").toLocaleString()}`
                            : "Scan the QR code below with WhatsApp to link your device"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {whatsappClient.connected ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Smartphone className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">WhatsApp Device</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatPhoneNumber(whatsappClient.phone)}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={deleteWhatsAppClient}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Disconnect
                              </Button>
                            </div>
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
                            ) : isQrExpired ? (
                              <div className="flex flex-col items-center gap-4 p-8 border rounded-lg bg-red-50/50 border-red-200">
                                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                                  <RefreshCw className="h-8 w-8 text-red-600" />
                                </div>
                                <div className="text-center">
                                  <p className="font-medium text-red-900 mb-1">QR Code Expired</p>
                                  <p className="text-sm text-red-700 mb-4">
                                    The security code has timed out. Please generate a new one.
                                  </p>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => createWhatsAppClient()}
                                  >
                                    Generate New Code
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center p-12 border rounded-lg">
                                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Add a user to this sub-client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              {isLoadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available users to add</p>
              ) : (
                <select
                  id="user"
                  value={selectedUserId?.toString() || ''}
                  onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id.toString()}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as SubClientUserRole)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={!selectedUserId}>
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-medium">{userToDelete?.username}</span> from this sub-client?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
