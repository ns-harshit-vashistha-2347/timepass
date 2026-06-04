import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arc } from 'react-konva'
import { useStore } from '../../store/useStore'

// ─── Canvas constants ────────────────────────────────────────────────────────
const W = 1200
const H = 560
const GROUND_Y = 490

// ─── Building definitions ────────────────────────────────────────────────────
const B = {
  hub:      { x: 28,   y: 175, w: 185, h: 315, label: 'AGENT HUB',    floors: 4,
              color: '#06b6d4', glow: '#06b6d4', dark: '#051a25' },
  enquiry:  { x: 448,  y: 130, w: 215, h: 360, label: 'ENQUIRY DEPT', floors: 5,
              color: '#f59e0b', glow: '#f59e0b', dark: '#1a0e02' },
  research: { x: 838,  y: 200, w: 175, h: 290, label: 'RESEARCH LAB', floors: 4,
              color: '#8b5cf6', glow: '#8b5cf6', dark: '#120b20' },
  dev:      { x: 1025, y: 242, w: 152, h: 248, label: 'DEV HUB',      floors: 3,
              color: '#10b981', glow: '#10b981', dark: '#061610' },
}

const WALK_Y = 462

// ─── Animated agents ────────────────────────────────────────────────────────
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
        const dx = tx - cur.x, dy = ty - cur.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist > 0.6) {
          const speed = Math.min(2.5, dist * 0.06)
          next[agent.id] = { x: cur.x + (dx/dist)*speed, y: cur.y + (dy/dist)*speed }
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
  junior: '#10b981',
  mid:    '#06b6d4',
  senior: '#8b5cf6',
  expert: '#f59e0b',
}

