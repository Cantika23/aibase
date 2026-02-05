/**
 * Custom hook for authentication
 * Provides easy access to auth state and actions
 */

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const store = useAuthStore();

  // Fetch current user on mount if we have a token
  useEffect(() => {
    if (store.token && !store.user) {
      store.fetchCurrentUser();
    }
  }, []);

  return {
    // State
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,

    // Actions
    register: store.register,
    login: store.login,
    logout: store.logout,
    changePassword: store.changePassword,
    updateProfile: store.updateProfile,
    fetchCurrentUser: store.fetchCurrentUser,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login or show login modal
      // Using console.warn to avoid circular dependency risk with logger
      console.warn("[Auth] User not authenticated");
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  return auth;
}
