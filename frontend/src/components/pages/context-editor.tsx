import { useState, useEffect, useCallback } from "react";
import {
  Save,
  RefreshCw,
  Maximize2,
  Minimize2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useProjectStore } from "@/stores/project-store";
import { buildApiUrl } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ContextVariablesLegend } from "@/components/pages/context-variables-legend";

const API_URL = buildApiUrl("");

export function ContextEditor() {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  const { currentProject } = useProjectStore();

  // Load Context
  const loadContext = async () => {
    if (!currentProject) {
      setError("No project selected.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/context?projectId=${currentProject.id}`
      );
      const data = await response.json();

      if (!data.success) throw new Error(data.error || "Failed to load context");

      setContent(data.data.content);
      setOriginalContent(data.data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      toast.error("Failed to load context");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    loadContext();
  }, [currentProject?.id]);

  // Save Context
  const handleSave = useCallback(async (newContent: string) => {
    if (!currentProject) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/context`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, projectId: currentProject.id }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to save context");

      setOriginalContent(newContent);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [currentProject]);

  const hasChanges = content !== originalContent;

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zenMode) {
         setZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zenMode]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 bg-muted/20">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={loadContext}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background relative overflow-hidden font-sans group/app">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        
        {/* Header */}
        <div className={cn(
          "flex-none flex items-center justify-between px-6 h-14 border-b bg-background/80 backdrop-blur-md transition-all duration-300",
          zenMode ? "-mt-14 opacity-0" : "opacity-100"
        )}>
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">System Context</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
             {hasChanges && (
                <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-top-1 duration-300">
                   <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </div>
                   <span className="text-xs font-medium text-amber-600 dark:text-amber-500">Unsaved</span>
                </div>
             )}
            
            <div className="h-4 w-px bg-border mx-2" />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZenMode(true)}>
                     <Maximize2 className="h-4 w-4" />
                   </Button>
                </TooltipTrigger>
                <TooltipContent>Zen Mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button 
                     variant={showVariables ? "secondary" : "ghost"} 
                     size="icon" 
                     className="h-8 w-8" 
                     onClick={() => setShowVariables(!showVariables)}
                   >
                     <Info className="h-4 w-4" />
                   </Button>
                </TooltipTrigger>
                <TooltipContent>Variables Legend</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant={hasChanges ? "default" : "secondary"}
              size="sm"
              onClick={() => handleSave(content)}
              disabled={!hasChanges || isLoading}
              className="gap-2 min-w-[80px]"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>


        
        {/* Editor Wrapper */}
        <div className="flex-1 overflow-hidden relative flex flex-row">
          <div className="flex-1 flex flex-col p-4 relative">
             {/* Zen Mode Exit */}
             {zenMode && (
                <Button 
                variant="secondary" 
                size="sm" 
                className="fixed top-4 right-4 z-50 opacity-0 group-hover/app:opacity-100 transition-opacity shadow-lg"
                onClick={() => setZenMode(false)}
                >
                <Minimize2 className="mr-2 h-3 w-3" /> Exit Zen
                </Button>
             )}

            <MarkdownEditor
                initialContent={originalContent}
                onSave={handleSave}
                saveLabel="Save"
                className="h-full border-0 shadow-none"
                minHeight="calc(100vh - 200px)"
            />
          </div>

          {/* Variable Legend Sidebar */}
          {showVariables && (
            <ContextVariablesLegend 
               className="animate-in slide-in-from-right-5 duration-300 shadow-xl z-20" 
            />
          )}
        </div>
      </div>
    </div>
  );
}
