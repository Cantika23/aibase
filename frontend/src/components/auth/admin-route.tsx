import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * Admin route component that requires authentication and admin role
 * Redirects to login page if user is not authenticated
 * Redirects to home page if user is not an admin
 */
export function AdminRoute({ children }: AdminRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Redirect to root if not an admin
    if (user?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    // Render admin content if authenticated and is admin
    return <>{children}</>;
}
