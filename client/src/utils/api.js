// Axios instance pre-configured with the API base URL and auth header injection.
// All components import this instead of raw axios so auth is handled in one place.

import axios from "axios";
import { API_BASE, STORAGE_KEYS } from "../constants";

export const getToken   = () => localStorage.getItem(STORAGE_KEYS.TOKEN);
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

// Single shared axios instance — base URL comes from constants so it's easy to switch environments
const apiClient = axios.create({ baseURL: API_BASE });

// Attach the JWT to every outgoing request automatically
apiClient.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`;
  return cfg;
});

// If the server returns 401 (token expired or invalid), clear storage and kick back to login
apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export default apiClient;
