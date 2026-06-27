import type { ChatMessage } from '../lib/types';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, FileText, Cpu, User } from 'lucide-react';

interface Props { message: ChatMessage; }

export default function ChatMessageComponent({ message }: Props) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      width: '100%',
      padding: '20px 24px',
      animation: 'fade-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      borderBottom: '1px solid var(--border-soft)'
    }}>
      {/* Avatar Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        background: isUser ? 'var(--amber-bg)' : 'var(--blue-bg)',
        border: `1px solid ${isUser ? 'var(--amber-border)' : 'var(--blue-border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isUser ? 'var(--accent-gold)' : 'var(--accent-cyan)',
        boxShadow: isUser ? '0 0 12px rgba(255, 159, 28, 0.05)' : '0 0 12px rgba(0, 245, 255, 0.05)',
      }}>
        {isUser ? <User size={16} /> : <Cpu size={16} />}
      </div>

      {/* Content Area */}
      <div style={{
        maxWidth: '78%',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}>
        {/* Name and Meta */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10.5,
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}>
          <span>{isUser ? 'INTELLIGENCE OPERATOR' : 'INTELLIMESH ANALYST'}</span>
          <span>•</span>
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>

        {/* Text Message Bubble */}
        <div style={{
          padding: '14px 18px',
          fontSize: 14.5,
          lineHeight: 1.65,
          background: isUser ? 'linear-gradient(135deg, rgba(255, 159, 28, 0.05), rgba(255, 159, 28, 0.01))' : 'var(--bg-surface)',
          border: `1px solid ${isUser ? 'var(--amber-border)' : 'var(--border)'}`,
          borderRadius: isUser ? '12px 0px 12px 12px' : '0px 12px 12px 12px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
        }}>
          <div className="chat-markdown">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* Evidence Sources Section */}
        {message.sources && message.sources.length > 0 && (
          <div style={{ marginTop: 6, width: '100%' }}>
            <button
              onClick={() => setShowSources(!showSources)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: 'var(--accent-teal)',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '4px 14px',
                letterSpacing: 0.6,
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-teal)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 245, 212, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {showSources ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              <span>{message.sources.length} SOURCES AUDITED</span>
            </button>

            {showSources && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 10,
                width: '100%',
                maxWidth: 620,
              }}>
                {message.sources.map((s, i) => {
                  const matchPercentage = Math.round(s.score * 100);
                  return (
                    <div key={i} className="glass-panel" style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      borderLeft: '4px solid var(--accent-cyan)',
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(12px)',
                      borderTop: '1px solid var(--glass-border)',
                      borderRight: '1px solid var(--glass-border)',
                      borderBottom: '1px solid var(--glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      animation: 'fade-up 0.2s ease',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={13} color="var(--accent-cyan)" />
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: 'var(--text-primary)',
                            fontWeight: 700
                          }}>
                            {s.metadata?.filename || 'Unnamed Source'}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 10,
                          color: matchPercentage > 80 ? 'var(--status-ok)' : 'var(--accent-gold)',
                          fontWeight: 700
                        }}>
                          {matchPercentage}% CONFIDENCE
                        </span>
                      </div>

                      {/* Matching Bar */}
                      <div style={{
                        width: '100%',
                        height: 3,
                        background: 'var(--border-soft)',
                        borderRadius: 1.5,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${matchPercentage}%`,
                          height: '100%',
                          background: 'var(--accent-cyan)',
                          boxShadow: '0 0 6px var(--accent-cyan)'
                        }} />
                      </div>

                      <p style={{
                        fontSize: 12.5,
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.55,
                        fontStyle: 'italic',
                        background: 'var(--navy-subtle)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--navy-border)',
                        fontWeight: 500
                      }}>
                        "{s.document.slice(0, 280)}{s.document.length > 280 ? '...' : ''}"
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
