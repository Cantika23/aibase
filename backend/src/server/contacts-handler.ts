import type { ContactChannel } from "../storage/contact-storage";
import { ContactStorage } from "../storage/contact-storage";
import { createLogger } from "../utils/logger";

const logger = createLogger('ContactsHandler');

/**
 * Get contacts list with pagination and filtering
 */
export async function handleGetContacts(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const channel = url.searchParams.get('channel') as ContactChannel | null;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const storage = ContactStorage.getInstance();
    const result = storage.list(channel || undefined, limit, offset);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching contacts');
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Helper to fetch chat history for a contact
 */
async function getContactHistory(contact: any): Promise<any[]> {
    try {
        const { ChatHistoryStorage } = await import("../storage/chat-history-storage");
        const chatHistoryStorage = ChatHistoryStorage.getInstance();
        const { ProjectStorage } = await import("../storage/project-storage");
        
        const projectId = contact.metadata.projectId;
        if (!projectId) return [];

        const projectStorage = ProjectStorage.getInstance();
        const project = projectStorage.getById(projectId);
        const tenantId = project?.tenant_id ?? 'default';

        let messages: any[] = [];

        if (contact.channel === 'whatsapp') {
             const uid = contact.metadata.uid || `whatsapp_user_${contact.id}`;
             const convId = `wa_${contact.id}`;
             messages = await chatHistoryStorage.loadChatHistory(convId, projectId, tenantId, uid);
        } else {
             // Web
             const userId = contact.id;
             const convId = contact.metadata.lastConvId;
             if (convId) {
                 messages = await chatHistoryStorage.loadChatHistory(convId, projectId, tenantId, userId);
             }
        }
        
        return messages || [];

    } catch (e) {
        logger.error({ error: e, contactId: contact.id }, "Error fetching contact history");
        return [];
    }
}

/**
 * Get single contact by ID with History
 */
export async function handleGetContact(req: Request, contactId: string): Promise<Response> {
  try {
    const storage = ContactStorage.getInstance();
    const contact = storage.getById(contactId);

    if (!contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const history = await getContactHistory(contact);

    return new Response(JSON.stringify({
        ...contact,
        history
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching contact');
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete a contact and their history
 */
export async function handleDeleteContact(req: Request, contactId: string): Promise<Response> {
  try {
    const contactStorage = ContactStorage.getInstance();
    const contact = contactStorage.getById(contactId);

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete from ContactStorage
    contactStorage.delete(contactId);

    // Delete Chat History
    const { ChatHistoryStorage } = await import("../storage/chat-history-storage");
    const chatHistoryStorage = ChatHistoryStorage.getInstance();
    const { ProjectStorage } = await import("../storage/project-storage");
    const projectStorage = ProjectStorage.getInstance();

    const projectId = contact.metadata.projectId;
    
    if (projectId) {
      const project = projectStorage.getById(projectId);
      const tenantId = project?.tenant_id ?? 'default';

      if (contact.channel === 'whatsapp') {
        const uid = contact.metadata.uid || `whatsapp_user_${contactId}`;
        const convId = `wa_${contactId}`;
        await chatHistoryStorage.deleteChatHistory(convId, projectId, tenantId, uid);
      } else {
        // Web user
        const userId = contactId;
        const convId = contact.metadata.lastConvId;
        if (convId) {
            await chatHistoryStorage.deleteChatHistory(convId, projectId, tenantId, userId);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error({ error }, "Error deleting contact");
    return new Response(JSON.stringify({ success: false, error: "Failed to delete contact" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
