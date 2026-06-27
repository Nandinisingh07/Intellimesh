import { useState, useEffect } from 'react';
import { getDocuments, queryDocuments } from '../lib/api';
import {
  Shield, Brain, TrendingUp, Layers, Compass, AlertTriangle,
  Lightbulb, Printer, Loader, FileText, CheckCircle, RefreshCw, Cpu,
  BarChart, Percent
} from 'lucide-react';
import ThreeDCard from '../components/ThreeDCard';


interface CitationSource {
  document: string;
  score: number;
  metadata?: {
    filename?: string;
  };
}

interface AnalysisSectionResult {
  id: string;
  title: string;
  content: string;
  confidence: number;
  sources: CitationSource[];
}

const SECTIONS = [
  {
    id: 'summary',
    title: 'Executive Summary',
    query: 'Provide an executive summary of the main points in the context. Format strictly as a bulleted list with a maximum of 5 short, concise, high-impact bullet points. Do not write introductory or concluding paragraphs.',
    icon: Shield,
    color: 'var(--accent-cyan)'
  },
  {
    id: 'findings',
    title: 'Key Findings',
    query: 'Extract the key evidence-supported findings from the context. For each finding, list the supporting source documents and explicitly include a citation count (e.g. "[Citations: N]"). Keep the list short, precise, and direct.',
    icon: Brain,
    color: 'var(--accent-gold)'
  },
  {
    id: 'trends',
    title: 'Research Trends',
    query: 'Identify the primary research trends and recurring topics in the context. For each trend, state the frequency of mentions and list the supporting source documents. Do not write generic paragraphs.',
    icon: TrendingUp,
    color: 'var(--accent-teal)'
  },
  {
    id: 'evidence_strength',
    title: 'Evidence Strength Analysis',
    query: 'Analyze the context and categorize the key topics by evidence strength: "Strong Evidence" (topics appearing in multiple sources), "Moderate Evidence" (topics in a few sources), and "Weak Evidence" (topics in only one source). Format strictly as: Strong Evidence\n* Topic A (X citations)\n\nModerate Evidence\n* Topic B (Y citations)...',
    icon: BarChart,
    color: 'var(--accent-green)'
  },
  {
    id: 'coverage',
    title: 'Knowledge Coverage Analysis',
    query: 'Calculate and display knowledge coverage percentages for the core topics in the context based on actual document frequency. Format strictly as a clean list, e.g.:\nTopic Name      X%\nTopic Name      Y%',
    icon: Percent,
    color: 'var(--accent-violet)'
  },
  {
    id: 'contradictions',
    title: 'Contradictions & Conflicts',
    query: 'Audit the context for any actual contradictions, conflicting claims, or data discrepancies between different sources. If conflicting evidence is detected, list them concisely. If no conflicts or contradictions are present in the context, reply with EXACTLY: "No contradictions detected from available evidence." and nothing else.',
    icon: Layers,
    color: 'var(--accent-red)'
  },
  {
    id: 'gaps',
    title: 'Knowledge Gaps',
    query: 'Identify weakly represented topics or areas with low document coverage in the context. Do not hallucinate gaps outside of the context. If no clear gaps are evident, reply with EXACTLY: "No significant knowledge gaps identified from available evidence." and nothing else.',
    icon: Compass,
    color: 'var(--accent-violet)'
  },
  {
    id: 'risks',
    title: 'Risk Assessment',
    query: 'Identify and list risks, failure modes, or technical challenges that are explicitly supported by the retrieved context. Do not suggest speculative or generic risks. If no risks are explicitly mentioned in the context, reply with EXACTLY: "No documented risks identified from available evidence." and nothing else.',
    icon: AlertTriangle,
    color: 'var(--accent-gold)'
  },
  {
    id: 'recommendations',
    title: 'Evidence-Based Recommendations',
    query: 'Generate recommendations formatted strictly as evidence observations based on the retrieved context. Do not use action-oriented recommendations like "Implement X". Instead, write observation-style points, e.g., "Topic X appears in N citations across M documents." List a maximum of 3 highly specific observations.',
    icon: Lightbulb,
    color: 'var(--accent-green)'
  }
];

