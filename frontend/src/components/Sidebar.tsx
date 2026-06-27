import type { ModelLoadedStatus } from '../lib/types';
import { useEffect, useRef } from 'react';
import { LayoutDashboard, Upload, MessageSquare, FileText, Sun, Moon, GitBranch, Sparkles } from 'lucide-react';

interface Props {
  currentPage: string;
  onNavigate: (p: string) => void;
  modelStatus?: ModelLoadedStatus;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const links = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Executive stats' },
  { id: 'chat', icon: MessageSquare, label: 'Query analyst' },
  { id: 'upload', icon: Upload, label: 'Ingest intelligence' },
  { id: 'documents', icon: FileText, label: 'Knowledge vault' },
  { id: 'graph', icon: GitBranch, label: 'Research network' },
  { id: 'analyst', icon: Sparkles, label: 'Research Analyst' },
];

function AnimatedLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Array<{ x: number; y: number; z: number; ox: number; oy: number }> = [];
    const particleCount = 12;
    let angle = 0;

    // Distribute particles evenly on a spherical surface
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 8; // Sphere radius
      particles.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        ox: 0,
        oy: 0,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      angle += 0.012;
      const cosY = Math.cos(angle);
      const sinY = Math.sin(angle);
      const cosX = Math.cos(angle * 0.5);
      const sinX = Math.sin(angle * 0.5);

      // Rotate coordinates in 3D and project to 2D
      particles.forEach(p => {
        // Rotate around Y-axis
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        // Rotate around X-axis
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        // Project with perspective depth scaling
        const focalLength = 30;
        const scale = focalLength / (focalLength + z2);
        p.ox = canvas.width / 2 + x1 * scale;
        p.oy = canvas.height / 2 + y2 * scale;
      });

      // Draw wireframe links between neighbors
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.16)';
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].ox - particles[j].ox;
          const dy = particles[i].oy - particles[j].oy;
          const dist = Math.hypot(dx, dy);
          if (dist < 11) {
            ctx.beginPath();
            ctx.moveTo(particles[i].ox, particles[i].oy);
            ctx.lineTo(particles[j].ox, particles[j].oy);
            ctx.stroke();
          }
        }
      }

      // Draw particle points
      particles.forEach(p => {
        ctx.fillStyle = '#00F5FF';
        ctx.shadowColor = '#00F5FF';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(p.ox, p.oy, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={28}
      height={28}
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(0, 245, 255, 0.04)', border: '1px solid rgba(0, 245, 255, 0.15)'
      }}
    />
  );
}

export default function Sidebar({ currentPage, onNavigate, modelStatus, theme, onToggleTheme }: Props) {
  const online = !!modelStatus;
  return (
    <aside style={{
      width: 240, background: 'var(--navy)', borderRight: '1px solid var(--navy-border)',
      display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0,
      boxShadow: 'var(--shadow-md)', position: 'relative', zIndex: 20
    }}>

      {/* Logo Section */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--navy-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AnimatedLogo />
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: '#fff' }}>
            <span>Intelli</span>
            <span style={{ color: 'var(--accent-cyan)', fontStyle: 'italic' }}>Mesh</span>
          </div>
        </div>
        <div className="logo-badge" style={{
          display: 'inline-flex',
          width: 'fit-content',
          background: 'rgba(0, 245, 255, 0.05)',
          border: '1px solid rgba(0, 245, 255, 0.15)',
          color: 'var(--accent-cyan)',
          boxShadow: '0 0 10px rgba(0, 245, 255, 0.05)'
        }}>
          <span className="telemetry-dot active" style={{ width: 6, height: 6, marginRight: 5 }} />
          air-gapped · secure
        </div>
      </div>

      {/* Nav Section */}
      <nav style={{ flex: 1, padding: '20px 10px', overflowY: 'auto' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--navy-muted)',
          letterSpacing: 1.8, textTransform: 'uppercase', padding: '0 12px', margin: '0 0 12px',
          fontWeight: 700
        }}>
          ANALYTICS SYSTEM
        </div>
        {links.map(({ id, icon: Icon, label }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`nav-item ${active ? 'active' : ''}`}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 14px', borderRadius: 8, border: '1px solid transparent', cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, var(--navy-active), rgba(0, 245, 255, 0.03))' : 'transparent',
                borderColor: active ? 'rgba(0, 245, 255, 0.12)' : 'transparent',
                color: active ? '#fff' : 'var(--navy-muted)',
                fontSize: 13.5, fontWeight: active ? 600 : 500,
                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', marginBottom: 4,
                boxShadow: active ? '0 4px 12px rgba(0, 245, 255, 0.04)' : 'none'
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--navy-hover)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.02)';
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--navy-muted)';
                  e.currentTarget.style.borderColor = 'transparent';
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) icon.style.color = 'var(--navy-muted)';
                }
              }}
            >
              <div className="nav-item-icon-container">
                <Icon
                  size={14}
                  color={active ? 'var(--accent-cyan)' : 'var(--navy-muted)'}
                  style={{ transition: 'color 0.2s ease', filter: active ? 'drop-shadow(0 0 6px var(--accent-cyan))' : 'none' }}
                />
              </div>
              <span style={{ transform: 'translateZ(10px)' }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle Section */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--navy-border)' }}>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--navy-border)',
            background: 'var(--navy-subtle)', cursor: 'pointer',
            color: 'var(--navy-muted)', fontSize: 12.5,
            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--navy-hover)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = theme === 'dark' ? 'var(--accent-gold)' : 'var(--accent-cyan)';
            e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 10px rgba(255, 159, 28, 0.1)' : '0 0 10px rgba(0, 245, 255, 0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--navy-subtle)';
            e.currentTarget.style.color = 'var(--navy-muted)';
            e.currentTarget.style.borderColor = 'var(--navy-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {theme === 'dark'
            ? <Sun size={13} color="var(--accent-gold)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-gold))' }} />
            : <Moon size={13} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 4px var(--accent-cyan))' }} />
          }
          <span style={{ fontSize: 11.5, letterSpacing: 0.3, fontWeight: 600 }}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>
      </div>

      {/* System Status Section */}
      <div style={{ padding: '18px 20px', borderTop: '1px solid var(--navy-border)' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--navy-muted)',
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700
        }}>
          SYSTEM TELEMETRY
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 4,
            fontSize: 9, fontFamily: 'JetBrains Mono', border: '1px solid rgba(16, 185, 129, 0.15)',
            background: 'rgba(16, 185, 129, 0.04)', color: '#10B981', fontWeight: 600
          }}>
            <span className="telemetry-dot active" style={{ width: 5, height: 5 }} />
            {online ? 'ONLINE' : 'SECURE'}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 4,
            fontSize: 9, fontFamily: 'JetBrains Mono', border: '1px solid rgba(0, 245, 255, 0.15)',
            background: 'rgba(0, 245, 255, 0.04)', color: 'var(--accent-cyan)', fontWeight: 600
          }}>
            <span className="telemetry-dot active" style={{ width: 5, height: 5, backgroundColor: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)' }} />
            OLLAMA
          </span>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--navy-muted)', letterSpacing: 0.3, fontWeight: 500 }}>
          LOCAL SECURE COMPILING
        </div>
      </div>
    </aside>
  );
}
