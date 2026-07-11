import type { ModelLoadedStatus } from '../lib/types';

interface Props { status?: ModelLoadedStatus; }

export default function StatusBar({ status }: Props) {
  const pill = (label: string, ok: boolean) => (
    <span key={label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 3,
      border: `1px solid ${ok ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
      background: ok ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
      fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: 0.5,
      color: ok ? 'var(--accent-green)' : 'var(--text-secondary)',
    }}>
      <span className={`telemetry-dot ${ok ? 'active' : 'offline'}`} />
      {label}
    </span>
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 20px', background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)', flexShrink: 0,
    }}>
      {pill(status?.embedder ? 'EMBEDDER: SentenceTransformer all-MiniLM-L6-v2' : 'EMBEDDER', !!status?.embedder)}
      {pill(status?.llm ?? 'LLM', !!status?.llm)}
      {pill('WHISPER', !!status?.whisper)}
      {pill('OCR', true)}
      <span style={{
        marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: 10,
        color: 'var(--text-muted)', letterSpacing: 0.3,
      }}>
        IntelliMesh v1.0 · Local Inference · Air-Gapped
      </span>
    </div>
  );
}