// ─── Agent character (robot style) ───────────────────────────────────────────
function AgentNode({ x, y, agent, tick }) {
  const color   = SKILL_COLOR[agent.skill_level] || '#06b6d4'
  const walking = agent.animationState === 'walking'
  const working = agent.animationState === 'working'
  const idle    = !walking && !working

  const bobY = walking ? Math.sin(tick * 0.25) * 4
             : working ? Math.sin(tick * 0.14) * 2 : 0
  const legSwing = walking ? Math.sin(tick * 0.25) * 5 : 0

  return (
    <Group x={x} y={y + bobY}>
      {/* Aura when working */}
      {working && (
        <Circle radius={22} fill={color} opacity={0.07 + Math.sin(tick * 0.1) * 0.04} />
      )}

      {/* Ground shadow */}
      <Rect x={-14} y={28} width={28} height={6} cornerRadius={4}
        fill="#000" opacity={0.3} />

      {/* Legs */}
      <Rect
        x={-8} y={18}
        width={7} height={14}
        cornerRadius={[0,0,4,4]}
        fill={color} opacity={0.85}
        rotation={walking ? legSwing : 0}
      />
      <Rect
        x={1} y={18}
        width={7} height={14}
        cornerRadius={[0,0,4,4]}
        fill={color} opacity={0.85}
        rotation={walking ? -legSwing : 0}
      />

      {/* Body */}
      <Rect x={-11} y={-2} width={22} height={22} cornerRadius={[3,3,6,6]}
        fill={color} opacity={0.9}
        shadowColor={color} shadowBlur={working ? 14 : 5} shadowOpacity={0.6}
      />
      {/* Body highlight stripe */}
      <Rect x={-7} y={1} width={14} height={3} cornerRadius={2}
        fill="rgba(255,255,255,0.2)" />
      {/* Chest badge */}
      <Rect x={-4} y={6} width={8} height={8} cornerRadius={1}
        fill={`${color}44`} stroke={`${color}88`} strokeWidth={0.8} />
      {/* Chest light */}
      <Circle x={0} y={10} radius={2}
        fill={working ? 'white' : color}
        opacity={working ? 0.9 + Math.sin(tick * 0.2) * 0.1 : 0.6}
        shadowColor={color} shadowBlur={working ? 8 : 0} shadowOpacity={0.9}
      />

      {/* Neck */}
      <Rect x={-4} y={-7} width={8} height={7} cornerRadius={2}
        fill={color} opacity={0.7} />

      {/* Head */}
      <Rect x={-13} y={-22} width={26} height={20} cornerRadius={5}
        fill={color} opacity={0.95}
        shadowColor={color} shadowBlur={working ? 16 : 6} shadowOpacity={0.55}
      />

      {/* Visor */}
      <Rect x={-10} y={-20} width={20} height={10} cornerRadius={3}
        fill="rgba(0,0,0,0.65)" />
      {/* Eye lights in visor */}
      <Circle x={-4} y={-15} radius={3}
        fill={working ? 'white' : `${color}cc`}
        shadowColor={color} shadowBlur={working ? 10 : 3} shadowOpacity={0.9}
        opacity={0.9 + Math.sin(tick * 0.15) * 0.1}
      />
      <Circle x={4} y={-15} radius={3}
        fill={working ? 'white' : `${color}cc`}
        shadowColor={color} shadowBlur={working ? 10 : 3} shadowOpacity={0.9}
        opacity={0.9 + Math.sin(tick * 0.15 + 0.3) * 0.1}
      />
      {/* Head top indicator */}
      <Circle x={0} y={-25} radius={2.5}
        fill={color}
        shadowColor={color} shadowBlur={8} shadowOpacity={0.9}
        opacity={idle ? 0.4 : 1}
      />

      {/* Arms */}
      <Rect
        x={working ? 14 : 11} y={working ? -6 : 2}
        width={5} height={working ? 14 : 12}
        cornerRadius={3}
        fill={color} opacity={0.8}
        rotation={working ? -35 : 10}
        offsetX={0} offsetY={0}
      />
      <Rect
        x={working ? -19 : -16} y={working ? -6 : 2}
        width={5} height={working ? 14 : 12}
        cornerRadius={3}
        fill={color} opacity={0.8}
        rotation={working ? 35 : -10}
      />

      {/* Working particles */}
      {working && (
        <>
          <Circle x={14 + Math.sin(tick*0.3)*4}  y={-28 + Math.cos(tick*0.3)*4} radius={2}
            fill={color} opacity={0.7 + Math.sin(tick*0.3)*0.3} />
          <Circle x={-14 + Math.sin(tick*0.2)*5} y={-24 + Math.cos(tick*0.2)*5} radius={1.5}
            fill={color} opacity={0.6 + Math.cos(tick*0.2)*0.3} />
          <Circle x={6}  y={-34 + Math.cos(tick*0.25)*3} radius={1.5}
            fill="white" opacity={0.5 + Math.sin(tick*0.25)*0.3} />
        </>
      )}

      {/* Name tag */}
      <Text
        text={agent.name?.split(' ')[0] ?? ''}
        x={-25} y={32} width={50} align="center"
        fontSize={8} fill={color} opacity={0.9}
        fontStyle="bold"
      />
    </Group>
  )
}

// ─── Tree ────────────────────────────────────────────────────────────────────
function Tree({ x, s = 1 }) {
  return (
    <Group x={x} y={GROUND_Y}>
      {/* Shadow */}
      <Rect x={-6*s} y={-3} width={12*s} height={4} cornerRadius={3} fill="#000" opacity={0.3} />
      {/* Trunk */}
      <Rect x={-3.5*s} y={-30*s} width={7*s} height={30*s}
        fill="#1a0f05" cornerRadius={[2,2,0,0]} />
      {/* Foliage layers */}
      <Circle y={-55*s} radius={22*s} fill="#0a2210" opacity={0.95}
        shadowColor="#10b981" shadowBlur={6} shadowOpacity={0.15} />
      <Circle x={-16*s} y={-42*s} radius={15*s} fill="#081a0d" opacity={0.9} />
      <Circle x={ 16*s} y={-42*s} radius={15*s} fill="#081a0d" opacity={0.9} />
      <Circle y={-68*s} radius={14*s} fill="#0d2e14" opacity={0.9} />
      {/* Highlight */}
      <Circle x={-6*s} y={-72*s} radius={6*s} fill="#1a4a22" opacity={0.5} />
    </Group>
  )
}

