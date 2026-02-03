import { create } from "zustand";
import { buildApiUrl } from "@/lib/base-path";
import { logger } from "@/lib/logger";

const API_BASE_URL = buildApiUrl("");

export type SubClientUserRole = "admin" | "user";

export interface SubClientUser {
  id: number;
  username: string;
  email: string;
  role: SubClientUserRole;
}

export interface SubClient {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  whatsapp_client_id: string | null;
  short_id: string | null;
  pathname: string | null;
  custom_domain: string | null;
  created_at: number;
  updated_at: number;
  users?: SubClientUser[];
}

interface SubClientStore {
  // State
  subClients: SubClient[];
  currentSubClient: SubClient | null;
  isLoading: boolean;
  error: string | null;
  enabled: boolean;

  // Actions
  setSubClients: (subClients: SubClient[]) => void;
  setCurrentSubClient: (subClient: SubClient | null) => void;
  addSubClient: (subClient: SubClient) => void;
  updateSubClient: (subClientId: string, updates: Partial<SubClient>) => void;
  removeSubClient: (subClientId: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setEnabled: (enabled: boolean) => void;

  // Async actions
  fetchSubClients: (projectId: string) => Promise<void>;
  createSubClient: (projectId: string, name: string, description?: string, pathname?: string) => Promise<SubClient | null>;
  updateSubClientDetails: (projectId: string, subClientId: string, name: string, description?: string, pathname?: string) => Promise<boolean>;
  deleteSubClient: (projectId: string, subClientId: string) => Promise<boolean>;
  addUserToSubClient: (projectId: string, subClientId: string, userId: number, role?: SubClientUserRole) => Promise<boolean>;
  removeUserFromSubClient: (projectId: string, subClientId: string, userId: number) => Promise<boolean>;
  updateUserRole: (projectId: string, subClientId: string, userId: number, role: SubClientUserRole) => Promise<boolean>;
}

export const useSubClientStore = create<SubClientStore>((set, get) => ({
  // Initial state
  subClients: [],
  currentSubClient: null,
  isLoading: false,
  error: null,
  enabled: false,

  // Synchronous actions
  setSubClients: (subClients) => set({ subClients }),

  setCurrentSubClient: (subClient) => set({ currentSubClient: subClient }),

  addSubClient: (subClient) => set((state) => ({
    subClients: [...state.subClients, subClient]
  })),

  updateSubClient: (subClientId, updates) => set((state) => ({
    subClients: state.subClients.map((sc) =>
      sc.id === subClientId ? { ...sc, ...updates } : sc
    ),
    currentSubClient: state.currentSubClient?.id === subClientId
      ? { ...state.currentSubClient, ...updates }
      : state.currentSubClient
  })),

  removeSubClient: (subClientId) => set((state) => {
    const newSubClients = state.subClients.filter((sc) => sc.id !== subClientId);
    const newCurrentSubClient = state.currentSubClient?.id === subClientId
      ? null
      : state.currentSubClient;
    return {
      subClients: newSubClients,
      currentSubClient: newCurrentSubClient
    };
  }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setEnabled: (enabled) => set({ enabled }),

  // Async actions
  fetchSubClients: async (projectId: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sub-clients");
      }

      const data = await response.json();

      if (data.success) {
        state.setSubClients(data.data.subClients);
        state.setEnabled(data.data.enabled);
      } else {
        state.setError(data.error || "Failed to fetch sub-clients");
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to fetch sub-clients");
      logger.general.error("Fetch sub-clients error", { error: String(error) });
    } finally {
      state.setIsLoading(false);
    }
  },

  createSubClient: async (projectId: string, name: string, description?: string, pathname?: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, pathname }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sub-client");
      }

      const data = await response.json();

      if (data.success) {
        state.addSubClient(data.data.subClient);
        return data.data.subClient;
      } else {
        state.setError(data.error || "Failed to create sub-client");
        return null;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to create sub-client");
      logger.general.error("Create sub-client error", { error: String(error) });
      return null;
    } finally {
      state.setIsLoading(false);
    }
  },

  updateSubClientDetails: async (projectId: string, subClientId: string, name: string, description?: string, pathname?: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, pathname }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sub-client");
      }

      const data = await response.json();

      if (data.success) {
        state.updateSubClient(subClientId, {
          name: data.data.subClient.name,
          description: data.data.subClient.description,
          updated_at: data.data.subClient.updated_at,
        });
        return true;
      } else {
        state.setError(data.error || "Failed to update sub-client");
        return false;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to update sub-client");
      logger.general.error("Update sub-client error", { error: String(error) });
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },

  deleteSubClient: async (projectId: string, subClientId: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sub-client");
      }

      const data = await response.json();

      if (data.success) {
        state.removeSubClient(subClientId);
        return true;
      } else {
        state.setError(data.error || "Failed to delete sub-client");
        return false;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to delete sub-client");
      logger.general.error("Delete sub-client error", { error: String(error) });
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },

  addUserToSubClient: async (projectId: string, subClientId: string, userId: number, role: SubClientUserRole = "user") => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add user to sub-client");
      }

      const data = await response.json();

      if (data.success) {
        // Refresh sub-clients to get updated user list
        await state.fetchSubClients(projectId);
        return true;
      } else {
        state.setError(data.error || "Failed to add user to sub-client");
        return false;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to add user to sub-client");
      logger.general.error("Add user to sub-client error", { error: String(error) });
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },

  removeUserFromSubClient: async (projectId: string, subClientId: string, userId: number) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove user from sub-client");
      }

      const data = await response.json();

      if (data.success) {
        // Refresh sub-clients to get updated user list
        await state.fetchSubClients(projectId);
        return true;
      } else {
        state.setError(data.error || "Failed to remove user from sub-client");
        return false;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to remove user from sub-client");
      logger.general.error("Remove user from sub-client error", { error: String(error) });
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },

  updateUserRole: async (projectId: string, subClientId: string, userId: number, role: SubClientUserRole) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sub-clients/${subClientId}/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user role");
      }

      const data = await response.json();

      if (data.success) {
        // Refresh sub-clients to get updated user list
        await state.fetchSubClients(projectId);
        return true;
      } else {
        state.setError(data.error || "Failed to update user role");
        return false;
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Failed to update user role");
      logger.general.error("Update user role error", { error: String(error) });
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },
}));
