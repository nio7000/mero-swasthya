import axios from "axios";
import { API_BASE, STORAGE_KEYS } from "../constants";

const API = axios.create({ baseURL: API_BASE });

API.interceptors.request.use((req) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const saveReport = async (reportData) => {
  return await API.post("/save-report/", reportData, {
    headers: { "Content-Type": "application/json" },
  });
};
