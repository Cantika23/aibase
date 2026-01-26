/**
 * Extension Component Registry
 * Dynamic registry for extension-defined UI components
 *
 * Components can come from:
 * 1. Backend API (custom per-project)
 * 2. Frontend built-in (default/fallback)
 */

import { lazy } from "react";
import type { ComponentType } from "react";
import type { ToolInvocation } from "./types";

export interface VisualizationComponentProps {
  toolInvocation: ToolInvocation;
}

// Registry of extension-defined components (loaded from backend)
const backendComponents: Record<string, ComponentType<VisualizationComponentProps>> = {};

// Cache for dynamically loaded backend components
const backendComponentCache: Record<string, ComponentType<VisualizationComponentProps>> = {};

// Built-in frontend components - fallback defaults
const builtInComponents: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
  'show-chart': () => import("./chart-tool").then(m => ({ default: m.ChartTool })),
  'show-table': () => import("./table-tool").then(m => ({ default: m.TableTool })),
  'show-mermaid': () => import("./mermaid-tool").then(m => ({ default: m.MermaidTool })),
};

/**
 * Register an extension's component (loaded from backend)
 * @param type - The extension type (e.g., 'show-chart', 'custom-viz')
 * @param component - The React component to render
 */
export function registerExtensionComponent(
  type: string,
  component: ComponentType<VisualizationComponentProps>
): void {
  backendComponents[type] = component;
  console.log(`[ExtensionRegistry] Registered backend component for: ${type}`);
}

/**
 * Load component from backend API
 * @param extensionId - The extension ID
 * @returns The component or null if not found
 */
async function loadComponentFromBackend(
  extensionId: string
): Promise<ComponentType<VisualizationComponentProps> | null> {
  try {
    console.log(`[ExtensionRegistry] Loading ${extensionId} from backend API`);

    // Fetch bundled UI from backend
    const response = await fetch(`/api/extensions/${extensionId}/ui`);

    if (!response.ok) {
      console.log(`[ExtensionRegistry] Backend UI not available for ${extensionId}, will use frontend fallback`);
      return null;
    }

    const bundledCode = await response.text();

    // Create module from code
    const blob = new Blob([bundledCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    // Dynamic import
    const module = await import(url);

    // Clean up blob URL
    URL.revokeObjectURL(url);

    // Get named export (ShowChartMessage, ShowTableMessage, etc.)
    const messageComponentName = extensionId.split('-').map((part, idx) =>
      idx === 0 ? part.charAt(0).toUpperCase() + part.slice(1) :
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('') + 'Message';

    const component = module[messageComponentName] || module.default || Object.values(module)[0];

    if (component) {
      console.log(`[ExtensionRegistry] Successfully loaded backend UI for ${extensionId}`);
      return component as ComponentType<VisualizationComponentProps>;
    }

    return null;
  } catch (error) {
    console.warn(`[ExtensionRegistry] Failed to load backend UI for ${extensionId}:`, error);
    return null;
  }
}

/**
 * Get a visualization component by type
 * Priority:
 * 1. Backend-loaded component (custom per-project)
 * 2. Frontend built-in component (default fallback)
 *
 * @param type - The visualization type
 * @returns The component or null if not found
 */
export async function getExtensionComponent(
  type: string
): Promise<ComponentType<VisualizationComponentProps> | null> {
  // Check backend registry first (hardcoded backend components)
  if (backendComponents[type]) {
    return backendComponents[type];
  }

  // Check backend cache
  if (backendComponentCache[type]) {
    return backendComponentCache[type];
  }

  // Try to load from backend API (custom per-project UI)
  try {
    const backendComponent = await loadComponentFromBackend(type);
    if (backendComponent) {
      backendComponentCache[type] = backendComponent;
      return backendComponent;
    }
  } catch (error) {
    console.warn(`[ExtensionRegistry] Backend UI load failed for ${type}, falling back to frontend`);
  }

  // Fallback to built-in frontend components
  if (builtInComponents[type]) {
    // Create a lazy wrapper for built-in components
    const LazyComponent = lazy(builtInComponents[type]);
    return LazyComponent as ComponentType<VisualizationComponentProps>;
  }

  return null;
}

/**
 * Synchronous version for backward compatibility
 * Only returns frontend built-in components
 * @deprecated Use async version instead
 */
export function getExtensionComponentSync(
  type: string
): ComponentType<VisualizationComponentProps> | null {
  if (backendComponents[type]) {
    return backendComponents[type];
  }

  if (builtInComponents[type]) {
    const LazyComponent = lazy(builtInComponents[type]);
    return LazyComponent as ComponentType<VisualizationComponentProps>;
  }

  return null;
}

/**
 * Check if a visualization type is supported
 * @param type - The visualization type
 * @returns true if the type has a registered component
 */
export function hasVisualizationType(type: string): boolean {
  return (
    backendComponents[type] !== undefined ||
    backendComponentCache[type] !== undefined ||
    builtInComponents[type] !== undefined
  );
}

/**
 * Get all registered visualization types
 */
export function getRegisteredTypes(): string[] {
  return [
    ...Object.keys(backendComponents),
    ...Object.keys(backendComponentCache),
    ...Object.keys(builtInComponents)
  ];
}

/**
 * Clear backend component cache (useful for development/hot-reload)
 */
export function clearBackendComponentCache(): void {
  Object.keys(backendComponentCache).forEach(key => {
    delete backendComponentCache[key];
  });
  console.log('[ExtensionRegistry] Backend component cache cleared');
}
