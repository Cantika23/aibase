/**
 * Frontend logging endpoint handler
 * Receives logs from frontend in development mode
 */

import type { LogEntry, LogBatch } from '../lib/types/logs';
import { createLogger } from '../utils/logger';
import { AuthService } from '../services/auth-service';

const logger = createLogger('FrontendLogs');
const authService = AuthService.getInstance();

/** Check if we're in development mode */
const isDevelopment = process.env.NODE_ENV !== 'production';

/** Maximum request body size (1MB) */
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * Handle POST /api/logs - Receive logs from frontend
 * Only available in development mode
 */
export async function handleFrontendLogs(req: Request): Promise<Response> {
  // Only allow in development mode
  if (!isDevelopment) {
    return Response.json(
      { success: false, error: 'Logging endpoint only available in development mode' },
      { status: 403 }
    );
  }

  // Check request body size
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return Response.json(
      { success: false, error: 'Request body too large' },
      { status: 413 }
    );
  }

  // Validate authentication
  const sessionToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!sessionToken) {
    return Response.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const session = await authService.validateSession(sessionToken);
  if (!session) {
    return Response.json(
      { success: false, error: 'Invalid session' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json() as LogEntry | LogBatch;

    // Handle both single log and batch of logs
    const logs = 'logs' in body ? body.logs : [body];

    for (const log of logs) {
      processFrontendLog(log, session?.id ?? 0);
    }

    return Response.json({ success: true, received: logs.length });
  } catch (error) {
    logger.error({ error }, 'Failed to process frontend logs');
    return Response.json(
      { success: false, error: 'Invalid log format' },
      { status: 400 }
    );
  }
}

/**
 * Process a single frontend log entry
 */
function processFrontendLog(log: LogEntry, userId: number): void {
  // Add user info to context
  const context = {
    ...log.context,
    _frontend: {
      userAgent: log.userAgent,
      url: log.url,
      userId: log.userId || String(userId),
      sessionId: log.sessionId,
      timestamp: log.timestamp,
    },
    _feature: log.feature,
  };

  // Map to appropriate logger method
  const logMethod = logger[log.level] || logger.info;
  
  // Create feature-specific prefix
  const prefix = `[Frontend:${log.feature}]`;

  // Log with appropriate level
  switch (log.level) {
    case 'trace':
      logger.trace(context, `${prefix} ${log.message}`);
      break;
    case 'debug':
      logger.debug(context, `${prefix} ${log.message}`);
      break;
    case 'info':
      logger.info(context, `${prefix} ${log.message}`);
      break;
    case 'warn':
      logger.warn(context, `${prefix} ${log.message}`);
      break;
    case 'error':
      logger.error(context, `${prefix} ${log.message}`);
      break;
    case 'fatal':
      // Use error level as fatal fallback (pino may not have fatal method in all configs)
      if (logger.fatal) {
        logger.fatal(context, `${prefix} ${log.message}`);
      } else {
        logger.error(context, `${prefix} [FATAL] ${log.message}`);
      }
      break;
    default:
      logger.info(context, `${prefix} ${log.message}`);
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleLogsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
