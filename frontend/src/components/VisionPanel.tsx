import { useEffect, useState } from 'react';
import axios from 'axios';

export default function VisionPanel({ imageFile }: { imageFile: File }) {
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fd = new FormData();
    fd.append('image', imageFile);
    axios.post('http://localhost:8000/api/image/analyze', fd)
      .then(r => { setDesc(r.data.description); setLoading(false); })
      .catch(() => { setDesc('Vision analysis unavailable.'); setLoading(false); });
  }, [imageFile]);

  return (
    <div style={{
      marginTop: 8, padding: '10px 14px',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent-cyan)', borderRadius: '0 6px 6px 0',
      fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-cyan)', marginBottom: 6 }}>
        ◆ AI VISION ANALYSIS
      </div>
      {loading ? (
        <span style={{ color: 'var(--accent-amber)' }}>Analyzing image…</span>
      ) : (
        <p style={{ margin: 0 }}>{desc}</p>
      )}
    </div>
  );
}
