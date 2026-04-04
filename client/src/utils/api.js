import axios from "axios";
import { API_BASE, STORAGE_KEYS } from "../constants";

export const getToken   = () => localStorage.getItem(STORAGE_KEYS.TOKEN);
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

const apiClient = axios.create({ baseURL: API_BASE });
apiClient.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${getToken()}`;
  return cfg;
});

export default apiClient;