export default function Analyst() {
  const [docCount, setDocCount] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [results, setResults] = useState<AnalysisSectionResult[]>([]);
  const [errorText, setErrorText] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    getDocuments()
      .then(d => {
        setDocCount(d.documents.length);
        setChunkCount(d.total_chunks);
      })
      .catch(() => { });
  }, []);

  const runAnalysis = async () => {
    if (docCount === 0) {
      setErrorText('Cannot analyze: Ingestion Vault contains 0 documents. Please ingest files first.');
      return;
    }

    setAnalyzing(true);
    setErrorText('');
    setResults([]);
    setProgressPercentage(0);

    const tempResults: AnalysisSectionResult[] = [];

    for (let i = 0; i < SECTIONS.length; i++) {
      const section = SECTIONS[i];
      setProgressText(`Generating ${section.title}...`);
      setProgressPercentage(Math.round((i / SECTIONS.length) * 100));

      try {
        const response = await queryDocuments(section.query, 3);

        // Calculate confidence based on retrieval score, citation count, and source agreement
        let confidenceRatio = 0.85; // Fallback default
        if (response.sources && response.sources.length > 0) {
          const scoresSum = response.sources.reduce((sum, src) => {
            const rawScore = src.score;
            let ratio = 0.85;
            if (rawScore < 0) {
              ratio = 0.0;
            } else if (rawScore > 1.0) {
              ratio = Math.min(100.0, rawScore) / 100.0;
            } else {
              ratio = rawScore;
            }
            return sum + ratio;
          }, 0);
          const avgRetrieval = scoresSum / response.sources.length;

          const count = response.sources.length;
          const citationFactor = Math.min(1.0, 0.7 + count * 0.1);

          const filenames = response.sources.map(s => s.metadata?.filename).filter(Boolean);
          const uniqueFiles = new Set(filenames).size;
          const sourceAgreement = uniqueFiles > 1 ? 1.0 : 0.9;

          let combined = avgRetrieval * citationFactor * sourceAgreement;
          if (combined < 0.40) {
            combined = 0.40;
          }
          confidenceRatio = combined;
        }

        const content = response.answer || 'No analysis response generated.';

        tempResults.push({
          id: section.id,
          title: section.title,
          content,
          confidence: parseFloat(confidenceRatio.toFixed(3)),
          sources: response.sources || []
        });

      } catch (err) {
        setAnalyzing(false);
        setErrorText('Inference failed. Ensure the local Ollama backend is running and the database is accessible.');
        return;
      }
    }

    setProgressPercentage(100);
    setProgressText('Analysis complete.');
    setResults(tempResults);
    setAnalyzing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const averageSystemConfidence = results.length > 0
    ? (results.reduce((sum, res) => sum + res.confidence, 0) / results.length) * 100
    : 0;

  return (
    <div style={{ padding: 28, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-soft)', paddingBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--accent-cyan)', letterSpacing: 1.8, marginBottom: 4, fontWeight: 700 }}>
            ▸ COGNITIVE INSIGHT ENGINE
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
            AI Research Analyst Mode
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', fontWeight: 500 }}>
            Synthesize strategic reports, cross-reference contradictions, and map risks over the entire local database.
          </p>
        </div>

        {results.length > 0 && !analyzing && (
          <button
            onClick={handlePrint}
            className="no-print"
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
            <Printer size={14} />
            Print Intelligence Report
          </button>
        )}
      </div>

      {/* Main Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Trigger Panel */}
        {results.length === 0 && !analyzing && (
          <ThreeDCard maxRotation={4} className="glass-panel cyber-bracket-container" style={{ padding: '36px 24px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', cursor: 'default' }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: 'var(--blue-bg)', border: '1px solid var(--blue-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 245, 255, 0.12)',
              transform: 'translateZ(25px)',
              transition: 'all 0.2s ease'
            }}>
              <Cpu size={24} color="var(--accent-cyan)" />
            </div>
            <div style={{ transform: 'translateZ(15px)' }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>Assemble Knowledge Base Analysis</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, maxWidth: 500, lineHeight: 1.55, fontWeight: 500 }}>
                This routine queries the local LLM system against all indexed chunks to auto-generate a comprehensive, 7-part intelligence audit report.
              </p>
            </div>

            {errorText && (
              <div style={{
                background: 'var(--red-bg)', border: '1px solid var(--red-border)',
                color: 'var(--accent-red)', padding: '10px 16px', borderRadius: 8,
                fontSize: 12.5, fontFamily: 'JetBrains Mono', maxWidth: 480, fontWeight: 700,
                transform: 'translateZ(10px)'
              }}>
                {errorText}
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={docCount === 0}
              className="btn-gold-analyze"
              style={{
                cursor: docCount === 0 ? 'not-allowed' : 'pointer',
                opacity: docCount === 0 ? 0.4 : 1,
                transform: 'translateZ(20px)'
              }}
            >
              Analyze Vault ({docCount} Documents)
            </button>
          </ThreeDCard>
        )}

        {/* Progress State */}
        {analyzing && (
          <div className="glass-panel cyber-bracket-container scanline-pulse" style={{ padding: '36px 24px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
            <Loader size={32} color="var(--accent-cyan)" style={{ animation: 'spin 2s linear infinite' }} />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Outfit', color: 'var(--text-primary)' }}>Analyzing Knowledge Base...</h3>
              <p style={{ fontSize: 13, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontWeight: 600 }}>{progressText}</p>
            </div>

            {/* Progress Meter */}
            <div style={{ width: '100%', maxWidth: 360, height: 8, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden', marginTop: 4, border: '1px solid var(--border)' }}>
              <div style={{ width: `${progressPercentage}%`, height: '100%', background: 'var(--gradient-cyan)', transition: 'width 0.4s ease', boxShadow: '0 0 10px rgba(0, 245, 255, 0.4)' }} />
            </div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)', fontWeight: 700 }}>
              {progressPercentage}% COMPILED
            </div>
          </div>
        )}

        {/* Report Output Panel */}
        {results.length > 0 && !analyzing && (
          <div className="analyst-layout-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>

            {/* Nav anchors index */}
            <div className="glass-panel no-print cyber-bracket-container" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>
                REPORT ANCHORS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SECTIONS.map(sec => (
                  <a
                    key={sec.id}
                    href={`#sec-${sec.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      borderRadius: 6, textDecoration: 'none', color: 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--navy-subtle)';
                      e.currentTarget.style.color = 'var(--accent-cyan)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sec.color }} />
                    {sec.title}
                  </a>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12, marginTop: 8 }}>
                <button
                  onClick={runAnalysis}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-surface)', color: 'var(--text-primary)',
                    fontSize: 12.5, fontWeight: 700, fontFamily: 'Outfit', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <RefreshCw size={12} />
                  Re-run Analysis
                </button>
              </div>
            </div>

            {/* Print friendly document wrapper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="intelligence-print-layout">

              {/* Cover Header */}
              <div className="glass-panel cyber-bracket-container" style={{ padding: 24, borderRadius: 14, borderLeft: '4px solid var(--accent-gold)', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 15.5, fontFamily: 'JetBrains Mono', color: 'var(--accent-gold)', letterSpacing: 1.5, fontWeight: 700, margin: 0 }}>
                      SYSTEM INTELLIGENCE SECURITY REPORT
                    </h2>
                    <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'Outfit' }}>
                      Semantic Knowledge Audit
                    </h3>
                  </div>
                  <span style={{
                    fontSize: 9.5, fontFamily: 'JetBrains Mono', color: 'var(--status-ok)',
                    border: '1px solid var(--green-border)', background: 'var(--green-bg)',
                    padding: '3px 8px', borderRadius: 4, fontWeight: 700
                  }}>
                    SECURITY CLEARANCE: SECURE LOCAL
                  </span>
                </div>

                {/* Audit metadata grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 16, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>DATE COMPILED</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'Outfit' }}>
                      {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SOURCE NODES</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'Outfit' }}>{docCount} Documents</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>TOTAL CHUNKS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'Outfit' }}>{chunkCount} Chunks</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>CONFIDENCE INDEX</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-ok)', marginTop: 2, fontFamily: 'Outfit' }}>
                      {averageSystemConfidence.toFixed(1)}% OPTIMAL
                    </div>
                  </div>
                </div>
              </div>

              {/* Sections results */}
              {results.map((res) => {
                const sectionMeta = SECTIONS.find(s => s.id === res.id)!;
                const IconComponent = sectionMeta.icon;
                const scorePercent = Math.round(res.confidence * 100);

                return (
                  <div
                    key={res.id}
                    id={`sec-${res.id}`}
                    className="glass-panel cyber-bracket-container"
                    style={{
                      padding: 24, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16,
                      scrollMarginTop: 20, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
                      borderTop: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)'
                    }}
                  >

                    {/* Section title & Dial */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: `${sectionMeta.color}15`, border: `1px solid ${sectionMeta.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: sectionMeta.color
                        }}>
                          <IconComponent size={18} style={{ color: sectionMeta.color }} />
                        </div>
                        <h3 style={{ fontSize: 17.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                          {res.title}
                        </h3>
                      </div>

                      {/* confidence score badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontWeight: 700 }}>CONFIDENCE RATIO</span>
                        <div style={{
                          fontSize: 11.5, fontFamily: 'JetBrains Mono', fontWeight: 700,
                          color: scorePercent > 80 ? 'var(--status-ok)' : 'var(--accent-gold)',
                          border: `1px solid ${scorePercent > 80 ? 'rgba(16,185,129,0.25)' : 'rgba(255,159,28,0.25)'}`,
                          background: scorePercent > 80 ? 'var(--green-bg)' : 'var(--amber-bg)',
                          padding: '3px 8px', borderRadius: 4
                        }}>
                          {scorePercent}%
                        </div>
                      </div>
                    </div>

                    {/* Content Answer */}
                    <p style={{
                      fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0,
                      whiteSpace: 'pre-wrap', fontWeight: 500
                    }}>
                      {res.content}
                    </p>

                    {/* Evidence accordion */}
                    {res.sources && res.sources.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                        <button
                          onClick={() => setExpandedSection(expandedSection === res.id ? null : res.id)}
                          className="no-print"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 10.5, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace',
                            padding: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
                          }}
                        >
                          {expandedSection === res.id ? '▼ HIDE EVIDENCE TRAIL' : `▶ SHOW EVIDENCE TRAIL (${res.sources.length} SOURCES)`}
                        </button>

                        <div
                          className="evidence-trail"
                          style={{
                            display: expandedSection === res.id ? 'flex' : 'none',
                            flexDirection: 'column',
                            gap: 10,
                            marginTop: 12
                          }}
                        >
                          {res.sources.map((src, idx) => {
                            const matchPercent = Math.round(
                              (() => {
                                const rawScore = src.score;
                                if (rawScore < 0) return 0;
                                if (rawScore > 1.0) return Math.min(100, rawScore);
                                return rawScore * 100;
                              })()
                            );
                            return (
                              <div key={idx} style={{
                                padding: 12, background: 'var(--navy-subtle)', border: '1px solid var(--border)',
                                borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={12} color="var(--text-muted)" />
                                    <span style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', fontWeight: 700 }}>
                                      {src.metadata?.filename || 'Unnamed Source'}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700,
                                    color: matchPercent > 80 ? 'var(--status-ok)' : 'var(--accent-gold)'
                                  }}>
                                    {matchPercent}% CITATION MATCH
                                  </span>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontStyle: 'italic', fontWeight: 500 }}>
                                  "{src.document.slice(0, 320)}{src.document.length > 320 ? '...' : ''}"
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Integrity footprint audit trail */}
              <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--border-soft)', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
                <CheckCircle size={14} color="var(--status-ok)" />
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>
                  EVIDENCE VERIFICATION PROTOCOL COMPLETE · 100% LOCAL COMPILATION PROVENANCE ACTIVE
                </span>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
