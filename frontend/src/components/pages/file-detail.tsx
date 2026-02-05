"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  deleteFile,
  fetchProjectFiles,
  formatFileSize,
  renameFile,
  type FileInfo,
} from "@/lib/files-api";
import { formatRelativeTime } from "@/lib/time-utils";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  Edit3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Loader2,
  FileIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLogger } from "@/hooks/use-logger";

export function FileDetailPage() {
  const navigate = useNavigate();
  const { projectId, fileName } = useParams<{ projectId: string; fileName: string }>();
  const log = useLogger('files');

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Delete/Rename state
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null);
  const [newFileName, setNewFileName] = useState("");

  useEffect(() => {
    if (projectId) {
      loadFiles(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (files.length > 0 && fileName) {
      const decodedFileName = decodeURIComponent(fileName);
      const index = files.findIndex((f) => f.name === decodedFileName);
      if (index !== -1) {
        setCurrentIndex(index);
        setCurrentFile(files[index]);
        loadFileContent(files[index]);
      } else {
        setIsLoading(false);
        toast.error("File not found");
      }
    }
  }, [files, fileName]);

  const loadFiles = async (projectId: string) => {
    setIsLoading(true);
    try {
      const projectFiles = await fetchProjectFiles(projectId);

      if (!Array.isArray(projectFiles)) {
        throw new Error("Invalid files data received from server");
      }

      const validFiles = projectFiles.filter((file) => {
        return (
          file &&
          typeof file === "object" &&
          file.name &&
          typeof file.name === "string" &&
          file.size &&
          typeof file.size === "number"
        );
      });

      setFiles(validFiles);
    } catch (error) {
      log.error("Error loading files", { error: String(error) });
      toast.error("Failed to load files", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileContent = async (file: FileInfo) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const isImage = imageExts.includes(ext);

    if (isImage) {
      setFileContent(null);
      setContentError(null);
      return;
    }

    const textExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c',
      'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'toml', 'csv', 'sql', 'sh',
      'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'log', 'env', 'ini', 'conf',
      'config', 'graphql', 'http', 'rest', 'dockerfile', 'gitignore', 'eslintrc',
      'prettierrc', 'babelrc', 'tsconfig', 'vim', 'emacs', 'rs', 'go', 'php',
      'rb', 'pl', 'lua', 'r', 'm', 'mm', 'swift', 'kt', 'kts', 'scala', 'groovy',
      'clj', 'cljs', 'edn', 'ex', 'exs', 'erl', 'hrl', 'hs', 'lhs', 'fs', 'fsi',
      'fsx', 'vb', 'dart', 'elm', 'purs', 'lhs', 'v', 'sv', 'vhd',
    ];
    const isTextFile = textExtensions.includes(ext) || ext === 'Makefile' || ext === 'Dockerfile';

    if (isTextFile) {
      setIsContentLoading(true);
      setContentError(null);

      try {
        const res = await fetch(file.url);
        if (!res.ok) throw new Error('Failed to load file');
        const content = await res.text();

        const maxSize = 50 * 1024;
        if (content.length > maxSize) {
          setFileContent(content.slice(0, maxSize) + '\n\n... (file truncated, too large to preview)');
        } else {
          setFileContent(content);
        }
      } catch (err) {
        log.error("Error loading file content", { error: String(err) });
        setContentError('Failed to load file content');
      } finally {
        setIsContentLoading(false);
      }
    } else {
      setFileContent(null);
      setContentError(null);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setCurrentFile(files[newIndex]);
      navigate(`/projects/${projectId}/files/${encodeURIComponent(files[newIndex].name)}`);
      loadFileContent(files[newIndex]);
      window.scrollTo(0, 0);
    }
  };

  const goToNext = () => {
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setCurrentFile(files[newIndex]);
      navigate(`/projects/${projectId}/files/${encodeURIComponent(files[newIndex].name)}`);
      loadFileContent(files[newIndex]);
      window.scrollTo(0, 0);
    }
  };

  const handleDownload = () => {
    if (currentFile) {
      window.open(currentFile.url, '_blank');
    }
  };

  const handleDeleteFile = (file: FileInfo) => {
    setDeletingFile(file);
  };

  const confirmDelete = async () => {
    if (!deletingFile || !projectId) return;

    try {
      await deleteFile(projectId, deletingFile.name);
      toast.success("File deleted successfully");
      navigate(`/projects/${projectId}/files`);
    } catch (error) {
      log.error("Error deleting file", { error: String(error) });
      toast.error("Failed to delete file");
    } finally {
      setDeletingFile(null);
    }
  };

  const handleRenameFile = (file: FileInfo) => {
    setRenamingFile(file);
    setNewFileName(file.name);
  };

  const confirmRename = async () => {
    if (!renamingFile || !projectId || !newFileName.trim()) return;

    try {
      await renameFile(projectId, renamingFile.name, newFileName.trim());
      toast.success("File renamed successfully");
      await loadFiles(projectId);
      navigate(`/projects/${projectId}/files/${encodeURIComponent(newFileName.trim())}`);
    } catch (error) {
      log.error("Error renaming file", { error: String(error) });
      toast.error(
        error instanceof Error ? error.message : "Failed to rename file",
      );
    } finally {
      setRenamingFile(null);
      setNewFileName("");
    }
  };

  const handleGoToConversation = () => {
    if (!projectId) return;
    navigate(`/projects/${projectId}/chat`);
  };

  const getFileTypeCategory = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
    const documentExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
    const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'md'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (documentExts.includes(ext)) return 'document';
    if (codeExts.includes(ext)) return 'code';
    return 'other';
  };

  const getFileIcon = (fileName: string): string => {
    const category = getFileTypeCategory(fileName);
    switch (category) {
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'document': return '📄';
      case 'code': return '💻';
      default: return '📎';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen-mobile items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading file...</p>
        </div>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="flex h-screen-mobile items-center justify-center px-4">
        <div className="text-center space-y-4">
          <FileIcon className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">File not found</h2>
          <p className="text-sm text-muted-foreground">
            The file you're looking for doesn't exist.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/files`)}
          >
            Back to Files
          </Button>
        </div>
      </div>
    );
  }

  const fileCategory = getFileTypeCategory(currentFile.name);
  const ext = currentFile.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  const isImage = imageExts.includes(ext);

  return (
    <div className="flex h-screen-mobile flex-col">
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 pt-[60px] md:px-6 pb-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header with breadcrumbs and actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/files`)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Files
              </Button>

              <div className="flex items-center gap-2">
                {files.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToPrevious}
                      disabled={currentIndex === 0}
                      title="Previous file"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      {currentIndex + 1} / {files.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToNext}
                      disabled={currentIndex === files.length - 1}
                      title="Next file"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                <Button variant="outline" size="icon" onClick={handleDownload} title="Download file">
                  <Download className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload()}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleRenameFile(currentFile)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleGoToConversation()}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Go to Conversation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteFile(currentFile)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* File info */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-5xl">{getFileIcon(currentFile.name)}</span>
                <div className="flex-1 min-w-0">
                  {currentFile.title ? (
                    <h1 className="text-2xl font-semibold truncate">{currentFile.title}</h1>
                  ) : (
                    <h1 className="text-2xl font-semibold truncate">{currentFile.name}</h1>
                  )}
                  <p className="text-sm text-muted-foreground truncate">{currentFile.name}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                    <span>{formatFileSize(currentFile.size)}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(currentFile.uploadedAt)}</span>
                    <span>•</span>
                    <span className="capitalize">{fileCategory}</span>
                  </div>
                </div>
              </div>

              {/* Description/Meta markdown section */}
              {currentFile.description && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h2 className="text-sm font-medium mb-2 text-muted-foreground uppercase tracking-wide">
                    Metadata
                  </h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <MarkdownRenderer>{currentFile.description}</MarkdownRenderer>
                  </div>
                </div>
              )}
            </div>

            {/* File preview */}
            <div className="border rounded-lg overflow-hidden bg-background">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h2 className="text-sm font-medium">Preview</h2>
              </div>
              <div className="p-4">
                {isContentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Loading file...</p>
                    </div>
                  </div>
                ) : contentError ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <p className="text-muted-foreground">{contentError}</p>
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                ) : isImage ? (
                  <div className="flex items-center justify-center">
                    <img
                      src={currentFile.url}
                      alt={currentFile.name}
                      className="max-w-full rounded-lg"
                    />
                  </div>
                ) : ext === 'pdf' ? (
                  <iframe
                    src={currentFile.url}
                    className="w-full h-[600px] rounded-lg border"
                    title={currentFile.name}
                  />
                ) : fileCategory === 'code' ? (
                  <pre className="text-sm bg-muted rounded-lg p-4 overflow-auto max-h-[600px]">
                    <code>{fileContent || '(No content to display)'}</code>
                  </pre>
                ) : fileCategory === 'document' ? (
                  <pre className="text-sm bg-muted rounded-lg p-4 overflow-auto max-h-[600px]">
                    <code>{fileContent || '(Document content preview not available)'}</code>
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="text-6xl">{getFileIcon(currentFile.name)}</div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-medium">Preview not available</p>
                      <p className="text-sm text-muted-foreground">
                        This file type ({ext.toUpperCase()}) cannot be previewed in the browser.
                      </p>
                      <Button variant="outline" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingFile}
        onOpenChange={(open) => !open && setDeletingFile(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingFile?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={!!renamingFile}
        onOpenChange={(open) => !open && setRenamingFile(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for "{renamingFile?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new file name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmRename();
                } else if (e.key === "Escape") {
                  setRenamingFile(null);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFile(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!newFileName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
