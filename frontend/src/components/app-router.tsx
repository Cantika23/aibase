import { Routes, Route, useLocation } from "react-router-dom";
import { ProjectRouteHandler } from "./project/project-route-handler";
import { SubClientRouteHandler } from "./sub-client/sub-client-route-handler";
import { ProtectedRoute } from "./auth/protected-route";
import { AdminRoute } from "./auth/admin-route";
import { Toaster } from "./ui/sonner";
import { SetupRequired } from "./setup-required";
import { useEffect, Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { getAppName, isWhatsAppEnabled } from "@/lib/setup";
import * as React from "react";
import { useProjectStore } from "@/stores/project-store";
import { useConversationStore } from "@/stores/conversation-store";
import { useAuthStore } from "@/stores/auth-store";
import { UserAccountMenu } from "./user-account-menu";
import DashboardLayout from "@/components/layout/dashboard-layout";

// Lazy load page components
const MainChat = lazy(() => import("./pages/main-chat").then(module => ({ default: module.MainChat })));
const SubClientLoginPage = lazy(() => import("./pages/sub-client-login").then(module => ({ default: module.SubClientLoginPage })));
const SubClientRegisterPage = lazy(() => import("./pages/sub-client-register").then(module => ({ default: module.SubClientRegisterPage })));
const MemoryEditor = lazy(() => import("./pages/memory-editor").then(module => ({ default: module.MemoryEditor })));
const ContextEditor = lazy(() => import("./pages/context-editor").then(module => ({ default: module.ContextEditor })));
const ConversationHistoryPage = lazy(() => import("./pages/conversation-history").then(module => ({ default: module.ConversationHistoryPage })));
const FilesManagerPage = lazy(() => import("./pages/files-manager").then(module => ({ default: module.FilesManagerPage })));
const FileDetailPage = lazy(() => import("./pages/file-detail").then(module => ({ default: module.FileDetailPage })));
const ProjectSelectorPage = lazy(() => import("./pages/project-selector").then(module => ({ default: module.ProjectSelectorPage })));
const UserManagementPage = lazy(() => import("./pages/user-management").then(module => ({ default: module.UserManagementPage })));
const LoginPage = lazy(() => import("./pages/login").then(module => ({ default: module.LoginPage })));
const AdminSetupPage = lazy(() => import("./pages/admin-setup").then(module => ({ default: module.AdminSetupPage })));
const EmbedChatPage = lazy(() => import("./pages/embed-chat").then(module => ({ default: module.EmbedChatPage })));
const EmbedSettings = lazy(() => import("./pages/embed-settings").then(module => ({ default: module.EmbedSettings })));
const ExtensionsSettings = lazy(() => import("./pages/extensions-settings").then(module => ({ default: module.ExtensionsSettings })));
const ExtensionEditor = lazy(() => import("./pages/extension-editor").then(module => ({ default: module.ExtensionEditor })));
const ExtensionAICreator = lazy(() => import("./pages/extension-ai-creator").then(module => ({ default: module.ExtensionAICreator })));
const WhatsAppSettings = lazy(() => import("./pages/whatsapp-settings").then(module => ({ default: module.WhatsAppSettings })));
const SubClientSettings = lazy(() => import("./pages/sub-client-settings").then(module => ({ default: module.SubClientSettings })));
const SubClientManagement = lazy(() => import("./pages/sub-client-management").then(module => ({ default: module.SubClientManagement })));
const DeveloperAPIPage = lazy(() => import("./pages/developer-api").then(module => ({ default: module.DeveloperAPIPage })));
const ProfilePage = lazy(() => import("./pages/profile").then(module => ({ default: module.ProfilePage })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8 w-full h-full min-h-[50vh]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

interface AppRouterProps {
  wsUrl: string;
}

export function AppRouter({ wsUrl }: AppRouterProps) {
  const [, setAppName] = React.useState<string>("AI Base");
  const [aimeowEnabled, setAimeowEnabled] = React.useState<boolean>(false);

  const { currentProject } = useProjectStore();
  const { loadConversations } = useConversationStore();
  const { user, logout, needsSetup, checkSetup, setupChecked } = useAuthStore();

  // Check setup status, load app name and settings on mount
  useEffect(() => {
    if (!setupChecked) {
      checkSetup();
    }

    const loadConfig = async () => {
      const [name, whatsappEnabled] = await Promise.all([
        getAppName(),
        isWhatsAppEnabled()
      ]);
      setAppName(name);
      setAimeowEnabled(whatsappEnabled);
    };
    loadConfig();
  }, [checkSetup, setupChecked]);

  // Load conversations when project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadConversations(currentProject.id);
    }
  }, [currentProject?.id, loadConversations]);

  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  const isAdminSetupRoute = location.pathname === "/admin-setup";
  const shouldShowSetupRequired = needsSetup && !isAdminSetupRoute;
  

  // Simple layout for Project Selector (header only)
  const showHeader = !isLoginRoute && !isAdminSetupRoute && user;

  if (shouldShowSetupRequired) {
      return <SetupRequired />;
  }

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public / Standalone Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-setup" element={<AdminSetupPage />} />
          <Route path="/embed" element={<EmbedChatPage />} />

          {/* Root / Project Selector - No Sidebar, just Header */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div className="flex flex-col min-h-screen bg-background">
                     {showHeader && (
                        <header className="flex items-center justify-end border-b px-4 py-2 bg-background">
                            <UserAccountMenu
                            user={{
                                username: user.username,
                                email: user.email,
                            }}
                            onLogout={logout}
                            />
                        </header>
                    )}
                    <ProjectSelectorPage />
                </div>
              </ProtectedRoute>
            }
          />

          {/* Dashboard Routes - Wrapped in DashboardLayout */}
          <Route element={<DashboardLayout />}>
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/chat"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <MainChat
                      wsUrl={wsUrl}
                      isTodoPanelVisible={true}
                    />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/history"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <ConversationHistoryPage />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/memory"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <MemoryEditor />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/context"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <ContextEditor />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/files"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <FilesManagerPage />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/files/:fileName"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <FileDetailPage />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            {aimeowEnabled && (
              <Route
                path="/projects/:projectId/whatsapp"
                element={
                  <AdminRoute>
                    <ProjectRouteHandler>
                      <WhatsAppSettings />
                    </ProjectRouteHandler>
                  </AdminRoute>
                }
              />
            )}
            <Route
              path="/projects/:projectId/api"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <DeveloperAPIPage />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/embed"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <EmbedSettings />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/extensions"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <ExtensionsSettings />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/extensions/:extensionId"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <ExtensionEditor />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/extensions/ai-create"
              element={
                <ProtectedRoute>
                  <ProjectRouteHandler>
                    <ExtensionAICreator />
                  </ProjectRouteHandler>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/sub-clients"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <SubClientSettings />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/sub-clients/management"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <SubClientManagement />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
            <Route
              path="/projects/:projectId/sub-clients/settings"
              element={
                <AdminRoute>
                  <ProjectRouteHandler>
                    <SubClientSettings />
                  </ProjectRouteHandler>
                </AdminRoute>
              }
            />
          </Route>

          {/* Sub-Client Routes */}
          <Route path="/s/:shortPath/login" element={<SubClientLoginPage />} />
          <Route path="/s/:shortPath/register" element={<SubClientRegisterPage />} />
          <Route
            path="/s/:shortPath/chat"
            element={
              <ProtectedRoute>
                <SubClientRouteHandler>
                  <MainChat
                    wsUrl={wsUrl}
                    isTodoPanelVisible={true}
                  />
                </SubClientRouteHandler>
              </ProtectedRoute>
            }
          />

          {/* Catch-all route - redirect to root */}
          <Route path="*" element={<ProtectedRoute><ProjectSelectorPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}