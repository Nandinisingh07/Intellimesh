import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface DataStream {
  x: number;
  y: number;
  speed: number;
  chars: string[];
}

export default function FloatingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const dpr = window.devicePixelRatio;
    const isDark = true; // Hardcoded default dark intelligence style

    // Initialize particles
    const particleCount = 35;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25 * dpr,
        vy: (Math.random() - 0.5) * 0.25 * dpr,
        radius: (Math.random() * 1.5 + 0.8) * dpr,
      });
    }

    // Initialize data streams (hex/binary columns)
    const streamCount = 20;
    const streams: DataStream[] = [];
    const hexChars = '0123456789ABCDEF//::RAG-INDEX';
    for (let i = 0; i < streamCount; i++) {
      const x = Math.random() * canvas.width;
      const charsList: string[] = [];
      const len = Math.floor(Math.random() * 8) + 4;
      for (let j = 0; j < len; j++) {
        charsList.push(hexChars[Math.floor(Math.random() * hexChars.length)]);
      }
      streams.push({
        x,
        y: Math.random() * -canvas.height,
        speed: (Math.random() * 0.5 + 0.3) * dpr,
        chars: charsList,
      });
    }

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.015)';
      ctx.lineWidth = 0.5 * dpr;

      const gridSize = 60 * dpr;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw faint background grid
      drawGrid();

      // ── Draw Data Streams ──────────────────────────────────────────────────
      ctx.font = `${8 * dpr}px JetBrains Mono, monospace`;
      streams.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) {
          s.y = -100 * dpr;
          s.x = Math.random() * canvas.width;
        }

        s.chars.forEach((c, idx) => {
          const py = s.y + idx * 12 * dpr;
          if (py < 0 || py > canvas.height) return;
          const alpha = Math.max(0, 0.018 - (idx / s.chars.length) * 0.018);
          ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
          ctx.fillText(c, s.x, py);
        });

        // Randomly mutate characters
        if (Math.random() < 0.05) {
          const mutateIdx = Math.floor(Math.random() * s.chars.length);
          s.chars[mutateIdx] = hexChars[Math.floor(Math.random() * hexChars.length)];
        }
      });

      // ── Draw Drifting Particles ──────────────────────────────────────────────
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        // Boundaries check
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw particle
        ctx.fillStyle = isDark ? 'rgba(0, 245, 255, 0.12)' : 'rgba(8, 145, 178, 0.08)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Connect near particles
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          const maxDist = 120 * dpr;
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.06;
            ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
            ctx.lineWidth = 0.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
