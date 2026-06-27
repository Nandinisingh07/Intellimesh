import type { HealthResponse, DocumentInfo, QueryResponse, UploadProgressEvent } from './types';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000' });

export const checkHealth = () =>
  api.get<HealthResponse>('/api/health').then(r => r.data);

export const getDocuments = () =>
  api.get<{ documents: DocumentInfo[]; total_chunks: number }>('/api/documents').then(r => r.data);

export const deleteDocument = (file_id: string) =>
  api.delete('/api/documents/' + file_id).then(r => r.data);

export const queryDocuments = (query: string, top_k = 5) =>
  api.post<QueryResponse>('/api/query', { query, top_k }).then(r => r.data);

export const uploadFiles = async (
  files: File[],
  onProgress?: (e: UploadProgressEvent) => void
) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const r = await api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress({
          filename: '',
          stage: 'uploading',
          progress: Math.round((e.loaded * 100) / e.total),
        });
      }
    },
  });
  return r.data;
};
