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
  const [modal, setModal]   = useState(null)

  if (!researchResult && !devResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6 opacity-30">📭</div>
        <div className="text-slate-500 text-lg font-medium mb-2">No results yet</div>
        <div className="text-slate-400 text-sm">
          Go to Mission Control, submit a query, and results will appear here.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-xs tracking-[0.3em] text-indigo-400 font-bold mb-1">OUTPUT CENTER</div>
        <h2 className="text-2xl font-black text-slate-800">Mission Results</h2>
        <p className="text-slate-500 text-sm mt-1">
          Click a button to view the full report in an overlay.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Research Result Card */}
        {researchResult && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  Research Report
                </span>

                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 tracking-wider">
                  NEW
                </span>
              </div>

              <div className="text-xs text-indigo-500 font-medium">
                Research Lab

                {resultTime && (
                  <span className="text-slate-400 ml-2">
                    · {resultTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed border-t border-slate-50 pt-4">
              Report ready — {researchResult.length.toLocaleString()} characters generated
            </p>
            <button
              onClick={() => setModal({ title: '🔬 Research Report', content: researchResult, color: '#4f46e5' })}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:shadow-md active:scale-95"
              style={{ background: '#4f46e5', color: 'white' }}>
              VIEW FULL REPORT ↗
            </button>
          </div>
        )}

        {/* Developer Result Card */}
        {devResult && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-xl">💻</div>
              <div>
                <div className="font-bold text-slate-800">Developer Output</div>
                <div className="text-xs text-indigo-600 font-medium">Dev Hub</div>
              </div>
              <div className="ml-auto w-2.5 h-2.5 rounded-full bg-emerald-400" title="Completed" />
            </div>
            <p className="text-slate-400 text-xs leading-relaxed border-t border-slate-50 pt-4">
              Output ready — {devResult.length.toLocaleString()} characters generated
            </p>
            <button
              onClick={() => setModal({ title: '💻 Developer Output', content: devResult, color: '#0891b2' })}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:shadow-md active:scale-95"
              style={{ background: '#0891b2', color: 'white' }}>
              VIEW FULL OUTPUT ↗
            </button>
          </div>
        )}
      </div>

      {/* Full-screen modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setModal(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{ background: `${modal.color}08` }}>
              <div className="font-black text-slate-800 text-lg">{modal.title}</div>
              <button onClick={() => setModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 prose prose-slate max-w-none text-sm leading-relaxed">
              {/* Plain pre-formatted text fallback for markdown */}
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">
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
  const [toast, setToast] = useState(false)
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

  // Auto-switch to results when output is ready
  useEffect(() => {
    if (researchResult || devResult) {
      // Don't auto-switch — let user click the tab themselves
    }
  }, [researchResult, devResult])

  const hasResults = !!(researchResult || devResult)

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: '#f0f4ff', fontFamily: '"Inter", "JetBrains Mono", monospace' }}>

      {/* Top navigation bar */}
      <header
        className="h-14 flex items-center justify-between px-6"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          boxShadow: '0 2px 20px rgba(79,70,229,0.3)'
        }}
      >
        <div
          className="font-black text-xl tracking-widest text-white"
          style={{ fontFamily: '"Orbitron", monospace' }}
        >
          CYBER HUB
        </div>

        {/* Main tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { id: 'mission', label: '⚡ Mission Control' },
            { id: 'results', label: `📊 Results${hasResults ? ' ●' : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mainTab === t.id ? '#4f46e5' : 'transparent',
                color: mainTab === t.id ? 'white' : '#64748b',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-white/60 font-medium">
          Operator: <span className="text-white/90">{user?.name}</span>
        </div>
      </header>

      {/* MISSION CONTROL tab */}
      {mainTab === 'mission' && (
        <div className="grid grid-cols-[1fr_380px] h-[calc(100vh-56px)]">

          {/* Left — simulation world */}
          <div className="p-4 overflow-hidden">
            <SimulationWorld />
          </div>

          {/* Right — query panel + activity log */}
          <div
            className="flex flex-col overflow-hidden border-l border-indigo-100"
            style={{ background: '#f5f7ff' }}
          >
            <div className="flex-1 overflow-hidden min-h-0">
              <OperationsPanel onResultsReady={() => setMainTab('results')} />
            </div>
            <div className="max-h-48 overflow-y-auto flex-shrink-0 border-t border-slate-100">
              <ActivityLog />
            </div>
          </div>
        </div>
      )}

      {/* RESULTS tab */}
      {mainTab === 'results' && (
        <div className="h-[calc(100vh-56px)] overflow-y-auto">
          <ResultsView resultTime={resultTime} />
        </div>
      )}
    </div>
  )
}