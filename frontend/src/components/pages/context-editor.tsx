import { useState, useEffect, useCallback } from "react";
import {
  Save,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  List,
  Code,
  Maximize2,
  Minimize2
} from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
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

const API_URL = buildApiUrl("");

export function ContextEditor() {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState(false);

  const { currentProject } = useProjectStore();

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      Markdown,
    ],
    content: '',
    onUpdate: ({ editor }) => {
       // Use markdown storage to get markdown content
       const markdownContent = editor.storage.markdown.getMarkdown();
       setContent(markdownContent);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8 sm:p-12',
      },
    },
  });

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

      // Set content in Tiptap
      if (editor) {
        editor.commands.setContent(data.data.content);
      }
      
      setContent(data.data.content);
      setOriginalContent(data.data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      toast.error("Failed to load context");
    } finally {
      setIsLoading(false);
    }
  };

  // Sync editor content when it changes externally (e.g. on load)
  useEffect(() => {
     if (editor && content === originalContent && !editor.isFocused) {
        // Only set if content matches original (fresh load) or simple sync
        // But better is to trust loadContext to set it initially.
        // This effect might cause cursor jumps if we sync on every keystroke.
        // So we only rely on loadContext setting it initially.
     }
  }, [editor, originalContent]); // simplified

  // Initial Load
  useEffect(() => {
    loadContext();
  }, [currentProject?.id]);
  
  // Re-sync editor if editor instance was not ready during load
  useEffect(() => {
     if (editor && originalContent && editor.isEmpty) {
        editor.commands.setContent(originalContent);
     }
  }, [editor, originalContent]);

  // Save Context
  const handleSave = useCallback(async () => {
    if (!currentProject) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/context`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, projectId: currentProject.id }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to save context");

      setOriginalContent(content);
      toast.success("Saved successfully");
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, content]);

  const hasChanges = content !== originalContent;

  // Keyboard Shortcuts (Standard Tiptap handles most, just Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
      if (e.key === "Escape" && zenMode) {
         setZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zenMode, hasChanges, handleSave]);


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

  if (!editor) {
      return null;
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

            <Button
              variant={hasChanges ? "default" : "secondary"}
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className="gap-2 min-w-[80px]"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Editor Wrapper */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          
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

          {/* Unified Toolbar - Tiptap Controls */}
          <div className="h-12 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm z-20 shrink-0">
             <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={editor.isActive('bold') ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => editor.chain().focus().toggleBold().run()}
                        >
                            <Bold className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bold</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={editor.isActive('italic') ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                        >
                            <Italic className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Italic</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={editor.isActive('underline') ? "secondary" : "ghost"}
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                        >
                            <Underline className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Underline</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={editor.isActive('code') ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => editor.chain().focus().toggleCode().run()}
                        >
                            <Code className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Inline Code</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={editor.isActive('bulletList') ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>List</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
             </div>
             
             {/* Note: Preview button removed as Tiptap is WYSIWYG */}
          </div>

          <div className="flex-1 flex overflow-hidden">
             {/* Content Area */}
             <div className="flex-1 overflow-y-auto min-h-0 bg-background" onClick={() => editor.chain().focus().run()}>
                 <div className="max-w-4xl mx-auto h-full">
                    <EditorContent editor={editor} className="h-full" />
                 </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
