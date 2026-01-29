import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000";

let axiosInstance: AxiosInstance | null = null;
let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let sessionLoaded = false;
let refreshPromise: Promise<string | null> | null = null;

const loadSessionTokens = async () => {
  if (sessionLoaded) return;
  const session = await getSession();
  accessTokenCache = session?.accessToken || null;
  refreshTokenCache = session?.refreshToken || null;
  sessionLoaded = true;
};

const refreshAccessToken = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    if (!refreshTokenCache) {
      return null;
    }
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
        refreshToken: refreshTokenCache,
      });
      const newAccessToken = response.data?.token;
      accessTokenCache = newAccessToken || null;
      return accessTokenCache;
    } catch {
      accessTokenCache = null;
      refreshTokenCache = null;
      sessionLoaded = false;
      if (typeof window !== "undefined") {
        await signOut({ callbackUrl: "/auth/login" });
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      await loadSessionTokens();
      if (accessTokenCache) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessTokenCache}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !String(originalRequest?.url || "").includes("/api/auth/refresh")
      ) {
        originalRequest._retry = true;
        await loadSessionTokens();
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return instance(originalRequest);
        }
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
};

export const getAxiosInstance = (): AxiosInstance => {
  if (!axiosInstance) {
    axiosInstance = createAxiosInstance();
  }
  return axiosInstance;
};

// Dashboard
export const dashboardAPI = {
  getOverview: () => getAxiosInstance().get("/api/admin/stats"),
  getProjectStats: () => getAxiosInstance().get("/api/admin/stats"),
  getFinancialTrends: () => getAxiosInstance().get("/api/admin/financial-chart"),
};

// Projects
export const projectsAPI = {
  getAll: (params?: string | { search?: string; clientId?: string }) => {
    const query =
      typeof params === "string" ? { search: params } : params || {};
    return getAxiosInstance().get("/api/projects", { params: query });
  },
  getById: (id: string) => getAxiosInstance().get(`/api/projects/${id}`),
  create: (data: any) =>
    getAxiosInstance().post("/api/projects", data, {
      headers:
        data instanceof FormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
    }),
  update: (id: string, data: any) =>
    getAxiosInstance().put(`/api/projects/${id}`, data, {
      headers:
        data instanceof FormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
    }),
  delete: (id: string) => getAxiosInstance().delete(`/api/projects/${id}`),
  getTasks: (projectId?: string) =>
    getAxiosInstance().get("/api/tasks", {
      params: projectId ? { projectId } : {},
    }),
  createTask: (data: any) => getAxiosInstance().post("/api/tasks", data),
  updateTask: (id: string, data: any) =>
    getAxiosInstance().put(`/api/tasks/${id}`, data),
  deleteTask: (id: string) => getAxiosInstance().delete(`/api/tasks/${id}`),
  getTeamMembers: () =>
    getAxiosInstance().get("/api/users", {
      params: { role: "team_member" },
    }),
  getMilestones: (projectId: string) =>
    getAxiosInstance().get(`/api/projects/${projectId}/milestones`),
  addTeamMember: (projectId: string, payload: { userId: string; role?: string }) =>
    getAxiosInstance().post(`/api/projects/${projectId}/team`, payload),
  addMilestone: (projectId: string, payload: { name: string }) =>
    getAxiosInstance().post(`/api/projects/${projectId}/milestones`, payload),
};

// Clients
export const clientsAPI = {
  getAll: () =>
    getAxiosInstance().get("/api/users", { params: { role: "client" } }),
  getById: (id: string) => getAxiosInstance().get(`/api/users/${id}`),
  create: (data: FormData) =>
    getAxiosInstance().post("/api/users/client", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    getAxiosInstance().put(`/api/users/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: string) => getAxiosInstance().delete(`/api/users/${id}`),
};

// Team Members
export const teamMembersAPI = {
  getAll: () =>
    getAxiosInstance().get("/api/users", {
      params: { role: "team_member" },
    }),
  getById: (id: string) =>
    getAxiosInstance().get(`/api/users/team-member/${id}/dashboard`),
  create: (data: any) => getAxiosInstance().post("/api/users/team-member", data),
  update: (id: string, data: any) =>
    getAxiosInstance().put(`/api/users/${id}`, data),
  delete: (id: string) => getAxiosInstance().delete(`/api/users/${id}`),
};

// Finance
export const financeAPI = {
  getAll: (params?: string | { type?: string; clientId?: string; projectId?: string }) => {
    const query =
      typeof params === "string" ? { type: params } : params || {};
    return getAxiosInstance().get("/api/finance", { params: query });
  },
  getById: (id: string) => getAxiosInstance().get(`/api/finance/${id}`),
  create: (data: any) => getAxiosInstance().post("/api/finance", data),
  update: (id: string, data: any) =>
    getAxiosInstance().put(`/api/finance/${id}`, data),
  delete: (id: string) => getAxiosInstance().delete(`/api/finance/${id}`),
};

// Messages
export const messagesAPI = {
  getByChat: (chatId: string) => getAxiosInstance().get(`/api/messages/${chatId}`),
  markRead: (chatId: string) => getAxiosInstance().put(`/api/messages/${chatId}/read`),
  uploadAttachments: (data: FormData) =>
    getAxiosInstance().post("/api/messages/upload", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Documents
export const documentsAPI = {
  getAll: (page = 1, limit = 10) =>
    getAxiosInstance().get("/api/documents", { params: { page, limit } }),
  getByProject: (projectId: string, milestoneId?: string) =>
    getAxiosInstance().get(`/api/documents/project/${projectId}`, {
      params: milestoneId ? { milestoneId } : {},
    }),
  upload: (data: FormData) =>
    getAxiosInstance().post("/api/documents", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateStatus: (id: string, status: string) =>
    getAxiosInstance().put(`/api/documents/${id}/status`, { status }),
};

// Profile / Settings
export const profileAPI = {
  get: () => getAxiosInstance().get("/api/users/profile"),
  update: (data: FormData | Record<string, any>) =>
    getAxiosInstance().put("/api/users/profile", data, {
      headers:
        data instanceof FormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
    }),
};

// Security
export const securityAPI = {
  changePassword: (oldPassword: string, newPassword: string) =>
    getAxiosInstance().put("/api/auth/password", { oldPassword, newPassword }),
};

// Chats
export const chatsAPI = {
  getAll: (projectId?: string) =>
    getAxiosInstance().get("/api/chats", { params: projectId ? { projectId } : {} }),
  access: (payload: { userId: string; projectId: string }) =>
    getAxiosInstance().post("/api/chats", payload),
};

// Notifications
export const notificationsAPI = {
  getAll: () => getAxiosInstance().get("/api/notifications"),
  markRead: (id: string) => getAxiosInstance().put(`/api/notifications/${id}/read`),
  markAllRead: () => getAxiosInstance().put("/api/notifications/read-all"),
  delete: (id: string) => getAxiosInstance().delete(`/api/notifications/${id}`),
};

export default getAxiosInstance;
