/**
 * Extension Editor Page
 * Create or edit project extensions
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore } from "@/stores/project-store";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getExtension,
  createExtension,
  updateExtension,
} from "@/lib/api/extensions";
import type { Extension } from "@/types/extension";
import { ArrowLeft, Save } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";

export function ExtensionEditor() {
  const { currentProject } = useProjectStore();
  const navigate = useNavigate();
  const { extensionId } = useParams<{ extensionId: string }>();

  const isCreating = extensionId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [code, setCode] = useState(getDefaultCode());
  const [enabled, setEnabled] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load extension if editing
  const loadExtension = useCallback(async () => {
    if (!currentProject || isCreating || !extensionId) return;

    setIsLoading(true);
    try {
      const extension = await getExtension(currentProject.id, extensionId);
      setName(extension.metadata.name);
      setDescription(extension.metadata.description);
      setAuthor(extension.metadata.author || "");
      setVersion(extension.metadata.version);
      setCode(extension.code);
      setEnabled(extension.metadata.enabled);
    } catch (error) {
      console.error("Failed to load extension:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load extension"
      );
      handleBack();
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, extensionId, isCreating]);

  useEffect(() => {
    loadExtension();
  }, [loadExtension]);

  const handleBack = () => {
    if (!currentProject) return;
    navigate(`/projects/${currentProject.id}/extensions`);
  };

  const handleSave = async () => {
    if (!currentProject) return;

    // Validate
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!code.trim()) {
      toast.error("Code is required");
      return;
    }

    setIsSaving(true);
    try {
      if (isCreating) {
        // Generate ID from name
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        await createExtension(currentProject.id, {
          id,
          name,
          description,
          author: author || undefined,
          version,
          code,
          enabled,
        });

        toast.success("Extension created successfully");
      } else if (extensionId) {
        await updateExtension(currentProject.id, extensionId, {
          name,
          description,
          author: author || undefined,
          version,
          code,
          enabled,
        });

        toast.success("Extension updated successfully");
      }

      handleBack();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isCreating ? "create" : "update"} extension`
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading extension...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isCreating ? "New Extension" : "Edit Extension"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isCreating
                  ? "Create a new extension for this project"
                  : `Editing: ${name}`}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Extension"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name or organization"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this extension do?"
              className="mt-1.5"
            />
          </div>

          {/* Code Editor */}
          <div>
            <Label>Code (TypeScript) *</Label>
            <div className="mt-1.5 border rounded-md overflow-hidden">
              <CodeMirror
                value={code}
                height="500px"
                extensions={[javascript({ typescript: true })]}
                onChange={(value) => setCode(value)}
                theme="dark"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  foldGutter: true,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  crosshairCursor: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  closeBracketsKeymap: true,
                  searchKeymap: true,
                  foldKeymap: true,
                  completionKeymap: true,
                  lintKeymap: true,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Export functions from a default object. These functions will be
              available in the script tool runtime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultCode(): string {
  return `/**
 * Extension Template
 *
 * Export an object with functions that will be available in scripts.
 * All core script runtime functions (fetch, progress, file, todo, etc.)
 * are available for use within your extension functions.
 */

export default {
  /**
   * Example function
   */
  async exampleFunction(param: string) {
    // You can use all script runtime functions here
    // progress('Doing something...');
    // const result = await fetch('https://api.example.com');

    return { message: \`Hello \${param}\` };
  },

  /**
   * Another example
   */
  processData(data: any[]) {
    return data.map(item => ({
      ...item,
      processed: true
    }));
  },
};
`;
}
