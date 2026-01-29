import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState, useEffect } from "react";
import type { FileInfo } from "@/lib/files-api";
import { formatFileSize, getFileIcon } from "@/lib/files-api";
import { formatRelativeTime } from "@/lib/time-utils";

interface FilePreviewDialogProps {
  files: FileInfo[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({
  files,
  initialIndex = 0,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFile = files[currentIndex];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!open || !currentFile) {
      setFileContent(null);
      setError(null);
      return;
    }

    // Determine file type
    const ext = currentFile.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const isImage = imageExts.includes(ext);

    // For images, we don't need to fetch content
    if (isImage) {
      setFileContent(null);
      setError(null);
      return;
    }

    // For code/text files, fetch content
    const textExtensions = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c',
      'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'toml', 'csv', 'sql', 'sh',
      'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'log', 'env', 'ini', 'conf',
      'config', 'graphql', 'http', 'rest', 'dockerfile', 'gitignore', 'eslintrc',
      'prettierrc', 'babelrc', 'tsconfig', 'vim', 'emacs', 'rs', 'go', 'php',
      'rb', 'pl', 'lua', 'r', 'm', 'mm', 'swift', 'kt', 'kts', 'scala', 'groovy',
      'clj', 'cljs', 'edn', 'ex', 'exs', 'erl', 'hrl', 'hs', 'lhs', 'fs', 'fsi',
      'fsx', 'vb', 'dart', 'elm', 'purs', 'lhs', 'v', 'sv', 'vhd', 'lua', 'nim',
      'wig', 'wren', 'x', 'xs', 'yap', 'pro', 'lisp', 'lsp', 'scm', 'rkt', 'ss',
      'st', 'tcl', 'ml', 'mli', 're', 'rei', 'lys', 'd', 'di', 'cr', 'nim',
    ];
    const isTextFile = textExtensions.includes(ext) || ext === 'Makefile' || ext === 'Dockerfile';

    if (isTextFile) {
      setIsLoading(true);
      setError(null);

      fetch(currentFile.url)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.text();
        })
        .then((content) => {
          // Limit content size for preview (max 50KB)
          const maxSize = 50 * 1024;
          if (content.length > maxSize) {
            setFileContent(content.slice(0, maxSize) + '\n\n... (file truncated, too large to preview)');
          } else {
            setFileContent(content);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error loading file:', err);
          setError('Failed to load file content');
          setIsLoading(false);
        });
    } else {
      setFileContent(null);
      setError(null);
    }
  }, [open, currentFile]);

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

  const fileCategory = currentFile ? getFileTypeCategory(currentFile.name) : 'other';
  const ext = currentFile?.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  const isImage = currentFile && imageExts.includes(ext);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDownload = () => {
    if (currentFile) {
      window.open(currentFile.url, '_blank');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    } else if (e.key === 'ArrowLeft') {
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    }
  };

  if (!currentFile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-3xl">{getFileIcon(currentFile.name)}</span>
              <DialogTitle className="truncate text-lg">
                {currentFile.name}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {files.length}
              </span>
              <Button variant="outline" size="icon" onClick={handleDownload} title="Download file">
                <Download className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatFileSize(currentFile.size)}</span>
            <span>•</span>
            <span>{formatRelativeTime(currentFile.uploadedAt)}</span>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="text-sm text-muted-foreground">Loading file...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="size-4 mr-2" />
                Download File
              </Button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {isImage ? (
                <div className="flex items-center justify-center">
                  <img
                    src={currentFile.url}
                    alt={currentFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              ) : fileCategory === 'code' || fileCategory === 'document' ? (
                <pre className="text-sm bg-background rounded-lg p-4 overflow-auto max-h-[60vh]">
                  <code>{fileContent || '(No content to display)'}</code>
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="text-6xl">{getFileIcon(currentFile.name)}</div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">Preview not available</p>
                    <p className="text-sm text-muted-foreground">
                      This file type ({ext.toUpperCase()}) cannot be previewed in the browser.
                    </p>
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="size-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {files.length > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="size-4 mr-1" />
              Previous
            </Button>
            <div className="flex gap-1">
              {files.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex ? 'bg-primary w-8' : 'bg-muted w-2'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                  title={files[index].name}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentIndex === files.length - 1}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
