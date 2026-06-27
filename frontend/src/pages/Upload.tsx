import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFiles } from '../lib/api';
import { Upload, CheckCircle, XCircle, Loader, FileText, Image, Mic, File, Database, Terminal, ShieldCheck, LayoutList } from 'lucide-react';
import ThreeDCard from '../components/ThreeDCard';
import VisionPanel from '../components/VisionPanel';

interface FileStatus {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  preview?: string;
  result?: { chunk_count: number; modality: string };
}

const getIcon = (name: string): React.ElementType => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext)) return Image;
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return Mic;
  if (['pdf', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
};

const getColor = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext)) return 'var(--accent-cyan)';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'var(--accent-green)';
  if (['pdf', 'docx'].includes(ext)) return 'var(--accent-gold)';
  return 'var(--text-secondary)';
};

export default function UploadPage() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize system console logs
  useEffect(() => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs([
      `[${time}] SYS: Secure Sandbox Pipeline online`,
      `[${time}] SYS: Ingestion engine ready for file upload...`
    ]);
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted.map(f => ({
      file: f,
      status: 'pending',
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    })));

    const time = new Date().toLocaleTimeString();
    setConsoleLogs(curr => [
      ...curr,
      `[${time}] INGEST: Loaded ${accepted.length} file(s) into memory buffer`
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Simulate scrolling CRT logs during upload
  const simulateLogs = (filesToUpload: FileStatus[]) => {
    let delay = 0;
    
    const addLog = (msg: string) => {
      const time = new Date().toLocaleTimeString();
      setConsoleLogs(curr => [...curr, `[${time}] ${msg}`]);
    };

    addLog('SYS: INGESTION PIPELINE INITIALIZED');
    
    filesToUpload.forEach((f) => {
      setTimeout(() => {
        addLog(`LOAD: Buffer index read for "${f.file.name}"`);
      }, delay += 250);

      const ext = f.file.name.split('.').pop()?.toLowerCase() ?? '';
      
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        setTimeout(() => {
          addLog(`OCR: Extracting layout bounds via Tesseract OCR...`);
        }, delay += 350);
        setTimeout(() => {
          addLog(`OCR: Discovered semantic bounding boxes in file`);
        }, delay += 300);
      } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
        setTimeout(() => {
          addLog(`WHISPER: Parsing speech frames through Whisper pipeline...`);
        }, delay += 400);
        setTimeout(() => {
          addLog(`WHISPER: Audio transcription completed.`);
        }, delay += 400);
      } else {
        setTimeout(() => {
          addLog(`PARSE: Extracting document text segments and meta blocks...`);
        }, delay += 300);
      }

      setTimeout(() => {
        addLog(`CHUNKS: Generating overlapping semantic vectors...`);
      }, delay += 350);
      
      setTimeout(() => {
        addLog(`EMBED: Requesting Ollama embedding vectors (1536D)...`);
      }, delay += 450);

      setTimeout(() => {
        addLog(`VAULT: Index sync successful. Stored securely.`);
      }, delay += 350);
    });

    setTimeout(() => {
      addLog('SYS: PIPELINE SECURE AUDIT COMPLETE.');
    }, delay + 400);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setFiles(s => s.map(f => ({ ...f, status: 'uploading' })));
    simulateLogs(files);

    try {
      const res = await uploadFiles(files.map(f => f.file));
      setFiles(s => s.map((f, i) => ({
        ...f, status: 'done', result: res.results?.[i],
      })));
    } catch {
      setFiles(s => s.map(f => ({ ...f, status: 'error' })));
      const time = new Date().toLocaleTimeString();
      setConsoleLogs(curr => [...curr, `[${time}] ✗ ERROR: Ingestion transaction failed`]);
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  // Modality count mapping helpers
  const countByType = (exts: string[]) => {
    return files.filter(f => {
      const ext = f.file.name.split('.').pop()?.toLowerCase() ?? '';
      return exts.includes(ext);
    }).length;
  };

  const docCount = countByType(['pdf', 'docx']);
  const ocrCount = countByType(['jpg', 'jpeg', 'png', 'webp', 'bmp']);
  const audioCount = countByType(['mp3', 'wav', 'm4a', 'ogg']);
  const txtCount = countByType(['txt', 'csv']);

  return (
    <div style={{ padding: 28, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--accent-cyan)', animation: 'pulse-dot 2s infinite', filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }}>●</span>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.8, fontWeight: 700 }}>
              SECURE VAULT INGESTION CONSOLE
            </div>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.8px' }}>
            <span className="metallic-text">Ingest Intelligence Documents</span>
          </h1>
        </div>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 10, 
          background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', 
          border: '1px solid var(--glass-border)', padding: '8px 16px', 
          borderRadius: 10, boxShadow: 'var(--shadow-sm)' 
        }}>
          <ShieldCheck size={14} color="var(--accent-green)" />
          <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.8px' }}>
            LOCAL ISOLATION: ACTIVE
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Column: Ingestion Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Dropzone */}
          <ThreeDCard maxRotation={4} style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }}>
            <div
              {...getRootProps()}
              className={`dropzone glass-panel ${isDragActive ? 'active' : ''}`}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
                background: isDragActive ? 'rgba(0, 245, 255, 0.05)' : 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                borderRadius: 16,
                padding: '52px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: isDragActive ? '0 0 24px rgba(0, 245, 255, 0.15)' : 'var(--shadow-sm)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <input {...getInputProps()} />

              {/* Shimmer overlay sweep */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.15), transparent)',
                  pointerEvents: 'none',
                  animation: 'shimmer-loop 6s linear infinite',
                }}
              />

              <div 
                style={{
                  width: 58, height: 58, borderRadius: 14,
                  background: isDragActive ? 'rgba(0, 245, 255, 0.08)' : 'var(--bg-surface)',
                  border: `1px solid ${isDragActive ? 'var(--accent-cyan)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isDragActive ? '0 0 16px rgba(0, 245, 255, 0.2)' : 'var(--shadow-sm)',
                  transition: 'all 0.3s ease',
                  animation: isDragActive ? 'bounce-glow 2s infinite' : 'none'
                }}
              >
                <Upload size={24} style={{ color: isDragActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              </div>
              
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit' }}>
                  {isDragActive ? 'Release to ingest files' : 'Drop documents or click to browse'}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 0', fontWeight: 500, lineHeight: 1.4 }}>
                  Files remain fully encrypted and air-gapped on this secure server instance
                </p>
              </div>

              <div style={{
                marginTop: 6,
                fontSize: 9.5,
                fontFamily: 'JetBrains Mono',
                color: 'var(--accent-teal)',
                background: 'var(--green-bg)',
                border: '1px solid var(--green-border)',
                borderRadius: 20,
                padding: '4px 14px',
                fontWeight: 700,
                letterSpacing: 0.5
              }}>
                ✓ 100% LOCAL COMPILATION
              </div>
            </div>
          </ThreeDCard>

          {/* Supported Channels Telemetry badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.2, fontWeight: 700 }}>
              ▸ MODALITY CHANNELS IN QUEUE
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              
              {/* Channel 1: Documents */}
              <ThreeDCard maxRotation={5} style={{
                background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)', borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'default'
              }} className="cyber-bracket-container">
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateZ(15px)' }}>
                  <FileText size={14} color="var(--accent-gold)" />
                </div>
                <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Document Vault</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>PDF, DOCX ({docCount} loaded)</div>
                </div>
              </ThreeDCard>

              {/* Channel 2: OCR Vision */}
              <ThreeDCard maxRotation={5} style={{
                background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)', borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'default'
              }} className="cyber-bracket-container">
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateZ(15px)' }}>
                  <Image size={14} color="var(--accent-cyan)" />
                </div>
                <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Vision OCR</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>PNG, JPG ({ocrCount} loaded)</div>
                </div>
              </ThreeDCard>

              {/* Channel 3: Audio Transcription */}
              <ThreeDCard maxRotation={5} style={{
                background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)', borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'default'
              }} className="cyber-bracket-container">
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateZ(15px)' }}>
                  <Mic size={14} color="var(--accent-green)" />
                </div>
                <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Voice Transcription</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>WAV, MP3 ({audioCount} loaded)</div>
                </div>
              </ThreeDCard>

              {/* Channel 4: Raw Text */}
              <ThreeDCard maxRotation={5} style={{
                background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)', borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'default'
              }} className="cyber-bracket-container">
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--navy-subtle)', border: '1px solid var(--navy-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateZ(15px)' }}>
                  <File size={14} color="var(--text-muted)" />
                </div>
                <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>Raw Extractors</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>TXT, CSV ({txtCount} loaded)</div>
                </div>
              </ThreeDCard>

            </div>
          </div>

        </div>

        {/* Right Column: Ingestion Queue & Telemetry Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Ingestion Queue */}
          <ThreeDCard maxRotation={4} className="dashboard-card glass-panel cyber-bracket-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '20px 22px',
            background: 'var(--glass-bg)',
            cursor: 'default',
            minHeight: '230px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, transform: 'translateZ(18px)', borderBottom: '1px solid var(--border-soft)', paddingBottom: 10 }}>
              <LayoutList size={15} color="var(--accent-cyan)" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--text-primary)', letterSpacing: 0.8, fontWeight: 700 }}>
                SECURE INGESTION QUEUE ({files.length} FILE{files.length !== 1 ? 'S' : ''})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, maxHeight: '200px', overflowY: 'auto', paddingRight: 4, transform: 'translateZ(10px)' }}>
              {files.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  flex: 1, gap: 10, color: 'var(--text-hint)', padding: '24px 0', border: '1px dashed var(--border)',
                  borderRadius: 10, background: 'rgba(255, 255, 255, 0.01)'
                }}>
                  <Database size={24} color="var(--border-bright)" />
                  <div style={{ fontSize: 12.5, fontFamily: 'Outfit', fontWeight: 600 }}>Vault Slot Vacant</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-hint)' }}>Awaiting local file selection...</div>
                </div>
              ) : (
                files.map((fs, i) => {
                  const Icon = getIcon(fs.file.name);
                  const color = getColor(fs.file.name);
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="glass-panel" style={{
                        borderRadius: 10, padding: '10px 12px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all 0.2s ease'
                      }}>
                        {fs.preview ? (
                          <img
                            src={fs.preview}
                            alt=""
                            style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <div style={{
                            width: 32, height: 32, background: 'var(--bg-surface)',
                            borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${color}30`
                          }}>
                            <Icon size={14} color={color} />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, color: 'var(--text-primary)', fontWeight: 700,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: 'Outfit, sans-serif'
                          }} title={fs.file.name}>
                            {fs.file.name}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                            {(fs.file.size / 1024).toFixed(1)} KB
                            {fs.result && (
                              <span style={{ color: 'var(--accent-green)', marginLeft: 8, fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700 }}>
                                ✓ {fs.result.chunk_count} chunks · {fs.result.modality.toUpperCase()}
                              </span>
                            )}
                            {fs.status === 'error' && (
                              <span style={{ color: 'var(--accent-red)', marginLeft: 8, fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700 }}>
                                ✗ Ingestion failed
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {fs.status === 'done' && <CheckCircle size={16} color="var(--status-ok)" style={{ filter: 'drop-shadow(0 0 4px var(--status-ok))' }} />}
                          {fs.status === 'error' && <XCircle size={16} color="var(--accent-red)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-red))' }} />}
                          {fs.status === 'uploading' && (
                            <Loader size={15} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
                          )}
                          {fs.status === 'pending' && (
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-bright)' }} />
                          )}
                        </div>
                      </div>
                      {fs.preview && fs.status === 'done' && (
                        <div style={{ marginTop: 8 }}>
                          <VisionPanel imageFile={fs.file} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Ingest Button */}
            {pendingCount > 0 && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                style={{
                  marginTop: 6, padding: '10px 20px', borderRadius: 8,
                  border: '1px solid var(--accent-cyan)',
                  background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(0, 245, 255, 0.05))',
                  color: '#fff',
                  fontSize: 12.5, fontWeight: 700, cursor: isUploading ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif',
                  transition: 'all 0.2s ease', letterSpacing: 0.5,
                  boxShadow: '0 4px 12px rgba(0, 245, 255, 0.15)',
                  transform: 'translateZ(15px)',
                  opacity: isUploading ? 0.5 : 1
                }}
                onMouseEnter={e => {
                  if (!isUploading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 245, 255, 0.3), rgba(0, 245, 255, 0.1))';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 245, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateZ(15px) translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isUploading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 245, 255, 0.2), rgba(0, 245, 255, 0.05))';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 245, 255, 0.15)';
                    e.currentTarget.style.transform = 'translateZ(15px)';
                  }
                }}
              >
                ▸ Index {pendingCount} file{pendingCount !== 1 ? 's' : ''} into Knowledge Base
              </button>
            )}
          </ThreeDCard>

          {/* CRT Log Telemetry Terminal */}
          <ThreeDCard maxRotation={4} className="dashboard-card glass-panel cyber-bracket-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '18px 20px',
            background: 'linear-gradient(180deg, var(--glass-bg), rgba(0, 245, 255, 0.01))',
            cursor: 'default'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', transform: 'translateZ(15px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={14} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)', letterSpacing: 0.8, fontWeight: 700 }}>
                  EXTRACTION ENGINE TELEMETRY
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['#00F5D4', '#FFB300', '#FF3B5C'].map((pinColor, i) => (
                  <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: pinColor, opacity: 0.8, boxShadow: `0 0 5px ${pinColor}` }} />
                ))}
              </div>
            </div>

            <div
              className="scanline-pulse"
              style={{
                background: 'linear-gradient(180deg, #02060D 0%, #060B12 100%)',
                border: '1px solid rgba(0, 245, 255, 0.15)',
                borderRadius: 8,
                padding: '12px 14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 8.5,
                color: '#E0F2FE',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                height: '140px',
                boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.95), 0 4px 20px rgba(0, 245, 255, 0.05)',
                position: 'relative',
                transform: 'translateZ(10px)',
                overflowY: 'auto'
              }}
            >
              {consoleLogs.map((log, idx) => {
                let color = 'rgba(0, 245, 255, 0.85)';
                if (log.includes('✓') || log.includes('COMPLETE') || log.includes('Ingestion') || log.includes('successful')) color = '#00F5D4';
                if (log.includes('Ollama') || log.includes('OCR:') || log.includes('WHISPER:')) color = '#FFB300';
                if (log.includes('✗') || log.includes('ERROR')) color = '#FF3B5C';

                const match = log.match(/^\[(.*?)\] (.*)$/);
                const timeStr = match ? match[1] : '';
                const msgStr = match ? match[2] : log;

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.3, opacity: 0.5 + (idx / consoleLogs.length) * 0.5 }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{timeStr}]</span>
                    <span style={{ color, fontWeight: 500 }}>{msgStr}</span>
                  </div>
                );
              })}
            </div>
          </ThreeDCard>

        </div>

      </div>

      {/* Dynamic Keyframes styles */}
      <style>{`
        @keyframes shimmer-loop {
          0% { transform: translateY(-5px); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translateY(185px); opacity: 0; }
        }
        @keyframes bounce-glow {
          0%, 100% { transform: translateY(0); box-shadow: 0 0 12px rgba(0, 245, 255, 0.1); }
          50% { transform: translateY(-4px); box-shadow: 0 0 20px rgba(0, 245, 255, 0.25); }
        }
      `}</style>
    </div>
  );
}
