import type { DocumentInfo } from '../lib/types';
import { useEffect, useState } from 'react';
import { getDocuments, deleteDocument } from '../lib/api';
import FileCard from '../components/FileCard';
import { RefreshCw, Loader } from 'lucide-react';

export default function Documents() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getDocuments()
      .then(d => { setDocs(d.documents); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    load();
  };

  return (
    <div style={{ padding: 28, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-cyan)', letterSpacing: 1.8, marginBottom: 4, fontWeight: 700 }}>
            ▸ KNOWLEDGE VAULT
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
            Document Registry
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
            {docs.length} active node{docs.length !== 1 ? 's' : ''} stored inside the local index.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', color: 'var(--text-secondary)',
            fontSize: 12.5, fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
            transition: 'all 0.2s ease', fontWeight: 700,
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-cyan)';
            e.currentTarget.style.color = 'var(--accent-cyan)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 245, 255, 0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <RefreshCw size={13} />
          Refresh Registry
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, gap: 12, borderRadius: 12, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
          <Loader size={20} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--text-secondary)', letterSpacing: 1.2, fontWeight: 700 }}>
            AUDITING INDEX STORAGE...
          </span>
        </div>
      ) : docs.length === 0 ? (
        <div className="glass-panel" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 260, gap: 14, textAlign: 'center',
          borderRadius: 12, padding: 24,
          background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)'
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--amber-bg)', border: '1px solid var(--amber-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 4, boxShadow: '0 0 16px rgba(255, 159, 28, 0.08)'
          }}>
            <span style={{ fontSize: 18, color: 'var(--accent-gold)' }}>⚠</span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit' }}>No Active Documents</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 300, lineHeight: 1.5, fontWeight: 500 }}>
            Ingest files to load knowledge records into the local database sandbox.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {docs.map(doc => (
            <FileCard key={doc.file_id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
