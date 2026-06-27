import type { DocumentInfo } from '../lib/types';
import { FileText, Image, Mic, File, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ThreeDCard from './ThreeDCard';

interface Props {
  doc: DocumentInfo;
  onDelete: (id: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  image: Image,
  audio: Mic,
};

const modalityColor: Record<string, string> = {
  pdf: 'var(--accent-cyan)',
  docx: 'var(--accent-teal)',
  txt: 'var(--accent-gold)',
  image: 'var(--accent-violet)',
  audio: 'var(--accent-green)',
};

export default function FileCard({ doc, onDelete }: Props) {
  const Icon = iconMap[doc.modality] ?? File;
  const color = modalityColor[doc.modality] ?? 'var(--text-secondary)';
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (confirming) {
      onDelete(doc.file_id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <ThreeDCard
      className={`glass-panel ${confirming ? 'hazard-strip-delete' : ''}`}
      style={{
        background: confirming ? 'transparent' : hovered ? 'var(--bg-hover)' : 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${confirming ? 'var(--accent-red)' : hovered ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'default',
      }}
      maxRotation={6}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
          background: 'var(--bg-surface)',
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
          transform: 'translateZ(15px)'
        }}>
          <Icon size={18} color={color} style={{ filter: hovered ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
        </div>
        <div style={{ minWidth: 0, flex: 1, transform: 'translateZ(10px)' }}>
          <div style={{
            fontSize: 14,
            color: 'var(--text-primary)',
            fontWeight: 700,
            lineHeight: 1.3,
            fontFamily: 'Outfit, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }} title={doc.filename}>
            {doc.filename}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 0.8,
            color, background: `${color}12`, border: `1px solid ${color}25`,
            borderRadius: 4, padding: '2px 8px', fontWeight: 700
          }}>
            {doc.modality.toUpperCase()}
          </div>
        </div>
      </div>

      <button
        onClick={handleDelete}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${confirming ? 'var(--accent-red)' : 'var(--border)'}`,
          background: confirming ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
          color: confirming ? 'var(--accent-red)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 11.5,
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 700,
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: confirming ? '0 0 12px rgba(239, 68, 68, 0.1)' : 'var(--shadow-sm)',
          transform: 'translateZ(18px)'
        }}
        onMouseEnter={e => {
          if (!confirming) {
            e.currentTarget.style.borderColor = 'var(--accent-red)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'var(--accent-red)';
          }
        }}
        onMouseLeave={e => {
          if (!confirming) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }
        }}
      >
        <Trash2 size={13} />
        {confirming ? 'CONFIRM' : 'DELETE'}
      </button>
    </ThreeDCard>
  );
}
