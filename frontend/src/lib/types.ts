export interface ModelLoadedStatus {
  embedder: boolean;
  llm: string;
  whisper: boolean;
  blip: boolean;
}

export interface HealthResponse {
  status: string;
  models_loaded: ModelLoadedStatus;
}

export interface DocumentInfo {
  file_id: string;
  filename: string;
  modality: string;
  chunk_index?: number;
  chunk_count?: number;
}

export interface SourceCitation {
  document: string;
  metadata: DocumentInfo;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  timestamp: Date;
}

export interface QueryResponse {
  answer: string;
  sources: SourceCitation[];
  latency_ms: number;
}

export interface UploadProgressEvent {
  filename: string;
  stage: string;
  progress: number;
}
