"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  List,
  Code,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
  onCancel?: () => void;
  onRegenerate?: () => Promise<string>;
  placeholder?: string;
  showRegenerate?: boolean;
  saveLabel?: string;
  className?: string;
  minHeight?: string;
}

export function MarkdownEditor({
  initialContent = "",
  onSave,
  onCancel,
  onRegenerate,
  placeholder = "Enter description...",
  showRegenerate = false,
  saveLabel = "Save",
  className,
  minHeight = "200px",
}: MarkdownEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [content, setContent] = useState(initialContent || placeholder || "");

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      Markdown,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const markdownContent = (editor.storage as any).markdown.getMarkdown();
      setContent(markdownContent);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none p-4',
        style: `min-height: ${minHeight}`,
        placeholder: placeholder,
      },
    },
  });

  // Sync initial content when it changes externally
  useEffect(() => {
    if (editor && initialContent !== content) {
      editor.commands.setContent(initialContent);
      setContent(initialContent);
    }
  }, [editor, initialContent]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      toast.success("Saved successfully");
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      const newContent = await onRegenerate();
      if (editor) {
        editor.commands.setContent(newContent);
      }
      setContent(newContent);
      toast.success("Regenerated successfully");
    } catch (err) {
      toast.error("Failed to regenerate");
    } finally {
      setIsRegenerating(false);
    }
  }, [editor, onRegenerate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape" && onCancel) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, onCancel]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex flex-col bg-background border rounded-lg overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="h-10 border-b flex items-center justify-between px-2 bg-muted/30 shrink-0">
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('bold') ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bold</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('italic') ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Italic</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('underline') ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <Underline className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Underline</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('code') ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Inline Code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('bulletList') ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>List</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1">
          {showRegenerate && onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="h-7 gap-1.5 text-xs"
            >
              {isRegenerating ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regenerate
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 gap-1.5 text-xs"
          >
            {isSaving ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {saveLabel}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
