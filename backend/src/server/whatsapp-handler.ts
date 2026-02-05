/**
 * WhatsApp API Handler
 * Handles WhatsApp client management, QR code generation, and message routing
 */

import { ProjectStorage } from "../storage/project-storage";
import { Conversation } from "../llm/conversation";
import { ChatHistoryStorage } from "../storage/chat-history-storage";
import * as fs from "fs/promises";
import * as path from "path";
import { PATHS, getProjectDir } from "../config/paths";
import { ScriptRuntime } from "../tools/extensions/script-runtime";
import { ExtensionLoader } from "../tools/extensions/extension-loader";
import { getBuiltinTools } from "../tools";
import { createLogger } from "../utils/logger";
import { loadContext, expandTemplate } from "./context-handler";

const logger = createLogger('WhatsAppHandler');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "http://localhost:7031/api/v1";

// Message deduplication cache: messageId -> timestamp
// Prevents processing the same message multiple times when aimeow sends duplicate webhooks
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Cleanup every 10 minutes

/**
 * Generate a simple hash from string for deduplication fallback
 * Uses a basic DJB2 hash algorithm
 */
function generateHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + character
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate deduplication key from message data
 * Priority: messageData.id > hash(from + text + timestamp)
 */
function generateDedupKey(messageData: any): { key: string; source: string } {
  // Priority 1: Use message ID if available
  if (messageData?.id) {
    return { key: `id_${messageData.id}`, source: 'message_id' };
  }

  // Priority 2: Use hash of message content + sender + timestamp as fallback
  const from = messageData?.from || messageData?.rawChat || messageData?.rawSender || 'unknown';
  const text = messageData?.text || messageData?.caption || '';
  const timestamp = messageData?.timestamp || Date.now();
  const content = `${from}|${text}|${timestamp}`;

  return {
    key: `hash_${generateHash(content)}`,
    source: 'content_hash'
  };
}

// Periodic cleanup of old entries from deduplication cache
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [msgId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      processedMessages.delete(msgId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info({ cleaned, totalRemaining: processedMessages.size }, '[WhatsApp] Cleaned up expired message IDs from deduplication cache');
  }
}, CLEANUP_INTERVAL_MS);

// Import notification functions for WebSocket broadcasts
let notifyWhatsAppStatus: (projectId: string, status: any) => void = () => { };
let notifyWhatsAppQRCode: (projectId: string, qrCode: string) => void = () => { };
let notifyWhatsAppQRTimeout: (projectId: string) => void = () => { };

// Initialize notification functions (called after whatsapp-ws is loaded)
export function initWhatsAppNotifications(
  notifyStatus: typeof notifyWhatsAppStatus,
  notifyQR: typeof notifyWhatsAppQRCode,
  notifyTimeout: typeof notifyWhatsAppQRTimeout
) {
  notifyWhatsAppStatus = notifyStatus;
  notifyWhatsAppQRCode = notifyQR;
  notifyWhatsAppQRTimeout = notifyTimeout;
}

interface WhatsAppClient {
  id: string;
  connected: boolean;
  connectedAt?: string;
  deviceName?: string;
}

/**
 * Get WhatsApp client for a project or sub-client
 */
export async function handleGetWhatsAppClient(req: Request, projectId?: string, subClientId?: string): Promise<Response> {
  try {
    // Get IDs from query params if not provided
    if (!projectId) {
      const url = new URL(req.url);
      projectId = url.searchParams.get("projectId") || undefined;
      subClientId = url.searchParams.get("subClientId") || undefined;
    }

    if (!projectId) {
      return Response.json(
        { success: false, error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Verify project exists
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);

    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Use sub-client ID as WhatsApp client ID if provided, otherwise use project ID
    const whatsappClientId = subClientId || projectId;

    // Get client from aimeow API
    const url = `${WHATSAPP_API_URL}/clients`;
    logger.info({ url, whatsappClientId }, "[WhatsApp] Fetching clients");
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, response: text }, "[WhatsApp] Failed to fetch clients");
      throw new Error(`Failed to fetch clients from WhatsApp service: ${response.status} ${text}`);
    }

    const data = await response.json();

    // Find client for this project or sub-client
    // Handle both array response and object with clients property
    const clientsArray = Array.isArray(data) ? data : (data as any).clients;
    const client = clientsArray?.find((c: any) => c.id === whatsappClientId);

    if (!client) {
      return Response.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      client: {
        id: client.id,
        phone: client.phone || null,
        connected: client.is_connected || false,
        connectedAt: client.connectedAt,
        deviceName: client.osName || "WhatsApp Device",
        subClientId: subClientId || null,
      },
    });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error getting client");
    return Response.json(
      { success: false, error: "Failed to get WhatsApp client" },
      { status: 500 }
    );
  }
}

/**
 * Create new WhatsApp client for a project or sub-client
 */
