"use client";

/**
 * File type category
 */
export type FileTypeCategory = "image" | "video" | "audio" | "document" | "code" | "other";

/**
 * View mode for file display
 */
export type ViewMode = "list" | "grid";

/**
 * File context mapping
 */
export interface FileContextMapping {
  [fileId: string]: boolean;
}

/**
 * Props for file icon components
 */
export interface FileIconProps {
  fileName: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Props for file card components
 */
export interface FileCardProps {
  file: import("@/lib/files-api").FileInfo;
  isSelected: boolean;
  isInContext: boolean;
  onSelect: () => void;
  onToggleContext: () => void;
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
  onDownload: () => void;
  onGoToConversation: () => void;
}
