import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { enquiryAPI, researchAPI, developerAPI } from '../services/api'
import { useStore } from '../store/useStore'

const ENQ_MSG = {
  pending:    'Query received — agents mobilising...',
  routing:    'Enquiry Dept analysing query intent...',
  dispatched: 'Dispatched to hub(s) ✓',
  failed:     'Routing failed ✗',
}
const HUB_MSG = {
  pending:    'Queued...',
  processing: 'Agents actively working...',
  completed:  'Completed ✓',
  failed:     'Failed ✗',
}

// Hub color map
const HUB_COLORS = {
  research: { primary: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
  developer: { primary: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
}

function StatusDot({ status, color }) {
  if (status === 'completed') return <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-400" />
  if (status === 'failed')    return <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-400" />
  return <span className="pulse-dot flex-shrink-0" style={{ background: color }} />
}

function ResultCard({ title, color, borderColor, result, status, onViewFull }) {
  if (!result && !status) return null
  return (
    <div className="rounded-xl p-4 transition-all"
      style={{ background: `${color}08`, border: `1px solid ${borderColor}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold tracking-widest" style={{ color }}>{title}</span>
        {result && (
          <button onClick={onViewFull}
            className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all hover:opacity-80"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            VIEW ↗
          </button>
        )}
      </div>
      {!result ? (
        <div className="flex items-center gap-2 text-xs">
          <StatusDot status={status} color={color} />
          <span style={{ color: `${color}bb` }}>{HUB_MSG[status] ?? status}</span>
        </div>
      ) : (
        <div className="text-xs leading-relaxed line-clamp-2" style={{ color: `${color}88` }}>
          {result.substring(0, 100)}...
        </div>
      )}
    </div>
  )
}

function ResultModal({ title, content, color, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(2,8,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: '#071628',
          border: `1px solid ${color}30`,
          boxShadow: `0 0 60px ${color}15`,
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${color}20`, background: `${color}08` }}>
          <div>
            <div className="text-xs tracking-widest font-bold mb-0.5" style={{ color }}>{title}</div>
            <div className="text-xs" style={{ color: '#5a7a9a' }}>Click outside to close</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#7aa3c4' }}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: '#7aa3c4', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
            {content}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function OperationsPanel({ onResultsReady }) {
  const user               = useStore(s => s.user)
  const isActive           = useStore(s => s.isActive)
  const setIsActive        = useStore(s => s.setIsActive)
  const setActiveHubs      = useStore(s => s.setActiveHubs)
  const addActivity        = useStore(s => s.addActivity)
  const researchResult     = useStore(s => s.researchResult)
  const setResearchResult  = useStore(s => s.setResearchResult)
  const devResult          = useStore(s => s.devResult)
  const setDevResult       = useStore(s => s.setDevResult)
  const setResearchSessionId = useStore(s => s.setResearchSessionId)
  const setDevSessionId    = useStore(s => s.setDevSessionId)
  const moveAgentsToEnquiry  = useStore(s => s.moveAgentsToEnquiry)
  const setAgentsRouting     = useStore(s => s.setAgentsRouting)
  const dispatchAgents       = useStore(s => s.dispatchAgents)
  const setAgentsWorking     = useStore(s => s.setAgentsWorking)
  const returnAgentsToHub    = useStore(s => s.returnAgentsToHub)
  const finishReturn         = useStore(s => s.finishReturn)

  const [query, setQuery]               = useState('')
  const [enquiryStatus, setEnquiryStatus] = useState(null)
  const [enquiryReasoning, setEnquiryReasoning] = useState(null)
  const [enquiryHubs, setEnquiryHubs]   = useState([])
  const [researchStatus, setResearchStatus] = useState(null)
  const [devStatus, setDevStatus]       = useState(null)
  const [error, setError]               = useState(null)
  const [modal, setModal]               = useState(null)
  const [inputFocused, setInputFocused] = useState(false)

  const enqPoll = useRef(null), resPoll = useRef(null), devPoll = useRef(null)
  const stopAll = () => { clearInterval(enqPoll.current); clearInterval(resPoll.current); clearInterval(devPoll.current) }
  useEffect(() => () => stopAll(), [])

  const checkDone = (hubs, latestRes, latestDev) => {
    const resDone = !hubs.includes('research')  || !!latestRes
    const devDone = !hubs.includes('developer') || !!latestDev
    if (resDone && devDone) {
      setIsActive(false); setActiveHubs([])
      returnAgentsToHub()
      addActivity('All missions complete. Agents returning.')
      setTimeout(() => { finishReturn(); addActivity('Hub secured. Agents back on standby.') }, 3500)
    }
  }

  const pollResearch = (sessionId, hubs) => {
    resPoll.current = setInterval(async () => {
      try {
        const { data } = await researchAPI.getResult(sessionId)
        setResearchStatus(data.status)
        if (data.status === 'processing') addActivity('Research Lab: Agents processing...')
        if (data.status === 'completed') {
          clearInterval(resPoll.current); setResearchResult(data.result)
          addActivity('Research Lab: Report complete ✅')
          if (onResultsReady) onResultsReady()
          checkDone(hubs, data.result, useStore.getState().devResult)
        }
        if (data.status === 'failed') {
          clearInterval(resPoll.current); addActivity('Research Lab: Mission failed ❌')
          checkDone(hubs, 'failed', useStore.getState().devResult)
        }
      } catch (e) { console.error('Research poll:', e) }
    }, 3000)
  }

  const pollDeveloper = (sessionId, hubs) => {
    devPoll.current = setInterval(async () => {
      try {
        const { data } = await developerAPI.getResult(sessionId)
        setDevStatus(data.status)
        if (data.status === 'processing') addActivity('Dev Hub: Agents coding...')
        if (data.status === 'completed') {
          clearInterval(devPoll.current); setDevResult(data.result)
          addActivity('Dev Hub: Work complete ✅')
          if (onResultsReady) onResultsReady()
          checkDone(hubs, useStore.getState().researchResult, data.result)
        }
        if (data.status === 'failed') {
          clearInterval(devPoll.current); addActivity('Dev Hub: Mission failed ❌')
          checkDone(hubs, useStore.getState().researchResult, 'failed')
        }
      } catch (e) { console.error('Dev poll:', e) }
    }, 3000)
  }

  const handleSubmit = async () => {
    if (!query.trim() || isActive) return
    stopAll()
    setError(null); setResearchResult(null); setDevResult(null)
    setEnquiryStatus(null); setEnquiryReasoning(null); setEnquiryHubs([])
    setResearchStatus(null); setDevStatus(null)
    setIsActive(true)
    addActivity(`Query submitted: "${query}"`)

    try {
      const { data } = await enquiryAPI.submit(user.id, query)
      const enqId = data.enquiry_session_id
      setEnquiryStatus('pending')
      addActivity('Enquiry Dept received query. Agents mobilising...')
      moveAgentsToEnquiry()
      setTimeout(() => { setAgentsRouting(); addActivity('Agents at Enquiry Dept — routing in progress.') }, 3200)

      enqPoll.current = setInterval(async () => {
        try {
          const { data: r } = await enquiryAPI.getResult(enqId)
          setEnquiryStatus(r.status)
          if (r.status === 'routing') addActivity('Enquiry Dept: Analysing query intent...')
          if (r.status === 'dispatched') {
            clearInterval(enqPoll.current)
            const hubs = r.routing_decision ?? []
            setEnquiryHubs(hubs); setActiveHubs(hubs); setEnquiryReasoning(r.reasoning)
            addActivity(`Routing → ${hubs.map(h => h.toUpperCase()).join(' + ')}`)
            addActivity(`Reason: ${r.reasoning}`)
            dispatchAgents(hubs)
            setTimeout(() => { setAgentsWorking(); addActivity(`Agents deployed to: ${hubs.join(', ')}`) }, 3500)
            if (r.research_session_id) { setResearchSessionId(r.research_session_id); pollResearch(r.research_session_id, hubs) }
            if (r.dev_session_id) { setDevSessionId(r.dev_session_id); pollDeveloper(r.dev_session_id, hubs) }
          }
          if (r.status === 'failed') {
            clearInterval(enqPoll.current); setError('Enquiry routing failed.')
            setIsActive(false); setActiveHubs([])
            returnAgentsToHub(); setTimeout(finishReturn, 3200)
          }
        } catch (e) { console.error('Enquiry poll:', e) }
      }, 2500)
    } catch (e) {
      console.error(e); setError('Failed to submit query to Enquiry Dept.'); setIsActive(false)
    }
  }

  // Example queries
  const examples = [
    'Research quantum computing trends',
    'Build a REST API for a todo app',
    'Analyse AI market landscape 2024',
  ]

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: '"DM Sans", sans-serif' }}>

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3"
        style={{ borderBottom: '1px solid rgba(26,58,92,0.5)' }}>
        <div className="text-xs tracking-widest mb-1" style={{ color: '#06b6d4', opacity: 0.6 }}>
          COMMAND CENTER
        </div>
        <div className="text-lg font-bold tracking-wide" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif' }}>
          Operations Panel
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Query input */}
        <div className="rounded-xl overflow-hidden transition-all"
          style={{
            background: 'rgba(13,32,64,0.6)',
            border: `1px solid ${inputFocused ? 'rgba(6,182,212,0.4)' : 'rgba(26,58,92,0.7)'}`,
            boxShadow: inputFocused ? '0 0 20px rgba(6,182,212,0.1)' : 'none',
            transition: 'all 0.2s ease',
          }}>
          <div className="px-4 pt-4 pb-2">
            <div className="text-xs font-medium tracking-widest mb-3" style={{ color: '#06b6d4', opacity: 0.7 }}>
              MISSION QUERY
            </div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              rows={4}
              disabled={isActive}
              placeholder="Ask anything — research a topic, build an app, analyse data..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: '#e8f4ff',
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: '"DM Sans", sans-serif',
                opacity: isActive ? 0.5 : 1,
              }}
            />
          </div>

          {/* Example chips */}
          {!query && !isActive && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {examples.map(ex => (
                <button key={ex}
                  onClick={() => setQuery(ex)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(6,182,212,0.06)',
                    border: '1px solid rgba(6,182,212,0.15)',
                    color: '#5a8a9a',
                  }}>
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Submit row */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid rgba(26,58,92,0.5)' }}>
            <span className="text-xs" style={{ color: '#3d6080' }}>⌘+Enter to dispatch</span>
            <button
              onClick={handleSubmit}
              disabled={isActive || !query.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold tracking-widest transition-all"
              style={{
                background:   isActive ? 'rgba(6,182,212,0.05)' : !query.trim() ? 'rgba(26,58,92,0.3)' : 'rgba(6,182,212,0.15)',
                border:       `1px solid ${isActive ? 'rgba(6,182,212,0.15)' : !query.trim() ? 'rgba(26,58,92,0.4)' : 'rgba(6,182,212,0.4)'}`,
                color:        isActive || !query.trim() ? '#3d6080' : '#06b6d4',
                cursor:       isActive || !query.trim() ? 'not-allowed' : 'pointer',
                boxShadow:    (!isActive && query.trim()) ? '0 0 16px rgba(6,182,212,0.15)' : 'none',
              }}>
              {isActive ? (
                <>
                  <span style={{
                    width: 10, height: 10,
                    border: '1.5px solid rgba(6,182,212,0.3)',
                    borderTopColor: '#06b6d4',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                  ACTIVE
                </>
              ) : 'DISPATCH ↗'}
            </button>
          </div>
        </div>

        {/* Enquiry status */}
        {enquiryStatus && (
          <div className="rounded-xl p-3.5"
            style={{
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
            <div className="flex items-center gap-2.5 mb-2">
              <StatusDot status={enquiryStatus} color="#f59e0b" />
              <span className="text-xs font-medium" style={{ color: '#f59e0b', opacity: 0.9 }}>
                ENQUIRY DEPT
              </span>
              <span className="text-xs ml-auto" style={{ color: '#7aa3c4' }}>
                {ENQ_MSG[enquiryStatus]}
              </span>
            </div>
            {enquiryHubs.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {enquiryHubs.map(h => {
                  const hc = HUB_COLORS[h] || { primary: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.25)' }
                  return (
                    <span key={h} className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                      style={{ background: hc.bg, color: hc.primary, border: `1px solid ${hc.border}` }}>
                      {h.toUpperCase()} ▸
                    </span>
                  )
                })}
              </div>
            )}
            {enquiryReasoning && (
              <div className="mt-2.5 text-xs leading-relaxed italic"
                style={{ color: '#5a7a9a', borderTop: '1px solid rgba(245,158,11,0.1)', paddingTop: 8 }}>
                "{enquiryReasoning}"
              </div>
            )}
          </div>
        )}

        {/* Hub statuses */}
        {(researchStatus || devStatus) && (
          <div className="space-y-2">
            {researchStatus && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <StatusDot status={researchStatus} color="#8b5cf6" />
                <span style={{ color: '#8b5cf6' }}>Research Lab</span>
                <span className="ml-auto" style={{ color: '#7aa3c4' }}>{HUB_MSG[researchStatus] ?? researchStatus}</span>
              </div>
            )}
            {devStatus && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <StatusDot status={devStatus} color="#10b981" />
                <span style={{ color: '#10b981' }}>Dev Hub</span>
                <span className="ml-auto" style={{ color: '#7aa3c4' }}>{HUB_MSG[devStatus] ?? devStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 text-xs"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            ⚠ {error}
          </div>
        )}

        {/* Results preview */}
        {(researchResult || devResult) && enquiryHubs.length === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <ResultCard title="RESEARCH" color="#8b5cf6" borderColor="rgba(139,92,246,0.3)"
              result={researchResult} status={researchStatus}
              onViewFull={() => setModal({ title: 'RESEARCH REPORT', content: researchResult, color: '#8b5cf6' })} />
            <ResultCard title="DEVELOPER" color="#10b981" borderColor="rgba(16,185,129,0.3)"
              result={devResult} status={devStatus}
              onViewFull={() => setModal({ title: 'DEVELOPER OUTPUT', content: devResult, color: '#10b981' })} />
          </div>
        )}
        {enquiryHubs.length === 1 && (
          <>
            {enquiryHubs[0] === 'research' && (
              <ResultCard title="RESEARCH RESULT" color="#8b5cf6" borderColor="rgba(139,92,246,0.3)"
                result={researchResult} status={researchStatus}
                onViewFull={() => setModal({ title: 'RESEARCH REPORT', content: researchResult, color: '#8b5cf6' })} />
            )}
            {enquiryHubs[0] === 'developer' && (
              <ResultCard title="DEVELOPER OUTPUT" color="#10b981" borderColor="rgba(16,185,129,0.3)"
                result={devResult} status={devStatus}
                onViewFull={() => setModal({ title: 'DEVELOPER OUTPUT', content: devResult, color: '#10b981' })} />
            )}
          </>
        )}

      </div>

      {modal && (
        <ResultModal title={modal.title} content={modal.content} color={modal.color} onClose={() => setModal(null)} />
      )}
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )
}
