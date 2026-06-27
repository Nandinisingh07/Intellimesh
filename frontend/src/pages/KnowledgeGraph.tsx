import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Shield, Filter, Activity, Compass, Calendar,
  Eye, EyeOff, LayoutTemplate, X, ChevronRight, RefreshCw,
  FileText, Cpu, Users, Folder, BookOpen, Award, BarChart2, Globe
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  type: string;
  label: string;
  detail?: string;
  x: number;
  y: number;
  z: number;
  category: NodeCategory;
  confidence: number;
  relevance: number;
  docCount: number;
  lastUpdated: string;
  daysAgo: number;
  connectionCount: number;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  relationship: string;
  strength: 'High' | 'Medium' | 'Low';
  citations: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type NodeCategory =
  | 'Policy' | 'Research Paper' | 'Technology' | 'Project'
  | 'Scientist' | 'Department' | 'Patent' | 'Report';

type ExploreMode = 'none' | 'research' | 'policy';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NodeCategory, {
  color: string; lightColor: string; icon: string; baseRadius: number;
}> = {
  'Policy': { color: '#F59E0B', lightColor: '#D97706', icon: 'P', baseRadius: 20 },
  'Research Paper': { color: '#3B82F6', lightColor: '#2563EB', icon: 'R', baseRadius: 16 },
  'Patent': { color: '#A855F7', lightColor: '#9333EA', icon: 'A', baseRadius: 14 },
  'Report': { color: '#64748B', lightColor: '#475569', icon: 'D', baseRadius: 13 },
  'Technology': { color: '#06B6D4', lightColor: '#0891B2', icon: 'T', baseRadius: 16 },
  'Scientist': { color: '#10B981', lightColor: '#059669', icon: 'S', baseRadius: 14 },
  'Project': { color: '#F97316', lightColor: '#EA580C', icon: 'J', baseRadius: 15 },
  'Department': { color: '#6366F1', lightColor: '#4F46E5', icon: 'G', baseRadius: 18 },
};

