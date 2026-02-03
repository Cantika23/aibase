"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSubClientStore } from "@/stores/sub-client-store";
import { useAuthStore } from "@/stores/auth-store";
import { useLogger } from "@/hooks/use-logger";
import { buildApiUrl } from "@/lib/base-path";
import { Loader2 } from "lucide-react";

interface SubClientRouteHandlerProps {
  children: React.ReactNode;
}

interface SubClientLookupResponse {
  success: boolean;
  data?: {
    subClient: {
      id: string;
      project_id: string;
      name: string;
      description: string | null;
      short_id: string;
      pathname: string;
    };
  };
  error?: string;
}

/**
 * Wrapper component that ensures the sub-client from URL is loaded and valid
 * Handles URL format: /s/{shortId}-{pathname} (e.g., /s/x7m2-marketing/chat)
 */
export function SubClientRouteHandler({ children }: SubClientRouteHandlerProps) {
  const log = useLogger('ui');
  const { shortPath } = useParams<{ shortPath: string }>();
  const navigate = useNavigate();
  const { setCurrentSubClient } = useSubClientStore();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lookupSubClient = async () => {
      if (!shortPath) {
        setError("No sub-client specified");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Lookup sub-client by shortId-pathname (e.g., x7m2-marketing)
        const response = await fetch(
          buildApiUrl(`/api/sub-clients/lookup?shortPath=${encodeURIComponent(shortPath)}`)
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Sub-client not found");
          } else {
            setError("Failed to load sub-client");
          }
          return;
        }

        const data: SubClientLookupResponse = await response.json();

        if (!data.success || !data.data?.subClient) {
          setError(data.error || "Failed to load sub-client");
          return;
        }

        const subClient = data.data.subClient;

        // Set the sub-client in store
        setCurrentSubClient({
          id: subClient.id,
          project_id: subClient.project_id,
          name: subClient.name,
          description: subClient.description,
          whatsapp_client_id: null,
          short_id: subClient.short_id,
          pathname: subClient.pathname,
          custom_domain: null,
          created_at: 0,
          updated_at: 0,
        });

        // TODO: Verify user belongs to this sub-client
        // For now, we'll allow access but will need to add authorization
      } catch (err) {
        log.error("Error looking up sub-client", { error: String(err) });
        setError("Failed to load sub-client");
      } finally {
        setIsLoading(false);
      }
    };

    lookupSubClient();
  }, [shortPath, setCurrentSubClient, log]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen-mobile items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <div className="text-lg font-medium">Loading workspace...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-screen-mobile items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-2xl font-bold text-muted-foreground">Workspace Not Found</div>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen-mobile items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-2xl font-bold">Authentication Required</div>
          <p className="text-muted-foreground">
            Please sign in to access this workspace
          </p>
          <button
            onClick={() => navigate(`/s/${shortPath}/login`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