export async function handleCreateWhatsAppClient(req: Request, projectId?: string, subClientId?: string): Promise<Response> {
  try {
    // If called directly with parameters, use them; otherwise parse from body
    let osName: string;
    let name: string;

    if (!projectId) {
      const body = await req.json() as any;
      projectId = body.projectId;
      subClientId = body.subClientId;
      osName = body.osName;
    } else {
      // Called from server/index.ts with sub-client context
      const body = await req.json() as any;
      osName = body.osName;
    }

    if (!projectId) {
      return Response.json(
        { success: false, error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Verify project exists
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);

    if (!project) {
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Use sub-client ID as WhatsApp client ID if provided
    const whatsappClientId = subClientId || projectId;
    const clientName = osName || (subClientId 
      ? `AIBase - ${project.name} (Sub-client)` 
      : `AIBase - ${project.name}`);

    // Create client in aimeow API
    const response = await fetch(`${WHATSAPP_API_URL}/clients/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: whatsappClientId,
        os_name: clientName,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error }, "[WhatsApp] Error creating client");
      throw new Error("Failed to create WhatsApp client");
    }

    const data = await response.json() as any;

    return Response.json({
      success: true,
      client: {
        id: data.id || whatsappClientId,
        connected: false,
        deviceName: clientName,
        subClientId: subClientId || null,
      },
    });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error creating client");
    return Response.json(
      { success: false, error: "Failed to create WhatsApp client" },
      { status: 500 }
    );
  }
}

/**
 * Delete WhatsApp client
 */
export async function handleDeleteWhatsAppClient(req: Request, projectId?: string, subClientId?: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    let clientId = url.searchParams.get("clientId");

    // If called with sub-client context, use subClientId as clientId
    if (!clientId && subClientId) {
      clientId = subClientId;
    }

    if (!clientId) {
      return Response.json(
        { success: false, error: "Missing clientId" },
        { status: 400 }
      );
    }

    // Delete client from aimeow API
    const response = await fetch(`${WHATSAPP_API_URL}/clients/${clientId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete WhatsApp client");
    }

    return Response.json({
      success: true,
      subClientId: subClientId || null,
    });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error deleting client");
    return Response.json(
      { success: false, error: "Failed to delete WhatsApp client" },
      { status: 500 }
    );
  }
}

/**
 * Get QR code for device linking
 */
export async function handleGetWhatsAppQRCode(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    if (!clientId) {
      return Response.json(
        { success: false, error: "Missing clientId" },
        { status: 400 }
      );
    }

    // Get client info from aimeow API
    const response = await fetch(`${WHATSAPP_API_URL}/clients/${clientId}`);

    if (!response.ok) {
      throw new Error("Failed to fetch client info");
    }

    const data = await response.json() as any;

    // The QRCode field contains the raw QR code string
    // We need to generate a data URL from it
    if (!data.qrCode || data.qrCode === "not_available") {
      return Response.json({
        success: false,
        error: "QR code not available yet",
      });
    }

    // Generate QR code data URL using a simple QR code generator
    // For now, return the QR code text and let the frontend generate the image
    return Response.json({
      success: true,
      qrCode: data.qrCode,
    });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error getting QR code");
    return Response.json(
      { success: false, error: "Failed to get QR code" },
      { status: 500 }
    );
  }
}

/**
 * Handle incoming WhatsApp webhook (messages from aimeow)
 */
export async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  try {
    const body = await req.json() as any;
    const { clientId, message: messageData, timestamp } = body;

    logger.info({
      clientId,
      from: messageData?.from,
      isLID: messageData?.isLID,
      rawChat: messageData?.rawChat,
      rawSender: messageData?.rawSender,
      rawSenderAlt: messageData?.rawSenderAlt,
      type: messageData?.type,
      fromMe: messageData?.fromMe,
      isGroup: messageData?.isGroup,
      pushName: messageData?.pushName,
    }, "[WhatsApp] Webhook received");

    // Ignore messages sent by the bot/device itself (self-messages)
    // This prevents the AI from replying to itself or syncing manual replies as user input
    if (messageData?.fromMe) {
      logger.info("[WhatsApp] Ignoring self-message fromMe=true");
      return Response.json({ success: true, ignored: true });
    }

    // MESSAGE DEDUPLICATION: Check if this message has already been processed
    // This prevents duplicate AI responses when aimeow sends duplicate webhooks
    const { key: dedupKey, source: dedupSource } = generateDedupKey(messageData);
    const existingTimestamp = processedMessages.get(dedupKey);

    if (existingTimestamp) {
      const age = Date.now() - existingTimestamp;
      if (age < MESSAGE_DEDUP_TTL_MS) {
        logger.info({
          dedupKey,
          dedupSource,
          age: `${age}ms`,
          messageId: messageData?.id,
          from: messageData?.from
        }, '[WhatsApp] ❌ Duplicate webhook blocked - message already processed');
        return Response.json({
          success: true,
          ignored: true,
          reason: 'duplicate-message',
          dedupKey,
          dedupSource
        });
      } else {
        // Old entry expired, remove it
        processedMessages.delete(dedupKey);
        logger.info({ dedupKey, age }, '[WhatsApp] ⏰ Dedup key expired, allowing re-processing');
      }
    }

    // Mark this message as processed IMMEDIATELY to prevent race conditions
    processedMessages.set(dedupKey, Date.now());
    logger.info({
      dedupKey,
      dedupSource,
      messageId: messageData?.id,
      from: messageData?.from,
      cacheSize: processedMessages.size
    }, '[WhatsApp] ✅ Tracking message for deduplication');

    // The clientId could be a projectId or a subClientId
    // Check if it's a sub-client first
    const SubClientStorage = (await import("../storage/sub-client-storage")).SubClientStorage;
    const subClientStorage = SubClientStorage.getInstance();
    
    let projectId: string;
    let subClientId: string | null = null;
    
    // Try to find sub-client by ID (clientId starting with 'scl_' is a sub-client)
    if (clientId.startsWith('scl_')) {
      const subClient = subClientStorage.getById(clientId);
      if (subClient) {
        projectId = subClient.project_id;
        subClientId = clientId;
        logger.info({ projectId, subClientId }, "[WhatsApp] Message routed to sub-client");
      } else {
        logger.error({ clientId }, "[WhatsApp] Sub-client not found");
        return Response.json({ success: false, error: "Sub-client not found" });
      }
    } else {
      // It's a project ID
      projectId = clientId;
    }

    // Verify project exists
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);

    if (!project) {
      logger.error({ projectId }, "[WhatsApp] Project not found");
      return Response.json({ success: false, error: "Project not found" });
    }

    // Filter group messages: Ignore unless mentioned
    if (messageData.isGroup) {
      const mentions = messageData.mentions || [];
      const myPhone = messageData.myPhone;

      // If no mentions at all, ignore
      if (mentions.length === 0) {
        logger.info("[WhatsApp] Ignoring group message (no mentions)");
        return Response.json({ success: true, ignored: true });
      }

      // If we know our phone number, check if we are mentioned
      if (myPhone) {
        // Mentions are JIDs (e.g., 12345@s.whatsapp.net), myPhone is usually just digits (12345)
        const isMentioned = mentions.some((m: string) => m.includes(myPhone));
        if (!isMentioned) {
          logger.info({ myPhone, mentions }, "[WhatsApp] Ignoring group message (bot not mentioned)");
          return Response.json({ success: true, ignored: true });
        }
      } else {
        // If we don't know our phone number but there are mentions, 
        // we conservatively ignore it to prevent spamming groups.
        logger.info("[WhatsApp] Ignoring group message (unknown bot identity)");
        return Response.json({ success: true, ignored: true });
      }

      logger.info({ myPhone, mentions }, "[WhatsApp] Processing group message (bot mentioned)");
    } else {
      // Logic for Private Chat (DM)
      logger.info({ from: messageData.from, pushName: messageData.pushName }, "[WhatsApp] Processing PRIVATE message (DM)");
    }

    // CHECK: Is this an unresolved LID?
    // aimeow sends isLID=true when it couldn't resolve the LID to a phone number
    // In this case, we cannot reply because we don't have a valid phone number
    if (messageData.isLID) {
      logger.error({ from: messageData.from }, "[WhatsApp] ❌ CANNOT REPLY: Unresolved LID detected");
      logger.error({
        rawChat: messageData.rawChat,
        rawSender: messageData.rawSender,
        rawSenderAlt: messageData.rawSenderAlt,
      }, "[WhatsApp] Raw fields provided by aimeow");
      // Return early - we cannot reply to an LID
      return Response.json({
        success: true,
        ignored: true,
        reason: "Unresolved LID - cannot reply",
        from: messageData.from,
      });
    }

    // CHECK: If 'from' field is empty, aimeow couldn't resolve the phone number
    // Try to extract from raw fields, but if we can't find one, we cannot reply
    if (!messageData.from || messageData.from === "") {
      logger.warn("[WhatsApp] 'from' field is empty (LID not resolved), attempting extraction from raw fields");
      // Don't return early - try to extract from raw fields below
    }

    // Extract WhatsApp phone number for reply target
    // For LID contacts: rawSenderAlt contains the actual phone number
    // For normal contacts: rawChat/rawSender contain the phone number
    let whatsappNumber: string | undefined;

    // PRIORITY 1: rawSenderAlt - this always has the real phone number when available
    // This is critical for LID contacts where Chat/Sender contain the LID
    if (messageData.rawSenderAlt) {
      const rawSenderAltClean = messageData.rawSenderAlt.split('@')[0];
      // Remove device ID suffix if present (e.g., "6281298329132:94" -> "6281298329132")
      const phoneClean = rawSenderAltClean.split(':')[0];
      if (phoneClean.length >= 8 && phoneClean.length < 15) {
        whatsappNumber = phoneClean;
        logger.info({ whatsappNumber }, "[WhatsApp] Using rawSenderAlt for reply target");
      }
    }

    // PRIORITY 2: For DM, use rawChat (only if we haven't found a number yet)
    if (!whatsappNumber && !messageData.isGroup && messageData.rawChat) {
      const rawChatClean = messageData.rawChat.split('@')[0];
      const phoneClean = rawChatClean.split(':')[0];
      // Skip if it's obviously an LID (too long)
      if (phoneClean.length < 15) {
        whatsappNumber = phoneClean;
        logger.info({ whatsappNumber }, "[WhatsApp] Using rawChat for DM reply target");
      }
    }

    // PRIORITY 3: For Group, use rawSender (who sent the message)
    if (!whatsappNumber && messageData.isGroup && messageData.rawSender) {
      const rawSenderClean = messageData.rawSender.split('@')[0];
      const phoneClean = rawSenderClean.split(':')[0];
      if (phoneClean.length < 15) {
        whatsappNumber = phoneClean;
        logger.info({ whatsappNumber }, "[WhatsApp] Using rawSender for Group reply target");
      }
    }

    // FALLBACK: Use 'from' field - but validate it's not an LID
    if (!whatsappNumber) {
      const fromCandidate = messageData.from.replace(/[^0-9]/g, '');
      // Check if it's an obvious LID (too long for a phone number)
      if (fromCandidate.length >= 15) {
        logger.error("[WhatsApp] ❌ CANNOT REPLY: 'from' field contains LID, no valid phone number available");
        logger.error({
          from: messageData.from,
          rawChat: messageData.rawChat,
          rawSender: messageData.rawSender,
          rawSenderAlt: messageData.rawSenderAlt,
          isLID: messageData.isLID,
        }, "[WhatsApp] Message data received");
        return Response.json({
          success: false,
          error: "Cannot reply - no valid phone number found (LID detected)",
          from: messageData.from,
        });
      }
      whatsappNumber = fromCandidate;
      logger.warn({ whatsappNumber }, "[WhatsApp] WARNING: Using 'from' field as fallback");
    }

    // Ensure format is clean (digits only)
    if (whatsappNumber) {
      whatsappNumber = whatsappNumber.replace(/[^0-9]/g, '');
    } else {
      // Should not happen due to checks above, but needed for TS
      return Response.json({ success: false, error: "Could not determine phone number" });
    }

    // FIX: Remove device-specific suffix if present (e.g. "33" or "32" at end of phone number)
    // WhatsApp multi-device sometimes appends device ID to JID
    // Indonesian numbers start with 62 and are usually 11-13 digits max.
    // If it's longer than 13 digits and ends with common suffixes, trim it.
    if (whatsappNumber && whatsappNumber.startsWith('62') && whatsappNumber.length > 13) {
      // Check for common suffixes like 33, 2, 1 etc
      // Only trim if the result is still a valid length (10-13 digits)

      // Try removing last 2 digits if it ends with known patterns
      if (whatsappNumber.endsWith('33') || whatsappNumber.endsWith('24') || whatsappNumber.endsWith('25')) {
        const trimmed = whatsappNumber.slice(0, -2);
        if (trimmed.length >= 10) {
           logger.info({ from: whatsappNumber, to: trimmed }, '[WhatsApp] Correcting phone number');
           whatsappNumber = trimmed;
        }
      }
      // Try removing last 1 digit (usually device ID)
      else if (whatsappNumber.length > 14) {
         const trimmed = whatsappNumber.slice(0, -1);
         if (trimmed.length >= 10) {
            logger.info({ from: whatsappNumber, to: trimmed }, '[WhatsApp] trimming extra digit from phone number');
            whatsappNumber = trimmed;
         }
      }
    }

    const uid = `whatsapp_user_${whatsappNumber ?? ''}`;

    // Upsert contact to Unified User Management
    const { ContactStorage } = await import("../storage/contact-storage");
    const contactStorage = ContactStorage.getInstance();
    
    await contactStorage.upsert({
      id: whatsappNumber, // Use phone number as ID for contacts
      name: messageData.pushName || whatsappNumber,
      channel: 'whatsapp',
      metadata: {
        uid, // Link to the chat uid
        projectId,
        subClientId,
        deviceName: messageData.deviceName,
        isGroup: messageData.isGroup
      }
    });

    // Get or create conversation for this WhatsApp contact
    const { ChatHistoryStorage } = await import("../storage/chat-history-storage");
    const chatHistoryStorage = ChatHistoryStorage.getInstance();

    // Find existing conversation for this UID
    let convId: string | null = null;
    const tenantId = project?.tenant_id ?? 'default'; // Use project's tenant
    const conversations = await chatHistoryStorage.listAllConversations(projectId, tenantId);

    // Look for existing conversation with this WhatsApp number in the ID
    for (const conv of conversations) {
      if (whatsappNumber && conv.convId.includes(whatsappNumber)) {
        convId = conv.convId;
        break;
      }
    }

    // Create new conversation if not found
    if (!convId) {
      // Use format: wa_<phone_number> WITHOUT timestamp so messages from same number go to same conversation
      convId = `wa_${whatsappNumber}`;
      const title = `WhatsApp - ${messageData.pushName || whatsappNumber}`;

      logger.info({ convId, title }, "[WhatsApp] Creating new conversation");
      // Note: Conversation will be created automatically when ChatHistoryStorage.saveChatHistory() is called
    }

    // Prepare message content based on type
    let messageText = "";
    const attachments: any[] = [];

    switch (messageData.type) {
      case "text":
        messageText = messageData.text || "";
        break;

      case "image":
        messageText = messageData.caption || "Sent an image";
        if (messageData.fileUrl) {
          attachments.push({
            type: "image",
            url: messageData.fileUrl,
            mimeType: messageData.mimeType,
          });

          // === SAVE IMAGE TO WHATSAPP FOLDER ===
          // Save image to data/projects/[tenant]/[project]/sub-clients/[sub-client]/whatsapp/[phone]/
          // or data/projects/[tenant]/[project]/whatsapp/[phone]/ if no sub-client
          (async () => {
            try {
              const tenantId = project.tenant_id ? String(project.tenant_id) : 'default';
              let whatsappFilesDir: string;
              
              if (subClientId) {
                // Use sub-client's whatsapp folder
                const { getSubClientWhatsAppDir } = await import("../config/paths");
                whatsappFilesDir = path.join(getSubClientWhatsAppDir(projectId, subClientId, tenantId), whatsappNumber ?? '');
              } else {
                // Use project's whatsapp folder
                const projectDir = getProjectDir(projectId, tenantId);
                whatsappFilesDir = path.join(projectDir, "whatsapp", whatsappNumber ?? '');
              }
              
              // Ensure directory exists
              await fs.mkdir(whatsappFilesDir, { recursive: true });

              // Determine extension
              let ext = ".jpg";
              if (messageData.mimeType === "image/png") ext = ".png";
              else if (messageData.mimeType === "image/webp") ext = ".webp";
              else if (messageData.mimeType === "image/jpeg") ext = ".jpg";

              // Use message ID for filename if available, otherwise timestamp
              const filename = `${messageData.id || Date.now()}${ext}`;
              const filePath = path.join(whatsappFilesDir, filename);

              logger.info({ filePath }, '[WhatsApp] saving image');

              // Download file
              const imgResponse = await fetch(messageData.fileUrl);
              if (imgResponse.ok) {
                 const arrayBuffer = await imgResponse.arrayBuffer();
                 await fs.writeFile(filePath, Buffer.from(arrayBuffer));
                 logger.info({ filename }, '[WhatsApp] Image saved successfully');
                 


                 // Optional: Save technical metadata as JSON too (backup)
                 const metaPath = filePath + ".meta.json";
                 await fs.writeFile(metaPath, JSON.stringify({
                   id: messageData.id,
                   timestamp: new Date().toISOString(),
                   sender: whatsappNumber ?? '',
                   caption: messageData.caption,
                   mimeType: messageData.mimeType,
                   originalUrl: messageData.fileUrl
                 }, null, 2));
              } else {
                 logger.error({ url: messageData.fileUrl, status: imgResponse.status }, '[WhatsApp] Failed to download image');
              }
            } catch (err) {
              logger.error({ err }, "[WhatsApp] Error saving image file");
            }
          })();
        }
        break;

      case "video":
        messageText = messageData.caption || "Sent a video";
        if (messageData.fileUrl) {
          attachments.push({
            type: "video",
            url: messageData.fileUrl,
            mimeType: messageData.mimeType,
          });
        }
        break;

      case "audio":
        messageText = "Sent a voice message";
        if (messageData.fileUrl) {
          attachments.push({
            type: "audio",
            url: messageData.fileUrl,
            mimeType: messageData.mimeType,
          });
        }
        break;

      case "document":
        messageText = messageData.caption || "Sent a document";
        if (messageData.fileUrl) {
          attachments.push({
            type: "document",
            url: messageData.fileUrl,
            mimeType: messageData.mimeType,
          });
        }
        break;

      case "location":
        messageText = `Shared location: ${messageData.name || "Location"}\nLat: ${messageData.latitude}, Lng: ${messageData.longitude}`;
        if (messageData.address) {
          messageText += `\nAddress: ${messageData.address}`;
        }
        break;

      case "live_location":
        messageText = `Shared live location\nLat: ${messageData.latitude}, Lng: ${messageData.longitude}`;
        break;

      case "other":
      default:
        // For self-chat or other types, try to get text content
        messageText = messageData.text || messageData.caption || "Sent a message";
        break;
    }

    // === IGNORE PLACEHOLDER MESSAGES ===
    // aimeow sometimes sends duplicate webhooks: one with actual content,
    // and another with type="other" and placeholder text like "Sent a message"
    // We ignore these placeholder messages to prevent duplicate AI responses
    if (messageData.type === "other" && messageText === "Sent a message" && attachments.length === 0) {
      logger.info({
        type: messageData.type,
        messageId: messageData.id,
        from: messageData.from
      }, '[WhatsApp] Ignoring placeholder message (duplicate webhook from aimeow)');
      return Response.json({
        success: true,
        ignored: true,
        reason: 'placeholder-message'
      });
    }

    // === HANDLER KHUSUS UNTUK LOCATION MESSAGE ===
    // Respons instan tanpa AI untuk menghindari timeout dan rate limit
    if (messageData.type === "location" || messageData.type === "live_location") {
      const lat = messageData.latitude;
      const lng = messageData.longitude;
      const locationName = messageData.name || "";
      const locationAddress = messageData.address || "";
      
      // Format timestamp dalam bahasa Indonesia
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      };
      const formattedTime = now.toLocaleDateString('id-ID', options) + ' WIB';
      
      // Template respons untuk pengaduan
      let autoReply = `📍 *Lokasi kejadian diterima!*\n\n`;
      
      if (locationName) {
        autoReply += `📌 Nama: ${locationName}\n`;
      }
      if (locationAddress) {
        autoReply += `🏠 Alamat: ${locationAddress}\n`;
      }
      
      autoReply += `🌐 Koordinat: ${lat}, ${lng}\n`;
      autoReply += `🕐 Waktu: ${formattedTime}\n`;
      autoReply += `🗺️ Maps: https://maps.google.com/?q=${lat},${lng}\n\n`;
      autoReply += `_Lokasi ini akan dilampirkan dalam laporan pengaduan Anda._`;
      
      logger.info("[WhatsApp] Location handler: Sending instant response for location message");
      
      // Kirim respons langsung tanpa AI
      sendWhatsAppMessage(projectId, whatsappNumber ?? '', { text: autoReply })
        .then(() => logger.info("[WhatsApp] Location auto-reply sent successfully"))
        .catch((err) => logger.error({ err }, "[WhatsApp] Error sending location auto-reply"));
      
      return Response.json({ success: true, convId, uid, handledBy: "location_handler" });
    }

    // Process the message through the AI system
    logger.info({
      projectId,
      convId,
      from: whatsappNumber,
      messageText,
      attachments,
    }, "[WhatsApp] Processing message");

    // Process message through AI (async, don't block webhook response)
    processWhatsAppMessageWithAI(projectId, convId, whatsappNumber ?? '', messageText, attachments, uid)
      .catch((error) => {
        logger.error({ error }, "[WhatsApp] Error processing message with AI");
        // Send error message to user
        sendWhatsAppMessage(projectId, whatsappNumber ?? '', {
          text: "Sorry, I encountered an error processing your message. Please try again.",
        }).catch((err) => logger.error({ err }, "[WhatsApp] Error sending error message"));
      });

    return Response.json({ success: true, convId, uid });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error handling webhook");
    return Response.json(
      { success: false, error: "Failed to handle webhook" },
      { status: 500 }
    );
  }
}

