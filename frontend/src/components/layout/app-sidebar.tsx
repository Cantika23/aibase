import * as React from "react"
import {
  MessageSquare,
  History,
  FolderOpen,
  Files,
  Database,
  Terminal,
  Code,
  Puzzle,
  MessageCircle,
  Users,
  Building2,
} from "lucide-react"
import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
import { TeamSwitcher } from "@/components/layout/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { getAppName, getLogoUrl, isWhatsAppEnabled } from "@/lib/setup";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentProject, initializeProject } = useProjectStore();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = currentUser?.role === "admin";
  
  const [appName, setAppName] = React.useState<string>("AI Base");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [aimeowEnabled, setAimeowEnabled] = React.useState<boolean>(false);

  React.useEffect(() => {
    const loadConfig = async () => {
      const [name, logo, whatsappEnabled] = await Promise.all([
        getAppName(),
        getLogoUrl(),
        isWhatsAppEnabled(),
      ]);
      setAppName(name);
      setLogoUrl(logo);
      setAimeowEnabled(whatsappEnabled);
    };
    loadConfig();

    if (!currentProject) {
      initializeProject();
    }
  }, [currentProject, initializeProject]);

  // Generate the URL for the current project
  const getUrl = React.useCallback((path: string) => {
    if (!currentProject?.id) return "#";
    return `/projects/${currentProject.id}/${path}`;
  }, [currentProject?.id]);

  // Build Menu Data
  const platformItems = React.useMemo(() => [
    {
      title: "Chat Interface",
      url: getUrl("chat"),
      icon: MessageSquare,
      isActive: true,
    },
    {
        title: "History",
        url: getUrl("history"),
        icon: History,
    }
  ], [getUrl]);

  // Workspace items - admin only
  const workspaceItems = React.useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        title: "Context",
        url: getUrl("context"),
        icon: FolderOpen,
      },
      {
        title: "Files",
        url: getUrl("files"),
        icon: Files,
      },
      {
        title: "Memory",
        url: getUrl("memory"),
        icon: Database,
      }
    ];
  }, [isAdmin, getUrl]);

  // Developer items - admin only
  const developerItems = React.useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
          title: "API",
          url: getUrl("api"),
          icon: Terminal,
      },
      {
          title: "Embed",
          url: getUrl("embed"),
          icon: Code,
      },
      {
          title: "Extensions",
          url: getUrl("extensions"),
          icon: Puzzle,
      }
    ];
  }, [isAdmin, getUrl]);

  // Check if sub-clients are enabled for current project
  const subClientsEnabled = currentProject?.sub_clients_enabled ?? false;

  // Management items - admin only
  const managementItems = React.useMemo(() => {
    if (!isAdmin) return [];
    
    // Explicitly typed items array
    const items = [];
    
    if (aimeowEnabled) {
        items.push({
            title: "WhatsApp",
            url: getUrl("whatsapp"),
            icon: MessageCircle,
        });
    }
    
    items.push({
        title: "Users",
        url: "/admin/users",
        icon: Users,
    });
    
    // Sub Client menu
    const subClientItems = [
      {
        title: "Settings",
        url: getUrl("sub-clients/settings"),
      },
    ];

    if (subClientsEnabled) {
      subClientItems.unshift({
        title: "Management",
        url: getUrl("sub-clients/management"),
      });
    }
    
    items.push({
        title: "Sub Client",
        url: getUrl("sub-clients"),
        icon: Building2,
        defaultOpen: subClientsEnabled,
        items: subClientItems,
    });
    
    return items;
  }, [isAdmin, aimeowEnabled, subClientsEnabled, getUrl]);


  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar" {...props}>
      <SidebarHeader className="border-b border-border/50 p-4">
        <TeamSwitcher 
            appName={appName} 
            currentProjectName={currentProject?.name || "Select Project"} 
            logoUrl={logoUrl}
        />
      </SidebarHeader>
      
      <SidebarContent className="gap-6 px-3 py-4">
        <div className="space-y-1">
             <NavMain label="Platform" items={platformItems} />
        </div>
        
        {(workspaceItems.length > 0) && (
             <div className="space-y-1">
                <NavMain label="Workspace" items={workspaceItems} />
             </div>
        )}
        
        {(managementItems.length > 0) && (
            <div className="space-y-1">
                <NavMain label="Management" items={managementItems} />
            </div>
        )}
        
        {(developerItems.length > 0) && (
             <div className="space-y-1">
                <NavMain label="Developer" items={developerItems} />
             </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4">
        {currentUser && (
            <NavUser 
                user={{
                    name: currentUser.username,
                    email: currentUser.email
                }} 
                onLogout={logout}
            />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}