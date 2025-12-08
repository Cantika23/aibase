/**
 * Authentication middleware for protecting routes
 */

import { authenticateRequest } from "../server/auth-handler";

/**
 * Middleware wrapper to protect routes that require authentication
 * Usage: const result = await requireAuth(req);
 */
export async function requireAuth(req: Request): Promise<{ user: any; token: string }> {
  const auth = await authenticateRequest(req);

  if (!auth) {
    throw new Error("Authentication required");
  }

  return auth;
}

/**
 * Helper to create protected route handlers
 * Automatically handles authentication and returns 401 if not authenticated
 */
export function withAuth(
  handler: (req: Request, auth: { user: any; token: string }) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      const auth = await requireAuth(req);
      return await handler(req, auth);
    } catch (error: any) {
      return Response.json(
        { error: error.message || "Authentication required" },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional auth - doesn't fail if not authenticated, but provides user if available
 */
export async function optionalAuth(req: Request): Promise<{ user: any; token: string } | null> {
  return await authenticateRequest(req);
}
