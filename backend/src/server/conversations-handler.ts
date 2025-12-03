/**
 * Handler for conversation-related API endpoints
 */

import { ChatHistoryStorage } from "../storage/chat-history-storage";
import { generateConversationTitle, getConversationTitle } from "../llm/conversation-title-generator";

const chatHistoryStorage = ChatHistoryStorage.getInstance();

/**
 * Handle GET /api/conversations?projectId={id} - Get all conversations for a project
 */
export async function handleGetConversations(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        {
          success: false,
          error: "projectId query parameter is required",
        },
        { status: 400 }
      );
    }

    // Get all conversation metadata
    const conversations = await chatHistoryStorage.listAllConversations(projectId);

    // Enrich with titles
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        let title = await getConversationTitle(conv.convId, conv.projectId);

        // If no title exists, try to generate one
        if (!title) {
          const messages = await chatHistoryStorage.loadChatHistory(conv.convId, conv.projectId);
          if (messages.length > 0) {
            title = await generateConversationTitle(messages, conv.convId, conv.projectId);
          }
        }

        return {
          ...conv,
          title: title || "New Conversation",
        };
      })
    );

    return Response.json({
      success: true,
      data: { conversations: enrichedConversations },
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversations",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/conversations/:convId/messages?projectId={id} - Get messages for a conversation
 */
export async function handleGetConversationMessages(
  req: Request,
  convId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        {
          success: false,
          error: "projectId query parameter is required",
        },
        { status: 400 }
      );
    }

    // Load conversation messages
    const messages = await chatHistoryStorage.loadChatHistory(convId, projectId);

    // Filter out system messages - they should never be sent to client
    const clientMessages = messages.filter((msg) => msg.role !== "system");

    // Get metadata
    const metadata = await chatHistoryStorage.getChatHistoryMetadata(convId, projectId);

    if (!metadata) {
      return Response.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }

    // Get title
    let title = await getConversationTitle(convId, projectId);

    // If no title exists, generate one
    if (!title && messages.length > 0) {
      title = await generateConversationTitle(messages, convId, projectId);
    }

    return Response.json({
      success: true,
      data: {
        convId,
        projectId,
        messages: clientMessages,
        metadata: {
          ...metadata,
          title: title || "New Conversation",
        },
      },
    });
  } catch (error) {
    console.error("Error getting conversation messages:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get conversation messages",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /api/conversations/:convId?projectId={id} - Delete a conversation
 */
export async function handleDeleteConversation(
  req: Request,
  convId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        {
          success: false,
          error: "projectId query parameter is required",
        },
        { status: 400 }
      );
    }

    // Check if conversation exists
    const metadata = await chatHistoryStorage.getChatHistoryMetadata(convId, projectId);

    if (!metadata) {
      return Response.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }

    // Delete conversation
    await chatHistoryStorage.deleteChatHistory(convId, projectId);

    return Response.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete conversation",
      },
      { status: 500 }
    );
  }
}
