import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Circle, Line, Text, Group } from 'react-konva'
import { useStore } from '../../store/useStore'

// ─── Canvas constants ────────────────────────────────────────────────────────
const W = 1200
const H = 560
const GROUND_Y = 490   // y where building bases sit

// Building definitions — all have (y + h) === GROUND_Y
const B = {
  hub:      { x: 30,   y: 190, w: 180, h: 300, color: '#00e5ff', dim: '#0a3a4a', label: 'AGENT HUB',    floors: 3 },
  enquiry:  { x: 455,  y: 140, w: 210, h: 350, color: '#ffaa00', dim: '#5a3a08', label: 'ENQUIRY DEPT', floors: 4 },
  research: { x: 840,  y: 205, w: 170, h: 285, color: '#00e5ff', dim: '#0a3a4a', label: 'RESEARCH LAB', floors: 3 },
  dev:      { x: 1022, y: 248, w: 150, h: 242, color: '#4d9fff', dim: '#0a2a4a', label: 'DEV HUB',      floors: 3 },
}

// Agent walk positions — match useStore POSITIONS exactly
const WALK_Y = 468

// ─── Animated agents hook ────────────────────────────────────────────────────
function useAnimatedAgents(agents) {
  const posRef = useRef({})
  const [positions, setPositions] = useState({})

  useEffect(() => {
    agents.forEach(agent => {
      if (!posRef.current[agent.id]) {
        posRef.current[agent.id] = { x: agent.x ?? 120, y: agent.y ?? WALK_Y }
      }
    })
    setPositions({ ...posRef.current })
  }, [agents.length])

  useEffect(() => {
    let frame
    const animate = () => {
      const next = { ...posRef.current }
      agents.forEach(agent => {
        const cur = posRef.current[agent.id] ?? { x: agent.x ?? 120, y: agent.y ?? WALK_Y }
        const tx = agent.targetX ?? agent.x ?? 120
        const ty = agent.targetY ?? agent.y ?? WALK_Y
        const dx = tx - cur.x
        const dy = ty - cur.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0.8) {
          const speed = Math.min(3, dist * 0.05)
          next[agent.id] = { x: cur.x + (dx / dist) * speed, y: cur.y + (dy / dist) * speed }
        } else {
          next[agent.id] = { x: tx, y: ty }
        }
      })
      posRef.current = next
      setPositions({ ...next })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [agents])

  return positions
}

// ─── Skill colors ────────────────────────────────────────────────────────────
const SKILL_COLOR = {
  junior: '#34d399',
  mid:    '#60a5fa',
  senior: '#00e5ff',
  expert: '#fbbf24',
}

// ─── Agent character ─────────────────────────────────────────────────────────
function AgentNode({ x, y, agent, tick }) {
  const color   = SKILL_COLOR[agent.skill_level] || '#00e5ff'
  const walking = agent.animationState === 'walking'
  const working = agent.animationState === 'working'
  const bobY    = walking ? Math.sin(tick * 0.22) * 3.5
                : working ? Math.sin(tick * 0.12) * 1.5 : 0

  return (
    <Group x={x} y={y + bobY}>
      {/* Ground shadow */}
      <Rect x={-11} y={24} width={22} height={5} cornerRadius={3}
        fill={color} opacity={0.12} />

      {/* Body blob */}
      <Rect x={-9} y={2} width={18} height={21} cornerRadius={[4,4,7,7]}
        fill={color} opacity={0.92}
        shadowColor={color} shadowBlur={working ? 12 : 4} shadowOpacity={0.5} />

      {/* Head */}
      <Circle y={-6} radius={11}
        fill={color}
        shadowColor={color} shadowBlur={working ? 14 : 5} shadowOpacity={0.55} />

      {/* Goggle band */}
      <Rect x={-11} y={-10} width={22} height={6} cornerRadius={3}
        fill="rgba(0,0,0,0.45)" />

      {/* Eyes */}
      <Circle x={-4} y={-7} radius={3.5} fill="white" />
      <Circle x={4}  y={-7} radius={3.5} fill="white" />
      <Circle x={-4} y={-6} radius={1.8} fill="#060010" />
      <Circle x={4}  y={-6} radius={1.8} fill="#060010" />
      <Circle x={-3} y={-7} radius={0.8} fill="white" />
      <Circle x={5}  y={-7} radius={0.8} fill="white" />

      {/* Arms */}
      <Line points={[-9, 8, working ? -16 : -14, working ? -4 : 20]}
        stroke={color} strokeWidth={4} lineCap="round" />
      <Line points={[9,  8, working ?  16 :  14, working ? -4 : 20]}
        stroke={color} strokeWidth={4} lineCap="round" />

      {/* Legs */}
      <Line points={[-5, 23, walking ? -9 : -5, 36]}
        stroke={color} strokeWidth={4} lineCap="round" />
      <Line points={[5,  23, walking ?  9 :  5, 36]}
        stroke={color} strokeWidth={4} lineCap="round" />

      {/* Working sparkles */}
      {working && (
        <>
          <Text text="✦" x={10}  y={-20} fontSize={10} fill={color} opacity={0.9} />
          <Text text="✦" x={-20} y={-14} fontSize={7}  fill={color} opacity={0.7} />
        </>
      )}

      {/* Name */}
      <Text text={agent.name?.split(' ')[0] ?? ''}
        x={-22} y={38} width={44} align="center"
        fontSize={7} fill={color} opacity={0.85} />
    </Group>
  )
}

// ─── Tree ────────────────────────────────────────────────────────────────────
function Tree({ x, s = 1 }) {
  return (
    <Group x={x} y={GROUND_Y}>
      {/* Shadow */}
      <Rect x={-7 * s} y={-3} width={14 * s} height={5}
        cornerRadius={4} fill="#000" opacity={0.25} />
      {/* Trunk */}
      <Rect x={-4 * s} y={-32 * s} width={8 * s} height={32 * s}
        fill="#241204" cornerRadius={[1,1,0,0]} />
      {/* Lower leaves */}
      <Circle             y={-46 * s} radius={19 * s} fill="#091a0c" opacity={0.95} />
      <Circle x={-14 * s} y={-36 * s} radius={13 * s} fill="#071508" opacity={0.9}  />
      <Circle x={ 14 * s} y={-36 * s} radius={13 * s} fill="#071508" opacity={0.9}  />
      {/* Upper leaves */}
      <Circle             y={-62 * s} radius={13 * s} fill="#0d2814" opacity={0.9}  />
      {/* Highlight */}
      <Circle x={-5 * s}  y={-66 * s} radius={5  * s} fill="#1a4a22" opacity={0.55} />
    </Group>
  )
}

// ─── Bush ────────────────────────────────────────────────────────────────────
function Bush({ x }) {
  return (
    <Group x={x} y={GROUND_Y}>
      <Circle             y={-9}  radius={9}  fill="#060f08" opacity={0.85} />
      <Circle x={-8}      y={-6}  radius={7}  fill="#050d07" opacity={0.85} />
      <Circle x={ 8}      y={-6}  radius={7}  fill="#050d07" opacity={0.85} />
      <Circle             y={-14} radius={5}  fill="#0a1c0c" opacity={0.8}  />
    </Group>
  )
}

// ─── Street lamp ─────────────────────────────────────────────────────────────
function Lamp({ x, isActive }) {
  return (
    <Group x={x} y={GROUND_Y - 12}>
      <Rect x={-2} y={-90} width={4} height={90} fill="#1a0a35" cornerRadius={2} />
      <Rect x={-2} y={-90} width={22} height={3}  fill="#1a0a35" cornerRadius={1} />
      <Circle x={20} y={-90} radius={5}
        fill={isActive ? '#fbbf24bb' : '#221040'}
        shadowColor={isActive ? '#fbbf24' : 'transparent'}
        shadowBlur={isActive ? 18 : 0} shadowOpacity={0.75} />
    </Group>
  )
}

// ─── Building ────────────────────────────────────────────────────────────────
function Building({ bldg, isActive, agentCount, onClick }) {
  const { x, y, w, h, color, dim, label, floors } = bldg
  const ac = isActive ? color : dim
  const wPerFloor = w > 190 ? 4 : 3
  const fH  = h / floors
  const wW  = Math.floor((w - 28) / wPerFloor) - 6
  const wH  = Math.floor(fH * 0.42)

  return (
    <Group onClick={onClick} onTap={onClick}>

      {/* Outer glow when active */}
      {isActive && (
        <Rect x={x - 14} y={y - 12} width={w + 28} height={h + 12}
          cornerRadius={8} fill={color} opacity={0.06}
          shadowColor={color} shadowBlur={60} shadowOpacity={0.85} />
      )}

      {/* Foundation */}
      <Rect x={x - 10} y={GROUND_Y - 10} width={w + 20} height={16}
        fill={isActive ? `${color}28` : '#0a0318'}
        stroke={ac} strokeWidth={1} cornerRadius={[0,0,4,4]} />

      {/* Main facade */}
      <Rect x={x} y={y} width={w} height={h}
        fillLinearGradientStartPoint={{ x: 0,  y: 0 }}
        fillLinearGradientEndPoint={  { x: w,  y: h }}
        fillLinearGradientColorStops={[0, '#130928', 0.45, '#0e0620', 1, '#080315']}
        stroke={ac} strokeWidth={isActive ? 1.8 : 1}
        shadowColor={isActive ? color : 'transparent'}
        shadowBlur={isActive ? 22 : 0} shadowOpacity={0.35} />

      {/* Glass panel shimmer */}
      <Rect x={x + 8} y={y} width={14} height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={  { x: 14,y: 0 }}
        fillLinearGradientColorStops={[0,'rgba(255,255,255,0)', 0.5,`rgba(255,255,255,${isActive ? 0.03 : 0.015})`, 1,'rgba(255,255,255,0)']}
        listening={false} />

      {/* Floor dividers */}
      {Array.from({ length: floors - 1 }, (_, i) => (
        <Line key={i}
          points={[x + 6, y + fH * (i+1), x + w - 6, y + fH * (i+1)]}
          stroke={isActive ? `${color}30` : '#180730'} strokeWidth={1} />
      ))}

      {/* Windows */}
      {Array.from({ length: floors }, (_, fi) =>
        Array.from({ length: wPerFloor }, (_, wi) => {
          const wx   = x + 12 + wi * ((w - 20) / wPerFloor) + 2
          const wy   = y + fi * fH + fH * 0.22
          const isLit = isActive || (fi + wi) % 3 !== 0
          const isDoor = fi === floors - 1 && wi === Math.floor(wPerFloor / 2)

          if (isDoor) {
            return (
              <Group key={`${fi}-${wi}`}>
                <Rect x={wx} y={wy + 2} width={wW} height={wH + 14}
                  fill={isActive ? `${color}15` : '#090215'}
                  stroke={isActive ? `${color}45` : '#160530'}
                  strokeWidth={1} cornerRadius={[wW / 2.2, wW / 2.2, 0, 0]}
                  shadowColor={isActive ? color : 'transparent'}
                  shadowBlur={isActive ? 10 : 0} shadowOpacity={0.4} />
              </Group>
            )
          }

          return (
            <Group key={`${fi}-${wi}`}>
              <Rect x={wx} y={wy} width={wW} height={wH}
                fill={isLit ? (isActive ? `${color}1e` : '#0f0828') : '#060212'}
                stroke={isLit ? (isActive ? `${color}55` : '#1c0c3a') : '#0c0420'}
                strokeWidth={1} cornerRadius={2}
                shadowColor={isActive && isLit ? color : 'transparent'}
                shadowBlur={isActive ? 7 : 0} shadowOpacity={0.45} />
              {/* Blind lines */}
              {isLit && [0.35, 0.65].map((r, li) => (
                <Line key={li}
                  points={[wx + 2, wy + wH * r, wx + wW - 2, wy + wH * r]}
                  stroke={isActive ? `${color}22` : '#140630'} strokeWidth={0.5} />
              ))}
              {/* Tiny agent silhouette in first window when active */}
              {agentCount > 0 && fi >= 1 && wi < Math.min(agentCount, wPerFloor) && fi < floors - 1 && (
                <Group x={wx + wW / 2} y={wy + wH * 0.45}>
                  <Circle radius={4} fill={color} opacity={0.65} />
                  <Rect x={-4} y={4} width={8} height={9} cornerRadius={2} fill={color} opacity={0.55} />
                </Group>
              )}
            </Group>
          )
        })
      )}

      {/* Left / right edge accent */}
      <Line points={[x, y, x, GROUND_Y]}       stroke={isActive ? `${color}55` : `${dim}55`} strokeWidth={2} />
      <Line points={[x+w, y, x+w, GROUND_Y]}   stroke={isActive ? `${color}55` : `${dim}55`} strokeWidth={2} />

      {/* Roof platform */}
      <Rect x={x - 5} y={y - 10} width={w + 10} height={12}
        fill={isActive ? `${color}38` : '#0e0422'}
        stroke={ac} strokeWidth={1} cornerRadius={[4,4,0,0]}
        shadowColor={isActive ? color : 'transparent'}
        shadowBlur={isActive ? 18 : 0} shadowOpacity={0.6} />

      {/* HVAC boxes */}
      {[0.15, 0.48, 0.78].map((r, i) => (
        <Rect key={i} x={x + w * r - 9} y={y - 28} width={18} height={18}
          fill={isActive ? `${color}22` : '#090318'}
          stroke={isActive ? `${color}44` : '#160530'} strokeWidth={1} cornerRadius={2} />
      ))}

      {/* Antenna */}
      <Line points={[x + w/2, y - 28, x + w/2, y - 56]}
        stroke={isActive ? color : dim} strokeWidth={2} />
      <Circle x={x + w/2} y={y - 58} radius={4}
        fill={isActive ? color : dim}
        shadowColor={isActive ? color : 'transparent'}
        shadowBlur={isActive ? 14 : 0} shadowOpacity={0.9} />
      {isActive && (
        <Circle x={x + w/2} y={y - 58} radius={9}
          fill={color} opacity={0.25} />
      )}

      {/* Building name sign */}
      <Rect x={x + 6} y={y + 10} width={w - 12} height={24}
        fill={isActive ? `${color}18` : '#090215'}
        stroke={isActive ? `${color}44` : '#160530'}
        strokeWidth={1} cornerRadius={3} />
      <Text text={label} x={x} y={y + 15} width={w} align="center"
        fontSize={9} fill={isActive ? 'white' : ac}
        fontStyle="bold" letterSpacing={2} />

      {/* Agent count badge */}
      {agentCount > 0 && (
        <Group>
          <Circle x={x + w - 13} y={y + 7} radius={12}
            fill={color} shadowColor={color} shadowBlur={10} shadowOpacity={0.8} />
          <Text text={String(agentCount)}
            x={x + w - 25} y={y + 1} width={24} align="center"
            fontSize={11} fill="white" fontStyle="bold" />
        </Group>
      )}

      {/* Inspect hint */}
      <Text text="▼ INSPECT" x={x} y={GROUND_Y - 22} width={w} align="center"
        fontSize={7} fill={ac} opacity={0.4} letterSpacing={1} />
    </Group>
  )
}

// ─── Road system ─────────────────────────────────────────────────────────────
function Roads({ isActive, activeHubs, tick }) {
  const off = -(tick * 0.6) % 26

  // Road endpoints at ground level
  const ry = GROUND_Y - 8   // road center y

  // Hub → Enquiry
  const r1 = [B.hub.x + B.hub.w, ry, B.enquiry.x, ry]
  // Enquiry → Research
  const r2 = [B.enquiry.x + B.enquiry.w, ry, B.research.x, ry - 4]
  // Enquiry → Dev (slight downward fork)
  const r3 = [B.enquiry.x + B.enquiry.w, ry, B.dev.x, ry + 4]

  const resActive = activeHubs.includes('research')
  const devActive = activeHubs.includes('developer')

  return (
    <Group>
      {/* ── Base road surfaces ── */}
      {[r1, r2, r3].map((pts, i) => (
        <Group key={i}>
          <Line points={pts} stroke="#0e0825" strokeWidth={22} lineCap="round" />
          <Line points={pts} stroke="#160c35" strokeWidth={16} lineCap="round" />
          {/* Center dash markings */}
          <Line points={pts} stroke="#1e0f40" strokeWidth={1.5}
            dash={[12, 9]} dashOffset={off} lineCap="round" />
        </Group>
      ))}

      {/* ── Active flow lines ── */}
      {isActive && (
        <Line points={r1} stroke="#00e5ff" strokeWidth={2.5}
          dash={[16, 10]} dashOffset={off} opacity={0.85} lineCap="round"
          shadowColor="#00e5ff" shadowBlur={10} shadowOpacity={0.8} />
      )}
      {resActive && (
        <Line points={r2} stroke="#00e5ff" strokeWidth={2.5}
          dash={[16, 10]} dashOffset={off} opacity={0.85} lineCap="round"
          shadowColor="#00e5ff" shadowBlur={10} shadowOpacity={0.8} />
      )}
      {devActive && (
        <Line points={r3} stroke="#60a5fa" strokeWidth={2.5}
          dash={[16, 10]} dashOffset={off} opacity={0.85} lineCap="round"
          shadowColor="#60a5fa" shadowBlur={10} shadowOpacity={0.8} />
      )}

      {/* Fork junction dot */}
      {isActive && (resActive || devActive) && (
        <Circle x={B.enquiry.x + B.enquiry.w + 10} y={ry} radius={5}
          fill="#00e5ff"
          shadowColor="#00e5ff" shadowBlur={12} shadowOpacity={0.9} />
      )}
    </Group>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SimulationWorld() {
  const agents     = useStore(s => s.agents)
  const isActive   = useStore(s => s.isActive)
  const activeHubs = useStore(s => s.activeHubs)

  const [selectedZone, setSelectedZone] = useState(null)
  const [tick, setTick] = useState(0)
  const [stageW, setStageW] = useState(W)
  const containerRef = useRef()
  const positions = useAnimatedAgents(agents)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const obs = new ResizeObserver(entries => setStageW(entries[0].contentRect.width))
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const scale = stageW / W

  const inZone = (zones) => agents.filter(a =>
    Array.isArray(zones) ? zones.includes(a.currentZone) : a.currentZone === zones
  )

  const hubAgents      = inZone(['hub', 'returning'])
  const enquiryAgents  = inZone(['toEnquiry', 'enquiry'])
  const researchAgents = inZone(['toResearch', 'research'])
  const devAgents      = inZone(['toDev', 'dev'])

  const enquiryActive  = true
  const researchActive = activeHubs.includes('research')
  const devActive      = activeHubs.includes('developer')

  return (
    <div ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height: H, background: '#040210',
               border: '1px solid rgba(0,229,255,0.15)' }}>

      <Stage width={stageW} height={H} scaleX={scale} scaleY={scale}>
        <Layer>

          {/* ── Sky gradient ── */}
          <Rect x={0} y={0} width={W} height={H}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={  { x: 0, y: H }}
            fillLinearGradientColorStops={[0, '#030112', 0.55, '#070218', 1, '#0a0320']} />

          {/* ── Stars ── */}
          {Array.from({ length: 50 }, (_, i) => (
            <Circle key={i}
              x={(i * 149.5) % W}
              y={(i * 89.7)  % (H * 0.52)}
              radius={i % 6 === 0 ? 1.6 : 0.9}
              fill="white"
              opacity={0.07 + (i % 6) * 0.04} />
          ))}

          {/* ── Distant city silhouette ── */}
          {[60,150,230,330,430,600,690,790,940,1060,1140].map((bx, i) => (
            <Rect key={i}
              x={bx} y={GROUND_Y - 55 - (i * 19) % 75}
              width={38 + (i * 13) % 55}
              height={(i * 19) % 75}
              fill="#07031a" opacity={0.55}
              cornerRadius={[2,2,0,0]} />
          ))}

          {/* ── Ground ── */}
          <Rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={  { x: 0, y: H - GROUND_Y }}
            fillLinearGradientColorStops={[0, '#0b0320', 1, '#060118']} />

          {/* Road surface strip */}
          <Rect x={0} y={GROUND_Y - 14} width={W} height={22}
            fill="#0e0825" opacity={0.9} />
          {/* Sidewalk edge */}
          <Rect x={0} y={GROUND_Y - 16} width={W} height={4}
            fill="#1c0a40" opacity={0.55} />

          {/* ── Roads ── */}
          <Roads isActive={isActive} activeHubs={activeHubs} tick={tick} />

          {/* ── Street lamps ── */}
          {[215, 410, 660, 825, 1000].map((lx, i) => (
            <Lamp key={i} x={lx} isActive={isActive} />
          ))}

          {/* ── Trees ── */}
          <Tree x={255}  s={0.95} />
          <Tree x={315}  s={0.72} />
          <Tree x={390}  s={0.88} />
          <Tree x={680}  s={0.82} />
          <Tree x={745}  s={1.05} />
          <Tree x={808}  s={0.78} />

          {/* ── Bushes ── */}
          {[235, 275, 340, 695, 772].map((bx, i) => <Bush key={i} x={bx} />)}

          {/* ── Buildings ── */}
          <Building bldg={B.hub}      isActive={!isActive || hubAgents.length > 0}
            agentCount={hubAgents.length}
            onClick={() => setSelectedZone({ name: 'AGENT HUB',    agents: hubAgents })} />

          <Building bldg={B.enquiry}  isActive={enquiryActive}
            agentCount={Math.max(1, enquiryAgents.length)}
            onClick={() => setSelectedZone({ name: 'ENQUIRY DEPT', agents: enquiryAgents })} />

          <Building bldg={B.research} isActive={researchActive}
            agentCount={researchAgents.length}
            onClick={() => setSelectedZone({ name: 'RESEARCH LAB', agents: researchAgents })} />

          <Building bldg={B.dev}      isActive={devActive}
            agentCount={devAgents.length}
            onClick={() => setSelectedZone({ name: 'DEV HUB',      agents: devAgents })} />

          <AgentNode
            x={B.enquiry.x + B.enquiry.w / 2}
            y={WALK_Y - 5}
            agent={{
              id: 'router',
              name: 'Router',
              skill_level: 'expert',
              animationState: enquiryAgents.length > 0 ? 'working' : 'idle',
              isMoving: false,
              isWorking: true,
            }}
            tick={tick}
          />

          {/* ── Store agents (hub idle + dispatched workers) ── */}
          {agents.map(agent => {
            const pos = positions[agent.id]
            if (!pos) return null
            return <AgentNode key={agent.id} x={pos.x} y={pos.y} agent={agent} tick={tick} />
          })}

        </Layer>
      </Stage>

      {/* ── Zone detail overlay (HTML on top of canvas) ── */}
      {selectedZone && (
        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm z-40 flex items-end"
          onClick={() => setSelectedZone(null)}>
          <div className="w-full p-5 rounded-t-2xl border-t border-cyan-500/25"
            style={{ background: '#0c0820' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-[10px] tracking-[0.35em] text-cyan-400/60 mb-1">ZONE DETAIL</div>
                <div className="text-white font-black text-lg tracking-wider">{selectedZone.name}</div>
                <div className="text-cyan-400/50 text-xs mt-0.5">
                  {selectedZone.agents.length} agent{selectedZone.agents.length !== 1 ? 's' : ''} present
                </div>
              </div>
              <button onClick={() => setSelectedZone(null)}
                className="text-cyan-400/60 hover:text-white text-lg">✕</button>
            </div>

            {selectedZone.agents.length === 0 ? (
              <div className="text-cyan-400/35 text-sm text-center py-5">No agents in this zone</div>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {selectedZone.agents.map(agent => {
                  const c = SKILL_COLOR[agent.skill_level] || '#00e5ff'
                  return (
                    <div key={agent.id} className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[76px]">
                      <div className="w-13 h-13 rounded-xl flex items-center justify-center text-2xl w-14 h-14"
                        style={{ background: `${c}12`, border: `1px solid ${c}30` }}>🤖</div>
                      <div className="text-center">
                        <div className="text-xs text-white font-semibold">{agent.name?.split(' ')[0]}</div>
                        <div className="text-[10px] text-cyan-400/65">{agent.role}</div>
                        <div className="mt-1 text-[9px] px-2 py-0.5 rounded-full inline-block"
                          style={{
                            background: agent.animationState === 'working' ? '#34d39918' : `${c}18`,
                            color:      agent.animationState === 'working' ? '#34d399'   : c,
                          }}>
                          {agent.animationState}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}