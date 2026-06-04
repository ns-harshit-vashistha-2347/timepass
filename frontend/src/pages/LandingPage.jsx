import { useState, useEffect } from 'react'
import { userAPI } from '../services/api'
import { useStore } from '../store/useStore'

// Floating orb component
function Orb({ cx, cy, r, color, delay = 0, duration = 6 }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: cx, top: cy,
        width: r * 2, height: r * 2,
        transform: 'translate(-50%,-50%)',
        background: `radial-gradient(circle, ${color}33 0%, ${color}00 70%)`,
        animation: `float ${duration}s ease-in-out ${delay}s infinite`,
        filter: 'blur(1px)',
      }}
    />
  )
}

// Animated network node
function NetworkNode({ x, y, active }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none transition-all duration-1000"
      style={{
        left: x, top: y,
        width: active ? 10 : 6,
        height: active ? 10 : 6,
        transform: 'translate(-50%,-50%)',
        background: active ? '#06b6d4' : '#1a3a5c',
        boxShadow: active ? '0 0 12px #06b6d4, 0 0 24px #06b6d444' : 'none',
        transition: 'all 0.8s ease',
      }}
    />
  )
}

export default function LandingPage({ onEnter }) {
  const setUser = useStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [tick, setTick]       = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 100), 150)
    return () => clearInterval(id)
  }, [])

  const handleCreateUser = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await userAPI.createTestUser()
      setUser(data)
      onEnter()
    } catch (e) {
      setError('Cannot reach the Hub. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // Which nodes pulse at each tick
  const nodeActive = (i) => (tick + i * 7) % 20 < 5

  // Connection lines (SVG)
  const nodes = [
    { x: '22%', y: '28%' }, { x: '38%', y: '18%' }, { x: '58%', y: '22%' },
    { x: '75%', y: '32%' }, { x: '82%', y: '55%' }, { x: '68%', y: '72%' },
    { x: '45%', y: '78%' }, { x: '28%', y: '65%' }, { x: '15%', y: '50%' },
    { x: '50%', y: '50%' },
  ]

  const connections = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],[9,2],[9,5],[9,7],[0,9],[3,9],
  ]

  const statuses = [
    { label: 'Agent Hub',     dot: '#10b981' },
    { label: 'Enquiry Dept',  dot: '#f59e0b' },
    { label: 'Research Lab',  dot: '#06b6d4' },
    { label: 'Dev Hub',       dot: '#8b5cf6' },
  ]

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #030b18 0%, #04111f 50%, #030810 100%)' }}
    >
      {/* Grid bg */}
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* Animated network SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.25 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {connections.map(([a, b], i) => {
          const na = nodes[a], nb = nodes[b]
          const isActive = nodeActive(a) || nodeActive(b)
          return (
            <line key={i}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={isActive ? '#06b6d4' : '#1a3a5c'}
              strokeWidth={isActive ? 1.5 : 0.8}
              opacity={isActive ? 0.7 : 0.4}
              style={{ transition: 'all 0.6s ease' }}
            />
          )
        })}
      </svg>

      {/* Network nodes */}
      {nodes.map((n, i) => (
        <NetworkNode key={i} x={n.x} y={n.y} active={nodeActive(i)} />
      ))}

      {/* Ambient orbs */}
      <Orb cx="15%" cy="20%" r={200} color="#06b6d4" delay={0} duration={8} />
      <Orb cx="85%" cy="75%" r={250} color="#8b5cf6" delay={2} duration={10} />
      <Orb cx="70%" cy="15%" r={150} color="#f59e0b" delay={4} duration={7} />
      <Orb cx="20%" cy="80%" r={180} color="#06b6d4" delay={1} duration={9} />

      {/* Center glow */}
      <div className="absolute" style={{
        left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── Main card ── */}
      <div
        className="relative z-10 flex flex-col items-center px-6 py-0"
        style={{ animation: 'fadeUp 0.8s ease both' }}
      >
        {/* Badge */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-medium"
          style={{
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.25)',
            color: '#06b6d4',
            letterSpacing: '0.12em',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
          MULTI-AGENT SIMULATION PLATFORM
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: '"Syne", sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(52px, 8vw, 96px)',
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #e8f4ff 30%, #7aa3c4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            CYBER
          </span>
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(6,182,212,0.4))',
          }}>
            HUB
          </span>
        </h1>

        {/* Tagline */}
        <p style={{
          color: '#7aa3c4',
          fontSize: 15,
          letterSpacing: '0.06em',
          marginBottom: 40,
          marginTop: 16,
          textAlign: 'center',
          fontFamily: '"DM Sans", sans-serif',
          maxWidth: 420,
          lineHeight: 1.65,
        }}>
          A living city where AI agents collaborate like a real tech company.
          Watch them think, route, research, and build — in real time.
        </p>

        {/* Zone indicators */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {statuses.map(({ label, dot }) => (
            <div key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: 'rgba(7,22,40,0.8)',
                border: '1px solid rgba(26,58,92,0.8)',
                color: '#7aa3c4',
              }}
            >
              <span className="pulse-dot" style={{ background: dot }} />
              {label}
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleCreateUser}
          disabled={loading}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 40px',
            background: loading ? 'rgba(6,182,212,0.06)'
              : hovered  ? 'rgba(6,182,212,0.18)'
              : 'rgba(6,182,212,0.1)',
            border: '1px solid',
            borderColor: loading ? 'rgba(6,182,212,0.2)'
              : hovered  ? 'rgba(6,182,212,0.8)'
              : 'rgba(6,182,212,0.4)',
            borderRadius: 12,
            color: loading ? '#7aa3c4' : '#06b6d4',
            fontFamily: '"Syne", sans-serif',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.15em',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: hovered && !loading
              ? '0 0 32px rgba(6,182,212,0.3), 0 0 64px rgba(6,182,212,0.1)'
              : '0 0 16px rgba(6,182,212,0.1)',
            transition: 'all 0.25s ease',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer sweep */}
          {hovered && !loading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.12) 50%, transparent 100%)',
              animation: 'shimmer 1.4s linear infinite',
              backgroundSize: '200% auto',
            }} />
          )}

          {loading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(6,182,212,0.3)',
                borderTopColor: '#06b6d4',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }} />
              INITIALIZING SESSION...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#06b6d4" strokeWidth="1.5"/>
                <path d="M6 5l5 3-5 3V5z" fill="#06b6d4"/>
              </svg>
              ENTER THE HUB
            </>
          )}
        </button>

        {error && (
          <p style={{
            marginTop: 16,
            color: '#ef4444',
            fontSize: 12,
            textAlign: 'center',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '8px 16px',
          }}>
            ⚠ {error}
          </p>
        )}

        <p style={{
          marginTop: 20,
          color: '#3d6080',
          fontSize: 11,
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}>
          No account needed — you'll be assigned a unique operator identity
        </p>
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 py-4"
        style={{
          borderTop: '1px solid rgba(26,58,92,0.5)',
          background: 'rgba(3,11,24,0.6)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {['Powered by Groq LLM', 'Real-time Simulation', 'Multi-Agent Architecture'].map((t, i) => (
          <span key={i} style={{ color: '#3d6080', fontSize: 11, letterSpacing: '0.1em' }}>
            {i > 0 && <span style={{ marginRight: 8, color: '#1a3a5c' }}>·</span>}
            {t}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  )
}
