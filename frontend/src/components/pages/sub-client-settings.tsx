/**
 * Sub-Client Settings Page
 * Settings for enabling/disabling sub-clients within a project
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useProjectStore } from "@/stores/project-store";
import { useSubClientStore } from "@/stores/sub-client-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  Building2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
export function SubClientSettings() {
  const { currentProject, updateProject } = useProjectStore();
  const { enabled, setEnabled } = useSubClientStore();

  const [isToggling, setIsToggling] = useState(false);

  // Check if user is project owner
  const isProjectOwner = currentProject?.user_id === useAuthStore.getState().user?.id;

  // Sync enabled state from project when it changes
  useEffect(() => {
    if (currentProject) {
      const projectEnabled = currentProject.sub_clients_enabled ?? false;
      if (projectEnabled !== enabled) {
        setEnabled(projectEnabled);
      }
    }
  }, [currentProject?.id, currentProject?.sub_clients_enabled]);

  // Toggle sub-clients feature
  const handleToggleSubClients = async () => {
    if (!currentProject) return;

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
        const newEnabled = !enabled;
        updateProject(currentProject.id, { sub_clients_enabled: newEnabled });
        // Also update the sub-client store's enabled state
        useSubClientStore.getState().setEnabled(newEnabled);
        toast.success(newEnabled ? "Sub-clients enabled" : "Sub-clients disabled");
      }
    } catch (error) {
      toast.error("Failed to update setting");
      console.error("Toggle sub-clients error:", error);
    } finally {
      setIsToggling(false);
    }
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
              <h1 className="text-2xl font-bold tracking-tight">Sub-Clients Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure sub-clients for {currentProject.name}
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
              Go to the <span className="font-medium">Management</span> page to create and manage sub-clients.
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
      </div>
    </div>
  );
}
