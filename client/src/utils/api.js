import axios from "axios";
import { API_BASE, STORAGE_KEYS } from "../constants";

export const getToken   = () => localStorage.getItem(STORAGE_KEYS.TOKEN);
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

const apiClient = axios.create({ baseURL: API_BASE });

apiClient.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`;
  return cfg;
});

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
