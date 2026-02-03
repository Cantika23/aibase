import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Outlet } from "react-router-dom"

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        <div className="flex flex-1 flex-col h-full"> 
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
