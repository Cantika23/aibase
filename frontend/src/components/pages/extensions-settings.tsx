/**
 * Extensions Settings Component
 * Manage project-specific extensions
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore } from "@/stores/project-store";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getExtensions,
  toggleExtension,
  deleteExtension,
  resetExtensionsToDefaults,
} from "@/lib/api/extensions";
import type { Extension } from "@/types/extension";
import {
  Trash2,
  Edit,
  Plus,
  PowerIcon,
  RefreshCw,
  Code,
} from "lucide-react";

export function ExtensionsSettings() {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();

  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load extensions
  const loadExtensions = useCallback(async () => {
    if (!currentProject) return;

    setIsLoading(true);
    try {
      const data = await getExtensions(currentProject.id);
      setExtensions(data);
    } catch (error) {
      console.error("Failed to load extensions:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load extensions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      loadExtensions();
    }
  }, [currentProject, loadExtensions]);

  // Handle toggle extension
  const handleToggle = async (extensionId: string) => {
    if (!currentProject) return;

    try {
      const updated = await toggleExtension(currentProject.id, extensionId);
      setExtensions((prev) =>
        prev.map((ext) =>
          ext.metadata.id === extensionId ? updated : ext
        )
      );
      toast.success(
        updated.metadata.enabled
          ? "Extension enabled"
          : "Extension disabled"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle extension"
      );
    }
  };

  // Handle delete extension
  const handleDelete = async (extensionId: string) => {
    if (!currentProject) return;

    if (
      !confirm(
        "Are you sure you want to delete this extension? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteExtension(currentProject.id, extensionId);
      setExtensions((prev) =>
        prev.filter((ext) => ext.metadata.id !== extensionId)
      );
      toast.success("Extension deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete extension"
      );
    }
  };

  // Handle reset to defaults
  const handleResetToDefaults = async () => {
    if (!currentProject) return;

    if (
      !confirm(
        "Are you sure you want to reset all extensions to defaults? This will delete all custom extensions."
      )
    ) {
      return;
    }

    try {
      const defaults = await resetExtensionsToDefaults(currentProject.id);
      setExtensions(defaults);
      toast.success("Extensions reset to defaults");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reset extensions"
      );
    }
  };

  // Handle create new extension
  const handleCreate = () => {
    if (!currentProject) return;
    navigate(`/projects/${currentProject.id}/extensions/new`);
  };

  // Handle edit extension
  const handleEdit = (extensionId: string) => {
    if (!currentProject) return;
    navigate(`/projects/${currentProject.id}/extensions/${extensionId}`);
  };

  // Filter extensions by search term
  const filteredExtensions = extensions.filter((ext) =>
    ext.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ext.metadata.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading && extensions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading extensions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extensions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project-specific extensions for the script tool
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefaults}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Extension
          </Button>
        </div>
      </div>

      {/* Search */}
      <div>
        <Label htmlFor="search">Search Extensions</Label>
        <Input
          id="search"
          placeholder="Search by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {/* Extensions List */}
      <div className="space-y-3">
        {filteredExtensions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchTerm ? "No extensions found" : "No extensions yet"}
          </div>
        ) : (
          filteredExtensions.map((extension) => (
            <div
              key={extension.metadata.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">
                      {extension.metadata.name}
                    </h3>
                    {extension.metadata.isDefault && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                    {!extension.metadata.enabled && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {extension.metadata.description}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                    <span>Version: {extension.metadata.version}</span>
                    {extension.metadata.author && (
                      <span>Author: {extension.metadata.author}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(extension.metadata.id)}
                    title={
                      extension.metadata.enabled ? "Disable" : "Enable"
                    }
                  >
                    <PowerIcon
                      className={`w-4 h-4 ${
                        extension.metadata.enabled
                          ? "text-green-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(extension.metadata.id)}
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(extension.metadata.id)}
                    title="Delete"
                    disabled={extension.metadata.isDefault}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
