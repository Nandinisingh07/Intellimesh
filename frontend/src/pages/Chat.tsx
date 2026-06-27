import type { ChatMessage, DocumentInfo, ModelLoadedStatus } from '../lib/types';
import { useState, useRef, useEffect } from 'react';
import { queryDocuments, checkHealth, getDocuments } from '../lib/api';
import ChatMessageComponent from '../components/ChatMessage';
import { Send, Mic, Square, RotateCw, Settings, Cpu, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import ThreeDCard from '../components/ThreeDCard';
import QuantumCore3D from '../components/QuantumCore3D';


type RecordState = 'idle' | 'recording' | 'transcribing';

interface ChatProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const MODALITY_COLORS: Record<string, string> = {
  pdf: 'var(--accent-cyan)',
  docx: 'var(--accent-teal)',
  txt: 'var(--accent-gold)',
  image: 'var(--accent-violet)',
  audio: 'var(--accent-green)',
};

export default function Chat({ theme, onToggleTheme }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [recordError, setRecordError] = useState('');
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [health, setHealth] = useState<ModelLoadedStatus | null>(null);
  const [chunks, setChunks] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refresh = () => {
    checkHealth().then(h => setHealth(h.models_loaded)).catch(() => { });
    getDocuments().then(d => { setDocs(d.documents); setChunks(d.total_chunks); }).catch(() => { });
  };

  useEffect(() => {
    refresh();
    const intv = setInterval(refresh, 10000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: q, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await queryDocuments(q);
      setMessages(m => [...m, {
        id: uuidv4(), role: 'assistant', content: res.answer,
        sources: res.sources, timestamp: new Date(),
      }]);
    } catch {
      setMessages(m => [...m, {
        id: uuidv4(), role: 'assistant',
        content: 'Backend unreachable. Ensure server is running on port 8000.',
        timestamp: new Date(),
      }]);
    } finally { setLoading(false); }
  };

  const startRecording = async () => {
    setRecordError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setRecordState('transcribing');
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        try {
          const res = await axios.post('http://localhost:8000/api/voice/transcribe', fd);
          setInput(res.data.text);
        } catch {
          setRecordError('Transcription failed — is Whisper installed?');
        } finally { setRecordState('idle'); }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecordState('recording');
    } catch {
      setRecordError('Microphone access denied.');
      setRecordState('idle');
    }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); };

  const recentDocs = docs.slice(0, 3);
  const queryCount = messages.filter(m => m.role === 'user').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div className="topbar" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <span className="page-heading" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, letterSpacing: '-0.3px' }}>
          Query Analyst Interface
        </span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          background: 'rgba(0, 245, 255, 0.05)', border: '1px solid rgba(0, 245, 255, 0.15)',
          color: 'var(--accent-cyan)', borderRadius: 4, padding: '2px 8px', marginLeft: 12, fontWeight: 700
        }}>
          {docs.length} NODES INDEXED
        </span>
        <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="topbar-btn" onClick={refresh} title="Refresh details" style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', transition: 'all 0.2s' }}>
            <RotateCw size={14} />
          </button>
          <button className="topbar-btn" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', transition: 'all 0.2s' }}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="stat-strip" style={{ borderBottom: '1px solid var(--border)', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
        <div className="stat-cell" style={{ borderRight: '1px solid var(--border-soft)' }}>
          <div className="stat-label" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>Documents</div>
          <div className="stat-value" style={{ fontFamily: 'JetBrains Mono', fontSize: 26, fontWeight: 700 }}>{docs.length}</div>
          <div className="stat-hint-text" style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 600 }}>Vault Total</div>
        </div>
        <div className="stat-cell" style={{ borderRight: '1px solid var(--border-soft)' }}>
          <div className="stat-label" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>Chunks</div>
          <div className="stat-value" style={{ fontFamily: 'JetBrains Mono', fontSize: 26, fontWeight: 700 }}>{chunks}</div>
          <div className="stat-hint-text" style={{ fontSize: 11, color: 'var(--accent-teal)', fontWeight: 600 }}>Across All Nodes</div>
        </div>
        <div className="stat-cell" style={{ borderRight: '1px solid var(--border-soft)' }}>
          <div className="stat-label" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>LLM</div>
          <div className="stat-value" style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 10 }}>
            {health?.llm || 'phi3:mini'}
          </div>
          <div className="stat-hint-text" style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 600 }}>Ollama Air-Gapped</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>Queries</div>
          <div className="stat-value" style={{ fontFamily: 'JetBrains Mono', fontSize: 26, fontWeight: 700 }}>{queryCount}</div>
          <div className="stat-hint-text" style={{ fontSize: 11, color: 'var(--accent-violet)', fontWeight: 600 }}>Current Session</div>
        </div>
      </div>

      {/* Content Area */}
      <div className="content-area" style={{ padding: '24px 28px', gap: 24 }}>
        {/* Recent Documents Section */}
        <div className="section-header" style={{ marginBottom: 0 }}>
          <div className="section-title" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1.2 }}>▸ RECENT VAULT INGESTIONS</div>
          <div className="section-rule" style={{ background: 'var(--border-soft)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {recentDocs.length === 0 ? (
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, width: '100%', gridColumn: '1 / -1', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
              No documents indexed yet. Go to Ingest Files to upload.
            </div>
          ) : (
            recentDocs.map(d => {
              const color = MODALITY_COLORS[d.modality] ?? 'var(--text-secondary)';
              const count = d.chunk_count || 1;

              return (
                <ThreeDCard className="glass-panel" key={d.file_id} maxRotation={5} style={{
                  borderRadius: 10, padding: '12px 14px',
                  background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'default'
                }}>
                  <div style={{
                    width: 32, height: 32, background: 'var(--bg-surface)',
                    borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                    border: `1px solid ${color}30`,
                    transform: 'translateZ(15px)'
                  }}>
                    <FileText size={15} color={color} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Outfit' }} title={d.filename}>
                      {d.filename}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 8.5, letterSpacing: 0.5,
                      color, fontWeight: 700
                    }}>
                      {count} CHUNKS
                    </div>
                  </div>
                </ThreeDCard>
              );
            })
          )}
        </div>

        {/* Conversation Section */}
        <div className="section-header" style={{ marginBottom: 0 }}>
          <div className="section-title" style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1.2 }}>▸ SECURE CONVERSATION LOG</div>
          <div className="section-rule" style={{ background: 'var(--border-soft)' }} />
        </div>

        <div className="chat-wrap glass-panel cyber-bracket-container" style={{ flex: 1, minHeight: 340, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: 14 }}>
          <div className="chat-header" style={{ background: 'var(--bg-section)', borderBottom: '1px solid var(--border)', padding: '12px 18px', fontSize: 10.5, fontWeight: 700 }}>
            <span style={{ fontSize: 8, color: 'var(--accent-cyan)', animation: 'pulse-dot 2s infinite', filter: 'drop-shadow(0 0 3px var(--accent-cyan))' }}>●</span>
            &nbsp;SEMANTIC CONTEXT RETRIEVAL · {health?.llm || 'phi3:mini'} · LOCAL INFERENCE PIPELINE
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                minHeight: '100%',
                padding: '36px 24px',
                boxSizing: 'border-box',
              }}>
                <div style={{ flexGrow: 1 }} />
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 20,
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '560px',
                }}>
                  {/* Floating 3D chatbot welcome icon badge */}
                  <ThreeDCard maxRotation={15} style={{
                    width: 72,
                    height: 72,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-section))',
                    border: '1px solid var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(0, 245, 255, 0.15)',
                    position: 'relative',
                    cursor: 'pointer',
                    animation: 'float 3s ease-in-out infinite'
                  }}>
                    {/* Glowing background ring */}
                    <div style={{
                      position: 'absolute',
                      inset: '-3px',
                      borderRadius: '26px',
                      background: 'var(--gradient-cyan)',
                      opacity: 0.3,
                      zIndex: -1,
                      filter: 'blur(8px)'
                    }} />
                    
                    <Cpu size={32} color="var(--accent-cyan)" style={{ transform: 'translateZ(20px)', filter: 'drop-shadow(0 0 8px rgba(0, 245, 255, 0.6))' }} />
                    
                    {/* Status Dot */}
                    <span style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'var(--accent-green)',
                      border: '2px solid var(--bg-surface)',
                      boxShadow: '0 0 8px var(--accent-green)'
                    }} />
                  </ThreeDCard>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '-0.5px'
                    }}>
                      Query Knowledge Engine
                    </h3>
                    <p style={{
                      fontSize: 13.5,
                      color: 'var(--text-secondary)',
                      margin: 0,
                      maxWidth: '420px',
                      lineHeight: 1.5,
                      fontWeight: 500
                    }}>
                      Ask natural language questions about your secure local database. Dictation is supported via Whisper.
                    </p>
                  </div>

                  {/* 3D Visual Component: Vector Core Rotation visualizer in welcome state */}
                  <div style={{ width: '100%', maxWidth: '440px', marginTop: 8 }}>
                    <QuantumCore3D />
                  </div>

                  {/* Interactive Suggestion Cards */}
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '440px' }}>
                    <div style={{
                      fontSize: 9.5,
                      color: 'var(--text-muted)',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      width: '100%',
                      marginBottom: 4
                    }}>
                      Suggested Inquiries
                    </div>
                    {[
                      "Summarize total knowledge index",
                      "Identify primary technical policies",
                      "List documents with highest chunk count"
                    ].map((queryText, index) => (
                      <ThreeDCard
                        key={index}
                        onClick={() => setInput(queryText)}
                        maxRotation={5}
                        style={{
                          padding: '12px 18px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                        className="cyber-bracket-container"
                      >
                        <span style={{ transform: 'translateZ(12px)', fontWeight: 600, fontFamily: 'Inter', textAlign: 'left' }}>
                          {queryText}
                        </span>
                        <span style={{
                          fontSize: 10,
                          color: 'var(--accent-cyan)',
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 700,
                          transform: 'translateZ(15px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          ▸ LOAD
                        </span>
                      </ThreeDCard>
                    ))}
                  </div>
                </div>

                <div style={{ flexGrow: 1 }} />
              </div>
            ) : (
              messages.map(m => (
                <ChatMessageComponent key={m.id} message={m} />
              ))
            )}

            {loading && (
              <div style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                width: '100%',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-soft)'
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                  boxShadow: '0 0 12px rgba(0, 245, 255, 0.05)',
                }}>
                  <Cpu size={16} style={{ animation: 'spin 3s linear infinite' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <span>INTELLIMESH ANALYST</span>
                    <span>•</span>
                    <span>THINKING...</span>
                  </div>
                  <div className="typing-dots" style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ background: 'var(--accent-cyan)' }} />
                    <span style={{ background: 'var(--accent-cyan)' }} />
                    <span style={{ background: 'var(--accent-cyan)' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-bar glass-panel" style={{
            padding: '16px 20px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid var(--glass-border)',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            position: 'relative'
          }}>
            {recordError && (
              <div style={{ position: 'absolute', top: -20, left: 18, fontSize: 10.5, color: 'var(--accent-red)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {recordError}
              </div>
            )}
            <button
              onClick={recordState === 'recording' ? stopRecording : startRecording}
              disabled={recordState === 'transcribing'}
              className={`icon-btn ${recordState === 'recording' ? 'recording' : ''}`}
              title={recordState === 'recording' ? 'Stop recording' : 'Start voice input'}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: recordState === 'recording' ? 'none' : '1px solid var(--border)',
                background: recordState === 'recording' 
                  ? 'var(--gradient-red)' 
                  : (recordState === 'transcribing' ? 'var(--bg-section)' : 'var(--bg-surface)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: recordState === 'transcribing' ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                color: recordState === 'recording' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: recordState === 'recording' ? '0 4px 14px rgba(239, 68, 68, 0.3)' : 'none',
                transform: recordState === 'recording' ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {recordState === 'recording' ? (
                <Square size={14} color="#FFFFFF" style={{ animation: 'pulse-dot 1s infinite' }} />
              ) : (
                <Mic size={14} color={recordState === 'transcribing' ? 'var(--text-muted)' : 'var(--text-secondary)'} />
              )}
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask your documents… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="query-input"
              style={{
                borderRadius: 10,
                border: inputFocused ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
                padding: '12px 16px',
                fontSize: 14.5,
                fontFamily: 'Inter, sans-serif',
                resize: 'none',
                outline: 'none',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                boxShadow: inputFocused ? '0 0 16px rgba(0, 245, 255, 0.12)' : 'var(--shadow-sm)'
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="icon-btn send"
              title="Send query"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: input.trim() && !loading ? 'none' : '1px solid var(--border)',
                background: input.trim() && !loading ? 'var(--gradient-cyan)' : 'var(--bg-surface)',
                color: input.trim() && !loading ? '#FFFFFF' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: input.trim() && !loading ? '0 4px 14px rgba(0, 245, 255, 0.3)' : 'none',
                transform: input.trim() && !loading ? 'scale(1.02)' : 'scale(1)',
                opacity: (loading || !input.trim()) ? 0.3 : 1
              }}
            >
              <Send size={14} color={input.trim() && !loading ? '#FFFFFF' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
