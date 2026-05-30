import { motion } from 'framer-motion'

// Color per skill level
const COLORS = {
  junior: '#34d399',   // green
  mid:    '#60a5fa',   // blue
  senior: '#a855f7',   // purple
  expert: '#fbbf24',   // gold
}

function MinionBody({ color, animationState, size = 1 }) {
  const s = size  // scale multiplier if needed
  const isWorking = animationState === 'working'
  const isWalking = animationState === 'walking'

  return (
    <svg width={36 * s} height={48 * s} viewBox="0 0 36 48">
      {/* Body — rounded rectangle blob */}
      <rect x="6" y="18" width="24" height="24" rx="10" fill={color} opacity="0.95"/>

      {/* Head */}
      <circle cx="18" cy="14" r="12" fill={color}/>

      {/* Goggle band */}
      <rect x="6" y="10" width="24" height="7" rx="3.5" fill="rgba(0,0,0,0.35)"/>

      {/* Eyes — single big eye (minion style) or two */}
      <circle cx="12" cy="13" r="4" fill="white"/>
      <circle cx="24" cy="13" r="4" fill="white"/>
      <circle cx="13" cy="14" r="2" fill="#111"/>
      <circle cx="25" cy="14" r="2" fill="#111"/>
      {/* Eye shine */}
      <circle cx="14" cy="13" r="0.8" fill="white"/>
      <circle cx="26" cy="13" r="0.8" fill="white"/>

      {/* Smile */}
      <path d="M 12 21 Q 18 26 24 21"
        stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* Arms */}
      <line
        x1="6" y1="26"
        x2={isWorking ? "0" : "2"}
        y2={isWorking ? "18" : "34"}
        stroke={color} strokeWidth="3.5" strokeLinecap="round"
      />
      <line
        x1="30" y1="26"
        x2={isWorking ? "36" : "34"}
        y2={isWorking ? "18" : "34"}
        stroke={color} strokeWidth="3.5" strokeLinecap="round"
      />

      {/* Legs */}
      <line x1="13" y1="40" x2={isWalking ? "10" : "13"} y2="47"
        stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="23" y1="40" x2={isWalking ? "26" : "23"} y2="47"
        stroke={color} strokeWidth="3.5" strokeLinecap="round"/>

      {/* Working sparkles */}
      {isWorking && (
        <>
          <text x="28" y="8" fontSize="8">✦</text>
          <text x="2" y="10" fontSize="6">✦</text>
        </>
      )}
    </svg>
  )
}

export default function AgentSprite({ agent, static: isStatic = false, size = 'sm' }) {

  const color = COLORS[agent.skill_level] || '#a855f7'
  const isWalking = agent.animationState === 'walking'

  const sprite = (
    <div className="flex flex-col items-center">
      <motion.div
        animate={isWalking && !isStatic ? { y: [0, -3, 0] } : { y: 0 }}
        transition={{ repeat: Infinity, duration: 0.45, ease: 'easeInOut' }}
      >
        <MinionBody
          color={color}
          animationState={agent.animationState}
          size={size === 'lg' ? 1.5 : 1}
        />
      </motion.div>

      {/* Glow shadow under feet */}
      <div className="w-6 h-1 rounded-full mt-0.5"
        style={{ background: `${color}44`, filter: 'blur(3px)' }} />

      {/* Name tag */}
      <div className="mt-1 text-[8px] font-bold tracking-wide whitespace-nowrap"
        style={{ color }}>
        {agent.name?.split(' ')[0]}
      </div>
    </div>
  )

  // Static mode = used inside zone detail panel, no position animation
  if (isStatic) return sprite

  return (
    <motion.div
      className="absolute z-50"
      initial={{ x: agent.x, y: agent.y }}      // ADD THIS — start at spawn position
      animate={{ x: agent.targetX, y: agent.targetY }}
      transition={{ duration: 3, ease: 'linear' }}
    >
      {sprite}
    </motion.div>
  )
}