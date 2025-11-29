import { Tool } from "../llm/conversation";
import { FileTool } from "./definition/file-tool";

/**
 * Get all built-in tools for a specific conversation
 */
export function getBuiltinTools(convId: string = "default", projectId: string = "default"): Tool[] {
  const fileTool = new FileTool();
  fileTool.setConvId(convId);
  fileTool.setProjectId(projectId);

  return [
    fileTool,
    // Add more tools here as separate files
  ];
}