// ─── Street lamp ─────────────────────────────────────────────────────────────
function Lamp({ x, isActive }) {
  return (
    <Group x={x} y={GROUND_Y - 14}>
      <Rect x={-2} y={-95} width={4} height={95} fill="#0d1f35" cornerRadius={2} />
      <Rect x={-2} y={-95} width={26} height={3.5} fill="#0d1f35" cornerRadius={1} />
      <Circle x={24} y={-94} radius={6}
        fill={isActive ? '#fde68a' : '#1a2a40'}
        shadowColor={isActive ? '#f59e0b' : 'transparent'}
        shadowBlur={isActive ? 24 : 0} shadowOpacity={0.8}
      />
      {isActive && (
        <Circle x={24} y={-94} radius={14}
          fill="#f59e0b" opacity={0.08 + Math.random() * 0.02}
        />
      )}
    </Group>
  )
}

// ─── Building ────────────────────────────────────────────────────────────────
function Building({ bldg, isActive, agentCount, onClick, tick }) {
  const { x, y, w, h, color, dark, label, floors } = bldg
  const fH = h / floors
  const cols = w > 190 ? 4 : 3
  const wW = Math.floor((w - 32) / cols) - 4
  const wH = Math.floor(fH * 0.38)
  const pulse = isActive ? 0.5 + Math.sin(tick * 0.08) * 0.1 : 0.15

  return (
    <Group onClick={onClick} onTap={onClick}>

      {/* Far glow when active */}
      {isActive && (
        <Rect x={x-20} y={y-18} width={w+40} height={h+18}
          cornerRadius={12}
          fill={color} opacity={0.04}
          shadowColor={color} shadowBlur={80} shadowOpacity={0.7}
        />
      )}

      {/* Foundation slab */}
      <Rect x={x-12} y={GROUND_Y-12} width={w+24} height={18}
        fill={isActive ? `${color}22` : dark}
        stroke={color} strokeWidth={isActive ? 1.5 : 0.6} opacity={isActive ? 0.9 : 0.5}
        cornerRadius={[0,0,5,5]}
      />

      {/* Main facade — gradient */}
      <Rect x={x} y={y} width={w} height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: w, y: h }}
        fillLinearGradientColorStops={[
          0, isActive ? `${dark}ee` : '#080f1e',
          0.5, isActive ? dark : '#050c18',
          1, isActive ? `${dark}cc` : '#040a14',
        ]}
        stroke={color}
        strokeWidth={isActive ? 2 : 0.8}
        opacity={isActive ? 1 : 0.8}
        shadowColor={isActive ? color : 'transparent'}
        shadowBlur={isActive ? 30 : 0} shadowOpacity={0.45}
        cornerRadius={[4,4,0,0]}
      />

      {/* Facade panel accent lines */}
      <Rect x={x+4} y={y} width={6} height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 6, y: 0 }}
        fillLinearGradientColorStops={[
          0, `${color}00`, 0.5, `${color}${isActive ? '22' : '0a'}`, 1, `${color}00`
        ]}
        listening={false}
      />
      <Rect x={x+w-10} y={y} width={6} height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 6, y: 0 }}
        fillLinearGradientColorStops={[
          0, `${color}00`, 0.5, `${color}${isActive ? '22' : '0a'}`, 1, `${color}00`
        ]}
        listening={false}
      />

      {/* Floor dividers */}
      {Array.from({ length: floors - 1 }, (_, i) => (
        <Line key={i}
          points={[x+8, y+fH*(i+1), x+w-8, y+fH*(i+1)]}
          stroke={isActive ? `${color}35` : '#0f1e30'}
          strokeWidth={1}
        />
      ))}

      {/* Windows */}
      {Array.from({ length: floors }, (_, fi) =>
        Array.from({ length: cols }, (_, wi) => {
          const wx = x + 14 + wi * ((w-28) / cols) + 2
          const wy = y + fi * fH + fH * 0.18
          const isDoor = fi === floors-1 && wi === Math.floor(cols/2)
          const litChance = (fi + wi * 3 + 1) % 4 !== 0
          const isLit = isActive || litChance
          const brightness = isActive ? (0.3 + Math.sin(tick * 0.07 + fi + wi) * 0.08) : 0.12

          if (isDoor) {
            return (
              <Rect key={`${fi}-${wi}`}
                x={wx+2} y={wy+4} width={wW-4} height={wH+20}
                fill={isActive ? `${color}20` : dark}
                stroke={isActive ? `${color}55` : `${color}20`}
                strokeWidth={1}
                cornerRadius={[wW/2.5, wW/2.5, 0, 0]}
                shadowColor={isActive ? color : 'transparent'}
                shadowBlur={isActive ? 12 : 0} shadowOpacity={0.5}
              />
            )
          }
          return (
            <Group key={`${fi}-${wi}`}>
              <Rect x={wx} y={wy} width={wW} height={wH}
                fill={isLit ? `${color}${Math.round(brightness*255).toString(16).padStart(2,'0')}` : dark}
                stroke={isLit ? `${color}${isActive ? '55' : '25'}` : `${color}15`}
                strokeWidth={0.8}
                cornerRadius={2}
                shadowColor={isActive && isLit ? color : 'transparent'}
                shadowBlur={isActive ? 6 : 0} shadowOpacity={0.5}
              />
              {/* Window frame cross */}
              <Line points={[wx+wW/2, wy+1, wx+wW/2, wy+wH-1]}
                stroke={isLit ? `${color}${isActive ? '30' : '18'}` : `${color}08`} strokeWidth={0.5} />
              <Line points={[wx+2, wy+wH/2, wx+wW-2, wy+wH/2]}
                stroke={isLit ? `${color}${isActive ? '30' : '18'}` : `${color}08`} strokeWidth={0.5} />
            </Group>
          )
        })
      )}

      {/* Edge pillars */}
      <Rect x={x} y={y} width={5} height={h}
        fill={isActive ? `${color}18` : `${color}08`}
        stroke={color} strokeWidth={isActive ? 1.5 : 0.6} opacity={0.8}
      />
      <Rect x={x+w-5} y={y} width={5} height={h}
        fill={isActive ? `${color}18` : `${color}08`}
        stroke={color} strokeWidth={isActive ? 1.5 : 0.6} opacity={0.8}
      />

      {/* Roof platform */}
      <Rect x={x-6} y={y-12} width={w+12} height={14}
        fill={isActive ? `${color}30` : dark}
        stroke={color} strokeWidth={isActive ? 1.5 : 0.6}
        cornerRadius={[6,6,0,0]}
        shadowColor={isActive ? color : 'transparent'}
        shadowBlur={isActive ? 22 : 0} shadowOpacity={0.7}
      />

      {/* HVAC units */}
      {[0.18, 0.5, 0.82].map((r, i) => (
        <Rect key={i} x={x+w*r-9} y={y-30} width={18} height={18}
          fill={isActive ? `${color}20` : dark}
          stroke={isActive ? `${color}50` : `${color}20`}
          strokeWidth={0.8} cornerRadius={2}
        />
      ))}

      {/* Antenna */}
      <Line points={[x+w/2, y-30, x+w/2, y-58]}
        stroke={color} strokeWidth={isActive ? 2.5 : 1.2} opacity={isActive ? 0.9 : 0.4}
      />
      <Circle x={x+w/2} y={y-60} radius={5}
        fill={color}
        shadowColor={color} shadowBlur={isActive ? 18 : 5} shadowOpacity={0.9}
        opacity={pulse}
      />
      {isActive && (
        <>
          <Circle x={x+w/2} y={y-60} radius={12}
            fill={color} opacity={0.1 + Math.sin(tick * 0.08) * 0.04}
          />
          <Circle x={x+w/2} y={y-60} radius={20}
            fill={color} opacity={0.04 + Math.sin(tick * 0.06) * 0.02}
          />
        </>
      )}

      {/* Name sign */}
      <Rect x={x+8} y={y+10} width={w-16} height={22}
        fill={isActive ? `${color}18` : dark}
        stroke={isActive ? `${color}55` : `${color}20`}
        strokeWidth={1} cornerRadius={3}
      />
      <Text text={label} x={x} y={y+15} width={w} align="center"
        fontSize={9} fill={isActive ? 'white' : color}
        fontStyle="bold" letterSpacing={2} opacity={isActive ? 0.95 : 0.55}
      />

      {/* Agent count badge */}
      {agentCount > 0 && (
        <Group>
          <Circle x={x+w-15} y={y+8} radius={13}
            fill={color}
            shadowColor={color} shadowBlur={12} shadowOpacity={0.9}
          />
          <Text text={String(agentCount)} x={x+w-27} y={y+2} width={24} align="center"
            fontSize={12} fill="white" fontStyle="bold"
          />
        </Group>
      )}

      {/* Inspect hint */}
      <Text text="▼ INSPECT" x={x} y={GROUND_Y-22} width={w} align="center"
        fontSize={7} fill={color} opacity={isActive ? 0.5 : 0.25} letterSpacing={1}
      />
    </Group>
  )
}

