import axios from "axios";
import { API_BASE, STORAGE_KEYS } from "../constants";

const API = axios.create({ baseURL: API_BASE });

API.interceptors.request.use((req) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──
export const login = (email, password) =>
  API.post("/auth/login", new URLSearchParams({ username: email, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

export const registerSendOtp   = (data)         => API.post("/auth/register/send-otp", data);
export const registerVerifyOtp = (data)         => API.post("/auth/register/verify-otp", data);
export const setupAccount      = (email, otp)   => API.post("/auth/setup-account", { email, otp });
export const changePassword    = (new_password) => API.post("/auth/change-password", { new_password });
export const forgotPassword    = (email)        => API.post("/auth/forgot-password", { email });

export const createUser      = (data)  => API.post("/admin/create-user/", data);
export const getUsers        = ()      => API.get("/admin/users/");
export const deleteUser      = (id)    => API.delete(`/admin/delete-user/${id}`);

// ── PATIENTS ──
export const getNextPatientId   = ()   => API.get("/next-patient-id/");
export const registerPatient    = (d)  => API.post("/register-patient/", d);
export const getPatients        = ()   => API.get("/patients/");
export const deletePatient      = (id) => API.delete(`/delete-patient/${id}`);
export const getAllPatientsAdmin = ()   => API.get("/admin/all-patients/");
export const softDeletePatient  = (id) => API.patch(`/admin/soft-delete-patient/${id}`);
export const restorePatient     = (id) => API.patch(`/admin/restore-patient/${id}`);

// ── REPORTS / OCR ──
export const analyzeReports = (formData) => API.post("/analyze-reports/", formData);
export const getReports     = ()         => API.get("/reports/");
export const getAiReports   = (pid)      => API.get(`/ai-reports/${pid}`);

// ── DOCTORS ──
export const getDoctors          = ()             => API.get("/doctors/");
export const assignDoctor        = (reason)       => API.post("/ai/assign-doctor/", { reason });
export const updateSpecialization = (id, spec)    => API.patch(`/doctors/${id}/specialization`, { specialization: spec });

// ── PRESCRIPTIONS & LAB ──
export const getLabTests       = ()    => API.get("/lab/tests");
export const createPrescription = (d)  => API.post("/prescriptions/", d);
export const getPrescriptions  = (pid) => API.get(`/prescriptions/${pid}`);

// ── TESTS ──
export const getPendingTests    = (q)        => API.get(`/counter/pending-tests/${q}`);
export const getTechnicianTests = (q)        => API.get(`/technician/tests/${q}`);
export const updateTestStatus   = (id, status) => API.patch(`/technician/update-status/${id}`, { status });
export const uploadTestReport   = (id, fd)   => API.post(`/technician/upload-report/${id}`, fd);

// ── BILLING ──
export const payTests              = (d)   => API.post("/counter/pay-tests/", d);
export const createConsultationBill = (d)  => API.post("/counter/consultation-bill/", d);
export const getPatientBills       = (pid) => API.get(`/billing/patient/${pid}`);
export const getInvoice            = (id)  => API.get(`/billing/invoice/${id}`);
export const getAdminPatientBills  = (pid) => API.get(`/admin/billing/patient/${pid}`);

// ── FOLLOW-UP ──
export const assignFollowup = (pid) => API.post("/followup/assign/", { patient_id: pid });
export const checkFollowup  = (pid) => API.get(`/followup/check/${pid}`);
export const useFollowup    = (pid) => API.post(`/followup/use/${pid}`);
export const cancelFollowup = (pid) => API.delete(`/followup/cancel/${pid}`);

// ── ANALYTICS ──
export const getAnalytics   = () => API.get("/admin/analytics/");
export const getAnalyticsV2 = () => API.get("/admin/analytics-v2/");

// ── PHARMACY ──
export const getPharmacyDashboard   = ()      => API.get("/pharmacy-admin/dashboard/summary");
export const getMedicines            = ()      => API.get("/pharmacy-admin/medicines/");
export const addMedicine             = (d)     => API.post("/pharmacy-admin/medicines/", d);
export const updateMedicine          = (id, d) => API.put(`/pharmacy-admin/medicines/${id}`, d);
export const deleteMedicine          = (id)    => API.delete(`/pharmacy-admin/medicines/${id}`);
export const updateStock             = (d)     => API.post("/pharmacy-admin/stock/", d);
export const createPharmacyBill      = (d)     => API.post("/pharmacy-admin/billing/", d);
export const getPharmacyPatientBills = (pid)   => API.get(`/pharmacy-admin/billing/patient/${pid}`);
export const getPharmacyInvoice      = (id)    => API.get(`/pharmacy-admin/billing/invoice/${id}`);
export const getPharmacyAnalytics    = ()      => API.get("/pharmacy-admin/analytics/");
export const getPharmacyMlPredictions = ()     => API.get("/pharmacy-admin/ml-predictions/");
export const getTransactions         = ()      => API.get("/pharmacy-admin/transactions/");

export default API;
