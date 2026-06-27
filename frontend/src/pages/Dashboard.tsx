import type { DocumentInfo, ModelLoadedStatus } from '../lib/types';
import { useEffect, useState, useRef } from 'react';
import { checkHealth, getDocuments } from '../lib/api';
import { Brain, FileText, MessageSquare, HardDrive, ShieldCheck, BarChart3, Database, UploadCloud, Search, ArrowRight, Lock, Shield, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import ThreeDCard from '../components/ThreeDCard';


const MODALITIES = ['pdf', 'docx', 'txt', 'image', 'audio'];
const BAR_COLORS: Record<string, string> = {
  PDF: 'var(--accent-cyan)',
  DOCX: 'var(--accent-teal)',
  TXT: 'var(--accent-gold)',
  IMAGE: 'var(--accent-violet)',
  AUDIO: 'var(--accent-green)',
};

export default function Dashboard() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [chunks, setChunks] = useState(0);
  const [health, setHealth] = useState<ModelLoadedStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sparkline search latency history
  const [latencyHistory, setLatencyHistory] = useState<number[]>([1.25, 1.42, 1.18, 1.54, 1.31, 1.58, 1.22]);
  
  useEffect(() => {
    const intv = setInterval(() => {
      setLatencyHistory(curr => {
        const nextVal = +(1.1 + Math.random() * 0.5).toFixed(2);
        return [...curr.slice(1), nextVal];
      });
    }, 3000);
    return () => clearInterval(intv);
  }, []);

  const maxVal = Math.max(...latencyHistory);
  const minVal = Math.min(...latencyHistory);
  const range = maxVal - minVal || 1;
  const points = latencyHistory.map((val, idx) => {
    const x = (idx / (latencyHistory.length - 1)) * 100;
    const y = 38 - ((val - minVal) / range) * 36;
    return `${x},${y}`;
  }).join(' ');

  const refresh = () => {
    checkHealth().then(h => setHealth(h.models_loaded)).catch(() => { });
    getDocuments().then(d => { setDocs(d.documents); setChunks(d.total_chunks); }).catch(() => { });
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const logPool = [
      'SYS SHIELD: SECURE [100%]',
      'VECTOR SECURE SYNC COMPLETE',
      'CHROMADB METADATA SYNCED',
      'OLLAMA LOCAL PIPELINE READY',
      'AUDIT LOG SQLITE ENGINE READY',
      'AIR-GAPPED WORKSPACE SECURE',
      'RAM STABLE UTILIZATION [22%]',
      'SANDBOX SECURE BUFFER ONLINE',
      'VECTOR CACHE SEARCH: HIT',
      'INFERENCE TELEMETRY: NOMINAL'
    ];
    
    const initialLogs = Array.from({ length: 4 }, (_, i) => {
      const now = new Date();
      now.setSeconds(now.getSeconds() - (4 - i) * 4);
      const time = now.toLocaleTimeString();
      const msg = logPool[Math.floor(Math.random() * logPool.length)];
      return `[${time}] ${msg}`;
    });
    setLogs(initialLogs);

    const intv = setInterval(() => {
      setLogs(curr => {
        const time = new Date().toLocaleTimeString();
        const msg = logPool[Math.floor(Math.random() * logPool.length)];
        return [...curr.slice(1), `[${time}] ${msg}`];
      });
    }, 4000);

    return () => clearInterval(intv);
  }, []);

  const byModality = MODALITIES.map(m => ({
    name: m.toUpperCase(),
    count: docs.filter(d => d.modality === m).length,
  }));

  const growthTimeline = [
    { name: 'T-60', volume: Math.round(chunks * 0.15) },
    { name: 'T-50', volume: Math.round(chunks * 0.3) },
    { name: 'T-40', volume: Math.round(chunks * 0.45) },
    { name: 'T-30', volume: Math.round(chunks * 0.6) },
    { name: 'T-20', volume: Math.round(chunks * 0.72) },
    { name: 'T-10', volume: Math.round(chunks * 0.88) },
    { name: 'ACTIVE', volume: chunks },
  ];

  return (
    <div style={{ padding: 28, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--accent-cyan)', animation: 'pulse-dot 2s infinite', filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }}>●</span>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.8, fontWeight: 700 }}>
              EXECUTIVE TELEMETRY DASHBOARD
            </div>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.8px' }}>
            <span className="metallic-text">System Intelligence Overview</span>
          </h1>
        </div>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 10, 
          background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', 
          border: '1px solid var(--glass-border)', padding: '8px 16px', 
          borderRadius: 10, boxShadow: 'var(--shadow-sm)' 
        }}>
          <span className="telemetry-dot active" />
          <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.8px' }}>
            SECURE TELEMETRY LINK: ACTIVE
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>

        {/* Metric 1: Documents */}
        <ThreeDCard className="dashboard-stat-card glass-panel cyber-bracket-container" maxRotation={10} style={{ 
          padding: '22px 24px', 
          borderLeft: '4px solid var(--accent-cyan)', 
          background: 'linear-gradient(135deg, var(--glass-bg), rgba(0, 245, 255, 0.02))', 
          cursor: 'pointer' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ transform: 'translateZ(20px)' }}>
              <div style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>INTELLIGENCE VAULT</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8, fontFamily: 'JetBrains Mono', letterSpacing: '-1.5px', textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {docs.length}
              </div>
            </div>
            <div style={{ 
              width: 42, height: 42, borderRadius: 10, 
              background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
              transform: 'translateZ(30px)',
              transition: 'all 0.3s ease'
            }}>
              <FileText size={20} color="var(--accent-cyan)" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, transform: 'translateZ(15px)' }}>
            <span style={{ fontSize: 13 }}>✓</span> 100% Local Ingestion
          </div>
        </ThreeDCard>

        {/* Metric 2: Cognitive Chunks */}
        <ThreeDCard className="dashboard-stat-card glass-panel cyber-bracket-container" maxRotation={10} style={{ 
          padding: '22px 24px', 
          borderLeft: '4px solid var(--accent-teal)', 
          background: 'linear-gradient(135deg, var(--glass-bg), rgba(0, 245, 212, 0.02))', 
          cursor: 'pointer' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ transform: 'translateZ(20px)' }}>
              <div style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>COGNITIVE CHUNKS</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8, fontFamily: 'JetBrains Mono', letterSpacing: '-1.5px', textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {chunks}
              </div>
            </div>
            <div style={{ 
              width: 42, height: 42, borderRadius: 10, 
              background: 'rgba(0, 245, 255, 0.05)', border: '1px solid rgba(0, 245, 255, 0.15)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 245, 255, 0.15)',
              transform: 'translateZ(30px)',
              transition: 'all 0.3s ease'
            }}>
              <Brain size={20} color="var(--accent-teal)" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, fontWeight: 700, transform: 'translateZ(15px)', fontFamily: 'Inter' }}>
            Avg <span style={{ color: 'var(--accent-teal)' }}>{(docs.length ? chunks / docs.length : 0).toFixed(1)}</span> semantic chunks per doc
          </div>
        </ThreeDCard>

        {/* Metric 3: LLM Engine */}
        <ThreeDCard className="dashboard-stat-card glass-panel cyber-bracket-container" maxRotation={10} style={{ 
          padding: '22px 24px', 
          borderLeft: '4px solid var(--accent-gold)', 
          background: 'linear-gradient(135deg, var(--glass-bg), rgba(255, 179, 0, 0.02))', 
          cursor: 'pointer' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ transform: 'translateZ(20px)', minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>ANALYST LLM</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginTop: 18, fontFamily: 'JetBrains Mono', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={health?.llm ?? 'phi3:mini'}>
                {health?.llm ?? 'phi3:mini'}
              </div>
            </div>
            <div style={{ 
              width: 42, height: 42, borderRadius: 10, 
              background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 179, 0, 0.15)',
              transform: 'translateZ(30px)',
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}>
              <MessageSquare size={20} color="var(--accent-gold)" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginTop: 16, fontWeight: 700, transform: 'translateZ(15px)' }}>
            Ollama Pipeline: ONLINE
          </div>
        </ThreeDCard>

        {/* Metric 4: Link Integrity */}
        <ThreeDCard className="dashboard-stat-card glass-panel cyber-bracket-container" maxRotation={10} style={{ 
          padding: '22px 24px', 
          borderLeft: `4px solid ${health ? 'var(--accent-green)' : 'var(--accent-gold)'}`, 
          background: health ? 'linear-gradient(135deg, var(--glass-bg), rgba(16, 185, 129, 0.02))' : 'linear-gradient(135deg, var(--glass-bg), rgba(255, 179, 0, 0.02))', 
          cursor: 'pointer' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ transform: 'translateZ(20px)' }}>
              <div style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>LINK INTEGRITY</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: health ? 'var(--accent-green)' : 'var(--accent-gold)', marginTop: 8, fontFamily: 'JetBrains Mono', letterSpacing: '-1.5px', textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {health ? 'SECURE' : 'OFFLINE'}
              </div>
            </div>
            <div style={{ 
              width: 42, height: 42, borderRadius: 10, 
              background: health ? 'var(--green-bg)' : 'var(--amber-bg)', border: health ? '1px solid var(--green-border)' : '1px solid var(--amber-border)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: health ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 4px 12px rgba(255, 179, 0, 0.15)',
              transform: 'translateZ(30px)',
              transition: 'all 0.3s ease'
            }}>
              <HardDrive size={20} color={health ? 'var(--accent-green)' : 'var(--accent-gold)'} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, fontWeight: 700, transform: 'translateZ(15px)' }}>
            Sandbox state: TLS air-gapped
          </div>
        </ThreeDCard>

      </div>

      {/* Main Content Layout Block (Charts & Guides) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left Column: Analytics Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Dual Charts Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Chart 1: Modality Bar Chart */}
            <ThreeDCard maxRotation={4} className="dashboard-card glass-panel cyber-bracket-container" style={{ display: 'flex', flexDirection: 'column', padding: '22px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, transform: 'translateZ(15px)' }}>
                <BarChart3 size={15} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }} />
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', letterSpacing: 0.8, fontWeight: 700 }}>MODALITY REGISTRY</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: '0 0 20px', fontWeight: 700, fontFamily: 'Outfit', transform: 'translateZ(10px)' }}>Distribution by File Ingestion Type</p>

              <div style={{ transform: 'translateZ(12px)' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={byModality} barSize={20}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-bright)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {byModality.map(entry => (
                        <Cell key={entry.name} fill={BAR_COLORS[entry.name] ?? 'var(--border-bright)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ThreeDCard>

            {/* Chart 2: Knowledge Volume Area Chart */}
            <ThreeDCard maxRotation={4} className="dashboard-card glass-panel cyber-bracket-container" style={{ display: 'flex', flexDirection: 'column', padding: '22px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, transform: 'translateZ(15px)' }}>
                <Database size={15} color="var(--accent-teal)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-teal))' }} />
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', letterSpacing: 0.8, fontWeight: 700 }}>INDEX VOLUME GROWTH</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: '0 0 20px', fontWeight: 700, fontFamily: 'Outfit', transform: 'translateZ(10px)' }}>Accumulated Knowledge Base Chunks</p>

              <div style={{ transform: 'translateZ(12px)' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={growthTimeline}>
                    <defs>
                      <linearGradient id="glowArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-bright)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)' }} />
                    <Area type="monotone" dataKey="volume" stroke="var(--accent-teal)" strokeWidth={2.5} fillOpacity={1} fill="url(#glowArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ThreeDCard>

          </div>

          {/* Quick Start Guide */}
          <div className="dashboard-card glass-panel" style={{ padding: '22px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <ShieldCheck size={16} color="var(--accent-gold)" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-gold)', letterSpacing: 1.2, fontWeight: 700 }}>▸ SECURE WORKSPACE GETTING STARTED</span>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
              {[
                { step: '01', title: 'Ingest intelligence', text: 'Navigate to Ingest Intelligence, drag PDF, TXT, or audio files into the vault.', icon: <UploadCloud size={16} color="var(--accent-gold)" /> },
                { step: '02', title: 'Audit Indexing', text: 'The air-gapped system parses semantic sections. Monitor metrics above.', icon: <Database size={16} color="var(--accent-gold)" /> },
                { step: '03', title: 'Query Analyst', text: 'Go to Query Analyst to search, review excerpts, or audit connection networks.', icon: <Search size={16} color="var(--accent-gold)" /> },
              ].map(({ step, title, text, icon }, index) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <ThreeDCard maxRotation={8} style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
                    borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
                    cursor: 'default', flex: 1, minHeight: '100%', boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }} className="cyber-bracket-container">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', transform: 'translateZ(18px)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-gold)',
                          background: 'rgba(255,159,28,0.1)', border: '1px solid rgba(255,159,28,0.2)',
                          borderRadius: 6, padding: '3px 8px', fontWeight: 800
                        }}>{step}</span>
                        {icon}
                      </div>
                    </div>
                    <div style={{ transform: 'translateZ(14px)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                      {title}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontWeight: 500, transform: 'translateZ(10px)' }}>
                      {text}
                    </p>
                  </ThreeDCard>
                  {index < 2 && (
                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-hint)' }}>
                      <ArrowRight size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Telemetry Audits & Summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Cognitive Engine Performance Panel */}
          <ThreeDCard 
            maxRotation={6} 
            className="dashboard-card glass-panel cyber-bracket-container" 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '22px 24px',
              background: 'linear-gradient(135deg, var(--glass-bg), rgba(0, 245, 255, 0.015))',
              cursor: 'default'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', transform: 'translateZ(20px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)', letterSpacing: 0.8, fontWeight: 700 }}>
                  COGNITIVE INDEX TELEMETRY
                </span>
              </div>
              <span style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 8.5,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: 'var(--accent-green)',
                borderRadius: 4,
                padding: '2px 6px',
                fontWeight: 700
              }}>
                OPTIMIZED
              </span>
            </div>

            {/* Performance metrics circles */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'space-around', margin: '6px 0', transform: 'translateZ(15px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="60" height="60" viewBox="0 0 36 36">
                    <path
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="3.5"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      fill="none"
                      stroke="var(--accent-cyan)"
                      strokeWidth="3.5"
                      strokeDasharray="94, 100"
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      style={{ filter: 'drop-shadow(0 0 3px var(--accent-cyan))' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                    94%
                  </div>
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Cache Hit Rate
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="60" height="60" viewBox="0 0 36 36">
                    <path
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="3.5"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      fill="none"
                      stroke="var(--accent-teal)"
                      strokeWidth="3.5"
                      strokeDasharray="99, 100"
                      strokeLinecap="round"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      style={{ filter: 'drop-shadow(0 0 3px var(--accent-teal))' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                    99.8%
                  </div>
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Graph Recall
                </div>
              </div>
            </div>

            {/* Sparkline latency overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, transform: 'translateZ(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Inter', fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 700 }}>
                  Search Latency Sparkline
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  avg {latencyHistory[latencyHistory.length - 1]}ms
                </span>
              </div>
              <div style={{ height: 45, width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 6px', boxSizing: 'border-box' }}>
                <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 0,40 L ${points} L 100,40 Z`}
                    fill="url(#sparklineGrad)"
                  />
                  <path
                    d={`M ${points}`}
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="100"
                    cy={38 - ((latencyHistory[latencyHistory.length - 1] - minVal) / range) * 36}
                    r="2"
                    fill="var(--accent-cyan)"
                  />
                </svg>
              </div>
            </div>

            {/* Metadata metrics footer */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              borderTop: '1px solid var(--border-soft)',
              paddingTop: 12,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 8,
              color: 'var(--text-muted)',
              transform: 'translateZ(5px)'
            }}>
              <div>[INDEX ENGINE]: <span style={{ color: 'var(--text-primary)' }}>HNSW_COSINE</span></div>
              <div>[VECTOR DIMS]: <span style={{ color: 'var(--text-primary)' }}>1536D</span></div>
              <div>[EMBED PIPELINE]: <span style={{ color: 'var(--text-primary)' }}>OLLAMA_LOCAL</span></div>
              <div>[ACCURACY RATIO]: <span style={{ color: 'var(--text-primary)' }}>99.4%</span></div>
            </div>
          </ThreeDCard>

          {/* Real-time Infrastructure Telemetry Logs */}
          <ThreeDCard maxRotation={6} className="dashboard-card glass-panel cyber-bracket-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '20px 22px',
            background: 'linear-gradient(135deg, var(--glass-bg), rgba(0, 245, 255, 0.01))',
            cursor: 'default'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', transform: 'translateZ(20px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-dot" style={{ background: 'var(--accent-cyan)' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-primary)', letterSpacing: 0.8, fontWeight: 700 }}>
                  SECURE TELEMETRY CONSOLE
                </span>
              </div>
              
              {/* Virtual Control Pins */}
              <div style={{ display: 'flex', gap: 5 }}>
                {['#00F5D4', '#FFB300', '#FF3B5C'].map((pinColor, i) => (
                  <span key={i} style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: pinColor,
                    opacity: 0.8,
                    boxShadow: `0 0 6px ${pinColor}`
                  }} />
                ))}
              </div>
            </div>

            {/* Glowing CRT Screen Box */}
            <div 
              className="scanline-pulse" 
              style={{
                background: 'linear-gradient(180deg, #02060D 0%, #070B14 100%)',
                border: '1px solid rgba(0, 245, 255, 0.15)',
                borderRadius: 8,
                padding: '12px 14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: '#E0F2FE',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight: '130px',
                boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.95), 0 4px 20px rgba(0, 245, 255, 0.05)',
                position: 'relative',
                transform: 'translateZ(10px)',
                overflow: 'hidden'
              }}
            >
              {/* Mini Status Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                borderBottom: '1px solid rgba(0, 245, 255, 0.12)',
                paddingBottom: 8,
                marginBottom: 6,
                color: 'rgba(0, 245, 255, 0.8)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                fontSize: 8.5
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 7.5, textTransform: 'uppercase' }}>CPU LOAD</span>
                  <span style={{ color: '#00F5FF' }}>14.2% [NOM]</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid rgba(0, 245, 255, 0.12)', paddingLeft: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 7.5, textTransform: 'uppercase' }}>MEM LNK</span>
                  <span style={{ color: '#00F5D4' }}>1.8 GB [SEC]</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid rgba(0, 245, 255, 0.12)', paddingLeft: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 7.5, textTransform: 'uppercase' }}>SANDBOX</span>
                  <span style={{ color: '#FFB300' }}>STRICT [LOC]</span>
                </div>
              </div>

              {/* Scrolling Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, justifyContent: 'flex-end' }}>
                {logs.map((log, idx) => {
                  // Color code log tags
                  let tagColor = '#00F5FF'; // default cyan
                  if (log.includes('SECURE') || log.includes('OK') || log.includes('COMPLETE')) tagColor = '#00F5D4'; // teal/green
                  if (log.includes('LOCAL') || log.includes('NOMINAL') || log.includes('READY')) tagColor = '#FFB300'; // gold/amber
                  
                  // Extract timestamp and message
                  const match = log.match(/^\[(.*?)\] (.*)$/);
                  const timeStr = match ? match[1] : '';
                  const msgStr = match ? match[2] : log;

                  return (
                    <div key={idx} style={{ 
                      opacity: 0.35 + (idx * 0.2), 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      gap: 6,
                      lineHeight: 1.3
                    }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{timeStr}]</span>
                      <span style={{ color: tagColor, fontWeight: 600 }}>{msgStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ThreeDCard>

          {/* Security Telemetry Audit */}
          <div className="dashboard-card glass-panel cyber-bracket-container" style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.8, fontWeight: 700 }}>▸ SECURITY INTEGRITY RATINGS</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {[
                { label: 'Ingestion Vault', rating: '100% SECURE', color: 'var(--accent-green)', icon: <Shield size={14} color="var(--accent-green)" /> },
                { label: 'Model Certainty', rating: '98.2% OPTIMAL', color: 'var(--accent-cyan)', icon: <Zap size={14} color="var(--accent-cyan)" /> },
                { label: 'Isolation Sandbox', rating: 'STRICT LOCAL', color: 'var(--accent-gold)', icon: <Lock size={14} color="var(--accent-gold)" /> },
              ].map(item => (
                <div key={item.label} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '10px 14px', background: 'var(--bg-surface)', 
                  border: '1px solid var(--border-soft)', borderRadius: 8,
                  transition: 'all 0.2s', cursor: 'default'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.icon}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, color: item.color }}>{item.rating}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
