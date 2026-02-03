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
  }, []);

  // Generate the URL for the current project
  const getUrl = (path: string) => {
    if (!currentProject?.id) return "#";
    return `/projects/${currentProject.id}/${path}`;
  };

  // Build Menu Data
  const platformItems = [
    {
      title: "Chat Interface",
      url: getUrl("chat"),
      icon: MessageSquare,
      isActive: true, // Default active logic handled by NavMain checking URL
    },
    {
        title: "History",
        url: getUrl("history"),
        icon: History,
    }
  ];

  const workspaceItems = [
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
    },
  ];

  const developerItems = [
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
      },
  ];

  const managementItems = [];
  if (aimeowEnabled) {
      managementItems.push({
          title: "WhatsApp",
          url: getUrl("whatsapp"),
          icon: MessageCircle,
      });
  }
  if (isAdmin) {
      managementItems.push({
          title: "Users",
          url: "/admin/users",
          icon: Users,
      });
  }


  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher 
            appName={appName} 
            currentProjectName={currentProject?.name || "Select Project"} 
            logoUrl={logoUrl}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Platform" items={platformItems} />
        <NavMain label="Workspace" items={workspaceItems} />
        {(managementItems.length > 0) && <NavMain label="Management" items={managementItems} />}
        {isAdmin && <NavMain label="Developer" items={developerItems} />}
      </SidebarContent>
      <SidebarFooter>
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