import type { ModelLoadedStatus } from './lib/types';
import { useState, useEffect } from 'react';
import { checkHealth } from './lib/api';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import KnowledgeGraph from './pages/KnowledgeGraph';
import Analyst from './pages/Analyst';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingBackground from './components/FloatingBackground';

type Page = 'dashboard' | 'upload' | 'chat' | 'documents' | 'graph' | 'analyst';
type Theme = 'dark' | 'light';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [modelStatus, setModelStatus] = useState<ModelLoadedStatus | undefined>();
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('im-theme') as Theme) ?? 'dark'
  );

  useEffect(() => {
    checkHealth()
      .then(h => setModelStatus(h.models_loaded))
      .catch(() => { });
  }, []);

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('im-theme', next);
      return next;
    });
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'upload': return <UploadPage />;
      case 'chat': return <Chat theme={theme} onToggleTheme={toggleTheme} />;
      case 'documents': return <Documents />;
      case 'graph': return <KnowledgeGraph theme={theme} />;
      case 'analyst': return <Analyst />;
      default: return <Dashboard />;
    }
  };

  return (
    <div
      data-theme={theme}
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg-page)',
        overflow: 'hidden',
        transition: 'background-color 0.25s ease, color 0.25s ease',
        position: 'relative'
      }}
    >
      <FloatingBackground />
      <Sidebar
        currentPage={page}
        onNavigate={p => setPage(p as Page)}
        modelStatus={modelStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background-color 0.25s ease' }}>
        <StatusBar status={modelStatus} />
        <main style={{ flex: 1, overflowY: 'auto', transition: 'background-color 0.25s ease', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ height: '100%', width: '100%' }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
