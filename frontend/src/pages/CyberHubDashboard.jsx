import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { hubAPI } from '../services/api'
import SimulationWorld from '../components/simulation/SimulationWorld'
import OperationsPanel from '../components/OperationsPanel'
import ActivityLog from '../components/ActivityLog'

// ─── Results view ─────────────────────────────────────────────────────────────
function ResultsView({ resultTime }) {
  const researchResult = useStore(s => s.researchResult)
  const devResult      = useStore(s => s.devResult)
  const [modal, setModal] = useState(null)

  if (!researchResult && !devResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-16">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>📭</span>
        </div>
        <div className="text-lg font-semibold mb-2" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif' }}>
          No results yet
        </div>
        <div className="text-sm" style={{ color: '#3d6080' }}>
          Go to Mission Control, submit a query, and results will appear here.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-widest mb-1" style={{ color: '#06b6d4', opacity: 0.7 }}>OUTPUT CENTER</div>
        <h2 className="text-2xl font-bold mb-1" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif' }}>
          Mission Results
        </h2>
        <p className="text-sm" style={{ color: '#5a7a9a' }}>
          Click a card to view the full report.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {researchResult && (
          <div className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(13,32,64,0.8)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 4px 32px rgba(139,92,246,0.1)',
            }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                🔬
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: '#e8f4ff' }}>Research Report</div>
                <div className="text-xs mt-0.5" style={{ color: '#8b5cf6' }}>Research Lab</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                  COMPLETE
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#5a7a9a' }}>
              Report ready — {researchResult.length.toLocaleString()} characters
              {resultTime && <span className="ml-2">· {resultTime.toLocaleTimeString()}</span>}
            </p>
            <button
              onClick={() => setModal({ title: 'Research Report', content: researchResult, color: '#8b5cf6', icon: '🔬' })}
              className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
              }}>
              VIEW FULL REPORT ↗
            </button>
          </div>
        )}

        {devResult && (
          <div className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(13,32,64,0.8)',
              border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 4px 32px rgba(16,185,129,0.1)',
            }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                💻
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: '#e8f4ff' }}>Developer Output</div>
                <div className="text-xs mt-0.5" style={{ color: '#10b981' }}>Dev Hub</div>
              </div>
              <div className="ml-auto">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                  COMPLETE
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#5a7a9a' }}>
              Output ready — {devResult.length.toLocaleString()} characters
            </p>
            <button
              onClick={() => setModal({ title: 'Developer Output', content: devResult, color: '#10b981', icon: '💻' })}
              className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              }}>
              VIEW FULL OUTPUT ↗
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(2,8,20,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setModal(null)}>
          <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: '#071628',
              border: `1px solid ${modal.color}30`,
              boxShadow: `0 0 60px ${modal.color}15`,
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${modal.color}20`, background: `${modal.color}08` }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{modal.icon}</span>
                <div>
                  <div className="font-bold text-base" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif' }}>
                    {modal.title}
                  </div>
                  <div className="text-xs" style={{ color: modal.color, opacity: 0.7 }}>Click outside to close</div>
                </div>
              </div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#7aa3c4' }}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6 prose-dark">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed"
                style={{ color: '#7aa3c4', fontFamily: '"JetBrains Mono", monospace' }}>
                {modal.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function CyberHubDashboard() {
  const user        = useStore(s => s.user)
  const setAgents   = useStore(s => s.setAgents)
  const addActivity = useStore(s => s.addActivity)
  const researchResult = useStore(s => s.researchResult)
  const devResult   = useStore(s => s.devResult)

  const [mainTab, setMainTab] = useState('mission')
  const [resultTime, setResultTime] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await hubAPI.getAllAgents()
        setAgents(data)
      } catch (e) { console.error(e) }
    }
    load()
    addActivity('Cyber Hub online.')
    const interval = setInterval(() => {
      if (!useStore.getState().isActive) load()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const hasResults = !!(researchResult || devResult)

  const tabs = [
    { id: 'mission', label: 'Mission Control', icon: '⚡' },
    { id: 'results', label: 'Results', icon: '📊', dot: hasResults },
  ]

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: '#030b18' }}>

      {/* ── Top nav ── */}
      <header className="h-14 flex items-center justify-between px-6"
        style={{
          background: 'rgba(7,22,40,0.95)',
          borderBottom: '1px solid rgba(6,182,212,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#06b6d4" strokeWidth="1.5"/>
              <path d="M5 6l3 2-3 2V6z" fill="#06b6d4"/>
              <circle cx="12" cy="4" r="1.5" fill="#f59e0b"/>
            </svg>
          </div>
          <span style={{
            fontFamily: '"Syne", sans-serif', fontWeight: 800,
            fontSize: 18, letterSpacing: '0.12em', color: '#e8f4ff',
          }}>
            CYBER<span style={{ color: '#06b6d4' }}>HUB</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl p-1"
          style={{ background: 'rgba(3,11,24,0.8)', border: '1px solid rgba(26,58,92,0.6)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className="relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background:   mainTab === t.id ? 'rgba(6,182,212,0.15)' : 'transparent',
                color:        mainTab === t.id ? '#06b6d4' : '#5a7a9a',
                border:       mainTab === t.id ? '1px solid rgba(6,182,212,0.3)' : '1px solid transparent',
                fontFamily:   '"DM Sans", sans-serif',
              }}>
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
              {t.dot && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 border-2"
                  style={{ borderColor: '#030b18' }} />
              )}
            </button>
          ))}
        </div>

        {/* Operator info */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="text-xs" style={{ color: '#5a7a9a' }}>
            Operator: <span style={{ color: '#7aa3c4' }}>{user?.name}</span>
          </span>
        </div>
      </header>

      {/* ── Mission Control ── */}
      {mainTab === 'mission' && (
        <div className="grid grid-cols-[1fr_380px]" style={{ height: 'calc(100vh - 56px)' }}>

          {/* Left — simulation world */}
          <div className="p-4 overflow-hidden">
            <SimulationWorld />
          </div>

          {/* Right — panels */}
          <div className="flex flex-col overflow-hidden"
            style={{ borderLeft: '1px solid rgba(26,58,92,0.5)', background: 'rgba(7,22,40,0.6)' }}>
            <div className="flex-1 overflow-hidden min-h-0">
              <OperationsPanel onResultsReady={() => setMainTab('results')} />
            </div>
            <div className="flex-shrink-0" style={{
              maxHeight: 180,
              overflowY: 'auto',
              borderTop: '1px solid rgba(26,58,92,0.5)',
            }}>
              <ActivityLog />
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {mainTab === 'results' && (
        <div style={{ height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
          <ResultsView resultTime={resultTime} />
        </div>
      )}
    </div>
  )
}