// ─── Roads ────────────────────────────────────────────────────────────────────
function Roads({ isActive, activeHubs, tick }) {
  const off = -(tick * 0.7) % 28
  const ry = GROUND_Y - 8

  const r1 = [B.hub.x + B.hub.w, ry, B.enquiry.x, ry]
  const r2 = [B.enquiry.x + B.enquiry.w, ry, B.research.x, ry - 3]
  const r3 = [B.enquiry.x + B.enquiry.w, ry, B.dev.x, ry + 3]

  const resActive = activeHubs.includes('research')
  const devActive = activeHubs.includes('developer')

  return (
    <Group>
      {[r1, r2, r3].map((pts, i) => (
        <Group key={i}>
          <Line points={pts} stroke="#060f1e" strokeWidth={24} lineCap="round" />
          <Line points={pts} stroke="#0a1828" strokeWidth={18} lineCap="round" />
          <Line points={pts} stroke="#1a3050" strokeWidth={1.5}
            dash={[14, 10]} dashOffset={off} lineCap="round" opacity={0.4} />
        </Group>
      ))}

      {/* Active flow lines */}
      {isActive && (
        <Line points={r1} stroke="#06b6d4" strokeWidth={3}
          dash={[18, 11]} dashOffset={off} opacity={0.9} lineCap="round"
          shadowColor="#06b6d4" shadowBlur={12} shadowOpacity={0.9}
        />
      )}
      {resActive && (
        <Line points={r2} stroke="#8b5cf6" strokeWidth={3}
          dash={[18, 11]} dashOffset={off} opacity={0.9} lineCap="round"
          shadowColor="#8b5cf6" shadowBlur={12} shadowOpacity={0.9}
        />
      )}
      {devActive && (
        <Line points={r3} stroke="#10b981" strokeWidth={3}
          dash={[18, 11]} dashOffset={off} opacity={0.9} lineCap="round"
          shadowColor="#10b981" shadowBlur={12} shadowOpacity={0.9}
        />
      )}

      {/* Junction node */}
      {isActive && (resActive || devActive) && (
        <Circle x={B.enquiry.x + B.enquiry.w + 12} y={ry} radius={6}
          fill="#f59e0b"
          shadowColor="#f59e0b" shadowBlur={16} shadowOpacity={0.9}
        />
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
    const id = setInterval(() => setTick(t => t + 1), 48)
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

  const researchActive = activeHubs.includes('research')
  const devActive      = activeHubs.includes('developer')

  // Cloud-like distant hills / skyline silhouette positions
  const cityBg = [
    {x:55,   h:55,  w:42},  {x:140,  h:80,  w:35}, {x:220,  h:45,  w:50},
    {x:310,  h:70,  w:38},  {x:398,  h:38,  w:45}, {x:620,  h:60,  w:40},
    {x:700,  h:88,  w:32},  {x:760,  h:50,  w:48}, {x:920,  h:65,  w:36},
    {x:1000, h:42,  w:55},  {x:1100, h:78,  w:38},
  ]

  // Stars
  const stars = Array.from({ length: 55 }, (_, i) => ({
    x: (i * 157.3 + 43) % W,
    y: (i * 91.7 + 11)  % (H * 0.45),
    r: i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.7,
    op: 0.08 + (i % 8) * 0.04,
  }))

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: H,
        border: '1px solid rgba(6,182,212,0.18)',
        boxShadow: '0 0 40px rgba(6,182,212,0.06)',
      }}
    >
      <Stage width={stageW} height={H} scaleX={scale} scaleY={scale}>
        <Layer>

          {/* ── Sky — beautiful gradient dawn/dusk ── */}
          <Rect x={0} y={0} width={W} height={H}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: H }}
            fillLinearGradientColorStops={[
              0, '#020814',
              0.3, '#04101e',
              0.6, '#071828',
              0.8, '#0d2238',
              0.9, '#102840',
              1,   '#0a1e30',
            ]}
          />

          {/* Horizon glow */}
          <Rect x={0} y={GROUND_Y-90} width={W} height={120}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: 120 }}
            fillLinearGradientColorStops={[
              0, 'rgba(6,182,212,0)',
              0.5, 'rgba(6,182,212,0.04)',
              1, 'rgba(6,182,212,0.02)',
            ]}
          />

          {/* ── Stars ── */}
          {stars.map((s, i) => (
            <Circle key={i} x={s.x} y={s.y} radius={s.r}
              fill="white" opacity={s.op + Math.sin(tick * 0.03 + i) * 0.02}
            />
          ))}

          {/* ── Moon ── */}
          <Circle x={60} y={60} radius={28}
            fill="#0d2040"
            shadowColor="#06b6d4" shadowBlur={30} shadowOpacity={0.2}
          />
          <Circle x={60} y={60} radius={27}
            fillLinearGradientStartPoint={{ x: -28, y: -28 }}
            fillLinearGradientEndPoint={{ x: 28, y: 28 }}
            fillLinearGradientColorStops={[0, '#e8f4ff', 0.6, '#a8c8e0', 1, '#6090b0']}
            opacity={0.9}
          />
          <Circle x={68} y={58} radius={22}
            fill="#081828" opacity={0.85}
          />

          {/* ── Distant city silhouette ── */}
          {cityBg.map((b, i) => (
            <Rect key={i}
              x={b.x} y={GROUND_Y - b.h - 20}
              width={b.w} height={b.h + 20}
              fill="#060f1e" opacity={0.7}
              cornerRadius={[3,3,0,0]}
            />
          ))}

          {/* ── Ground ── */}
          <Rect x={0} y={GROUND_Y} width={W} height={H-GROUND_Y}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: H-GROUND_Y }}
            fillLinearGradientColorStops={[0, '#0d2030', 1, '#050d18']}
          />

          {/* ── Pavement strip ── */}
          <Rect x={0} y={GROUND_Y-16} width={W} height={24}
            fill="#0a1828" opacity={0.95}
          />
          {/* Curb highlight */}
          <Rect x={0} y={GROUND_Y-18} width={W} height={3}
            fill="#1a3050" opacity={0.7}
          />

          {/* ── Roads ── */}
          <Roads isActive={isActive} activeHubs={activeHubs} tick={tick} />

          {/* ── Lamps ── */}
          {[218, 408, 658, 822, 998].map((lx, i) => (
            <Lamp key={i} x={lx} isActive={isActive} />
          ))}

          {/* ── Trees ── */}
          <Tree x={258} s={0.95} />
          <Tree x={318} s={0.70} />
          <Tree x={388} s={0.85} />
          <Tree x={682} s={0.80} />
          <Tree x={748} s={1.05} />
          <Tree x={810} s={0.78} />

          {/* ── Buildings ── */}
          <Building bldg={B.hub}      isActive={!isActive || hubAgents.length > 0}
            agentCount={hubAgents.length} tick={tick}
            onClick={() => setSelectedZone({ name: 'AGENT HUB',    color: B.hub.color,      agents: hubAgents })}
          />
          <Building bldg={B.enquiry}  isActive={true}
            agentCount={Math.max(1, enquiryAgents.length)} tick={tick}
            onClick={() => setSelectedZone({ name: 'ENQUIRY DEPT', color: B.enquiry.color,  agents: enquiryAgents })}
          />
          <Building bldg={B.research} isActive={researchActive}
            agentCount={researchAgents.length} tick={tick}
            onClick={() => setSelectedZone({ name: 'RESEARCH LAB', color: B.research.color, agents: researchAgents })}
          />
          <Building bldg={B.dev}      isActive={devActive}
            agentCount={devAgents.length} tick={tick}
            onClick={() => setSelectedZone({ name: 'DEV HUB',      color: B.dev.color,      agents: devAgents })}
          />

          {/* ── Router agent (always at Enquiry) ── */}
          <AgentNode
            x={B.enquiry.x + B.enquiry.w / 2}
            y={WALK_Y - 5}
            agent={{
              id: 'router', name: 'Router', skill_level: 'expert',
              animationState: enquiryAgents.length > 0 ? 'working' : 'idle',
            }}
            tick={tick}
          />

          {/* ── Store agents ── */}
          {agents.map(agent => {
            const pos = positions[agent.id]
            if (!pos) return null
            return <AgentNode key={agent.id} x={pos.x} y={pos.y} agent={agent} tick={tick} />
          })}

        </Layer>
      </Stage>

      {/* ── Zone detail overlay ── */}
      {selectedZone && (
        <div className="absolute inset-0 z-40 flex items-end"
          style={{ background: 'rgba(2,8,20,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedZone(null)}
        >
          <div className="w-full p-5 rounded-t-2xl"
            style={{
              background: 'rgba(7,22,40,0.98)',
              border: `1px solid ${selectedZone.color}30`,
              borderBottom: 'none',
              boxShadow: `0 -8px 40px ${selectedZone.color}15`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-xs tracking-widest mb-1" style={{ color: selectedZone.color, opacity: 0.7 }}>
                  ZONE DETAIL
                </div>
                <div className="text-white font-bold text-lg tracking-wider" style={{ fontFamily: '"Syne", sans-serif' }}>
                  {selectedZone.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: selectedZone.color, opacity: 0.5 }}>
                  {selectedZone.agents.length} agent{selectedZone.agents.length !== 1 ? 's' : ''} present
                </div>
              </div>
              <button onClick={() => setSelectedZone(null)}
                className="text-sm transition-opacity hover:opacity-100 opacity-40"
                style={{ color: selectedZone.color }}
              >✕ CLOSE</button>
            </div>

            {selectedZone.agents.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: '#3d6080' }}>
                No agents currently in this zone
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {selectedZone.agents.map(agent => {
                  const c = SKILL_COLOR[agent.skill_level] || '#06b6d4'
                  return (
                    <div key={agent.id} className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[80px]">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
                        🤖
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-white font-semibold">{agent.name?.split(' ')[0]}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#5a7a9a' }}>{agent.role}</div>
                        <div className="mt-1 text-xs px-2 py-0.5 rounded-full inline-block"
                          style={{
                            background: agent.animationState === 'working' ? '#10b98118' : `${c}18`,
                            color:      agent.animationState === 'working' ? '#10b981'   : c,
                            border: `1px solid ${agent.animationState === 'working' ? '#10b98130' : `${c}30`}`,
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