/**
 * Detect and extract inline script JSON from AI response
 * Returns the parsed script object if found, null otherwise
 */
function detectInlineScriptJSON(response: string): { purpose?: string; code: string } | null {
  // Pattern 1: JSON in markdown code block
  const codeBlockMatch = response.match(/```json\s*\n?\s*(\{[\s\S]*?\})\s*\n?```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.code && typeof parsed.code === 'string') {
        return parsed;
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  // Pattern 2: Raw JSON object with code field
  const jsonMatch = response.match(/^\s*\{[\s\S]*"code"\s*:\s*"[\s\S]*"\s*[\s\S]*\}\s*$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(response.trim());
      if (parsed.code && typeof parsed.code === 'string') {
        return parsed;
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  return null;
}

/**
 * Execute script using ScriptRuntime with full extension support
 * This gives WhatsApp users access to ALL extensions (search, excel, chart, postgresql, etc.)
 */
async function executeWhatsAppScript(
  scriptData: { purpose?: string; code: string },
  projectId: string,
  tenantId: string,
  whatsappNumber: string
): Promise<string | null> {
  try {
    logger.info({ purpose: scriptData.purpose || "Unknown purpose" }, "[WhatsApp] Executing script with ScriptRuntime");
    logger.info({ code: scriptData.code.substring(0, 200) + "..." }, "[WhatsApp] Script code");
    
    // Load extensions via ExtensionLoader
    const extensionLoader = new ExtensionLoader();
    
    // Initialize project extensions (copies defaults if needed)
    try {
      await extensionLoader.initializeProject(projectId);
    } catch (initError) {
      logger.warn({ initError }, "[WhatsApp] Extension initialization failed (non-critical)");
    }
    
    // Load all enabled extensions
    const extensions = await extensionLoader.loadExtensions(projectId);
    logger.info({ extensions: Object.keys(extensions).join(", ") || "none" }, "[WhatsApp] Loaded extensions");

    // Track all progress message promises
    const progressPromises: Promise<void>[] = [];

    // Create a broadcast function that sends progress to WhatsApp
    // Send progress immediately when received
    const broadcast = (type: "tool_call" | "tool_result", data: any) => {
      if (type === "tool_call" && data.status === "progress" && data.result?.message) {
        logger.info({ message: data.result.message }, "[WhatsApp] Script progress - sending immediately");

        // Send progress message (fire and forget, but track promise)
        const progressPromise = (async () => {
          try {
            // Send progress message WITHOUT affecting typing indicator
            await sendWhatsAppMessageRaw(projectId, whatsappNumber, { text: `⏳ ${data.result.message}` });
            logger.info("[WhatsApp] Progress message sent");
          } catch (err) {
            logger.error({ err }, "[WhatsApp] Error sending progress");
          }
        })();

        progressPromises.push(progressPromise);
      }
    };

    // Create ScriptRuntime with extensions
    const runtime = new ScriptRuntime({
      convId: `wa_${whatsappNumber}`,
      projectId,
      userId: `whatsapp_user_${whatsappNumber}`,
      tools: new Map(), // No additional tools registry needed for WA
      broadcast,
      toolCallId: `wa_script_${Date.now()}`,
      purpose: scriptData.purpose || "WhatsApp script",
      code: scriptData.code,
      extensions,
    });

    // Execute the script with timeout
    const result = await Promise.race([
      runtime.execute(scriptData.code),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Script execution timeout (30s)")), 30000)
      ),
    ]);

    logger.info({ result: JSON.stringify(result).substring(0, 200) }, "[WhatsApp] Script execution result");

    // Wait for all progress messages to be sent
    await Promise.all(progressPromises);
    logger.info("[WhatsApp] All progress messages sent");

    // Format result for WhatsApp
    if (result === undefined || result === null) {
      return null;
    }

    // Check for error in result
    if (result && typeof result === 'object' && result.__error) {
      return `❌ ${result.error || 'Unknown error'}`;
    }

    // Use helper for formatting
    const formatted = formatToolResultForWhatsApp("script", { purpose: scriptData.purpose }, result);
    return formatted || String(result);

  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error executing script");
    return `❌ Maaf, terjadi kesalahan saat memproses permintaan: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Format tool execution result for WhatsApp message
 */
function formatToolResultForWhatsApp(toolName: string, args: any, result: any): string | null {
  try {
    // Handle null/undefined results
    if (result === null || result === undefined) {
      return null;
    }

    // Handle error results
    if (typeof result === 'object' && result.error) {
      return `❌ ${result.error}`;
    }

    // Handle string results
    if (typeof result === 'string') {
      // Skip if it looks like internal JSON
      if (result.startsWith('{') || result.startsWith('[')) {
        try {
          const parsed = JSON.parse(result);
          return formatToolResultForWhatsApp(toolName, args, parsed);
        } catch {
          return result;
        }
      }
      return result;
    }

    // Handle array results (e.g., search results)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return "Tidak ada hasil ditemukan.";
      }

      let formatted = "";
      
      // Add title based on context
      if (args?.purpose) {
        formatted += `📊 *${args.purpose}*\n\n`;
      } else if (args?.search_query) {
        formatted += `🔍 *Hasil pencarian: ${args.search_query}*\n\n`;
      }

      // Format each item in array
      const maxItems = 5; // Limit to avoid too long messages
      const items = result.slice(0, maxItems);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item === 'object' && item !== null) {
          // Format search result style objects
          if (item.title && item.url) {
            formatted += `*${i + 1}. ${item.title}*\n`;
            if (item.description) {
              formatted += `${item.description.substring(0, 150)}${item.description.length > 150 ? '...' : ''}\n`;
            }
            formatted += `🔗 ${item.url}\n\n`;
          } else {
            // Generic object formatting
            for (const [key, value] of Object.entries(item)) {
              if (key.startsWith('_')) continue;
              const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
              formatted += `• ${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            }
            formatted += '\n';
          }
        } else {
          formatted += `• ${item}\n`;
        }
      }

      if (result.length > maxItems) {
        formatted += `\n_...dan ${result.length - maxItems} hasil lainnya_`;
      }

      return formatted.trim() || null;
    }

    // Handle object results - format nicely
    if (typeof result === 'object') {
      let formatted = "";
      
      // Check if it's a search result wrapper with 'results' array
      if (result.results && Array.isArray(result.results)) {
        return formatToolResultForWhatsApp(toolName, args, result.results);
      }
      
      // Add purpose/title if available from args
      if (args?.purpose) {
        formatted += `📊 *${args.purpose}*\n\n`;
      } else if (toolName === 'script') {
        formatted += `📊 *Hasil*\n\n`;
      }

      // Format object properties
      for (const [key, value] of Object.entries(result)) {
        // Skip internal keys
        if (key.startsWith('_') || key === 'raw') continue;
        
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        
        // Handle nested arrays
        if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object') {
            // It's an array of objects, format separately
            const nestedFormatted = formatToolResultForWhatsApp(toolName, { ...args, purpose: label }, value);
            if (nestedFormatted) {
              formatted += nestedFormatted + '\n';
            }
          } else {
            formatted += `• ${label}: ${value.join(', ')}\n`;
          }
        }
        // Handle nested objects
        else if (typeof value === 'object' && value !== null) {
          formatted += `• ${label}: ${JSON.stringify(value)}\n`;
        } else {
          formatted += `• ${label}: ${value}\n`;
        }
      }

      return formatted.trim() || null;
    }

    // Fallback for other types
    return String(result);
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error formatting tool result");
    return null;
  }
}

