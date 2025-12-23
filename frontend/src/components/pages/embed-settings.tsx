/**
 * Embed Settings Page
 * Full page for managing project embedding settings
 */

import { useState, useEffect, useCallback } from "react";
import {
  PageActionButton,
  PageActionGroup,
} from "@/components/ui/page-action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useProjectStore } from "@/stores/project-store";
import { buildApiUrl } from "@/lib/base-path";
import { Power, PowerOff, RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = buildApiUrl("");

export function EmbedSettings() {
  const { currentProject } = useProjectStore();

  const [isEmbedEnabled, setIsEmbedEnabled] = useState(false);
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCoping, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeType, setCodeType] = useState<"iframe" | "javascript">("iframe");
  const [width, setWidth] = useState("400px");
  const [height, setHeight] = useState("600px");

  // Load custom CSS
  const loadCustomCss = useCallback(async () => {
    if (!currentProject) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/css`
      );
      const data = await response.json();

      if (data.success && data.data.customCss) {
        setCustomCss(data.data.customCss);
      }
    } catch (err) {
      console.error("Failed to load custom CSS:", err);
    }
  }, [currentProject]);

  // Load welcome message
  const loadWelcomeMessage = useCallback(async () => {
    if (!currentProject || !embedToken) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/embed/info?projectId=${currentProject.id}&embedToken=${embedToken}`
      );
      const data = await response.json();

      if (data.success && data.data.welcomeMessage) {
        setWelcomeMessage(data.data.welcomeMessage);
      }
    } catch (err) {
      console.error("Failed to load welcome message:", err);
    }
  }, [currentProject, embedToken]);

  // Load embed settings when project changes
  const loadEmbedSettings = useCallback(async () => {
    if (!currentProject) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/status`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load embed settings");
      }

      setIsEmbedEnabled(data.data.isEmbeddable || false);
      setEmbedToken(data.data.embedToken || null);

      // Load custom CSS
      if (data.data.isEmbeddable) {
        await loadCustomCss();
      }

      // Load welcome message if embed token exists
      if (data.data.embedToken) {
        await loadWelcomeMessage();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load embed settings";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, loadCustomCss, loadWelcomeMessage]);

  // Load embed settings when project changes
  useEffect(() => {
    if (currentProject) {
      loadEmbedSettings();
    }
  }, [currentProject, loadEmbedSettings]);

  // Also reload welcome message when embedToken changes
  useEffect(() => {
    if (embedToken) {
      loadWelcomeMessage();
    }
  }, [embedToken, loadWelcomeMessage]);

  const handleEnableEmbed = async () => {
    if (!currentProject) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/enable`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to enable embedding");
      }

      setIsEmbedEnabled(true);
      setEmbedToken(data.data.embedToken);
      toast.success("Embedding enabled successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to enable embedding";
      setError(errorMessage);
      toast.error("Failed to enable embedding", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableEmbed = async () => {
    if (!currentProject) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/disable`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to disable embedding");
      }

      setIsEmbedEnabled(false);
      setEmbedToken(null);
      setCustomCss("");
      setWelcomeMessage("");
      toast.success("Embedding disabled successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to disable embedding";
      setError(errorMessage);
      toast.error("Failed to disable embedding", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCustomCss = async () => {
    if (!currentProject) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/css`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customCss }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save custom CSS");
      }

      toast.success("Custom CSS saved successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save custom CSS";
      setError(errorMessage);
      toast.error("Failed to save custom CSS", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWelcomeMessage = async () => {
    if (!currentProject) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/welcome-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ welcomeMessage }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save welcome message");
      }

      toast.success("Welcome message saved successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save welcome message";
      setError(errorMessage);
      toast.error("Failed to save welcome message", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!currentProject || !confirm("Regenerating the token will invalidate all existing embed codes. Continue?")) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${currentProject.id}/embed/regenerate`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to regenerate token");
      }

      setEmbedToken(data.data.embedToken);
      toast.success("Embed token regenerated successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to regenerate token";
      setError(errorMessage);
      toast.error("Failed to regenerate token", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateIframeCode = (): string => {
    if (!currentProject || !embedToken) return "";
    const basePath = buildApiUrl("");
    const baseUrl = window.location.origin;
    const embedUrl = `${baseUrl}${basePath}/embed?projectId=${encodeURIComponent(currentProject.id)}&embedToken=${encodeURIComponent(embedToken)}`;

    return `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="microphone"
  style="border: 1px solid #ccc; border-radius: 8px;"
></iframe>`;
  };

  const generateJavaScriptCode = (): string => {
    if (!currentProject || !embedToken) return "";
    const basePath = buildApiUrl("");
    const baseUrl = window.location.origin;
    const embedUrl = `${baseUrl}${basePath}/embed?projectId=${encodeURIComponent(currentProject.id)}&embedToken=${encodeURIComponent(embedToken)}`;

    return `<div id="aibase-chat"></div>
<script>
(function() {
  const iframe = document.createElement('iframe');
  iframe.src = '${embedUrl}';
  iframe.width = '${width}';
  iframe.height = '${height}';
  iframe.frameBorder = '0';
  iframe.allow = 'microphone';
  iframe.style.cssText = 'border: 1px solid #ccc; border-radius: 8px;';
  document.getElementById('aibase-chat').appendChild(iframe);
})();
<\/script>`;
  };

  const embedCode = isEmbedEnabled && embedToken
    ? codeType === "iframe"
      ? generateIframeCode()
      : generateJavaScriptCode()
    : "";

  const handleCopyCode = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("Embed code copied to clipboard!");
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
      setIsCopying(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No project selected. Please select a project first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 px-4 pt-14 mb-4">
      {/* Header */}
      <PageActionGroup>
        <PageActionButton
          icon={RefreshCw}
          label="Refresh"
          onClick={loadEmbedSettings}
          variant="outline"
          isLoading={isLoading}
          spinIcon={true}
        />
        {isEmbedEnabled ? (
          <PageActionButton
            icon={PowerOff}
            label="Disable Embed"
            onClick={handleDisableEmbed}
            variant="destructive"
            isLoading={isSaving}
          />
        ) : (
          <PageActionButton
            icon={Power}
            label="Enable Embed"
            onClick={handleEnableEmbed}
            isLoading={isSaving}
          />
        )}
      </PageActionGroup>

      {error && (
        <Alert variant="destructive">
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground ml-4">Loading embed settings...</p>
        </div>
      ) : !isEmbedEnabled ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <p className="text-muted-foreground mb-4">
              Embedding is currently disabled for this project. Enable it to generate embed
              codes and customize the embedded chat.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {/* Welcome Message Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Welcome Message</h2>
            <p className="text-sm text-muted-foreground">
              Customize the message shown to users when the chat has no messages yet. Leave empty to use the default "Welcome".
            </p>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message (max 500 characters)</Label>
              <textarea
                id="welcomeMessage"
                placeholder="e.g., Hello! How can I help you today?"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                maxLength={500}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {welcomeMessage.length}/500
              </p>
            </div>
            <Button onClick={handleSaveWelcomeMessage} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Welcome Message"}
            </Button>
          </div>

          {/* Custom CSS Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Custom CSS</h2>
            <p className="text-sm text-muted-foreground">
              Add custom CSS to style the embedded chat widget. Max 10KB.
            </p>
            <div className="space-y-2">
              <Label htmlFor="customCss">CSS Code</Label>
              <textarea
                id="customCss"
                placeholder={`/* Example CSS */
.aibase-chat-container {
  background-color: #f5f5f5;
}
.aibase-chat-input {
  border-radius: 8px;
}`}
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                maxLength={10240}
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {customCss.length}/10240
              </p>
            </div>
            <Button onClick={handleSaveCustomCss} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Custom CSS"}
            </Button>
          </div>

          {/* Embed Code Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Embed Code</h2>
                <p className="text-sm text-muted-foreground">
                  Copy and paste this code into your website
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={codeType === "iframe" ? "default" : "outline"}
                  onClick={() => setCodeType("iframe")}
                >
                  iframe
                </Button>
                <Button
                  size="sm"
                  variant={codeType === "javascript" ? "default" : "outline"}
                  onClick={() => setCodeType("javascript")}
                >
                  JavaScript
                </Button>
              </div>
            </div>

            {/* Size Controls */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="400px"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="600px"
                />
              </div>
            </div>

            {/* Code Display */}
            <div className="space-y-2">
              <Label>Embed Code</Label>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={handleCopyCode}
                >
                  {isCoping ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Regenerate Token */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleRegenerateToken}
                disabled={isSaving}
              >
                Regenerate Embed Token
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Regenerating the token will invalidate all existing embed codes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
