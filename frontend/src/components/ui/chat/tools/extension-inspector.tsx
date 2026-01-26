/**
 * Extension Inspector Component
 * Renders extension-specific inspector components based on the extension ID
 */

import { useEffect, useState } from "react";
import { getInspector } from "./extension-inspector-registry";
import type { ComponentType } from "react";
import type { InspectorComponentProps } from "./extension-inspector-registry";

interface ExtensionInspectorProps {
  extensionId: string;
  data: any;
  error?: string;
}

export function ExtensionInspector({ extensionId, data, error }: ExtensionInspectorProps) {
  const [InspectorComponent, setInspectorComponent] = useState<ComponentType<InspectorComponentProps> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInspector() {
      setLoading(true);
      setLoadError(null);

      try {
        const component = await getInspector(extensionId);

        if (!cancelled) {
          if (component) {
            setInspectorComponent(() => component);
          } else {
            setLoadError('No inspector available');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`[ExtensionInspector] Failed to load inspector for ${extensionId}:`, err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load inspector');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInspector();

    return () => {
      cancelled = true;
    };
  }, [extensionId]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        Loading inspector...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {loadError}: <code className="font-mono">{extensionId}</code>
      </div>
    );
  }

  if (!InspectorComponent) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No inspector available for extension: <code className="font-mono">{extensionId}</code>
      </div>
    );
  }

  return <InspectorComponent data={data} error={error} />;
}