const CATEGORY_ICONS: Record<NodeCategory, any> = {
  'Policy': Award,
  'Research Paper': BookOpen,
  'Patent': FileText,
  'Report': BarChart2,
  'Technology': Cpu,
  'Scientist': Users,
  'Project': Folder,
  'Department': Globe,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function enrichNode(n: any): GraphNode {
  const hash = stableHash(n.label || n.id);
  let category: NodeCategory = 'Report';
  if (n.type === 'query') category = 'Policy';
  else if (n.type === 'doc') {
    const ext = (n.label?.split('.').pop() ?? '').toLowerCase();
    if (ext === 'pdf') category = 'Research Paper';
    else if (ext === 'docx') category = 'Report';
    else if (ext === 'txt') category = 'Patent';
    else category = 'Report';
  } else {
    const cats: NodeCategory[] = ['Technology', 'Scientist', 'Department'];
    category = cats[hash % 3];
  }

  const confidence = 85 + (hash % 14);
  const relevance = parseFloat((0.68 + (hash % 28) * 0.01).toFixed(2));
  const docCount = 1 + (hash % 5);
  const daysAgo = 1 + (hash % 120);
  const lastUpdated =
    daysAgo === 1 ? 'Yesterday' :
      daysAgo < 7 ? `${daysAgo} days ago` :
        daysAgo < 30 ? `${Math.floor(daysAgo / 7)} weeks ago` :
          `${Math.floor(daysAgo / 30)} months ago`;

  const initX = isNaN(n.x) || !isFinite(n.x) ? (Math.random() * 300 - 150) : n.x;
  const initY = isNaN(n.y) || !isFinite(n.y) ? (Math.random() * 300 - 150) : n.y;
  const initZ = Math.random() * 120 - 60;

  return { ...n, x: initX, y: initY, z: initZ, category, confidence, relevance, docCount, lastUpdated, daysAgo, connectionCount: 0 };
}

function enrichEdge(e: any, nodes: GraphNode[]): GraphEdge {
  const hash = stableHash(e.from + e.to);
  const nodeA = nodes.find(n => n.id === e.from);
  let relationship = 'RELATED_TO';
  if (nodeA?.category === 'Policy') relationship = 'REGULATES';
  else if (nodeA?.category === 'Scientist') relationship = 'AUTHORED_BY';
  else if (nodeA?.category === 'Research Paper') relationship = 'CITES';
  else if (nodeA?.category === 'Technology') relationship = 'ENABLES';
  else if (nodeA?.category === 'Department') relationship = 'OVERSEES';
  const strength = (['High', 'Medium', 'Low'] as const)[hash % 3];
  return { ...e, relationship, strength, citations: 1 + (hash % 6) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeGraph({ theme }: { theme: 'dark' | 'light' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // Graph data
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  // UI state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [timeFilter, setTimeFilter] = useState(4);
  const [exploreMode, setExploreMode] = useState<ExploreMode>('none');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  const [zoomPct, setZoomPct] = useState(100);
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    'Policy': true, 'Research Paper': true, 'Patent': true, 'Report': true,
    'Technology': true, 'Scientist': true, 'Project': true, 'Department': true,
  });

  // Physics refs — never trigger re-renders
  const posRef = useRef<Record<string, { x: number; y: number; z: number }>>({});
  const velRef = useRef<Record<string, { x: number; y: number; z: number }>>({});
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const tPanRef = useRef({ x: 0, y: 0 });
  const tZoomRef = useRef(1);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const tYawRef = useRef(0);
  const tPitchRef = useRef(0);
  const pulseRef = useRef(0);
  const dragRef = useRef<{ type: 'node'; node: GraphNode } | { type: 'pan' } | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const selectedIdRef = useRef<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const filteredRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  // Keep filteredRef in sync without triggering the canvas effect
  const isDark = theme === 'dark';

  // ─── Fetch data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:8000/api/graph')
      .then(r => {
        const raw = r.data || {};
        const rawNodes: any[] = raw.nodes || [];
        const rawEdges: any[] = raw.edges || [];
        const nodes = rawNodes.map(enrichNode);

        // Count connections per node
        const connMap: Record<string, number> = {};
        rawEdges.forEach((e: any) => {
          connMap[e.from] = (connMap[e.from] || 0) + 1;
          connMap[e.to] = (connMap[e.to] || 0) + 1;
        });
        nodes.forEach(n => { n.connectionCount = connMap[n.id] || 0; });

        const edges = rawEdges.map((e: any) => enrichEdge(e, nodes));
        setGraphData({ nodes, edges });
        setNodeCount(nodes.length);
        setEdgeCount(edges.length);
        setLoading(false);
        setError(null);
      })
      .catch(() => {
        // Use demo data so the graph always shows something
        const demoNodes: GraphNode[] = [
          { id: 'n1', type: 'doc', label: 'Neural Networks Survey.pdf', detail: 'Comprehensive survey of deep learning architectures including CNNs, RNNs, and Transformers.', x: -120, y: -80, z: 20, category: 'Research Paper', confidence: 94, relevance: 0.92, docCount: 3, lastUpdated: '2 days ago', daysAgo: 2, connectionCount: 3 },
          { id: 'n2', type: 'doc', label: 'Data Privacy Policy.docx', detail: 'Internal policy document governing data handling and user privacy regulations.', x: 120, y: -60, z: -30, category: 'Policy', confidence: 98, relevance: 0.87, docCount: 5, lastUpdated: 'Yesterday', daysAgo: 1, connectionCount: 4 },
          { id: 'n3', type: 'doc', label: 'ML Pipeline Architecture', detail: 'Technical specification for the end-to-end machine learning pipeline used in production.', x: 0, y: 120, z: 40, category: 'Technology', confidence: 91, relevance: 0.85, docCount: 2, lastUpdated: '5 days ago', daysAgo: 5, connectionCount: 2 },
          { id: 'n4', type: 'entity', label: 'Dr. Sarah Chen', detail: 'Lead researcher specializing in natural language processing and knowledge graphs.', x: -80, y: 60, z: -20, category: 'Scientist', confidence: 89, relevance: 0.79, docCount: 4, lastUpdated: '1 week ago', daysAgo: 7, connectionCount: 3 },
          { id: 'n5', type: 'doc', label: 'Q3 Analytics Report', detail: 'Quarterly analysis of system performance metrics and user engagement statistics.', x: 100, y: 80, z: 15, category: 'Report', confidence: 96, relevance: 0.81, docCount: 1, lastUpdated: '3 weeks ago', daysAgo: 21, connectionCount: 2 },
          { id: 'n6', type: 'entity', label: 'AI Research Dept', detail: 'Department responsible for foundational AI research and applied machine learning projects.', x: -150, y: 20, z: -50, category: 'Department', confidence: 99, relevance: 0.95, docCount: 8, lastUpdated: 'Yesterday', daysAgo: 1, connectionCount: 5 },
          { id: 'n7', type: 'doc', label: 'NLP Patent US-2024-1182', detail: 'Patent covering novel tokenization methods for low-resource languages.', x: 60, y: -130, z: 30, category: 'Patent', confidence: 92, relevance: 0.76, docCount: 2, lastUpdated: '2 months ago', daysAgo: 60, connectionCount: 2 },
          { id: 'n8', type: 'entity', label: 'RAG System v2', detail: 'Second generation retrieval-augmented generation system with multimodal support.', x: -20, y: -160, z: -40, category: 'Project', confidence: 88, relevance: 0.88, docCount: 6, lastUpdated: '4 days ago', daysAgo: 4, connectionCount: 3 },
        ];
        const demoEdges: GraphEdge[] = [
          { from: 'n1', to: 'n4', weight: 0.9, relationship: 'AUTHORED_BY', strength: 'High', citations: 5 },
          { from: 'n1', to: 'n8', weight: 0.8, relationship: 'ENABLES', strength: 'High', citations: 3 },
          { from: 'n2', to: 'n6', weight: 0.7, relationship: 'REGULATES', strength: 'Medium', citations: 2 },
          { from: 'n3', to: 'n8', weight: 0.85, relationship: 'IMPLEMENTS', strength: 'High', citations: 4 },
          { from: 'n4', to: 'n6', weight: 0.6, relationship: 'MEMBER_OF', strength: 'High', citations: 1 },
          { from: 'n5', to: 'n6', weight: 0.5, relationship: 'PRODUCED_BY', strength: 'Medium', citations: 2 },
          { from: 'n7', to: 'n4', weight: 0.75, relationship: 'FILED_BY', strength: 'Medium', citations: 3 },
          { from: 'n8', to: 'n6', weight: 0.9, relationship: 'MANAGED_BY', strength: 'High', citations: 4 },
          { from: 'n1', to: 'n7', weight: 0.65, relationship: 'CITES', strength: 'Low', citations: 2 },
          { from: 'n2', to: 'n8', weight: 0.55, relationship: 'GOVERNS', strength: 'Medium', citations: 1 },
        ];
        setGraphData({ nodes: demoNodes, edges: demoEdges });
        setNodeCount(demoNodes.length);
        setEdgeCount(demoEdges.length);
        setLoading(false);
        setError('Using demo data — backend offline');
      });
  }, []);

  // ─── Sync physics refs when graph data changes ────────────────────────────

  useEffect(() => {
    graphData.nodes.forEach(n => {
      if (!posRef.current[n.id]) {
        posRef.current[n.id] = { x: n.x, y: n.y, z: n.z };
        velRef.current[n.id] = { x: 0, y: 0, z: 0 };
      }
    });
  }, [graphData]);

  // ─── Filtered data (compute + keep ref in sync) ──────────────────────────

  const filteredNodes = graphData.nodes.filter(n => {
    if (!activeFilters[n.category]) return false;
    if (timeFilter === 1 && n.daysAgo > 1) return false;
    if (timeFilter === 2 && n.daysAgo > 7) return false;
    if (timeFilter === 3 && n.daysAgo > 30) return false;
    return true;
  });
  const filteredEdges = graphData.edges.filter(e =>
    filteredNodes.some(n => n.id === e.from) && filteredNodes.some(n => n.id === e.to)
  );
  filteredRef.current = { nodes: filteredNodes, edges: filteredEdges };

  // ─── Canvas resize observer ───────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── Main render + physics loop ──────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── helpers ──────────────────────────────────────────────────────────────

    function project(wx: number, wy: number, wz: number) {
      const dpr = window.devicePixelRatio;
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const z = zoomRef.current;
      const pan = panRef.current;
      const W = canvas!.width;
      const H = canvas!.height;

      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      const x1 = wx * cosY - wz * sinY;
      const z1 = wx * sinY + wz * cosY;
      const cosX = Math.cos(pitch), sinX = Math.sin(pitch);
      const y2 = wy * cosX - z1 * sinX;
      const z2 = wy * sinX + z1 * cosX;

      const focal = 400 * dpr;
      const scale = focal / (focal + z2 * dpr);

      return {
        x: x1 * scale * z * dpr + pan.x * dpr + W / 2,
        y: y2 * scale * z * dpr + pan.y * dpr + H / 2,
        scale,
        zDepth: z2,
      };
    }

    function getNodeAtCanvas(cx: number, cy: number): GraphNode | null {
      const { nodes } = filteredRef.current;
      const z = zoomRef.current;
      let closest: GraphNode | null = null;
      let minD = Infinity;

      nodes.forEach(n => {
        const p = posRef.current[n.id];
        if (!p) return;
        const proj = project(p.x, p.y, p.z);
        const cfg = CATEGORY_CONFIG[n.category];
        const r = cfg.baseRadius * proj.scale * z * window.devicePixelRatio + 10;
        const d = Math.hypot(proj.x - cx, proj.y - cy);
        if (d < r && d < minD) { minD = d; closest = n; }
      });
      return closest;
    }

    function getImpacted(selId: string, mode: ExploreMode): Set<string> {
      const { edges } = filteredRef.current;
      const ids = new Set([selId]);
      if (mode === 'none') return ids;

      edges.forEach(e => {
        if (mode === 'policy' && e.from === selId) ids.add(e.to);
        if (mode === 'research') {
          if (e.from === selId) ids.add(e.to);
          if (e.to === selId) ids.add(e.from);
        }
      });

      if (mode === 'research') {
        const firstDeg = new Set(ids);
        edges.forEach(e => {
          if (firstDeg.has(e.from)) ids.add(e.to);
          if (firstDeg.has(e.to)) ids.add(e.from);
        });
      }
      return ids;
    }

    // ── physics ───────────────────────────────────────────────────────────────

    function physics() {
      const { nodes, edges } = filteredRef.current;
      if (nodes.length === 0) return;

      const repelDist = 160, kRepel = 400;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const pa = posRef.current[a.id];
        if (!pa) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const pb = posRef.current[b.id];
          if (!pb) continue;
          const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
          const dist = Math.hypot(dx, dy, dz) || 0.1;
          if (dist >= repelDist) continue;
          const f = (kRepel * (repelDist - dist)) / dist;
          const fx = (dx / dist) * f * 0.1;
          const fy = (dy / dist) * f * 0.1;
          const fz = (dz / dist) * f * 0.04; // Less Z repulsion for flatter look
          velRef.current[a.id].x += fx; velRef.current[b.id].x -= fx;
          velRef.current[a.id].y += fy; velRef.current[b.id].y -= fy;
          velRef.current[a.id].z += fz; velRef.current[b.id].z -= fz;
        }
      }

      const kSpring = 0.03, restLen = 90;
      edges.forEach(e => {
        const pa = posRef.current[e.from], pb = posRef.current[e.to];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
        const dist = Math.hypot(dx, dy, dz) || 0.1;
        const f = kSpring * (dist - restLen) * e.weight;
        const fx = (dx / dist) * f * 0.15;
        const fy = (dy / dist) * f * 0.15;
        const fz = (dz / dist) * f * 0.06;
        velRef.current[e.from].x += fx; velRef.current[e.to].x -= fx;
        velRef.current[e.from].y += fy; velRef.current[e.to].y -= fy;
        velRef.current[e.from].z += fz; velRef.current[e.to].z -= fz;
      });

      // Center gravity
      nodes.forEach(n => {
        const p = posRef.current[n.id]; if (!p) return;
        velRef.current[n.id].x += (n.x - p.x) * 0.015;
        velRef.current[n.id].y += (n.y - p.y) * 0.015;
        velRef.current[n.id].z += (n.z - p.z) * 0.015;
      });

      // Integrate
      const damp = 0.74;
      nodes.forEach(n => {
        const p = posRef.current[n.id], v = velRef.current[n.id];
        if (!p || !v) return;
        if (dragRef.current?.type === 'node' && dragRef.current.node.id === n.id) {
          v.x = v.y = v.z = 0; return;
        }
        let vx = v.x, vy = v.y, vz = v.z;
        if (!isFinite(vx)) vx = 0;
        if (!isFinite(vy)) vy = 0;
        if (!isFinite(vz)) vz = 0;
        const spd = Math.hypot(vx, vy, vz);
        if (spd > 12) { vx = vx / spd * 12; vy = vy / spd * 12; vz = vz / spd * 12; }
        p.x += vx; p.y += vy; p.z += vz;
        if (!isFinite(p.x)) p.x = n.x;
        if (!isFinite(p.y)) p.y = n.y;
        if (!isFinite(p.z)) p.z = n.z;
        v.x = vx * damp; v.y = vy * damp; v.z = vz * damp;
      });
    }

    // ── draw ─────────────────────────────────────────────────────────────────

    function draw() {
      const { nodes, edges } = filteredRef.current;
      const W = canvas!.width, H = canvas!.height;
      const dpr = window.devicePixelRatio;
      const z = zoomRef.current;
      const selId = selectedIdRef.current;
      const hovId = hoveredIdRef.current;

      ctx!.clearRect(0, 0, W, H);

      // ── Background ─────────────────────────────────────────────────────────
      if (isDark) {
        ctx!.fillStyle = '#080C14';
      } else {
        ctx!.fillStyle = '#F0F4F8';
      }
      ctx!.fillRect(0, 0, W, H);

      // Subtle grid
      ctx!.save();
      ctx!.strokeStyle = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)';
      ctx!.lineWidth = 0.5;
      const gridSize = 40 * dpr;
      const offX = (panRef.current.x * dpr + W / 2) % gridSize;
      const offY = (panRef.current.y * dpr + H / 2) % gridSize;
      for (let x = offX; x < W; x += gridSize) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, H); ctx!.stroke(); }
      for (let y = offY; y < H; y += gridSize) { ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(W, y); ctx!.stroke(); }
      ctx!.restore();

      // ── Project all nodes ──────────────────────────────────────────────────
      const proj: Record<string, ReturnType<typeof project>> = {};
      nodes.forEach(n => {
        const p = posRef.current[n.id] || { x: n.x, y: n.y, z: n.z };
        proj[n.id] = project(p.x, p.y, p.z);
      });

      const impacted = selId ? getImpacted(selId, exploreMode) : new Set<string>();

      // ── Heatmap density ────────────────────────────────────────────────────
      if (showHeatmap) {
        ctx!.save();
        nodes.forEach(n => {
          const pr = proj[n.id]; if (!pr) return;
          const r = 80 * pr.scale * z * dpr;
          const cfg = CATEGORY_CONFIG[n.category];
          const col = isDark ? cfg.color : cfg.lightColor;
          const { r: cr, g, b } = hexToRgb(col);
          const grad = ctx!.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, r);
          grad.addColorStop(0, `rgba(${cr},${g},${b},0.1)`);
          grad.addColorStop(1, `rgba(${cr},${g},${b},0)`);
          ctx!.beginPath();
          ctx!.arc(pr.x, pr.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        });
        ctx!.restore();
      }

      // ── Cluster boundaries ──────────────────────────────────────────────────
      if (showClusters) {
        ctx!.save();
        const categories = Object.keys(CATEGORY_CONFIG) as NodeCategory[];
        categories.forEach(cat => {
          const catNodes = nodes.filter(n => n.category === cat);
          if (catNodes.length < 2) return;
          let sx = 0, sy = 0, sz = 0, cnt = 0;
          catNodes.forEach(n => {
            const p = posRef.current[n.id]; if (!p) return;
            sx += p.x; sy += p.y; sz += p.z; cnt++;
          });
          if (!cnt) return;
          const cx = sx / cnt, cy = sy / cnt, cz = sz / cnt;
          let maxD = 40;
          catNodes.forEach(n => {
            const p = posRef.current[n.id]; if (!p) return;
            maxD = Math.max(maxD, Math.hypot(p.x - cx, p.y - cy));
          });
          const cproj = project(cx, cy, cz);
          const rad = (maxD + 30) * cproj.scale * z * dpr;
          const cfg = CATEGORY_CONFIG[cat];
          const col = isDark ? cfg.color : cfg.lightColor;
          const { r, g, b } = hexToRgb(col);

          ctx!.beginPath();
          ctx!.arc(cproj.x, cproj.y, rad, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${r},${g},${b},${isDark ? 0.18 : 0.25})`;
          ctx!.lineWidth = 1.5;
          ctx!.setLineDash([6, 10]);
          ctx!.stroke();
          ctx!.setLineDash([]);

          // Cluster label
          ctx!.font = `${Math.max(9, 10 * cproj.scale * z) * dpr}px Inter, sans-serif`;
          ctx!.fillStyle = `rgba(${r},${g},${b},${isDark ? 0.6 : 0.7})`;
          ctx!.textAlign = 'center';
          ctx!.fillText(cat.toUpperCase(), cproj.x, cproj.y - rad - 6 * dpr);
        });
        ctx!.restore();
      }

      // ── Edges ──────────────────────────────────────────────────────────────
      edges.forEach(e => {
        const pA = proj[e.from], pB = proj[e.to];
        if (!pA || !pB) return;

        const edgeImpacted = selId && impacted.has(e.from) && impacted.has(e.to);
        const faded = selId && !edgeImpacted;
        const avgScale = (pA.scale + pB.scale) / 2;

        // Faint connection line backing glow for depth
        if (!faded) {
          ctx!.save();
          ctx!.beginPath();
          ctx!.moveTo(pA.x, pA.y);
          ctx!.lineTo(pB.x, pB.y);
          ctx!.strokeStyle = edgeImpacted 
            ? (exploreMode === 'policy' ? 'rgba(245,158,11,0.22)' : 'rgba(6,182,212,0.22)') 
            : (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(79,70,229,0.05)');
          ctx!.lineWidth = (edgeImpacted ? 5.5 : 2.5) * avgScale * z * dpr;
          ctx!.stroke();
          ctx!.restore();
        }

        ctx!.beginPath();
        ctx!.moveTo(pA.x, pA.y);
        ctx!.lineTo(pB.x, pB.y);

        if (edgeImpacted) {
          const accentCol = exploreMode === 'policy' ? '#F59E0B' : '#06B6D4';
          ctx!.strokeStyle = accentCol;
          ctx!.lineWidth = 2.5 * avgScale * z * dpr;
          ctx!.setLineDash([]);
        } else if (faded) {
          ctx!.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
          ctx!.lineWidth = 0.8 * dpr;
          ctx!.setLineDash([]);
        } else {
          // KEY FIX: dark edges in light mode, visible edges in dark mode
          ctx!.strokeStyle = isDark
            ? (e.strength === 'High' ? 'rgba(255,255,255,0.2)' : e.strength === 'Medium' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)')
            : (e.strength === 'High' ? 'rgba(15,23,42,0.35)' : e.strength === 'Medium' ? 'rgba(15,23,42,0.22)' : 'rgba(15,23,42,0.12)');
          ctx!.lineWidth = (e.strength === 'High' ? 1.5 : e.strength === 'Medium' ? 1.0 : 0.7) * avgScale * z * dpr;
          ctx!.setLineDash(e.strength === 'Low' ? [4 * dpr, 5 * dpr] : []);
        }
        ctx!.stroke();
        ctx!.setLineDash([]);

        // Multi-dot connection flow particles
        if (!faded) {
          const t1 = (pulseRef.current + stableHash(e.from) * 0.02) % 1;
          const t2 = (t1 + 0.5) % 1;
          const particlesT = [t1, t2];

          particlesT.forEach(t => {
            const px = pA.x + (pB.x - pA.x) * t;
            const py = pA.y + (pB.y - pA.y) * t;
            const pSize = (edgeImpacted ? 3.2 : 1.8) * avgScale * z * dpr;
            
            // Draw particle glow halo
            ctx!.beginPath();
            ctx!.arc(px, py, pSize * 2.2, 0, Math.PI * 2);
            ctx!.fillStyle = edgeImpacted
              ? (exploreMode === 'policy' ? 'rgba(245,158,11,0.18)' : 'rgba(6,182,212,0.18)')
              : (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.12)');
            ctx!.fill();

            // Draw solid particle core
            ctx!.beginPath();
            ctx!.arc(px, py, pSize, 0, Math.PI * 2);
            const dotCol = edgeImpacted
              ? (exploreMode === 'policy' ? '#F59E0B' : '#06B6D4')
              : (isDark ? '#818CF8' : '#4F46E5');
            ctx!.fillStyle = dotCol;
            ctx!.fill();
          });
        }

        // Relationship label on impacted edges
        if (edgeImpacted && avgScale * z > 0.5) {
          const mx = (pA.x + pB.x) / 2;
          const my = (pA.y + pB.y) / 2;
          const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
          ctx!.save();
          ctx!.translate(mx, my);
          ctx!.rotate(Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle);
          const fs = Math.max(8, 9 * avgScale * z) * dpr;
          ctx!.font = `600 ${fs}px Inter, sans-serif`;
          const label = e.relationship;
          const tw = ctx!.measureText(label).width;
          ctx!.fillStyle = isDark ? 'rgba(8,12,20,0.75)' : 'rgba(240,244,248,0.85)';
          ctx!.fillRect(-tw / 2 - 4, -fs * 0.8, tw + 8, fs * 1.1);
          ctx!.fillStyle = exploreMode === 'policy' ? '#F59E0B' : '#06B6D4';
          ctx!.textAlign = 'center';
          ctx!.fillText(label, 0, 0);
          ctx!.restore();
        }
      });

      // ── Nodes (depth sorted) ───────────────────────────────────────────────
      const sorted = [...nodes].sort((a, b) => (proj[b.id]?.zDepth ?? 0) - (proj[a.id]?.zDepth ?? 0));

      sorted.forEach(n => {
        const pr = proj[n.id]; if (!pr) return;
        const cfg = CATEGORY_CONFIG[n.category];
        const col = isDark ? cfg.color : cfg.lightColor;
        const { r, g, b } = hexToRgb(col);
        const radius = cfg.baseRadius * pr.scale * z * dpr;

        const isSel = selId === n.id;
        const isHov = hovId === n.id;
        const isImpact = !!selId && impacted.has(n.id);
        const faded = !!selId && !isImpact;
        const alpha = faded ? 0.2 : 1;

        // Soft ambient glow around all active nodes
        if (!faded) {
          const ambientGlowR = radius + 6 * dpr;
          const ambientGrad = ctx!.createRadialGradient(pr.x, pr.y, radius, pr.x, pr.y, ambientGlowR);
          ambientGrad.addColorStop(0, `rgba(${r},${g},${b},0.12)`);
          ambientGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.beginPath();
          ctx!.arc(pr.x, pr.y, ambientGlowR, 0, Math.PI * 2);
          ctx!.fillStyle = ambientGrad;
          ctx!.fill();
        }

        // Outer glow ring
        if (!faded && (isSel || isImpact || isHov)) {
          const glowR = radius + (isSel ? 16 : 9) * dpr;
          const grad = ctx!.createRadialGradient(pr.x, pr.y, radius, pr.x, pr.y, glowR);
          grad.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.beginPath();
          ctx!.arc(pr.x, pr.y, glowR, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.globalAlpha = alpha;
          ctx!.fill();
          ctx!.globalAlpha = 1;
        }

        // Selection pulse ring
        if (isSel) {
          const pulse = 1 + Math.sin(pulseRef.current * 10) * 0.15;
          ctx!.beginPath();
          ctx!.arc(pr.x, pr.y, (radius + 5 * dpr) * pulse, 0, Math.PI * 2);
          ctx!.strokeStyle = col;
          ctx!.lineWidth = 2 * dpr;
          ctx!.globalAlpha = 0.7;
          ctx!.stroke();
          ctx!.globalAlpha = 1;
        }

        // Node depth drop shadow in 3D perspective
        if (!faded) {
          ctx!.beginPath();
          ctx!.arc(pr.x + 2 * dpr, pr.y + 3 * dpr, radius, 0, Math.PI * 2);
          ctx!.fillStyle = isDark ? 'rgba(2,4,8,0.55)' : 'rgba(15,23,42,0.15)';
          ctx!.fill();
        }

        // Node body — solid fill with inner gradient feel via two circles
        ctx!.beginPath();
        ctx!.arc(pr.x, pr.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r},${g},${b},${faded ? 0.2 : 0.9})`;
        ctx!.fill();

        // Inner highlight (top-left lighter spot for depth)
        if (!faded) {
          const highlightGrad = ctx!.createRadialGradient(
            pr.x - radius * 0.3, pr.y - radius * 0.3, 0,
            pr.x, pr.y, radius
          );
          highlightGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
          highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx!.beginPath();
          ctx!.arc(pr.x, pr.y, radius, 0, Math.PI * 2);
          ctx!.fillStyle = highlightGrad;
          ctx!.fill();
        }

        // Border ring
        ctx!.beginPath();
        ctx!.arc(pr.x, pr.y, radius, 0, Math.PI * 2);
        ctx!.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)';
        ctx!.lineWidth = 1.5 * dpr;
        ctx!.stroke();

        // Category letter inside node
        const fs = Math.max(8, radius * 0.7);
        ctx!.font = `700 ${fs}px Inter, sans-serif`;
        ctx!.fillStyle = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
        ctx!.globalAlpha = faded ? 0.3 : 1;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(cfg.icon, pr.x, pr.y);
        ctx!.textBaseline = 'alphabetic';
        ctx!.globalAlpha = 1;

        // Node label below
        if (pr.scale * z > 0.4) {
          const truncated = n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label;
          const labelFs = Math.max(9, 10 * pr.scale * z) * dpr;
          ctx!.font = `${isSel || isHov ? '600' : '500'} ${labelFs}px Inter, sans-serif`;
          const tw = ctx!.measureText(truncated).width;
          const lx = pr.x, ly = pr.y + radius + 14 * dpr;

          // Label background pill for readability
          if (!faded) {
            ctx!.fillStyle = isDark ? 'rgba(8,12,20,0.7)' : 'rgba(255,255,255,0.85)';
            ctx!.beginPath();
            const pad = 4 * dpr;
            ctx!.roundRect(lx - tw / 2 - pad, ly - labelFs, tw + pad * 2, labelFs * 1.4, 3 * dpr);
            ctx!.fill();
          }

          ctx!.fillStyle = faded
            ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')
            : (isDark ? '#E2E8F0' : '#1E293B');
          ctx!.textAlign = 'center';
          ctx!.globalAlpha = faded ? 0.3 : 1;
          ctx!.fillText(truncated, lx, ly);
          ctx!.globalAlpha = 1;
        }
      });

      // ── Minimap ─────────────────────────────────────────────────────────────
      drawMinimap(nodes);
    }

    function drawMinimap(nodes: GraphNode[]) {
      if (nodes.length === 0) return;
      const dpr = window.devicePixelRatio;
      const W = canvas!.width, H = canvas!.height;
      const mmW = 140 * dpr, mmH = 100 * dpr;
      const mmX = W - mmW - 16 * dpr;
      const mmY = H - mmH - 16 * dpr;

      ctx!.save();
      ctx!.fillStyle = isDark ? 'rgba(8,12,20,0.88)' : 'rgba(248,250,252,0.9)';
      ctx!.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
      ctx!.lineWidth = dpr;
      ctx!.beginPath();
      ctx!.roundRect(mmX, mmY, mmW, mmH, 6 * dpr);
      ctx!.fill();
      ctx!.stroke();

      // Label
      ctx!.font = `500 ${8 * dpr}px Inter, sans-serif`;
      ctx!.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
      ctx!.textAlign = 'left';
      ctx!.fillText('MINIMAP', mmX + 6 * dpr, mmY + 10 * dpr);

      // Bounds
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      nodes.forEach(n => {
        const p = posRef.current[n.id]; if (!p) return;
        mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x);
        mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y);
      });
      if (mnX === Infinity) { ctx!.restore(); return; }
      const pad = 16 * dpr;
      const bW = (mxX - mnX) || 1, bH = (mxY - mnY) || 1;

      nodes.forEach(n => {
        const p = posRef.current[n.id]; if (!p) return;
        const mx = mmX + pad + ((p.x - mnX) / bW) * (mmW - pad * 2);
        const my = mmY + 16 * dpr + ((p.y - mnY) / bH) * (mmH - 24 * dpr);
        ctx!.beginPath();
        ctx!.arc(mx, my, 2.5 * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = CATEGORY_CONFIG[n.category][isDark ? 'color' : 'lightColor'];
        ctx!.globalAlpha = selectedIdRef.current === n.id ? 1 : 0.7;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      });

      ctx!.restore();
    }

    // ── loop ─────────────────────────────────────────────────────────────────

    function loop() {
      // Smooth camera interpolation
      const lerp = 0.1;
      panRef.current.x += (tPanRef.current.x - panRef.current.x) * lerp;
      panRef.current.y += (tPanRef.current.y - panRef.current.y) * lerp;
      zoomRef.current += (tZoomRef.current - zoomRef.current) * lerp;
      yawRef.current += (tYawRef.current - yawRef.current) * lerp;
      pitchRef.current += (tPitchRef.current - pitchRef.current) * lerp;

      // Slow auto-orbit when idle
      if (!dragRef.current) tYawRef.current += 0.0004;

      pulseRef.current = (pulseRef.current + 0.004) % 1;

      setZoomPct(Math.round(zoomRef.current * 100));
      physics();
      draw();
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);

    // ── mouse events ─────────────────────────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      const cx = (e.clientX - rect.left) * dpr;
      const cy = (e.clientY - rect.top) * dpr;
      const n = getNodeAtCanvas(cx, cy);

      if (n) {
        dragRef.current = { type: 'node', node: n };
        selectedIdRef.current = n.id;
        setSelectedNode(n);
        tPanRef.current.x = -n.x * tZoomRef.current;
        tPanRef.current.y = -n.y * tZoomRef.current;
      } else {
        dragRef.current = { type: 'pan' };
        selectedIdRef.current = null;
        setSelectedNode(null);
      }
      lastMouseRef.current = { x: cx, y: cy };
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      const cx = (e.clientX - rect.left) * dpr;
      const cy = (e.clientY - rect.top) * dpr;

      if (dragRef.current?.type === 'node' && e.buttons === 1) {
        const pos = posRef.current[dragRef.current.node.id];
        if (pos) {
          pos.x += (cx - lastMouseRef.current.x) / (zoomRef.current * dpr * 1.5);
          pos.y += (cy - lastMouseRef.current.y) / (zoomRef.current * dpr * 1.5);
        }
      } else if (dragRef.current?.type === 'pan' && e.buttons === 1) {
        tYawRef.current += (cx - lastMouseRef.current.x) * 0.003;
        tPitchRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, tPitchRef.current + (cy - lastMouseRef.current.y) * 0.003));
      } else {
        const hov = getNodeAtCanvas(cx, cy);
        hoveredIdRef.current = hov?.id ?? null;
        canvas!.style.cursor = hov ? 'pointer' : 'grab';
      }
      lastMouseRef.current = { x: cx, y: cy };
    }

    function onMouseUp() { dragRef.current = null; }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      tZoomRef.current = Math.min(4, Math.max(0.2, tZoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, exploreMode, showHeatmap, showClusters]);
  // NOTE: filteredNodes/Edges are synced via filteredRef — no stale closure

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    tYawRef.current = 0;
    tPitchRef.current = 0;
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    filteredRef.current.nodes.forEach(n => {
      const p = posRef.current[n.id]; if (!p) return;
      mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x);
      mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y);
    });
    if (mnX === Infinity) { tPanRef.current = { x: 0, y: 0 }; tZoomRef.current = 1; return; }
    const W = canvasRef.current?.clientWidth ?? 600;
    const H = canvasRef.current?.clientHeight ?? 400;
    const pad = 80;
    const scaleX = (W - pad * 2) / ((mxX - mnX) || 1);
    const scaleY = (H - pad * 2) / ((mxY - mnY) || 1);
    const nz = Math.min(1.2, Math.max(0.3, Math.min(scaleX, scaleY)));
    tZoomRef.current = nz;
    tPanRef.current = { x: -((mnX + mxX) / 2) * nz, y: -((mnY + mxY) / 2) * nz };
  }, []);

  const searchResults = searchQuery.trim()
    ? filteredNodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : [];

  const handleSelectSearchNode = (n: GraphNode) => {
    setSearchQuery(''); setSearchFocused(false);
    selectedIdRef.current = n.id; setSelectedNode(n);
    tPanRef.current = { x: -n.x * tZoomRef.current, y: -n.y * tZoomRef.current };
  };

  const connectedEdges = selectedNode
    ? filteredEdges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
    : [];
  const connectedNodes = connectedEdges.map(e => {
    const otherId = e.from === selectedNode?.id ? e.to : e.from;
    return { node: filteredNodes.find(n => n.id === otherId), edge: e };
  }).filter(x => x.node);

  // ─── Render ──────────────────────────────────────────────────────────────

  const bg = isDark ? '#080C14' : '#F0F4F8';
  const surf = isDark ? '#0F1520' : '#FFFFFF';
  const surf2 = isDark ? '#141C2B' : '#F8FAFC';
  const border = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const textPrimary = isDark ? '#E2E8F0' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#475569';
  const textMuted = isDark ? '#4B5563' : '#94A3B8';

  const panelStyle: React.CSSProperties = {
    background: isDark ? 'rgba(15,21,32,0.92)' : 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${border}`,
    borderRadius: 16,
    overflow: 'hidden',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: textMuted,
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: bg, position: 'relative', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div style={{ ...panelStyle, position: 'absolute', top: 16, left: 16, width: 300, bottom: 16, zIndex: 10, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}` }}>
              <Shield size={16} color="#6366F1" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>Knowledge Graph</div>
              <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>{nodeCount} nodes · {edgeCount} edges</div>
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 10, fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '5px 8px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: surf2, border: `1px solid ${border}`, borderRadius: 8, padding: '7px 10px' }}>
              <Search size={14} color={textMuted} style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search nodes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, color: textPrimary, width: '100%' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, lineHeight: 1, padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            {searchFocused && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: surf, border: `1px solid ${border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 20, overflow: 'hidden' }}>
                {searchResults.map(n => {
                  const cfg = CATEGORY_CONFIG[n.category];
                  const col = isDark ? cfg.color : cfg.lightColor;
                  return (
                    <div key={n.id} onMouseDown={() => handleSelectSearchNode(n)} style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${border}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = surf2}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
                      <span style={{ fontSize: 9, color: col, fontWeight: 600, background: `${col}18`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{n.category.split(' ')[0].toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category filters */}
          <div>
            <div style={sectionLabel}><Filter size={10} />Node types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(Object.keys(activeFilters) as NodeCategory[]).map(cat => {
                const active = activeFilters[cat];
                const cfg = CATEGORY_CONFIG[cat];
                const col = isDark ? cfg.color : cfg.lightColor;
                const Icon = CATEGORY_ICONS[cat];
                const count = graphData.nodes.filter(n => n.category === cat).length;
                return (
                  <button key={cat} onClick={() => setActiveFilters(p => ({ ...p, [cat]: !p[cat] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1px solid ${active ? col + '30' : border}`, background: active ? `${col}0D` : 'transparent', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                    <Icon size={12} color={active ? col : textMuted} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: active ? textPrimary : textMuted, flex: 1 }}>{cat}</span>
                    <span style={{ fontSize: 10, color: active ? col : textMuted, fontWeight: 600 }}>{count}</span>
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${active ? col : border}`, background: active ? col : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <div style={{ width: 6, height: 4, borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translateY(-1px)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explore mode */}
          <div>
            <div style={sectionLabel}><Compass size={10} />Explore mode</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {([
                { id: 'none', label: 'Inspect', desc: 'Click any node to inspect it' },
                { id: 'research', label: 'Research trail', desc: 'Trace 2-hop citation paths' },
                { id: 'policy', label: 'Policy impact', desc: 'Downstream regulatory reach' },
              ] as const).map(m => {
                const active = exploreMode === m.id;
                return (
                  <div key={m.id} onClick={() => setExploreMode(m.id)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${active ? '#6366F1' : border}`, background: active ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#6366F1' : textMuted }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#6366F1' : textPrimary }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: textMuted, marginTop: 3, paddingLeft: 12 }}>{m.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time horizon */}
          <div>
            <div style={sectionLabel}><Calendar size={10} />Time horizon</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 1, l: '24h' }, { v: 2, l: '7d' }, { v: 3, l: '30d' }, { v: 4, l: 'All' }].map(({ v, l }) => (
                <button key={v} onClick={() => setTimeFilter(v)} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${timeFilter === v ? '#6366F1' : border}`, background: timeFilter === v ? 'rgba(99,102,241,0.12)' : 'transparent', color: timeFilter === v ? '#6366F1' : textMuted, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Render options */}
          <div>
            <div style={sectionLabel}><Activity size={10} />Display</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Heatmap density', state: showHeatmap, toggle: () => setShowHeatmap(s => !s), icon: Activity },
                { label: 'Cluster bounds', state: showClusters, toggle: () => setShowClusters(s => !s), icon: LayoutTemplate },
              ].map(({ label, state, toggle, icon: Icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: surf2, border: `1px solid ${border}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textSecondary }}><Icon size={11} />{label}</span>
                  <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: state ? '#6366F1' : textMuted, padding: 0 }}>
                    {state ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer stats */}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${border}`, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6366F1' }}>{filteredNodes.length}</div>
            <div style={{ fontSize: 9, color: textMuted, marginTop: 1 }}>VISIBLE</div>
          </div>
          <div style={{ width: 1, background: border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>{filteredEdges.length}</div>
            <div style={{ fontSize: 9, color: textMuted, marginTop: 1 }}>EDGES</div>
          </div>
          <div style={{ width: 1, background: border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>{Object.values(activeFilters).filter(Boolean).length}</div>
            <div style={{ fontSize: 9, color: textMuted, marginTop: 1 }}>TYPES ON</div>
          </div>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(8,12,20,0.8)' : 'rgba(240,244,248,0.8)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${border}`, borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: textSecondary, fontWeight: 500 }}>Loading knowledge graph…</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom HUD ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, background: isDark ? 'rgba(15,21,32,0.9)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', border: `1px solid ${border}`, padding: '7px 16px', borderRadius: 24, fontSize: 11, color: textSecondary }}>
        <span style={{ fontWeight: 600, color: textPrimary }}>{zoomPct}%</span>
        <span style={{ color: border }}>|</span>
        <span>Drag to orbit · Scroll to zoom · Click node to inspect</span>
        <span style={{ color: border }}>|</span>
        <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6366F1', fontWeight: 600, padding: 0 }}>
          <RefreshCw size={11} />Recenter
        </button>
      </div>

      {/* ── Right detail panel ──────────────────────────────────────────────── */}
      {selectedNode && (
        <div style={{ ...panelStyle, position: 'absolute', top: 16, right: 16, width: 320, bottom: 16, zIndex: 10, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {(() => {
                  const cfg = CATEGORY_CONFIG[selectedNode.category];
                  const col = isDark ? cfg.color : cfg.lightColor;
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: col, background: `${col}18`, border: `1px solid ${col}30`, borderRadius: 5, padding: '3px 8px', marginBottom: 8, letterSpacing: '0.04em' }}>
                      {selectedNode.category.toUpperCase()}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {selectedNode.label}
                </div>
              </div>
              <button onClick={() => { selectedIdRef.current = null; setSelectedNode(null); }} style={{ background: surf2, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: textMuted, lineHeight: 1, flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Confidence + relevance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Confidence', value: `${selectedNode.confidence}%`, color: '#F59E0B' },
                { label: 'Relevance', value: `${Math.round(selectedNode.relevance * 100)}%`, color: '#10B981' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: surf2, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, color: textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: color, width: value, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: surf2, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: textMuted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documents</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>{selectedNode.docCount}</div>
              </div>
              <div style={{ background: surf2, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: textMuted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Updated</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>{selectedNode.lastUpdated}</div>
              </div>
            </div>

            {/* Detail excerpt */}
            {selectedNode.detail && (
              <div>
                <div style={sectionLabel}>Intelligence excerpt</div>
                <div style={{ fontSize: 12.5, color: textSecondary, lineHeight: 1.6, background: surf2, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px', wordBreak: 'break-word' }}>
                  {selectedNode.detail}
                </div>
              </div>
            )}

            {/* Connected nodes */}
            {connectedNodes.length > 0 && (
              <div>
                <div style={sectionLabel}><ChevronRight size={10} />Connections ({connectedNodes.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {connectedNodes.map(({ node, edge }, i) => {
                    if (!node) return null;
                    const cfg = CATEGORY_CONFIG[node.category];
                    const col = isDark ? cfg.color : cfg.lightColor;
                    return (
                      <div key={i} onClick={() => handleSelectSearchNode(node)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: surf2, border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = col + '50'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = border}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</div>
                          <div style={{ fontSize: 9.5, color: textMuted, marginTop: 1 }}>{edge.relationship} · {edge.strength}</div>
                        </div>
                        <ChevronRight size={10} color={textMuted} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action */}
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${border}` }}>
            <button
              onClick={() => alert(`Opening source: ${selectedNode.label}`)}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.12)', color: '#6366F1', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.01em' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.transform = 'none'; }}
            >
              Open source document →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; border-radius: 2px; }
      `}</style>
    </div>
  );
}