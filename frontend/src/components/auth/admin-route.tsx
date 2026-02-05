import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

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
    const [hasTimeout, setHasTimeout] = useState(false);

    // Set timeout to prevent infinite loading (5 seconds)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) {
                console.error("[AdminRoute] Authentication check timed out");
                setHasTimeout(true);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [isLoading]);

    // Show loading state while checking authentication
    if (isLoading && !hasTimeout) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Show timeout error if loading takes too long
    if (isLoading && hasTimeout) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center max-w-md p-6">
                    <div className="rounded-lg bg-red-50 p-4 mb-4">
                        <h2 className="text-lg font-semibold text-red-900 mb-2">
                            Authentication Timeout
                        </h2>
                        <p className="text-sm text-red-700 mb-4">
                            The authentication check is taking too long. This might be due to a network issue or session problem.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                    >
                        Refresh Page
                    </button>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.href = '/login';
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Clear Session & Login
                    </button>
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