/**
 * Clean response before sending to WhatsApp
 * Removes tool call JSON and other unwanted content
 */
function cleanWhatsAppResponse(response: string): string {
  let cleaned = response;

  // Remove structured tool call JSON with tool_call_id
  cleaned = cleaned.replace(/\{[^}]*"tool_call_id"\s*:\s*"[^"]*"[^}]*\}/g, '');

  // Remove tool call JSON patterns (e.g., {"name": "tool_name", "arguments": {...}})
  cleaned = cleaned.replace(/\{[^}]*"name"\s*:\s*"[^"]*"[^}]*"arguments"\s*:\s*\{[^}]*\}[^}]*\}/g, '');

  // Remove tool_calls array patterns
  cleaned = cleaned.replace(/"tool_calls"\s*:\s*\[[^\]]*\]/g, '');

  // Remove function call patterns
  cleaned = cleaned.replace(/\[Function Call: [^\]]*\]/gi, '');

  // Remove tool result patterns
  cleaned = cleaned.replace(/\[Tool Result: [^\]]*\]/gi, '');

  // Remove "Calling tool" messages
  cleaned = cleaned.replace(/Calling tool:?\s*\[?[^\n\]]*\]?/gi, '');

  // Remove tool execution messages
  cleaned = cleaned.replace(/Executing\s+\w+\s+tool/gi, '');

  // Remove JSON objects that look like tool results
  cleaned = cleaned.replace(/\{[^}]*"error"[^}]*\}/g, '');

  // Remove webhook/message JSON patterns (clientId, message, timestamp, etc.)
  cleaned = cleaned.replace(/\{"clientId"\s*:\s*"[^"]*"[^}]*\}/gs, '');
  
  // Remove message payload JSON patterns
  cleaned = cleaned.replace(/\{"message"\s*:\s*\{[^}]*\}[^}]*\}/gs, '');
  
  // Remove standalone JSON objects with common webhook fields
  cleaned = cleaned.replace(/\{[^}]*"timestamp"\s*:\s*\d+[^}]*\}/g, '');
  
  // Remove location-related JSON patterns
  cleaned = cleaned.replace(/\{[^}]*"latitude"\s*:\s*[0-9.-]+[^}]*"longitude"\s*:\s*[0-9.-]+[^}]*\}/g, '');
  
  // Remove any remaining JSON-like structures that start with { and contain quoted keys
  // Be more aggressive for obvious JSON dumps
  cleaned = cleaned.replace(/^\s*\{[\s\S]*"[a-zA-Z_]+"\s*:\s*[\s\S]*\}\s*$/gm, '');

  // Remove empty or whitespace-only markdown code blocks (```json\n\n```, ```\n```, etc.)
  cleaned = cleaned.replace(/```[a-z]*\s*\n*\s*```/gi, '');
  
  // Remove code blocks that only contain whitespace or very short content
  cleaned = cleaned.replace(/```[a-z]*\s*\n\s*\n*```/gi, '');

  // === NEW: Remove Thinking/Reasoning Tags ===
  // Removes content like <think>...</think> or just </think> artifacts
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<\/think>/gi, ''); // Remove stray closing tags
  cleaned = cleaned.replace(/<think>/gi, '');   // Remove stray opening tags

  // Remove multiple newlines (compress to max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Process WhatsApp message with AI
 */
