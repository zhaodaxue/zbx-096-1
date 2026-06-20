import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getResidents = () => api.get('/residents').then((r) => r.data);
export const getResident = (id) => api.get(`/residents/${id}`).then((r) => r.data);
export const createResident = (data) => api.post('/residents', data).then((r) => r.data);
export const updateResident = (id, data) => api.put(`/residents/${id}`, data).then((r) => r.data);

export const getPainRecords = (residentId, startDate, endDate) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return api.get(`/residents/${residentId}/pain-records`, { params }).then((r) => r.data);
};

export const savePainRecord = (data) => api.post('/pain-records', data).then((r) => r.data);

export const getMedAdjustmentDays = (residentId) =>
  api.get(`/residents/${residentId}/med-adjustment-days`).then((r) => r.data);

export const saveMedAdjustmentDay = (data) =>
  api.post('/med-adjustment-days', data).then((r) => r.data);

export const deleteMedAdjustmentDay = (id) =>
  api.delete(`/med-adjustment-days/${id}`).then((r) => r.data);

export default api;
