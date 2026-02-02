/**
 * Hook for auto-saving visualizations when rendered
 */

import { useEffect, useRef } from 'react';
import { ConvIdManager } from '@/lib/conv-id';
import { useProjectStore } from '@/stores/project-store';
import { saveVisualizationAsPNG } from '@/lib/image-save';
import { useLogger } from '@/hooks/use-logger';

interface UseVisualizationSaveOptions {
  toolCallId: string;
  saveTo?: string;
  shouldSave: boolean;
}

export function useVisualizationSave({
  toolCallId,
  saveTo,
  shouldSave,
}: UseVisualizationSaveOptions) {
  const log = useLogger('files');
  const hasSavedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const { currentProject } = useProjectStore();

  useEffect(() => {
    // Only save if saveTo is provided and we haven't saved yet
    if (!shouldSave || !saveTo || hasSavedRef.current || !currentProject?.id) {
      return;
    }

    // Small delay to ensure rendering is complete
    timeoutRef.current = setTimeout(async () => {
      try {
        // Find the visualization container by toolCallId
        const container = document.querySelector(`[data-tool-call-id="${toolCallId}"]`) as HTMLElement;

        if (!container) {
          log.warn("[Visualization Save] Container not found", { toolCallId });
          return;
        }

        const convId = ConvIdManager.getConvId();
        const projectId = currentProject.id;

        log.debug("[Visualization Save] Saving visualization", { filename: saveTo, toolCallId });

        const savedFile = await saveVisualizationAsPNG({
          element: container,
          filename: saveTo,
          convId,
          projectId,
        });

        log.debug("[Visualization Save] Saved successfully", { url: savedFile.url });
        hasSavedRef.current = true;

      } catch (error) {
        log.error("[Visualization Save] Failed to save", { error: error instanceof Error ? error.message : String(error) });
      }
    }, 500); // 500ms delay to ensure rendering is complete

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toolCallId, saveTo, shouldSave, currentProject?.id]);
}