async function processWhatsAppMessageWithAI(
  projectId: string,
  convId: string,
  whatsappNumber: string,
  messageText: string,
  attachments: any[],
  uid: string
): Promise<void> {
  try {
    logger.info({ messageText }, "[WhatsApp] Starting AI processing for message");
    logger.info({ attachments: JSON.stringify(attachments, null, 2) }, "[WhatsApp] Received attachments");

    // Start typing indicator immediately
    await startWhatsAppTyping(projectId, whatsappNumber);

    // Get ChatHistoryStorage instance (singleton, already imported)
    const chatHistoryStorage = ChatHistoryStorage.getInstance();
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);
    const tenantId = project?.tenant_id ?? 'default';

    // === PRE-PROCESS IMAGE ATTACHMENTS ===
    // Analyze images using Vision API and add descriptions to message
    let enhancedMessage = messageText;
    
    // Notify user if we are processing images
    // WHATSAPP: Suppress image analysis notification - will show typing indicator only
    const hasImages = attachments.some(a => a.type === "image" && a.url);
    if (hasImages) {
      logger.info("[WhatsApp] Processing image(s) - notification suppressed, typing indicator active");
    }
    
    for (const attachment of attachments) {
      if (attachment.type === "image" && attachment.url) {
        logger.info({ url: attachment.url }, "[WhatsApp] Processing image attachment");
        
        try {
          // Download image from URL
          const imgResponse = await fetch(attachment.url);
          if (!imgResponse.ok) {
            logger.error({ status: imgResponse.status }, "[WhatsApp] Failed to download image");
            continue;
          }
          
          const arrayBuffer = await imgResponse.arrayBuffer();
          const base64Image = Buffer.from(arrayBuffer).toString('base64');
          const mimeType = attachment.mimeType || 'image/jpeg';
          
          logger.info({ size: arrayBuffer.byteLength }, "[WhatsApp] Image downloaded");
          
          // Call Vision API to analyze image
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            logger.warn("[WhatsApp] OPENAI_API_KEY not set, skipping image analysis");
            continue;
          }
          
          const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.z.ai/v1';
          const endpoint = `${baseUrl}/chat/completions`;
          
          // Construct prompt based on user message
          const userPrompt = messageText.trim() 
            ? `User's question about this image: "${messageText}"\n\nPlease describe what you see in this image and answer the user's question if applicable.`
            : "Describe this image in detail, including the main subjects, colors, composition, mood, and any text visible in the image.";
          
          logger.info("[WhatsApp] Calling Vision API...");
          const visionResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'GLM-4.6V',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: userPrompt },
                    { 
                      type: 'image_url', 
                      image_url: { url: `data:${mimeType};base64,${base64Image}` } 
                    },
                  ],
                },
              ],
              max_tokens: 1000,
            }),
          });
          
          if (!visionResponse.ok) {
            const errorText = await visionResponse.text();
            logger.error({ status: visionResponse.status, errorText }, "[WhatsApp] Vision API error");
            continue;
          }
          
          const visionData = await visionResponse.json() as any;
          const description = visionData.choices?.[0]?.message?.content || 
                             visionData.choices?.[0]?.message?.reasoning_content;
          
          if (description) {
            logger.info({ description: description.substring(0, 100) + "..." }, "[WhatsApp] Image analyzed");
            
            // Add image description to message for AI context
            enhancedMessage = `[User sent an image]\n\n**Image Analysis:**\n${description}\n\n${messageText ? `**User's message:** ${messageText}` : "Please respond to the image."}`;
          }
        } catch (err) {
          logger.error({ err }, "[WhatsApp] Error analyzing image");
        }
      }
    }
    
    // Use enhanced message if we processed images
    const finalMessage = enhancedMessage;
    logger.info({ finalMessage: finalMessage.substring(0, 200) + "..." }, "[WhatsApp] Final message to AI");

    // Load existing conversation history
    logger.info("[WhatsApp] Loading client history...");
    const existingHistory = await chatHistoryStorage.loadChatHistory(convId, projectId, tenantId);
    logger.info({ messageCount: existingHistory?.length || 0 }, "[WhatsApp] Loaded history");

    // Track tool execution results to send if AI response is empty
    const toolResults: Array<{ toolName: string; result: any }> = [];
    let toolResultSent = false;
    let toolNotificationSent = false;

    // Track response state for WhatsApp (skip pre-tool thinking, only send post-tool final response)
    let responseAfterTool = "";
    let preToolResponse = "";
    let shouldReset = false;  // Flag to reset accumulator after tool execution

    // Load built-in tools for this conversation (includes script tool with extensions)
    const tools = getBuiltinTools(convId, projectId, tenantId, uid);
    logger.info({ tools: tools.map(t => t.name).join(", ") }, "[WhatsApp] Loaded tools");

    // Create conversation instance with custom hooks for script progress and tool results
    logger.info("[WhatsApp] Creating conversation instance...");
    // Load dynamic context
    let systemPrompt = "";
    try {
      const contextTemplate = await loadContext(projectId);
      systemPrompt = await expandTemplate(contextTemplate);
    } catch (err) {
      logger.error({ err }, "[WhatsApp] Failed to load dynamic context, using fallback");
      systemPrompt = `You are a helpful AI assistant on WhatsApp.`;
    }

    // Track all progress message promises
    const progressPromises: Promise<void>[] = [];

    const conversation = await Conversation.create({
      projectId,
      tenantId,
      convId,
      urlParams: { CURRENT_UID: uid },
      tools, // <-- Register tools so AI can call script, todo, memory
      systemPrompt,
      hooks: {
        tools: {
          before: async (toolCallId: string, toolName: string, args: any) => {
            // WHATSAPP: Suppress all intermediate tool execution messages
            // Only send final completed message after tools finish
            logger.info({ toolName }, "[WhatsApp] Tool started (Notification suppressed - will send only when complete)");

            // Still track progress to prevent duplicates, but don't send
            toolNotificationSent = true;

            // Mark that we should reset response accumulator after this tool executes
            // This ensures we only capture the FINAL response (after tool), not the "thinking" before
            shouldReset = true;
          },
          progress: async (toolCallId: string, toolName: string, data: any) => {
            // Send progress updates to WhatsApp user
            if (toolName === "script" && data?.message) {
              logger.info({ message: data.message }, "[WhatsApp] Script progress - sending immediately");

              const progressPromise = (async () => {
                try {
                  await sendWhatsAppMessageRaw(projectId, whatsappNumber, { text: `⏳ ${data.message}` });
                  logger.info("[WhatsApp] Progress message sent, restarting typing indicator");

                  // Restart typing indicator after progress message to keep showing "typing..."
                  // aimeow API stops typing when any message is sent, so we need to restart it
                  await startWhatsAppTyping(projectId, whatsappNumber);
                } catch (err) {
                  logger.error({ err }, "[WhatsApp] Error sending progress");
                }
              })();

              progressPromises.push(progressPromise);
            }
          },
          after: async (toolCallId: string, toolName: string, args: any, result: any) => {
            logger.info({ toolName, result: JSON.stringify(result).substring(0, 200) }, "[WhatsApp] Tool executed");

            // Store tool result for later use if needed (debugging or fallback)
            toolResults.push({ toolName, result });

            // Do NOT send tool results directly to user.
            // The AI will incorporate the result into the final answer.
          },
        },
      },
    });
    logger.info("[WhatsApp] Conversation created");

    // Load history if exists
    if (existingHistory && existingHistory.length > 0) {
      (conversation as any)._history = existingHistory;
    }
    logger.info("[WhatsApp] Sending user message to AI...");

    // Stream response and handle tool calls internally
    // Conversation.sendMessage handles all chunks and tool call recursion
    logger.info("[WhatsApp] AI processing started (handles tool calls automatically)...");
    const startTime = Date.now();

    let fullResponse = "";
    let chunkCount = 0;

    try {
      // Stream all chunks (tool calls handled internally by Conversation)
      for await (const chunk of conversation.sendMessage(finalMessage, attachments)) {
        chunkCount++;

        // Check if we need to reset (tool was just executed)
        if (shouldReset) {
          responseAfterTool = chunk;  // Start fresh
          fullResponse = responseAfterTool;
          shouldReset = false;  // Clear flag
          logger.info("[WhatsApp] Tool execution detected, capturing final response only");
        } else if (responseAfterTool.length > 0) {
          // Continue accumulating post-tool response
          responseAfterTool += chunk;
          fullResponse = responseAfterTool;
        } else {
          // Still in pre-tool phase
          preToolResponse += chunk;
          fullResponse = preToolResponse;
        }

        // Log first chunk and every 50 chunks
        if (chunkCount === 1) logger.info("[WhatsApp] First chunk received");
        if (chunkCount % 50 === 0) logger.info({ chunkCount }, "[WhatsApp] Streaming...");
      }
      const duration = Date.now() - startTime;
      logger.info({
        chunkCount,
        duration,
        responseLength: fullResponse.length,
        preToolLength: preToolResponse.length,
        postToolLength: responseAfterTool.length
      }, "[WhatsApp] AI response complete");
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration }, "[WhatsApp] Error during AI processing");
      // Continue to save history so we don't lose the user's message
    }

    // Wait for all progress messages to be sent
    await Promise.all(progressPromises);
    logger.info("[WhatsApp] All progress messages sent");

    // Save conversation history (Filter out system prompt)
    const history = (conversation as any)._history || [];
    const cleanHistory = history.filter((msg: any) => msg.role !== 'system');
    await chatHistoryStorage.saveChatHistory(convId, cleanHistory, projectId, tenantId, uid);

    // If tool result was already sent, we may not need to send AI's response
    // unless it contains additional useful information
    if (toolResultSent) {
      logger.info("[WhatsApp] Tool result already sent to user");
      
      // Check if AI generated a meaningful follow-up response
      if (fullResponse.trim()) {
        const cleanedResponse = cleanWhatsAppResponse(fullResponse);
        
        // Only send if it's not a generic "I will check..." type response
        // and contains actual new information
        const genericPatterns = [
          /saya akan (cek|periksa|lihat|cari)/i,
          /mari saya (cek|periksa|lihat|cari)/i,
          /sedang (mencari|mengecek|memeriksa)/i,
          /baik.*(saya|akan)/i,
          /tentu.*(saya|akan)/i,
        ];
        
        const isGenericResponse = genericPatterns.some(p => p.test(cleanedResponse));
        
        if (cleanedResponse.trim() && !isGenericResponse && cleanedResponse.length > 50) {
          logger.info({ cleanedResponse: cleanedResponse.substring(0, 50) + "..." }, "[WhatsApp] Sending additional AI context");
          await sendWhatsAppMessage(projectId, whatsappNumber, {
            text: cleanedResponse,
          }, false); // Final message - stop typing after 1s
        } else {
          logger.info("[WhatsApp] Skipping generic/short AI response since tool result already sent");
        }
      }
      return;
    }

    // Send response back to WhatsApp
    if (fullResponse.trim()) {
      // First, check if this is an inline script JSON that needs execution
      const inlineScript = detectInlineScriptJSON(fullResponse);

      if (inlineScript) {
        logger.info("[WhatsApp] Detected inline script JSON, executing...");
        const scriptResult = await executeWhatsAppScript(inlineScript, projectId, String(tenantId), whatsappNumber);

        if (scriptResult) {
          logger.info({ scriptResult: scriptResult.substring(0, 100) + "..." }, "[WhatsApp] Script executed, sending result");
          await sendWhatsAppMessage(projectId, whatsappNumber, {
            text: scriptResult,
          }, false); // Final message - stop typing after 1s
          logger.info("[WhatsApp] Script result sent successfully");
        } else {
          logger.warn("[WhatsApp] Script execution returned no result");
        }
        return;
      }

      // Clean the response
      const cleanedResponse = cleanWhatsAppResponse(fullResponse);

      // Skip empty responses
      if (!cleanedResponse.trim()) {
        logger.warn("[WhatsApp] WARNING: Response is empty after cleaning. Checking for tool results...");
        logger.warn({ fullResponse }, "[WhatsApp] Full raw response");

        // If we have tool results but didn't send them yet, send now
        if (toolResults.length > 0) {
          for (const { toolName, result } of toolResults) {
            const formatted = formatToolResultForWhatsApp(toolName, {}, result);
            if (formatted) {
              logger.info("[WhatsApp] Sending stored tool result as fallback");
              await sendWhatsAppMessage(projectId, whatsappNumber, {
                text: formatted,
              }, false); // Final message - stop typing after 1s
              break; // Only send first result to avoid spam
            }
          }
        }
        return;
      }

      // === SKIP INTERMEDIATE "THINKING" RESPONSE WHEN TOOLS WERE CALLED ===
      // If tools were executed, skip generic "thinking" responses like "Berfikir keras..."
      // Only send the final substantive response
      if (toolResults.length > 0) {
        const genericPatterns = [
          /berfikir keras/i,
          /tunggu ya/i,
          /baik, saya/i,
          /tentu, saya/i,
          /mari saya/i,
          /saya akan/i,
          /sedang mem/i,
          /akan saya/i,
        ];

        const isGenericResponse = genericPatterns.some(p => p.test(cleanedResponse));

        // Check if response is short (likely just a thinking phrase)
        const isShortResponse = cleanedResponse.length < 100;

        if (isGenericResponse || isShortResponse) {
          logger.info({
            cleanedResponse: cleanedResponse.substring(0, 50),
            isGenericResponse,
            isShortResponse,
          }, "[WhatsApp] Skipping intermediate 'thinking' response - waiting for final response after tool execution");
          return; // Don't send this intermediate response
        }
      }

      logger.info({ cleanedResponse: cleanedResponse.substring(0, 100) + "..." }, "[WhatsApp] Sending response back to WhatsApp");
      await sendWhatsAppMessage(projectId, whatsappNumber, {
        text: cleanedResponse,
      }, false); // Final message - stop typing after 1s
      logger.info("[WhatsApp] Response sent successfully");
    } else if (toolResults.length > 0) {
      // No AI response but we have tool results
      logger.info("[WhatsApp] No AI response, sending tool results");
      for (const { toolName, result } of toolResults) {
        const formatted = formatToolResultForWhatsApp(toolName, {}, result);
        if (formatted) {
          await sendWhatsAppMessage(projectId, whatsappNumber, {
            text: formatted,
          }, false); // Final message - stop typing after 1s
          break;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    logger.error({ errorMessage }, "[WhatsApp] Error in AI processing");
    logger.error({ errorStack }, "[WhatsApp] Error stack");
    throw error;
  }
}

/**
 * Start WhatsApp typing indicator
 */
async function startWhatsAppTyping(projectId: string, phone: string): Promise<void> {
  try {
    // Only send typing indicator if phone is valid
    if (!phone || phone.includes('@')) { 
      // Sometimes raw JID is passed, clean it if needed or let endpoint handle it
      // Ideally we pass phone number only
    }

    const response = await fetch(`${WHATSAPP_API_URL}/clients/${projectId}/start-typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      // Don't log 404s loudly as it might mean feature not supported or client not ready
      if (response.status !== 404) {
        const errorText = await response.text();
        logger.warn({ errorText }, "[WhatsApp] Failed to start typing indicator");
      }
    } else {
      logger.info({ phone }, "[WhatsApp] Started typing indicator");
    }
  } catch (error) {
    logger.warn({ error }, "[WhatsApp] Error starting typing");
  }
}

/**
 * Stop WhatsApp typing indicator
 */
async function stopWhatsAppTyping(projectId: string, phone: string): Promise<void> {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/clients/${projectId}/stop-typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({ errorText }, "[WhatsApp] Failed to stop typing indicator");
      // Don't throw - this is not critical
    } else {
      logger.info({ phone }, "[WhatsApp] Stopped typing indicator");
    }
  } catch (error) {
    logger.warn({ error }, "[WhatsApp] Error stopping typing");
    // Don't throw - this is not critical
  }
}

/**
 * Send WhatsApp message without handling typing indicator
 * Used for progress messages where typing is managed separately
 */
async function sendWhatsAppMessageRaw(
  projectId: string,
  phone: string,
  message: { text?: string; imageUrl?: string; location?: { lat: number; lng: number } }
): Promise<void> {
  try {
    logger.info({ phone, message: message.text?.substring(0, 50) + "..." }, "[WhatsApp] Sending to WhatsApp (raw)");
    const response = await fetch(`${WHATSAPP_API_URL}/clients/${projectId}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        message: message.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ errorText }, "[WhatsApp] Failed to send WhatsApp message");
      throw new Error("Failed to send WhatsApp message");
    }

    logger.info({ phone }, "[WhatsApp] Message sent successfully (raw)");
  } catch (error) {
    logger.error({ url: `${WHATSAPP_API_URL}/clients/${projectId}/send-message` }, "[WhatsApp] Error sending message to URL");
    logger.error({ error }, "[WhatsApp] Error details");

    const errorStr = String(error);
    if (errorStr.includes("fetch failed") || errorStr.includes("ECONNREFUSED")) {
      logger.error("[WhatsApp] CRITICAL: Could not connect to WhatsApp Service!");
      logger.error("[WhatsApp] Please ensure the WhatsApp automation service is running on port 7031.");
    }
    throw error;
  }
}

