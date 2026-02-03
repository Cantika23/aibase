/**
 * Sub-Client Settings Page
 * Full page for managing sub-clients within a project
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useProjectStore } from "@/stores/project-store";
import { useSubClientStore } from "@/stores/sub-client-store";
import { useAuthStore } from "@/stores/auth-store";
import { 
  Users, 
  Plus, 
  Trash2, 
  Building2, 
  RefreshCw,
  AlertTriangle,
  Edit
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
export function SubClientSettings() {
  const { currentProject, updateProject } = useProjectStore();
  const { 
    subClients, 
    isLoading, 
    enabled,
    fetchSubClients,
    createSubClient,
    deleteSubClient,
    updateSubClientDetails,
  } = useSubClientStore();
  const token = useAuthStore((state) => state.token);
  
  const [isToggling, setIsToggling] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subClientToDelete, setSubClientToDelete] = useState<string | null>(null);
  const [subClientToEdit, setSubClientToEdit] = useState<string | null>(null);
  const [newSubClientName, setNewSubClientName] = useState("");
  const [newSubClientDescription, setNewSubClientDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPathname, setEditPathname] = useState("");

  // Check if user is project owner
  const isProjectOwner = currentProject?.user_id === useAuthStore.getState().user?.id;

  // Load sub-clients when project changes
  useEffect(() => {
    if (currentProject && enabled) {
      fetchSubClients(currentProject.id);
    }
  }, [currentProject?.id, enabled]);

  // Toggle sub-clients feature
  const handleToggleSubClients = async () => {
    if (!currentProject || !token) return;
    
    setIsToggling(true);
    try {
      const response = await fetch(`/api/projects/${currentProject.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sub_clients_enabled: !enabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update setting");
      }

      const data = await response.json();
      if (data.success) {
        updateProject(currentProject.id, { sub_clients_enabled: !enabled });
        toast.success(enabled ? "Sub-clients disabled" : "Sub-clients enabled");
        if (!enabled) {
          // Just enabled - fetch sub-clients
          fetchSubClients(currentProject.id);
        }
      }
    } catch (error) {
      toast.error("Failed to update setting");
      console.error("Toggle sub-clients error:", error);
    } finally {
      setIsToggling(false);
    }
  };

  // Create new sub-client
  const handleCreateSubClient = async () => {
    if (!currentProject || !newSubClientName.trim()) {
      toast.error("Name is required");
      return;
    }

    const result = await createSubClient(
      currentProject.id,
      newSubClientName.trim(),
      newSubClientDescription.trim() || undefined
    );

    if (result) {
      toast.success(`Sub-client created! URL: /s/${result.short_id}-${result.pathname}`);
      setCreateDialogOpen(false);
      setNewSubClientName("");
      setNewSubClientDescription("");
    }
  };

  // Delete sub-client
  const handleDeleteSubClient = async () => {
    if (!currentProject || !subClientToDelete) return;

    const success = await deleteSubClient(currentProject.id, subClientToDelete);

    if (success) {
      toast.success("Sub-client deleted successfully");
      setDeleteDialogOpen(false);
      setSubClientToDelete(null);
    }
  };

  // Update sub-client
  const handleUpdateSubClient = async () => {
    if (!currentProject || !subClientToEdit || !editName.trim()) return;

    const success = await updateSubClientDetails(
      currentProject.id,
      subClientToEdit,
      editName.trim(),
      editDescription.trim() || undefined,
      editPathname.trim() || undefined
    );

    if (success) {
      toast.success("Sub-client updated successfully");
      setEditDialogOpen(false);
      setSubClientToEdit(null);
      setEditName("");
      setEditDescription("");
      setEditPathname("");
    }
  };

  // Open edit dialog
  const openEditDialog = (subClient: typeof subClients[0]) => {
    setSubClientToEdit(subClient.id);
    setEditName(subClient.name);
    setEditDescription(subClient.description || "");
    setEditPathname(subClient.pathname || "");
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (subClientId: string) => {
    setSubClientToDelete(subClientId);
    setDeleteDialogOpen(true);
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center px-4 pt-12 md:pt-4 md:px-6 pb-4">
      <div className="w-full max-w-3xl space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sub-Clients</h1>
              <p className="text-sm text-muted-foreground">
                Manage sub-clients for {currentProject.name}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleSubClients}
                disabled={isToggling || !isProjectOwner}
              />
              <span>Enable Sub-Clients</span>
            </CardTitle>
            <CardDescription>
              When enabled, you can create multiple sub-clients within this project, 
              each with their own WhatsApp integration and users.
            </CardDescription>
          </CardHeader>
          {!isProjectOwner && (
            <CardContent>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Only the project owner can enable or disable sub-clients.
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>

        {/* Sub-Clients List */}
        {enabled && (
          <>
            <div className="flex justify-end">
              <Button
                onClick={() => setCreateDialogOpen(true)}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Sub-Client
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : subClients.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">No sub-clients yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create your first sub-client to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {subClients.map((subClient) => (
                  <Card key={subClient.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{subClient.name}</CardTitle>
                            <CardDescription>
                              {subClient.short_id && subClient.pathname && (
                                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                                  /s/{subClient.short_id}-{subClient.pathname}
                                </span>
                              )}
                              <span className="ml-2">{subClient.users?.length || 0} users</span>
                              {subClient.whatsapp_client_id && " • WhatsApp connected"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(subClient)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(subClient.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {subClient.description && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">
                          {subClient.description}
                        </p>
                      </CardContent>
                    )}
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {subClient.users?.map((user) => (
                          <div
                            key={user.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
                          >
                            <Users className="h-3 w-3" />
                            <span>{user.username}</span>
                            {user.role === "admin" && (
                              <span className="text-primary font-medium">(Admin)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sub-Client</DialogTitle>
              <DialogDescription>
                Create a new sub-client within this project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Marketing Department"
                  value={newSubClientName}
                  onChange={(e) => setNewSubClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this sub-client..."
                  value={newSubClientDescription}
                  onChange={(e) => setNewSubClientDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewSubClientName("");
                  setNewSubClientDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubClient}
                disabled={!newSubClientName.trim() || isLoading}
              >
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Sub-Client</DialogTitle>
              <DialogDescription>
                Update the sub-client details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pathname">Pathname</Label>
                <Input
                  id="edit-pathname"
                  placeholder="marketing-dept"
                  value={editPathname}
                  onChange={(e) => setEditPathname(e.target.value)}
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers, and hyphens only"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate from name. Lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSubClientToEdit(null);
                  setEditName("");
                  setEditDescription("");
                  setEditPathname("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateSubClient}
                disabled={!editName.trim() || isLoading}
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Sub-Client</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this sub-client? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSubClientToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSubClient}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
