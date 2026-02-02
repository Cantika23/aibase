import { create } from "zustand";
import type { User } from "./auth-store";
import { buildApiUrl } from "@/lib/base-path";
import { logger } from "@/lib/logger";

const API_BASE_URL = buildApiUrl("");

interface AdminStore {
  // State
  users: User[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setUsers: (users: User[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  fetchUsers: (token: string) => Promise<void>;
  createUser: (
    token: string,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => Promise<boolean>;
  deleteUser: (token: string, userId: number) => Promise<boolean>;
  impersonateUser: (token: string, userId: number) => Promise<{ user: User; token: string } | null>;

  // Tenant-specific user operations
  fetchTenantUsers: (token: string, tenantId: number) => Promise<void>;
  createTenantUser: (
    token: string,
    tenantId: number,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => Promise<boolean>;
  updateTenantUser: (
    token: string,
    tenantId: number,
    userId: number,
    data: { email?: string; username?: string; password?: string; role?: "admin" | "user" }
  ) => Promise<boolean>;
  deleteTenantUser: (token: string, tenantId: number, userId: number) => Promise<boolean>;
}

export const useAdminStore = create<AdminStore>((set, _get) => ({
  // Initial state
  users: [],
  isLoading: false,
  error: null,

  // Synchronous actions
  setUsers: (users) => set({ users }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Async actions
  fetchUsers: async (token: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }

      const data = await response.json();
      set({ users: data.users, isLoading: false, error: null });
    } catch (error: any) {
      logger.auth.error("Fetch users error", { error: String(error) });
      set({
        error: error.message || "Failed to fetch users",
        isLoading: false,
      });
    }
  },

  createUser: async (
    token: string,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, username, password, role }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }

      const data = await response.json();

      // Add the new user to the list
      set((state) => ({
        users: [...state.users, data.user],
        isLoading: false,
        error: null,
      }));

      logger.auth.info("User created successfully", { username: data.user.username });
      return true;
    } catch (error: any) {
      logger.auth.error("Create user error", { error: String(error) });
      set({
        error: error.message || "Failed to create user",
        isLoading: false,
      });
      return false;
    }
  },

  deleteUser: async (token: string, userId: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }

      // Remove the user from the list
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        isLoading: false,
        error: null,
      }));

      logger.auth.info("User deleted successfully");
      return true;
    } catch (error: any) {
      logger.auth.error("Delete user error", { error: String(error) });
      set({
        error: error.message || "Failed to delete user",
        isLoading: false,
      });
      return false;
    }
  },

  impersonateUser: async (token: string, userId: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}/impersonate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to impersonate user");
      }

      const data = await response.json();
      set({ isLoading: false, error: null });

      logger.auth.info("Impersonation successful", { username: data.user.username });
      return data;
    } catch (error: any) {
      logger.auth.error("Impersonate user error", { error: String(error) });
      set({
        error: error.message || "Failed to impersonate user",
        isLoading: false,
      });
      return null;
    }
  },

  // Tenant-specific user operations
  fetchTenantUsers: async (token: string, tenantId: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch tenant users");
      }

      const data = await response.json();
      set({ users: data.users, isLoading: false, error: null });
    } catch (error: any) {
      logger.auth.error("Fetch tenant users error", { error: String(error) });
      set({
        error: error.message || "Failed to fetch tenant users",
        isLoading: false,
      });
    }
  },

  createTenantUser: async (
    token: string,
    tenantId: number,
    email: string,
    username: string,
    password: string,
    role: "admin" | "user"
  ) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, username, password, role }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }

      const data = await response.json();

      // Add the new user to the list
      set((state) => ({
        users: [...state.users, data.user],
        isLoading: false,
        error: null,
      }));

      logger.auth.info("Tenant user created successfully", { username: data.user.username });
      return true;
    } catch (error: any) {
      logger.auth.error("Create tenant user error", { error: String(error) });
      set({
        error: error.message || "Failed to create user",
        isLoading: false,
      });
      return false;
    }
  },

  updateTenantUser: async (
    token: string,
    tenantId: number,
    userId: number,
    data: { email?: string; username?: string; password?: string; role?: "admin" | "user" }
  ) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tenants/${tenantId}/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      const responseData = await response.json();

      // Update the user in the list
      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? responseData.user : u
        ),
        isLoading: false,
        error: null,
      }));

      logger.auth.info("Tenant user updated successfully");
      return true;
    } catch (error: any) {
      logger.auth.error("Update tenant user error", { error: String(error) });
      set({
        error: error.message || "Failed to update user",
        isLoading: false,
      });
      return false;
    }
  },

  deleteTenantUser: async (token: string, tenantId: number, userId: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tenants/${tenantId}/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }

      // Remove the user from the list
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        isLoading: false,
        error: null,
      }));

      logger.auth.info("Tenant user deleted successfully");
      return true;
    } catch (error: any) {
      logger.auth.error("Delete tenant user error", { error: String(error) });
      set({
        error: error.message || "Failed to delete user",
        isLoading: false,
      });
      return false;
    }
  },
}));