/**
 * Send WhatsApp message with typing indicator management
 * For final completion messages: stops typing after 3 seconds (to ensure message is delivered)
 */
async function sendWhatsAppMessage(
  projectId: string,
  phone: string,
  message: { text?: string; imageUrl?: string; location?: { lat: number; lng: number } },
  keepTyping: boolean = false
): Promise<void> {
  // Send the message
  await sendWhatsAppMessageRaw(projectId, phone, message);

  // Handle typing indicator after message sent
  if (!keepTyping) {
    // For completion messages: stop typing after 50ms
    logger.info("[WhatsApp] Completion message sent, stopping typing in 50ms...");
    await new Promise(resolve => setTimeout(resolve, 50));
    await stopWhatsAppTyping(projectId, phone);
    logger.info("[WhatsApp] Typing indicator stopped");
  }
  // For keepTyping=true (progress), typing is restarted by the caller
}

/**
 * Handle connection status updates from aimeow
 * This webhook is called when a WhatsApp client connects or disconnects
 */
export async function handleWhatsAppConnectionStatus(req: Request): Promise<Response> {
  try {
    const body = await req.json() as any;
    const { clientId, event, data } = body;

    logger.info({ clientId, event, data }, "[WhatsApp] Connection status update");

    if (!clientId) {
      return Response.json(
        { success: false, error: "Missing clientId" },
        { status: 400 }
      );
    }

    // The clientId is the projectId
    const projectId = clientId;

    // Verify project exists
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);

    if (!project) {
      logger.error({ projectId }, "[WhatsApp] Project not found");
      return Response.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Process the connection event
    switch (event) {
      case "connected":
        // Client successfully connected to WhatsApp
        // Fetch phone number from aimeow API
        try {
          const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "http://localhost:7031/api/v1";
          const response = await fetch(`${WHATSAPP_API_URL}/clients`);

          if (response.ok) {
            const clientsData = await response.json() as any;
            const clientsArray = Array.isArray(clientsData) ? clientsData : clientsData.clients;
            const client = clientsArray?.find((c: any) => c.id === projectId);

            notifyWhatsAppStatus(projectId, {
              connected: true,
              connectedAt: new Date().toISOString(),
              deviceName: client?.osName || "WhatsApp Device",
              phone: client?.phone || null,
            });
          } else {
            notifyWhatsAppStatus(projectId, {
              connected: true,
              connectedAt: new Date().toISOString(),
              deviceName: data?.osName || "WhatsApp Device",
              phone: data?.phone || null,
            });
          }
        } catch (err) {
          logger.error({ err }, "[WhatsApp] Error fetching phone number");
          notifyWhatsAppStatus(projectId, {
            connected: true,
            connectedAt: new Date().toISOString(),
            deviceName: data?.osName || "WhatsApp Device",
            phone: data?.phone || null,
          });
        }
        logger.info({ projectId }, "[WhatsApp] Client connected");
        break;

      case "disconnected":
        // Client disconnected from WhatsApp
        notifyWhatsAppStatus(projectId, {
          connected: false,
        });
        logger.info({ projectId }, "[WhatsApp] Client disconnected");
        break;

      case "qr_code":
        // New QR code available
        if (data?.qrCode) {
          notifyWhatsAppQRCode(projectId, data.qrCode);
        }
        break;

      case "qr_timeout":
        // QR code expired
        notifyWhatsAppQRTimeout(projectId);
        break;

      case "error":
        // Error occurred
        notifyWhatsAppStatus(projectId, {
          error: data?.error || "Unknown error",
        });
        break;

      default:
        logger.info({ event }, "[WhatsApp] Unknown event");
    }

    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error }, "[WhatsApp] Error handling connection status");
    return Response.json(
      { success: false, error: "Failed to handle connection status" },
      { status: 500 }
    );
  }
}




