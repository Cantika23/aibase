"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/project-store";
import { useLogger } from "@/hooks/use-logger";

interface ProjectRouteHandlerProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that ensures the project from URL is loaded and valid
 */
export function ProjectRouteHandler({ children }: ProjectRouteHandlerProps) {
  const log = useLogger('ui');
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, currentProject, selectProject, isLoading, initializeProject } = useProjectStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Initialize projects if not already loaded
    if (projects.length === 0 && !isLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeProject().then(() => {
        setIsInitialized(true);
      });
    } else if (projects.length > 0) {
      setIsInitialized(true);
    }
  }, [projects.length, isLoading, initializeProject]);

  useEffect(() => {
    // Wait for projects to load
    if (!isInitialized || isLoading || projects.length === 0) {
      return;
    }

    // Validate project ID from URL
    if (!projectId) {
      navigate("/");
      return;
    }

    // Check if project exists
    const projectExists = projects.some((p) => p.id === projectId);
    if (!projectExists) {
      log.warn("Project not found, redirecting to project selector", { projectId });
      navigate("/");
      return;
    }

    // Sync current project with URL if different
    if (currentProject?.id !== projectId) {
      selectProject(projectId);
    }
  }, [projectId, projects, currentProject, isLoading, isInitialized, selectProject, navigate, log]);

  // Show loading state while validating
  if (!isInitialized || isLoading || !currentProject || currentProject.id !== projectId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">Loading project...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
