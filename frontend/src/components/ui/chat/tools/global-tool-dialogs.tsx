import { useShallow } from "zustand/react/shallow";
import { ScriptDetailsDialog } from "@/components/ui/script-details-dialog";
import { FileToolDetailsDialog } from "@/components/ui/file-tool-details-dialog";
import { GenericToolDetailsDialog } from "@/components/ui/generic-tool-details-dialog";
import { useUIStore } from "@/stores/ui-store";
import type { ToolInvocation } from "./types";

/**
 * GlobalToolDialogs - Single instance of all tool dialogs for the entire app
 *
 * This component should be rendered once at a high level (e.g., Chat container)
 * to avoid rendering multiple dialog instances per message.
 *
 * All dialogs are controlled via global UI store state.
 */
export function GlobalToolDialogs({
  toolInvocations = [],
}: {
  toolInvocations?: ToolInvocation[];
}) {
  const {
    selectedScript,
    selectedFileTool,
    selectedGenericTool,
    setSelectedScript,
    setSelectedFileTool,
    setSelectedGenericTool,
  } = useUIStore(
    useShallow((state) => ({
      selectedScript: state.selectedScript,
      selectedFileTool: state.selectedFileTool,
      selectedGenericTool: state.selectedGenericTool,
      setSelectedScript: state.setSelectedScript,
      setSelectedFileTool: state.setSelectedFileTool,
      setSelectedGenericTool: state.setSelectedGenericTool,
    }))
  );

  // Collect all progress messages for script tools
  const scriptProgressMap = new Map<string, string[]>();
  toolInvocations.forEach((inv) => {
    if (
      inv.toolName === "script" &&
      inv.state === "progress" &&
      "result" in inv &&
      inv.result?.message
    ) {
      const key = inv.toolCallId || inv.args?.purpose || "script";
      if (!scriptProgressMap.has(key)) {
        scriptProgressMap.set(key, []);
      }
      scriptProgressMap.get(key)!.push(inv.result.message);
    }
  });

  return (
    <>
      <ScriptDetailsDialog
        open={!!selectedScript}
        onOpenChange={(open) => !open && setSelectedScript(null)}
        purpose={selectedScript?.purpose || ""}
        code={selectedScript?.code || ""}
        state={selectedScript?.state || "call"}
        progressMessages={
          selectedScript
            ? scriptProgressMap.get(selectedScript.purpose) || []
            : []
        }
        result={selectedScript?.result}
        error={selectedScript?.error}
        inspectionData={selectedScript?.inspectionData}
      />
      <FileToolDetailsDialog
        open={!!selectedFileTool}
        onOpenChange={(open) => !open && setSelectedFileTool(null)}
        action={selectedFileTool?.action || ""}
        path={selectedFileTool?.path}
        newPath={selectedFileTool?.newPath}
        state={selectedFileTool?.state || "call"}
        result={selectedFileTool?.result}
        error={selectedFileTool?.error}
      />
      <GenericToolDetailsDialog
        open={!!selectedGenericTool}
        onOpenChange={(open) => !open && setSelectedGenericTool(null)}
        toolName={selectedGenericTool?.toolName || ""}
        args={selectedGenericTool?.args}
        state={selectedGenericTool?.state || "call"}
        result={selectedGenericTool?.result}
        error={selectedGenericTool?.error}
      />
    </>
  );
}
