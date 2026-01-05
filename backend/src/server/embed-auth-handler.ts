/**
 * Embed Authentication Handler
 * Handles authentication for embedded chat users via uid
 */

import { ProjectStorage } from "../storage/project-storage";
import { UserStorage } from "../storage/user-storage";
import { AuthService } from "../services/auth-service";
import { createLogger } from "../utils/logger";

const logger = createLogger("EmbedAuth");

const projectStorage = ProjectStorage.getInstance();
const userStorage = UserStorage.getInstance();
const authService = AuthService.getInstance();

export async function handleEmbedAuth(req: Request): Promise<Response> {
    try {
        const body = await req.json();
        const { projectId, embedToken, uid } = body as { projectId: string; embedToken: string; uid: string };

        if (!projectId || !embedToken || !uid) {
            return Response.json(
                { success: false, error: "Missing required fields: projectId, embedToken, uid" },
                { status: 400 }
            );
        }

        // 1. Verify project exists and token matches
        const project = projectStorage.getById(projectId);
        if (!project) {
            return Response.json(
                { success: false, error: "Project not found" },
                { status: 404 }
            );
        }

        if (project.embed_token !== embedToken) {
            return Response.json(
                { success: false, error: "Invalid embed token" },
                { status: 403 }
            );
        }

        // 2. Construct unique username for this embed user
        const embedUsername = `embed_${projectId}_${uid}`;

        // 3. Check if user exists, if not create one
        let user = userStorage.getByUsername(embedUsername);

        if (!user) {
            // Get project owner to determine tenant
            const projectOwner = userStorage.getById(project.user_id);
            if (!projectOwner) {
                return Response.json(
                    { success: false, error: "Project owner not found" },
                    { status: 500 }
                );
            }

            // Create new embed user
            // We generate a random password (it won't be used for login, only session creation)
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);

            try {
                const result = await authService.register({
                    email: `${embedUsername}@embed.local`, // Dummy email
                    username: embedUsername,
                    password: randomPassword,
                    role: 'user', // Regular user role
                    tenant_id: projectOwner.tenant_id, // Same tenant as project owner
                });
                user = result.user as any;
            } catch (err: any) {
                logger.error({ error: err }, "Failed to create embed user");
                return Response.json(
                    { success: false, error: "Failed to create embed user" },
                    { status: 500 }
                );
            }
        }

        // 4. Create session for the user (we use login-like behavior but bypassing password check since we trust the embed token + uid combo)
        // Actually, `authService.login` requires password. We should use `sessionStorage.create(user.id)` directly if possible, 
        // but `AuthService` doesn't expose it directly publicly easily.
        // However, `authService.register` returns a session. 
        // If user already exists, we can't call register.
        // We might need to extend AuthService to allow "impersonation" or "creating session for user" if we trust the context.

        // Workaround: We can't easily get a session without password using AuthService public API unless we modify it.
        // Let's modify AuthService in the next step to allow creating a session for a specific user ID if we have admin/system trust.
        // OR, since good design pattern: let's import SessionStorage directly here as we are in the backend server context.

        // Note: We need to import SessionStorage. 
        // But wait, `SessionStorage` is not exported from `../services/auth-service`. It's in `../storage/session-storage`.
        // Let's dynamically import it or assume we can use it.

        // Better approach: Use a dedicated method in AuthService "createSessionForUser(userId)" which we will add. 
        // For now, I will assume I can modify AuthService.

        // Wait, I can just use `authService` if I add a method to it.
        // Let's add `createSessionForUser` to AuthService first.

        // 4. Create session for the user
        const session = await authService.createSessionForUser(user!.id);

        return Response.json({
            success: true,
            data: {
                token: session.token,
                user: {
                    id: user!.id,
                    username: user!.username,
                    // We can return more info if needed
                }
            }
        });
    } catch (error) {
        logger.error({ error }, "Error handling embed auth");
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to authenticate embed user",
            },
            { status: 500 }
        );
    }
}
