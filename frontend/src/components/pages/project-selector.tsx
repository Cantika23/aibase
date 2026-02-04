"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/project-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectCreateModal } from "@/components/project/project-create-modal";
import { ProjectRenameModal } from "@/components/project/project-rename-modal";
import { Plus, Trash2, Pencil, Loader2, FolderOpen, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/stores/project-store";
import { cn } from "@/lib/utils";

export function ProjectSelectorPage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const {
    projects,
    currentProject,
    selectProject,
    deleteProject,
    isLoading,
    error,
    initializeProject,
  } = useProjectStore();

  useEffect(() => {
    const init = async () => {
      try {
        await initializeProject();
      } finally {
        setHasInitialized(true);
      }
    };
    init();
  }, [initializeProject]);

  const handleSelectProject = (projectId: string) => {
    selectProject(projectId);
    navigate(`/projects/${projectId}/chat`);
  };

  const handleRenameProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToRename(project);
    setIsRenameModalOpen(true);
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string,
    projectName: string
  ) => {
    e.stopPropagation();
    if (
      !confirm(
        `Are you sure you want to delete "${projectName}"? This will permanently delete all conversations and files in this project.`
      )
    ) {
      return;
    }

    setDeletingProjectId(projectId);
    const success = await deleteProject(projectId);
    setDeletingProjectId(null);

    if (success) {
      toast.success("Project deleted successfully");
    }
  };

  const handleCreateProject = () => {
    setIsCreateModalOpen(true);
  };

  const handleProjectCreated = () => {
    if (currentProject) {
      navigate(`/projects/${currentProject.id}/chat`);
    }
  };

  // Loading State
  if ((isLoading || !hasInitialized) && projects.length === 0) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-in fade-in duration-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium tracking-tight">Loading Projects...</span>
        </div>
      </div>
    );
  }

  // Error State
  if (error && projects.length === 0) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center p-8">
        <div className="flex max-w-[400px] flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <FolderOpen className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Unable to load projects</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 md:py-16 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-base text-muted-foreground">Manage your AI workspaces.</p>
        </div>
        <div className="flex items-center gap-2">
             {/* Primary Action */}
            <Button onClick={handleCreateProject} className="h-10 px-4 shadow-none">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
        </div>
      </div>

      {/* Content Section */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group relative flex flex-col justify-between transition-all duration-200 hover:border-foreground/20 hover:shadow-sm cursor-pointer border-border bg-card"
              onClick={() => handleSelectProject(project.id)}
            >
              <CardHeader className="space-y-3 p-5">
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                     <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                  </div>
                  <CardTitle className="text-base font-semibold leading-none tracking-tight">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
                     {project.description || "No description provided."}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <div className="px-5 pb-5 pt-0 mt-auto">
                 <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.created_at).toLocaleDateString()}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                         <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={(e) => handleRenameProject(e, project)}
                            disabled={deletingProjectId === project.id}
                            title="Rename Project"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                            disabled={deletingProjectId === project.id}
                            title="Delete Project"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                    </div>
                 </div>
              </div>
            </Card>
          ))}
          
           {/* Quick Action Card (Optional, visually distinct) */}
           <button
              onClick={handleCreateProject}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-5 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/50 hover:text-foreground h-full min-h-[180px]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 group-hover:bg-background">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Create New Project</span>
            </button>
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No projects created</h3>
          <p className="mb-6 mt-2 max-w-sm text-sm text-balance text-muted-foreground">
            Get started by creating your first project workspace.
          </p>
          <Button onClick={handleCreateProject} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create First Project
          </Button>
        </div>
      )}

      {/* Modals */}
      <ProjectCreateModal
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open && currentProject) {
            handleProjectCreated();
          }
        }}
      />

      <ProjectRenameModal
        open={isRenameModalOpen}
        onOpenChange={setIsRenameModalOpen}
        project={projectToRename}
      />
    </main>
  );
}
