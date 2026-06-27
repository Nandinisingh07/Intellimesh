import { useEffect, useRef, useState } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  colorType: 'cyan' | 'teal' | 'gold' | 'violet';
  baseColor: string;
  pulse: number;
}

interface Neighbor {
  idx: number;
  similarity: number;
}

export default function QuantumCore3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const hoverRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  // Speed and rotation tracking
  const angleXRef = useRef(0.005);
  const angleYRef = useRef(0.01);
  const angleZRef = useRef(0.003);

  // Real-time telemetry readouts
  const [telemetry, setTelemetry] = useState({
    fps: 60,
    temp: 34.2,
    nodes: 1024,
    latency: 1.4,
    sync: 'LNK_ACTV'
  });

  // Query Simulation states
  const queryIndexRef = useRef<number>(-1);
  const queryProgressRef = useRef<number>(0);
  const queryNeighborsRef = useRef<Neighbor[]>([]);
  const queryTimerRef = useRef<number>(0);

  // Generate nodes representing high-dimensional vector clusters
  const [points] = useState<Point3D[]>(() => {
    const pts: Point3D[] = [];
    const nodeCount = 45;
    
    for (let i = 0; i < nodeCount; i++) {
      // Generate points scattered in a sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 40 + Math.random() * 25; // sphere radius

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const colorTypes: ('cyan' | 'teal' | 'gold' | 'violet')[] = ['cyan', 'teal', 'gold', 'violet'];
      const colorType = colorTypes[Math.floor(Math.random() * colorTypes.length)];

      pts.push({
        x,
        y,
        z,
        colorType,
        baseColor: '#00F5FF',
        pulse: Math.random() * Math.PI
      });
    }
    return pts;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width ?? 300) * window.devicePixelRatio;
      canvas.height = 180 * window.devicePixelRatio;
      canvas.style.width = '100%';
      canvas.style.height = '180px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let curAngleX = 0;
    let curAngleY = 0;
    let curAngleZ = 0;

    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    // Helper to get CSS theme colors
    const getThemeColor = (name: string, fallback: string) => {
      if (typeof window === 'undefined') return fallback;
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || fallback;
    };

    const render = (time: number) => {
      const dt = time - lastFrameTime;
      lastFrameTime = time;

      // Update FPS and telemetry values
      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 1000) {
        setTelemetry(prev => ({
          ...prev,
          fps: frameCount,
          temp: +(34.0 + Math.random() * 0.8).toFixed(1),
          latency: +(1.2 + Math.random() * 0.4).toFixed(1)
        }));
        frameCount = 0;
        fpsTimer = 0;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const dpr = window.devicePixelRatio;

      // Retrieve dynamic theme variables
      const cyanColor = getThemeColor('--accent-cyan', '#00F5FF');
      const tealColor = getThemeColor('--accent-teal', '#00F5D4');
      const goldColor = getThemeColor('--accent-gold', '#FF9F1C');
      const violetColor = getThemeColor('--accent-violet', '#A855F7');
      const textPrimary = getThemeColor('--text-primary', '#F8FAFC');

      const colorMap = {
        cyan: cyanColor,
        teal: tealColor,
        gold: goldColor,
        violet: violetColor
      };

      // Speed transitions based on hover state
      const targetSpeedX = hoverRef.current ? 0.015 : 0.003;
      const targetSpeedY = hoverRef.current ? 0.022 : 0.005;
      const targetSpeedZ = hoverRef.current ? 0.010 : 0.002;

      angleXRef.current += (targetSpeedX - angleXRef.current) * 0.1;
      angleYRef.current += (targetSpeedY - angleYRef.current) * 0.1;
      angleZRef.current += (targetSpeedZ - angleZRef.current) * 0.1;

      curAngleX += angleXRef.current;
      curAngleY += angleYRef.current;
      curAngleZ += angleZRef.current;

      const cosX = Math.cos(curAngleX);
      const sinX = Math.sin(curAngleX);
      const cosY = Math.cos(curAngleY);
      const sinY = Math.sin(curAngleY);
      const cosZ = Math.cos(curAngleZ);
      const sinZ = Math.sin(curAngleZ);

      // Rotate point helper
      const rotatePoint = (x: number, y: number, z: number) => {
        // Rotate X
        let y1 = y * cosX - z * sinX;
        let z1 = z * cosX + y * sinX;

        // Rotate Y
        let x2 = x * cosY - z1 * sinY;
        let z2 = z1 * cosY + x * sinY;

        // Rotate Z
        let x3 = x2 * cosZ - y1 * sinZ;
        let y3 = y1 * cosZ + x2 * sinZ;

        return { x: x3, y: y3, z: z2 };
      };

      // --- Query Search Timer Logic ---
      queryTimerRef.current += dt;
      if (queryTimerRef.current >= 4500) {
        queryTimerRef.current = 0;
        // Trigger a new query simulation
        const qIdx = Math.floor(Math.random() * points.length);
        queryIndexRef.current = qIdx;
        queryProgressRef.current = 0;

        // Calculate nearest neighbors in 3D space
        const qNode = points[qIdx];
        const dists = points.map((p, idx) => {
          if (idx === qIdx) return { idx, dist: Infinity };
          const dx = p.x - qNode.x;
          const dy = p.y - qNode.y;
          const dz = p.z - qNode.z;
          return { idx, dist: Math.sqrt(dx*dx + dy*dy + dz*dz) };
        });
        dists.sort((a, b) => a.dist - b.dist);
        queryNeighborsRef.current = dists.slice(0, 4).map(d => ({
          idx: d.idx,
          similarity: +(0.88 + Math.random() * 0.11).toFixed(3)
        }));
      }

      if (queryIndexRef.current !== -1) {
        // Increment search simulation progress
        queryProgressRef.current += dt / 1500;
        if (queryProgressRef.current >= 1.0) {
          queryIndexRef.current = -1;
        }
      }

      // --- Draw Radar Grid Lines (Concentric HUD Circles) ---
      ctx.strokeStyle = `${cyanColor}0b`;
      ctx.lineWidth = 0.8 * dpr;
      for (let rFactor = 0.4; rFactor <= 1.0; rFactor += 0.3) {
        ctx.beginPath();
        ctx.arc(cx, cy, 65 * rFactor * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw vertical and horizontal dashed radar lines
      ctx.strokeStyle = `${cyanColor}06`;
      ctx.setLineDash([2 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.moveTo(cx - 75 * dpr, cy);
      ctx.lineTo(cx + 75 * dpr, cy);
      ctx.moveTo(cx, cy - 75 * dpr);
      ctx.lineTo(cx, cy + 75 * dpr);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // --- Draw Gyroscopic Outer Orthogonal Rings ---
      ctx.lineWidth = 0.5 * dpr;
      ctx.strokeStyle = `${cyanColor}1d`;
      const numRingPoints = 45;
      const ringRadius = 75;

      const drawGyroRing = (rotateRingFn: (angle: number) => { x: number, y: number, z: number }) => {
        ctx.beginPath();
        for (let i = 0; i <= numRingPoints; i++) {
          const theta = (i / numRingPoints) * Math.PI * 2;
          const localPt = rotateRingFn(theta);
          const rotPt = rotatePoint(localPt.x, localPt.y, localPt.z);
          
          const cameraDistance = 200;
          const scale = cameraDistance / (cameraDistance + rotPt.z);
          const px = cx + rotPt.x * scale * dpr * 1.5;
          const py = cy + rotPt.y * scale * dpr * 1.25;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };

      // Equator Ring
      drawGyroRing((t) => ({ x: ringRadius * Math.cos(t), y: 0, z: ringRadius * Math.sin(t) }));
      // Meridian Ring (rotated slightly differently)
      drawGyroRing((t) => ({ x: 0, y: ringRadius * Math.cos(t), z: ringRadius * Math.sin(t) }));

      // --- Project and Process Nodes ---
      const projected = points.map((p, idx) => {
        let rot = rotatePoint(p.x, p.y, p.z);

        const cameraDistance = 200;
        const scale = cameraDistance / (cameraDistance + rot.z);
        let px = cx + rot.x * scale * dpr * 1.5;
        let py = cy + rot.y * scale * dpr * 1.25;

        // Apply interactive magnetic drag field (pull nodes slightly toward cursor)
        if (mouseRef.current.active) {
          const mouseDx = mouseRef.current.x * dpr;
          const mouseDy = mouseRef.current.y * dpr;
          const dx = mouseDx - (px - cx);
          const dy = mouseDy - (py - cy);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 60 * dpr) {
            const pullFactor = (1 - dist / (60 * dpr)) * 6 * dpr;
            px += (dx / dist) * pullFactor;
            py += (dy / dist) * pullFactor;
          }
        }

        p.pulse += 0.04;

        return {
          px,
          py,
          scale,
          color: colorMap[p.colorType],
          depth: rot.z,
          idx,
          pulse: p.pulse,
          baseNode: p
        };
      });

      // --- Draw Network Mesh Lines ---
      ctx.lineWidth = 0.45 * dpr;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].px - projected[j].px;
          const dy = projected[i].py - projected[j].py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const maxDist = 45 * dpr * (projected[i].scale + projected[j].scale) / 2;
          if (dist < maxDist) {
            let opacity = (1 - dist / maxDist) * 0.12 * projected[i].scale;
            let strokeColor = cyanColor;

            // Check if this connection is part of the active search query
            const isQueryActive = queryIndexRef.current !== -1;
            if (isQueryActive) {
              const isQNodeI = projected[i].idx === queryIndexRef.current;
              const isQNodeJ = projected[j].idx === queryIndexRef.current;
              const isNeighborI = queryNeighborsRef.current.some(n => n.idx === projected[i].idx);
              const isNeighborJ = queryNeighborsRef.current.some(n => n.idx === projected[j].idx);

              if ((isQNodeI && isNeighborJ) || (isQNodeJ && isNeighborI)) {
                const threshold = 0.2;
                if (queryProgressRef.current > threshold) {
                  const pulseAge = (queryProgressRef.current - threshold) / (1 - threshold);
                  opacity = (1 - dist / maxDist) * 0.65 * (1 - Math.abs(pulseAge - 0.5) * 2);
                  strokeColor = tealColor;

                  // Draw running particle pulse along active search line
                  ctx.fillStyle = textPrimary;
                  const ratio = Math.max(0, Math.min(1, pulseAge * 1.3));
                  const startNode = isQNodeI ? projected[i] : projected[j];
                  const endNode = isQNodeI ? projected[j] : projected[i];
                  const pulseX = startNode.px + (endNode.px - startNode.px) * ratio;
                  const pulseY = startNode.py + (endNode.py - startNode.py) * ratio;
                  
                  ctx.beginPath();
                  ctx.arc(pulseX, pulseY, 2.2 * dpr, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }

            ctx.strokeStyle = `rgba(${parseColorToRgb(strokeColor)}, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].px, projected[i].py);
            ctx.lineTo(projected[j].px, projected[j].py);
            ctx.stroke();
          }
        }
      }

      // --- Draw Nodes sorted by depth (back to front) ---
      projected.sort((a, b) => b.depth - a.depth);
      projected.forEach(p => {
        let size = Math.max(1, 3.2 * p.scale * dpr);
        let glow = size * 2.8;
        let finalColor = p.color;
        let isNearestNeighbor = false;
        let neighborSim = 0;

        const isQueryActive = queryIndexRef.current !== -1;
        const isQueryNode = isQueryActive && p.idx === queryIndexRef.current;

        if (isQueryActive && !isQueryNode) {
          const match = queryNeighborsRef.current.find(n => n.idx === p.idx);
          if (match) {
            isNearestNeighbor = true;
            neighborSim = match.similarity;
          }
        }

        // Query Node effects
        if (isQueryNode) {
          size *= 1.8;
          glow = size * 3.5;
          finalColor = '#FFFFFF';

          // Draw expanding wave rings
          const waveRadiusMax = 65 * dpr * p.scale;
          const waveRadius = queryProgressRef.current * waveRadiusMax;
          const waveOpacity = 0.5 * (1 - queryProgressRef.current);
          
          ctx.strokeStyle = `rgba(${parseColorToRgb(tealColor)}, ${waveOpacity})`;
          ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath();
          ctx.arc(p.px, p.py, waveRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(${parseColorToRgb(cyanColor)}, ${waveOpacity * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.px, p.py, waveRadius * 0.7, 0, Math.PI * 2);
          ctx.stroke();
        } 
        // Nearest Neighbors effects
        else if (isNearestNeighbor) {
          const threshold = 0.25;
          if (queryProgressRef.current > threshold) {
            const scaleUp = Math.min(1.5, 1.0 + (queryProgressRef.current - threshold) * 1.5);
            size *= scaleUp;
            glow = size * 4.0;
            finalColor = tealColor;

            // Render Floating Similarity Tag
            const progress = (queryProgressRef.current - threshold) / (1 - threshold);
            const fade = Math.max(0, 1.0 - progress);
            const driftY = progress * 16 * dpr;
            
            ctx.font = `bold ${Math.round(8.5 * dpr)}px JetBrains Mono, monospace`;
            ctx.fillStyle = `rgba(${parseColorToRgb(tealColor)}, ${fade})`;
            ctx.textAlign = 'center';
            ctx.fillText(`sim:${neighborSim.toFixed(3)}`, p.px, p.py - size - 4 * dpr - driftY);
          }
        }

        // Draw radial glow
        const grad = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, glow);
        grad.addColorStop(0, finalColor);
        grad.addColorStop(0.35, `rgba(${parseColorToRgb(finalColor)}, 0.25)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.px, p.py, glow, 0, Math.PI * 2);
        ctx.fill();

        // Draw solid center node
        ctx.fillStyle = isQueryNode ? '#FFFFFF' : `rgba(255, 255, 255, ${0.75 + Math.sin(p.pulse) * 0.2})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Draw Interactive Mouse HUD Tracker ---
      if (mouseRef.current.active) {
        const mouseX = mouseRef.current.x * dpr + cx;
        const mouseY = mouseRef.current.y * dpr + cy;

        ctx.strokeStyle = `rgba(${parseColorToRgb(cyanColor)}, 0.3)`;
        ctx.lineWidth = 0.55 * dpr;

        ctx.beginPath();
        ctx.moveTo(mouseX - 8 * dpr, mouseY);
        ctx.lineTo(mouseX + 8 * dpr, mouseY);
        ctx.moveTo(mouseX, mouseY - 8 * dpr);
        ctx.lineTo(mouseX, mouseY + 8 * dpr);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 4.5 * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    // Helper: Parse any color format (Hex, RGB, RGBA) to RGB csv format
    function parseColorToRgb(colorStr: string): string {
      const color = colorStr.trim();
      if (color.startsWith('rgb')) {
        const match = color.match(/\d+\s*,\s*\d+\s*,\s*\d+/);
        return match ? match[0] : '0,245,255';
      }
      let hex = color.replace('#', '');
      if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
      }
      if (hex.length !== 6) return '0,245,255';
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r},${g},${b}`;
    }

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [points]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    mouseRef.current = { x, y, active: true };
  };

  const handleMouseEnter = () => {
    hoverRef.current = true;
  };

  const handleMouseLeave = () => {
    hoverRef.current = false;
    mouseRef.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '180px',
        borderRadius: '12px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
        cursor: 'crosshair',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        boxShadow: 'var(--shadow-sm)'
      }}
      className="scanline-pulse hover:border-[rgba(0,245,255,0.25)] hover:shadow-[0_0_20px_rgba(0,245,255,0.06)]"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sci-Fi Decorative Corner Brackets */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 6, height: 6, borderTop: '1px solid rgba(0, 245, 255, 0.45)', borderLeft: '1px solid rgba(0, 245, 255, 0.45)' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderTop: '1px solid rgba(0, 245, 255, 0.45)', borderRight: '1px solid rgba(0, 245, 255, 0.45)' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 6, height: 6, borderBottom: '1px solid rgba(0, 245, 255, 0.45)', borderLeft: '1px solid rgba(0, 245, 255, 0.45)' }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 6, height: 6, borderBottom: '1px solid rgba(0, 245, 255, 0.45)', borderRight: '1px solid rgba(0, 245, 255, 0.45)' }} />

      {/* Futuristic Scanline Overlay */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.3), transparent)',
          boxShadow: '0 0 8px rgba(0, 245, 255, 0.45)',
          pointerEvents: 'none',
          animation: 'scanline-sweep 4s linear infinite',
        }}
      />

      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* --- HUD Readouts --- */}

      {/* Top Left: Core Status */}
      <div 
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 7.5,
          color: 'rgba(0, 245, 255, 0.65)',
          pointerEvents: 'none',
          lineHeight: 1.4,
          letterSpacing: '0.5px'
        }}
      >
        <div>[SYS_VEC_CORE]: <span style={{ color: 'var(--accent-teal)', fontWeight: 'bold' }}>ONLINE</span></div>
        <div>[DIM]: 1536D</div>
      </div>

      {/* Top Right: Memory / Temp */}
      <div 
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 7.5,
          color: 'rgba(0, 245, 255, 0.65)',
          pointerEvents: 'none',
          lineHeight: 1.4,
          textAlign: 'right',
          letterSpacing: '0.5px'
        }}
      >
        <div>[INDEX]: HNSW</div>
        <div>[LATENCY]: {telemetry.latency}ms</div>
      </div>

      {/* Bottom Left: Title & Speed Indicator */}
      <div 
        style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8.5,
          color: 'var(--text-primary)',
          fontWeight: 700,
          letterSpacing: '1px',
          pointerEvents: 'none',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)'
        }}
      >
        <span style={{ color: 'var(--accent-cyan)' }}>▸</span> DATABASE VECTOR CORE ROTATION // SPEED:{' '}
        <span style={{ color: hoverRef.current ? 'var(--accent-teal)' : 'var(--accent-gold)' }}>
          {hoverRef.current ? 'HIGH' : 'NOMINAL'}
        </span>
      </div>

      {/* Bottom Right: FPS & Node count */}
      <div 
        style={{
          position: 'absolute',
          bottom: 10,
          right: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 7.5,
          color: 'rgba(0, 245, 255, 0.65)',
          pointerEvents: 'none',
          lineHeight: 1.4,
          textAlign: 'right',
          letterSpacing: '0.5px'
        }}
      >
        <div>[FPS]: {telemetry.fps}</div>
        <div>[NODES]: {telemetry.nodes}</div>
      </div>

      {/* Dynamic scanline keyframe injector */}
      <style>{`
        @keyframes scanline-sweep {
          0% { transform: translateY(-5px); opacity: 0; }
          5% { opacity: 0.8; }
          95% { opacity: 0.8; }
          100% { transform: translateY(185px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
