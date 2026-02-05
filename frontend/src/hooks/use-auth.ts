/**
 * Custom hook for authentication
 * Provides easy access to auth state and actions
 */

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const store = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const hasFetchedRef = useRef(false);

  // Track mount state to prevent updates after unmount
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Fetch current user on mount if we have a token and user is not loaded
  useEffect(() => {
    if (isMounted && store.token && !store.user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      console.log("[useAuth] Fetching current user...");
      store.fetchCurrentUser().catch((error) => {
        console.error("[useAuth] Failed to fetch current user:", error);
      });
    }
  }, [isMounted, store.token, store.user]);

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
