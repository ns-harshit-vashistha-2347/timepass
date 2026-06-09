/**
 * SimulationWorld3D.jsx — MEGA OVERHAUL v3
 *
 * NEW vs previous version:
 *  • BuildingModal: cinematic 3-col panel (metrics, agent roster, live terminal)
 *  • Enhanced AgentDetailPanel: task progress bar, energy bar, perf score
 *  • LiveHUD v2: network traffic sparkline, skill breakdown, mission timer
 *  • HolographicProjector: animated beam + floating data nodes above selected building
 *  • CityBackdrop: distant buildings for a proper cyberpunk skyline
 *  • FIXED: BuildingInterior double-render bug removed entirely
 *  • Added SectionLabel, HUDPanel, AgentRosterCard helper components
 *  • All animations CSS-injected inline
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

// ─── World constants ──────────────────────────────────────────────────────────

const BUILDINGS = {
  hub: {
    pos: [-10, 0, 0], size: [3, 6, 2.5],
    color: '#06b6d4', label: 'AGENT HUB', key: 'hub',
    desc: 'Central factory. Spawns and manages all AI agents on demand.',
    dept: 'Infrastructure', role: 'Agent Spawner & Lifecycle Manager',
  },
  enquiry: {
    pos: [-2.5, 0, 0], size: [3.8, 9.5, 3],
    color: '#f59e0b', label: 'ENQUIRY DEPT', key: 'enquiry',
    desc: 'Smart front-door. Routes queries to the right hub using LLM reasoning.',
    dept: 'Query Routing', role: 'LLM Router & Task Dispatcher',
  },
  research: {
    pos: [5, 0, 0], size: [3, 6.5, 2.5],
    color: '#8b5cf6', label: 'RESEARCH LAB', key: 'research',
    desc: 'Deep analysis, fact-finding, market research and written reports.',
    dept: 'Research', role: 'Analysis & Report Generation',
  },
  dev: {
    pos: [10, 0, 0], size: [2.5, 5, 2],
    color: '#10b981', label: 'DEV HUB', key: 'dev',
    desc: 'Full-stack builds, architecture decisions, code reviews and DevOps.',
    dept: 'Development', role: 'Code Generation & Review',
  },
}

const ROAD_Z = 1.8
const AGENT_Y = 0.5

const ZONE_3D = {
  hub:        [-10,  AGENT_Y, ROAD_Z],
  toEnquiry:  [-6.5, AGENT_Y, ROAD_Z],
  enquiry:    [-2.5, AGENT_Y, ROAD_Z],
  toResearch: [1.5,  AGENT_Y, ROAD_Z],
  research:   [5,    AGENT_Y, ROAD_Z],
  toDev:      [7.5,  AGENT_Y, ROAD_Z],
  dev:        [10,   AGENT_Y, ROAD_Z],
  returning:  [-6.5, AGENT_Y, ROAD_Z],
}

const SKILL_COLORS = {
  junior: '#10b981',
  mid:    '#06b6d4',
  senior: '#8b5cf6',
  expert: '#f59e0b',
}

const DEFAULT_CAM  = new THREE.Vector3(0, 14, 22)
const DEFAULT_LOOK = new THREE.Vector3(0, 3, 0)

const TERMINAL_MSGS = {
  hub: [
    'Agent pool initialized', 'Spawning agent JNRX-{id}',
    'Queue depth: {n} pending', 'Memory: {n}.{m}GB / 16GB',
    'Lifecycle check: NOMINAL', 'Load balancer: adjusted',
    'Agent {id} assigned to routing', 'Heartbeat pulse: OK',
    'Slot {n} available', 'Eviction policy: LRU active',
    'Spawn latency: {n}ms', 'Pool capacity: {n}/24',
  ],
  enquiry: [
    'Query received → routing...', 'Intent: RESEARCH classified',
    'Intent: DEVELOPMENT classified', 'Groq API latency: {n}ms',
    'Dispatch → RESEARCH LAB', 'Dispatch → DEV HUB',
    'Queue: {n} items pending', 'Context window: {n}k tokens',
    'LLM call #{n} complete', 'Confidence: {n}%',
    'Fallback triggered: retry {n}', 'Router policy: AUTO',
  ],
  research: [
    'LangGraph step {n}: complete', 'Web search: {n} results',
    'Synthesizing section {n}/{m}', 'Report confidence: {n}%',
    'Citation check: {n} sources', 'Deep dive pipeline: active',
    'Agent collaboration: started', 'Fact-check pass {n}: OK',
    'Vector store query: {n}ms', 'Summary: {n} tokens generated',
    'Embedding model: loaded', 'Chain depth: {n} hops',
  ],
  dev: [
    'Code review: {n} files scanned', 'Build v{n}.{m}: triggered',
    'Test suite {n}/{m}: PASS', 'Linter: {n} warnings',
    'Git commit: {hash}', 'Dependency audit: clean',
    'DevOps check: PASSED', 'PR #{n} analysis done',
    'Refactor pass: complete', 'Coverage: {n}%',
    'Docker layer cache: hit', 'CI pipeline: stage {n}',
  ],
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const ri  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const rid = ()     => Math.random().toString(36).substring(2, 6).toUpperCase()
const rh  = ()     => Math.random().toString(16).substring(2, 10)

function termMsg(key) {
  const pool = TERMINAL_MSGS[key] || TERMINAL_MSGS.hub
  return pool[Math.floor(Math.random() * pool.length)]
    .replace('{id}',   rid())
    .replace(/{n}/g,   String(ri(1, 99)))
    .replace(/{m}/g,   String(ri(10, 100)))
    .replace('{hash}', rh())
}

// ─── Camera controller ────────────────────────────────────────────────────────

function CameraController({ zoomTarget }) {
  const { camera } = useThree()
  const ctrlRef = useRef()
  const camPos  = useRef(DEFAULT_CAM.clone())
  const lookAt  = useRef(DEFAULT_LOOK.clone())
  const tCamPos = useRef(DEFAULT_CAM.clone())
  const tLookAt = useRef(DEFAULT_LOOK.clone())

  useEffect(() => {
    if (!zoomTarget) {
      tCamPos.current.copy(DEFAULT_CAM)
      tLookAt.current.copy(DEFAULT_LOOK)
    } else {
      const b  = BUILDINGS[zoomTarget]
      const bx = b.pos[0]
      const bh = b.size[1]
      tCamPos.current.set(bx, bh * 0.45 + 2, b.pos[2] + 4)
      tLookAt.current.set(bx, bh * 0.4, b.pos[2])
    }
  }, [zoomTarget])

  useFrame(() => {
    camPos.current.lerp(tCamPos.current, 0.05)
    lookAt.current.lerp(tLookAt.current, 0.05)
    camera.position.copy(camPos.current)
    camera.lookAt(lookAt.current)
    if (ctrlRef.current) ctrlRef.current.target.copy(lookAt.current)
  })

  return (
    <OrbitControls
      ref={ctrlRef} enablePan={false}
      minDistance={6} maxDistance={35}
      minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.2}
      enabled={!zoomTarget}
    />
  )
}

// ─── City backdrop (distant skyline) ─────────────────────────────────────────

function CityBackdrop() {
  const bldgs = useMemo(() => [
    { x: -22, z: -10, w: 1.6, h: 12, c: '#06b6d4' },
    { x: -19, z: -9,  w: 2.2, h: 19, c: '#8b5cf6' },
    { x: -16, z: -11, w: 1.3, h: 8,  c: '#06b6d4' },
    { x: -14, z: -10, w: 2,   h: 24, c: '#f59e0b' },
    { x: -11, z: -11, w: 1.6, h: 14, c: '#10b981' },
    { x: -25, z: -8,  w: 1.1, h: 9,  c: '#8b5cf6' },
    { x: -28, z: -9,  w: 1.4, h: 15, c: '#06b6d4' },
    { x: -8,  z: -10, w: 1.2, h: 11, c: '#f59e0b' },
    { x: 0,   z: -11, w: 1.3, h: 7,  c: '#8b5cf6' },
    { x: 7,   z: -10, w: 1.1, h: 13, c: '#f59e0b' },
    { x: 13,  z: -9,  w: 1.6, h: 15, c: '#10b981' },
    { x: 16,  z: -10, w: 2.2, h: 11, c: '#06b6d4' },
    { x: 18,  z: -11, w: 1.3, h: 21, c: '#8b5cf6' },
    { x: 20,  z: -9,  w: 2,   h: 13, c: '#f59e0b' },
    { x: 22,  z: -10, w: 1.1, h: 17, c: '#10b981' },
    { x: 25,  z: -8,  w: 1.6, h: 9,  c: '#06b6d4' },
    { x: 28,  z: -9,  w: 1.2, h: 14, c: '#8b5cf6' },
  ], [])

  return (
    <group>
      {bldgs.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w * 0.9]} />
          <meshStandardMaterial
            color="#010608" emissive={b.c}
            emissiveIntensity={0.05 + (i % 3) * 0.015}
            roughness={0.28} metalness={0.82}
          />
        </mesh>
      ))}
    </group>
  )
}

// ─── Holographic projector (above selected building) ─────────────────────────

function HolographicProjector({ buildingKey }) {
  const config = BUILDINGS[buildingKey]
  if (!config) return null

  const beamRef   = useRef()
  const n1Ref     = useRef()
  const n2Ref     = useRef()
  const n3Ref     = useRef()
  const ringRef   = useRef()
  const ring2Ref  = useRef()

  const [bx, , bz] = config.pos
  const bh          = config.size[1]
  const color       = config.color

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (beamRef.current)  beamRef.current.material.opacity  = 0.13 + Math.sin(t * 2.8) * 0.05
    if (ringRef.current)  ringRef.current.rotation.y        = t * 1.1
    if (ring2Ref.current) ring2Ref.current.rotation.y       = -t * 0.7
    if (n1Ref.current) {
      n1Ref.current.position.y = bh / 2 + 3.5 + Math.sin(t * 1.1) * 0.55
      n1Ref.current.rotation.y = t * 0.85
      n1Ref.current.rotation.x = t * 0.45
    }
    if (n2Ref.current) {
      n2Ref.current.position.y = bh / 2 + 5.2 + Math.sin(t * 0.85 + 1.2) * 0.65
      n2Ref.current.rotation.y = -t * 0.65
    }
    if (n3Ref.current) {
      n3Ref.current.position.y = bh / 2 + 2.2 + Math.sin(t * 1.55 + 2.3) * 0.45
      n3Ref.current.rotation.y = t * 1.25
    }
  })

  return (
    <group position={[bx, 0, bz]}>
      {/* Core beam */}
      <mesh ref={beamRef} position={[0, bh / 2 + 4.5, 0]}>
        <cylinderGeometry args={[0.08, 0.55, 9, 20, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      {/* Outer haze */}
      <mesh position={[0, bh / 2 + 4.5, 0]}>
        <cylinderGeometry args={[0.45, 1.4, 9, 20, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>
      {/* Spinning ring at base */}
      <group ref={ringRef} position={[0, bh / 2 + 0.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.045, 7, 44]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.72} />
        </mesh>
      </group>
      {/* Counter-spin inner ring */}
      <group ref={ring2Ref} position={[0, bh / 2 + 0.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.58, 0.03, 6, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} transparent opacity={0.55} />
        </mesh>
      </group>
      {/* Data node 1 — octahedron */}
      <group ref={n1Ref} position={[0, bh / 2 + 3.5, 0]}>
        <mesh>
          <octahedronGeometry args={[0.21, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} transparent opacity={0.92} />
        </mesh>
        <pointLight color={color} intensity={2} distance={5.5} />
      </group>
      {/* Data node 2 — cube */}
      <group ref={n2Ref} position={[0.48, bh / 2 + 5.2, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.88} />
        </mesh>
      </group>
      {/* Data node 3 — tetrahedron */}
      <group ref={n3Ref} position={[-0.48, bh / 2 + 2.2, 0]}>
        <mesh>
          <tetrahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.82} />
        </mesh>
      </group>
    </group>
  )
}

// ─── City ground ──────────────────────────────────────────────────────────────

function CityGround({ isActive }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#040d1a" roughness={0.9} metalness={0.2} />
      </mesh>

      {Array.from({ length: 25 }, (_, i) => {
        const x = -12 + i
        return (
          <line key={`v${i}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([x, 0, -8, x, 0, 8])} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#06b6d4" opacity={isActive ? 0.20 : 0.09} transparent />
          </line>
        )
      })}

      {Array.from({ length: 17 }, (_, i) => {
        const z = -8 + i
        return (
          <line key={`h${i}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([-12, 0, z, 13, 0, z])} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#06b6d4" opacity={isActive ? 0.20 : 0.09} transparent />
          </line>
        )
      })}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, ROAD_Z]}>
        <planeGeometry args={[28, 2.5]} />
        <meshStandardMaterial color="#050c18" roughness={0.85} />
      </mesh>

      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-13 + i * 2, 0.02, ROAD_Z]}>
          <planeGeometry args={[0.9, 0.08]} />
          <meshStandardMaterial
            color={isActive ? '#06b6d4' : '#1a3050'}
            emissive={isActive ? '#06b6d4' : '#0a1828'}
            emissiveIntensity={isActive ? 1.4 : 0.3}
          />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, ROAD_Z - 1.28]}>
        <planeGeometry args={[28, 0.07]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={isActive ? 5 : 1.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, ROAD_Z + 1.28]}>
        <planeGeometry args={[28, 0.07]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={isActive ? 5 : 1.5} />
      </mesh>

      {[-9, -6, -1, 2, 6, 9].map(x => (
        <group key={x} position={[x, 0, 3.8]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 4, 6]} />
            <meshStandardMaterial color="#0d1f35" />
          </mesh>
          <mesh position={[0.5, 3.8, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={isActive ? 3.5 : 2} />
          </mesh>
          <pointLight position={[0.5, 3.8, 0]} color="#f59e0b" intensity={isActive ? 1.5 : 0.8} distance={7} />
        </group>
      ))}
    </group>
  )
}

// ─── 3D Building ──────────────────────────────────────────────────────────────

function Building3D({ config, isActive, agentCount, onClick }) {
  const meshRef   = useRef()
  const ringRef   = useRef()
  const glowRef   = useRef()
  const screenRef = useRef()
  const [hovered, setHovered] = useState(false)
  const { pos, size, color, label } = config
  const [bx, , bz] = pos
  const [bw, bh, bd] = size

  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd)),
    [bw, bh, bd],
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ringRef.current)  ringRef.current.rotation.y = t * 0.5
    if (glowRef.current)  glowRef.current.intensity  = isActive ? (1.8 + Math.sin(t * 2) * 0.6) : 0
    if (meshRef.current) {
      const target = hovered ? 1.03 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
    }
    if (screenRef.current) {
      screenRef.current.material.emissiveIntensity = isActive
        ? 0.55 + Math.sin(t * 2.8 + bx) * 0.28 : 0.1
    }
  })

  const windows = useMemo(() => {
    const wins = []
    const cols   = bw > 3.2 ? 4 : 3
    const floors = Math.floor(bh / 1.4) - 1
    for (let fi = 0; fi < floors; fi++) {
      for (let ci = 0; ci < cols; ci++) {
        const wx  = bx - bw / 2 + (ci + 0.7) * (bw / cols)
        const wy  = 0.8 + fi * 1.35
        const lit = (fi + ci * 2 + 1) % 5 !== 0 || isActive
        wins.push({ wx, wy, lit, fi, ci })
      }
    }
    return wins
  }, [bx, bw, bh, isActive])

  return (
    <group
      position={[bx, bh / 2, bz]}
      onClick={e => { e.stopPropagation(); onClick() }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
    >
      <pointLight ref={glowRef} color={color} intensity={0} distance={16} decay={2} />

      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <meshStandardMaterial
          color="#040d1c" emissive={color}
          emissiveIntensity={isActive ? 0.22 : hovered ? 0.14 : 0.07}
          roughness={0.25} metalness={0.72}
        />
      </mesh>

      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={isActive ? 0.8 : hovered ? 0.55 : 0.28} />
      </lineSegments>

      {windows.map(({ wx, wy, lit, fi, ci }) => (
        <mesh key={`w${fi}-${ci}`} position={[wx - bx, wy - bh / 2, bd / 2 + 0.01]}>
          <planeGeometry args={[0.22, 0.38]} />
          <meshStandardMaterial
            color={lit ? color : '#060f1e'} emissive={lit ? color : '#000'}
            emissiveIntensity={isActive ? 1.4 : lit ? 0.5 : 0}
            transparent opacity={lit ? 0.95 : 0.4}
          />
        </mesh>
      ))}

      <mesh ref={screenRef} position={[0, bh * 0.05, bd / 2 + 0.03]}>
        <planeGeometry args={[bw * 0.65, bh * 0.38]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} transparent opacity={0.13} />
      </mesh>
      {isActive && <ScanLine bw={bw} bh={bh} bd={bd} color={color} />}

      <mesh position={[0, bh / 2 + 0.15, 0]}>
        <boxGeometry args={[bw + 0.3, 0.2, bd + 0.3]} />
        <meshStandardMaterial color="#060f1e" emissive={color} emissiveIntensity={isActive ? 0.55 : 0.1} />
      </mesh>

      <mesh position={[0, bh / 2 + 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 2, 8]} />
        <meshStandardMaterial color="#0d2040" emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, bh / 2 + 2.3, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isActive ? 6 : 2} />
      </mesh>
      {isActive && (
        <>
          <pointLight position={[0, bh / 2 + 2.3, 0]} color={color} intensity={3} distance={10} />
          <mesh position={[0, bh / 2 + 2.3, 0]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.14} />
          </mesh>
        </>
      )}

      {isActive && (
        <group ref={ringRef} position={[0, -bh / 2 + 0.1, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[bw * 0.75, 0.055, 8, 36]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} transparent opacity={0.85} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[bw * 0.44, 0.035, 6, 28]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} transparent opacity={0.55} />
          </mesh>
        </group>
      )}

      {isActive && [[-bw/2,-bd/2],[bw/2,-bd/2],[-bw/2,bd/2],[bw/2,bd/2]].map(([ex,ez],i) => (
        <mesh key={i} position={[ex, 0, ez]}>
          <cylinderGeometry args={[0.045, 0.045, bh, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} transparent opacity={0.65} />
        </mesh>
      ))}

      <Billboard position={[0, bh / 2 + 3.2, 0]}>
        <Text fontSize={0.36} color={isActive ? 'white' : color} anchorX="center" anchorY="middle" letterSpacing={0.12} outlineColor={color} outlineWidth={isActive ? 0.015 : 0.006}>
          {label}
        </Text>
        {agentCount > 0 && (
          <Text position={[0, -0.5, 0]} fontSize={0.26} color={color} anchorX="center" anchorY="middle">
            {`● ${agentCount} AGENT${agentCount > 1 ? 'S' : ''}`}
          </Text>
        )}
      </Billboard>
    </group>
  )
}

function ScanLine({ bw, bh, bd, color }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ref.current) {
      ref.current.position.y = (((t * 0.6) % 1) - 0.5) * bh * 0.36
      ref.current.material.opacity = 0.55 + Math.sin(t * 4) * 0.2
    }
  })
  return (
    <mesh ref={ref} position={[0, 0, bd / 2 + 0.04]}>
      <planeGeometry args={[bw * 0.63, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.6} />
    </mesh>
  )
}

// ─── Human-like Agent ─────────────────────────────────────────────────────────

function HumanAgent3D({ agent, index, onSelect }) {
  const groupRef  = useRef()
  const bodyRef   = useRef()
  const headRef   = useRef()
  const leftLeg   = useRef()
  const rightLeg  = useRef()
  const leftArm   = useRef()
  const rightArm  = useRef()
  const eyeGlow   = useRef()
  const [hovered, setHovered] = useState(false)

  const color   = SKILL_COLORS[agent.skill_level] || '#06b6d4'
  const zone    = agent.currentZone || 'hub'
  const walking = agent.animationState === 'walking'
  const working = agent.animationState === 'working'

  const targetPos = useMemo(() => {
    const base = ZONE_3D[zone] || ZONE_3D.hub
    const col  = ((index % 3) + 3) % 3
    const row  = Math.floor(Math.abs(index) / 3)
    return new THREE.Vector3(base[0] + (col - 1) * 0.62, base[1], base[2] + row * 0.62)
  }, [zone, index])

  const curPos  = useRef(targetPos.clone())
  const prevPos = useRef(targetPos.clone())

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const spd = walking ? 0.04 : 0.08
    curPos.current.lerp(targetPos, spd)

    if (groupRef.current) {
      groupRef.current.position.copy(curPos.current)
      const moveDir = new THREE.Vector3().subVectors(curPos.current, prevPos.current)
      if (moveDir.lengthSq() > 0.0000015) {
        const targetAngle = Math.atan2(moveDir.x, moveDir.z)
        groupRef.current.rotation.y += (targetAngle - groupRef.current.rotation.y) * 0.15
      }
    }
    prevPos.current.copy(curPos.current)

    if (walking) {
      const swing = Math.sin(t * 6) * 0.6
      if (leftLeg.current)  leftLeg.current.rotation.x  =  swing
      if (rightLeg.current) rightLeg.current.rotation.x = -swing
      if (leftArm.current)  leftArm.current.rotation.x  = -swing * 0.5
      if (rightArm.current) rightArm.current.rotation.x =  swing * 0.5
      if (groupRef.current) groupRef.current.position.y = curPos.current.y + Math.abs(Math.sin(t * 6)) * 0.05
      if (headRef.current)  headRef.current.rotation.y  = Math.sin(t * 3) * 0.07
    } else {
      if (leftLeg.current)  leftLeg.current.rotation.x  = 0
      if (rightLeg.current) rightLeg.current.rotation.x = 0
    }

    if (working) {
      if (leftArm.current)  leftArm.current.rotation.x  = -0.85 + Math.sin(t * 4) * 0.38
      if (rightArm.current) rightArm.current.rotation.x = -0.85 - Math.sin(t * 4) * 0.38
      if (bodyRef.current)  bodyRef.current.material.emissiveIntensity = 0.38 + Math.sin(t * 5) * 0.22
      if (eyeGlow.current)  eyeGlow.current.intensity   = 0.65 + Math.sin(t * 6) * 0.38
    } else {
      if (!walking) {
        if (leftArm.current)  leftArm.current.rotation.x  = 0
        if (rightArm.current) rightArm.current.rotation.x = 0
      }
      if (bodyRef.current && !walking) bodyRef.current.scale.y = 1 + Math.sin(t * 1.6) * 0.014
      if (eyeGlow.current) eyeGlow.current.intensity = hovered ? 0.55 : 0.18
    }
  })

  const eyeColor = hovered ? '#ffffff' : color

  return (
    <group
      ref={groupRef}
      onClick={e => { e.stopPropagation(); onSelect(agent) }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
    >
      <pointLight ref={eyeGlow} position={[0, 1.08, 0.22]} color={color} intensity={0.18} distance={2.2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -AGENT_Y + 0.01, 0]}>
        <circleGeometry args={[0.28, 14]} />
        <meshStandardMaterial color="#000" transparent opacity={0.4} />
      </mesh>

      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -AGENT_Y + 0.025, 0]}>
          <ringGeometry args={[0.3, 0.4, 28]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.75} />
        </mesh>
      )}

      <group ref={leftLeg} position={[-0.105, 0.24, 0]}>
        <mesh position={[0, -0.13, 0]}><capsuleGeometry args={[0.072, 0.18, 4, 8]} /><meshStandardMaterial color="#0a1e36" emissive={color} emissiveIntensity={0.14} metalness={0.75} roughness={0.3} /></mesh>
        <mesh position={[0, -0.28, 0.04]}><sphereGeometry args={[0.058, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} /></mesh>
        <mesh position={[0, -0.45, 0]}><capsuleGeometry args={[0.058, 0.16, 4, 8]} /><meshStandardMaterial color="#071525" emissive={color} emissiveIntensity={0.1} metalness={0.8} roughness={0.25} /></mesh>
        <mesh position={[0, -0.59, 0.04]}><boxGeometry args={[0.13, 0.09, 0.2]} /><meshStandardMaterial color="#040e1c" emissive={color} emissiveIntensity={0.22} metalness={0.9} /></mesh>
      </group>

      <group ref={rightLeg} position={[0.105, 0.24, 0]}>
        <mesh position={[0, -0.13, 0]}><capsuleGeometry args={[0.072, 0.18, 4, 8]} /><meshStandardMaterial color="#0a1e36" emissive={color} emissiveIntensity={0.14} metalness={0.75} roughness={0.3} /></mesh>
        <mesh position={[0, -0.28, 0.04]}><sphereGeometry args={[0.058, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} /></mesh>
        <mesh position={[0, -0.45, 0]}><capsuleGeometry args={[0.058, 0.16, 4, 8]} /><meshStandardMaterial color="#071525" emissive={color} emissiveIntensity={0.1} metalness={0.8} roughness={0.25} /></mesh>
        <mesh position={[0, -0.59, 0.04]}><boxGeometry args={[0.13, 0.09, 0.2]} /><meshStandardMaterial color="#040e1c" emissive={color} emissiveIntensity={0.22} metalness={0.9} /></mesh>
      </group>

      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.31, 0.09, 0.19]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.82} /></mesh>

      <mesh ref={bodyRef} position={[0, 0.57, 0]} castShadow>
        <capsuleGeometry args={[0.152, 0.3, 4, 10]} />
        <meshStandardMaterial color="#061828" emissive={color} emissiveIntensity={working ? 0.32 : 0.13} roughness={0.22} metalness={0.88} />
      </mesh>
      <mesh position={[0, 0.62, 0.175]}><planeGeometry args={[0.19, 0.21]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={working ? 3.5 : 1.4} transparent opacity={0.92} /></mesh>
      <mesh position={[0, 0.46, 0.174]}><planeGeometry args={[0.27, 0.04]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} transparent opacity={0.72} /></mesh>

      <group ref={leftArm} position={[-0.245, 0.72, 0]}>
        <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.098, 10, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.72} /></mesh>
        <mesh position={[0, -0.12, 0]}><capsuleGeometry args={[0.062, 0.17, 4, 8]} /><meshStandardMaterial color="#071525" emissive={color} emissiveIntensity={0.1} metalness={0.8} roughness={0.28} /></mesh>
        <mesh position={[0, -0.245, 0]}><sphereGeometry args={[0.052, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} /></mesh>
        <mesh position={[0, -0.375, 0]}><capsuleGeometry args={[0.052, 0.155, 4, 8]} /><meshStandardMaterial color="#0a1e36" emissive={color} emissiveIntensity={0.12} metalness={0.82} roughness={0.25} /></mesh>
        <mesh position={[0, -0.49, 0]}><sphereGeometry args={[0.062, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={working ? 2.5 : 0.55} /></mesh>
      </group>

      <group ref={rightArm} position={[0.245, 0.72, 0]}>
        <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.098, 10, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.72} /></mesh>
        <mesh position={[0, -0.12, 0]}><capsuleGeometry args={[0.062, 0.17, 4, 8]} /><meshStandardMaterial color="#071525" emissive={color} emissiveIntensity={0.1} metalness={0.8} roughness={0.28} /></mesh>
        <mesh position={[0, -0.245, 0]}><sphereGeometry args={[0.052, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} /></mesh>
        <mesh position={[0, -0.375, 0]}><capsuleGeometry args={[0.052, 0.155, 4, 8]} /><meshStandardMaterial color="#0a1e36" emissive={color} emissiveIntensity={0.12} metalness={0.82} roughness={0.25} /></mesh>
        <mesh position={[0, -0.49, 0]}><sphereGeometry args={[0.062, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={working ? 2.5 : 0.55} /></mesh>
      </group>

      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.063, 0.078, 0.13, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.38} metalness={0.82} /></mesh>

      <group ref={headRef}>
        <mesh position={[0, 1.09, 0]} castShadow>
          <sphereGeometry args={[0.172, 20, 20]} />
          <meshStandardMaterial color="#061828" emissive={color} emissiveIntensity={0.22} roughness={0.12} metalness={0.96} />
        </mesh>
        <mesh position={[0, 1.09, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.173, 0.024, 4, 30]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[0, 1.065, 0.153]}>
          <boxGeometry args={[0.258, 0.135, 0.032]} />
          <meshStandardMaterial color="#000710" transparent opacity={0.92} roughness={0} metalness={1} />
        </mesh>
        <mesh position={[-0.072, 1.077, 0.165]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={hovered ? 8 : 5} />
        </mesh>
        <mesh position={[0.072, 1.077, 0.165]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={hovered ? 8 : 5} />
        </mesh>
        <mesh position={[0, 1.3, 0]}><cylinderGeometry args={[0.016, 0.016, 0.19, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} /></mesh>
        <mesh position={[0, 1.41, 0]}><sphereGeometry args={[0.038, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} /></mesh>
      </group>

      {working && (
        <>
          <WorkingParticle color={color} offset={0} />
          <WorkingParticle color={color} offset={2.1} />
          <WorkingParticle color={color} offset={4.2} />
        </>
      )}
    </group>
  )
}

function WorkingParticle({ color, offset }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + offset
    if (ref.current) {
      ref.current.position.x = Math.sin(t * 2.5) * 0.42
      ref.current.position.y = 0.72 + Math.abs(Math.sin(t * 1.8)) * 0.72
      ref.current.position.z = Math.cos(t * 2.5) * 0.42
      ref.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.35
    }
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.052, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.75} />
    </mesh>
  )
}

// ─── Ambient particles ────────────────────────────────────────────────────────

function FloatingParticle({ x, y, z, speed, phase, color, size }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + phase
    if (ref.current) {
      ref.current.position.y = y + Math.sin(t) * 0.95
      ref.current.position.x = x + Math.cos(t * 0.42) * 0.45
      ref.current.material.opacity = 0.22 + Math.sin(t * 1.6) * 0.18
    }
  })
  return (
    <mesh ref={ref} position={[x, y, z]}>
      <sphereGeometry args={[size, 5, 5]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.35} />
    </mesh>
  )
}

function AmbientParticles() {
  const particles = useMemo(() => {
    const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b']
    return Array.from({ length: 38 }, (_, i) => ({
      x: (Math.random() - 0.5) * 26, z: (Math.random() - 0.5) * 10,
      y: 2.8 + Math.random() * 7.5,
      speed: 0.22 + Math.random() * 0.55, phase: Math.random() * Math.PI * 2,
      color: colors[i % colors.length], size: 0.038 + Math.random() * 0.058,
    }))
  }, [])
  return <>{particles.map((p, i) => <FloatingParticle key={i} {...p} />)}</>
}

// ─── Patrol drones ────────────────────────────────────────────────────────────

function PatrolDrone({ orbitPhase, color, height }) {
  const groupRef = useRef()
  const r1 = useRef(), r2 = useRef(), r3 = useRef(), r4 = useRef()
  const scanLight = useRef()

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime()
    const x  = Math.sin(t * 0.38 + orbitPhase) * 9.5
    const z  = Math.cos(t * 0.22 + orbitPhase) * 2.8 - 0.5
    const y  = height + Math.sin(t * 0.85 + orbitPhase) * 0.5
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      const vx = Math.cos(t * 0.38 + orbitPhase) * 0.38
      const vz = -Math.sin(t * 0.22 + orbitPhase) * 0.22
      groupRef.current.rotation.y = Math.atan2(vx, vz)
      groupRef.current.rotation.z = Math.sin(t * 0.85) * 0.07
    }
    const rs = t * 28
    if (r1.current) r1.current.rotation.y =  rs
    if (r2.current) r2.current.rotation.y = -rs
    if (r3.current) r3.current.rotation.y =  rs
    if (r4.current) r4.current.rotation.y = -rs
    if (scanLight.current) scanLight.current.intensity = 0.55 + Math.sin(t * 3.2) * 0.25
  })

  return (
    <group ref={groupRef}>
      <mesh><boxGeometry args={[0.34, 0.1, 0.34]} /><meshStandardMaterial color="#071828" emissive={color} emissiveIntensity={0.5} metalness={0.96} roughness={0.08} /></mesh>
      <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.1, 14, 14]} /><meshStandardMaterial color="#030d1e" emissive={color} emissiveIntensity={0.85} metalness={0.9} roughness={0} transparent opacity={0.82} /></mesh>
      <mesh ref={r1} position={[-0.26, 0.04, -0.26]}><cylinderGeometry args={[0.18, 0.18, 0.025, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={0.52} /></mesh>
      <mesh ref={r2} position={[ 0.26, 0.04, -0.26]}><cylinderGeometry args={[0.18, 0.18, 0.025, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={0.52} /></mesh>
      <mesh ref={r3} position={[-0.26, 0.04,  0.26]}><cylinderGeometry args={[0.18, 0.18, 0.025, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={0.52} /></mesh>
      <mesh ref={r4} position={[ 0.26, 0.04,  0.26]}><cylinderGeometry args={[0.18, 0.18, 0.025, 14]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} transparent opacity={0.52} /></mesh>
      <pointLight ref={scanLight} position={[0, -0.22, 0]} color={color} intensity={0.55} distance={7} />
      <mesh position={[0, -0.08, 0]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} /></mesh>
    </group>
  )
}

// ─── Data packets & beams ────────────────────────────────────────────────────

function DataPacket({ from, to, color, delay, speed = 0.45 }) {
  const ref     = useRef()
  const t       = useRef(delay)
  const fromVec = useMemo(() => new THREE.Vector3(...from), [])
  const toVec   = useMemo(() => new THREE.Vector3(...to), [])
  useFrame((_, delta) => {
    t.current = (t.current + delta * speed) % 1
    if (ref.current) {
      const arc = Math.sin(t.current * Math.PI) * 1.3
      ref.current.position.lerpVectors(fromVec, toVec, t.current)
      ref.current.position.y += arc
      ref.current.material.opacity = Math.sin(t.current * Math.PI)
    }
  })
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.14, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} transparent opacity={1} />
    </mesh>
  )
}

function ConnectionBeam({ from, to, color, active }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [])
  const geom   = useMemo(() => { const g = new THREE.BufferGeometry(); g.setFromPoints(points); return g }, [points])
  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={active ? 0.7 : 0.12} />
    </line>
  )
}

// ─── Scene environment ────────────────────────────────────────────────────────

function SceneEnvironment({ isActive }) {
  const moonRef = useRef()
  useFrame(({ clock }) => {
    if (moonRef.current) moonRef.current.intensity = 0.22 + Math.sin(clock.getElapsedTime() * 0.3) * 0.04
  })
  return (
    <>
      <fog attach="fog" args={['#020810', 24, 58]} />
      <ambientLight intensity={0.2} color="#0a1a2e" />
      <directionalLight ref={moonRef} position={[-8, 20, -5]} intensity={0.22} color="#a0c8f0" castShadow />
      <pointLight position={[-10, 4, 0]} color="#06b6d4" intensity={isActive ? 2.0 : 0.6} distance={14} />
      <pointLight position={[-2.5, 5, 0]} color="#f59e0b" intensity={isActive ? 2.5 : 1.0} distance={18} />
      <pointLight position={[5,   4, 0]} color="#8b5cf6" intensity={isActive ? 2.0 : 0.6} distance={14} />
      <pointLight position={[10,  3, 0]} color="#10b981" intensity={isActive ? 2.0 : 0.6} distance={14} />
      <Stars radius={80} depth={40} count={2200} factor={3.5} saturation={0.3} fade speed={0.5} />
    </>
  )
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ color: '#2d4f6a', fontSize: 8, letterSpacing: '0.2em', marginBottom: 7, textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
      {children}
    </div>
  )
}

function HUDPanel({ children, style }) {
  return (
    <div style={{
      background: 'rgba(3,8,18,0.92)',
      border: '1px solid rgba(6,182,212,0.16)',
      borderRadius: 11, padding: '9px 13px',
      backdropFilter: 'blur(16px)',
      minWidth: 172,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Agent Roster Card ────────────────────────────────────────────────────────

function AgentRosterCard({ agent }) {
  const ac = SKILL_COLORS[agent.skill_level] || '#06b6d4'
  const sc = agent.animationState === 'working' ? '#10b981' :
             agent.animationState === 'walking' ? '#f59e0b' : '#5a7a9a'

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `${ac}07`, border: `1px solid ${ac}22`,
      borderRadius: 13, padding: '11px 13px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${ac}70, transparent)`, opacity: agent.animationState === 'working' ? 1 : 0.3 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${ac}18`, border: `1px solid ${ac}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: agent.animationState === 'working' ? `0 0 14px ${ac}45` : 'none', flexShrink: 0 }}>
          🧑‍💻
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e2eeff', fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name || 'Agent'}</div>
          <div style={{ color: '#3d5f7a', fontSize: 9.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.role || 'AI Worker'}</div>
        </div>
        <div style={{ flexShrink: 0, background: `${ac}18`, border: `1px solid ${ac}35`, borderRadius: 6, padding: '2px 7px', fontSize: 8, color: ac, fontWeight: 800, letterSpacing: '0.1em' }}>
          {(agent.skill_level || '??').toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc, boxShadow: `0 0 5px ${sc}`, display: 'inline-block', animation: agent.animationState !== 'idle' ? 'pulseDot 1.4s ease infinite' : 'none' }} />
        <span style={{ color: sc, fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{agent.animationState || 'idle'}</span>
        <span style={{ color: '#2d4f6a', fontSize: 8, fontFamily: '"JetBrains Mono", monospace' }}>{(agent.currentZone || 'hub').replace('to', '→').toUpperCase()}</span>
      </div>
    </div>
  )
}

// ─── Live HUD (enhanced) ─────────────────────────────────────────────────────

function LiveHUD({ agents, isActive, activeHubs }) {
  const [uptime, setUptime]   = useState(0)
  const [netBars, setNetBars] = useState(Array.from({ length: 10 }, () => ri(20, 70)))

  useEffect(() => {
    const t = setInterval(() => {
      setUptime(u => u + 1)
      setNetBars(prev => [...prev.slice(1), ri(20, 95)])
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const skillCounts = useMemo(() => ({
    expert: agents.filter(a => a.skill_level === 'expert').length,
    senior: agents.filter(a => a.skill_level === 'senior').length,
    mid:    agents.filter(a => a.skill_level === 'mid').length,
    junior: agents.filter(a => a.skill_level === 'junior').length,
  }), [agents])

  const statColor = isActive ? '#10b981' : '#5a7a9a'
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', zIndex: 5 }}>
      {/* Status + network sparkline */}
      <HUDPanel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statColor, boxShadow: isActive ? `0 0 10px ${statColor}` : 'none', display: 'inline-block', animation: isActive ? 'pulseDot 1.2s ease infinite' : 'none' }} />
            <span style={{ color: statColor, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>{isActive ? 'SYS ONLINE' : 'STANDBY'}</span>
          </div>
          <span style={{ color: '#2d4f6a', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}>{fmt(uptime)}</span>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20, marginBottom: 3 }}>
          {netBars.map((h, i) => (
            <div key={i} style={{ flex: 1, borderRadius: 2, background: `rgba(6,182,212,${0.12 + (h / 95) * 0.7})`, height: `${(h / 95) * 20}px`, transition: 'height 0.4s ease' }} />
          ))}
        </div>
        <div style={{ color: '#2d4f6a', fontSize: 7.5, letterSpacing: '0.16em', fontFamily: '"JetBrains Mono", monospace' }}>NET TRAFFIC</div>
      </HUDPanel>

      {/* Agent breakdown */}
      <HUDPanel>
        <SectionLabel>AGENTS DEPLOYED</SectionLabel>
        <div style={{ color: '#e2eeff', fontSize: 26, fontWeight: 800, fontFamily: '"Syne", sans-serif', lineHeight: 1, marginBottom: 8 }}>
          {agents.length}
          <span style={{ color: '#2d4f6a', fontSize: 10, fontWeight: 400, marginLeft: 5 }}>ONLINE</span>
        </div>
        {Object.entries(skillCounts).filter(([, v]) => v > 0).map(([sk, ct]) => (
          <div key={sk} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 16, height: 3, borderRadius: 2, background: SKILL_COLORS[sk] }} />
            <span style={{ color: '#4a6a84', fontSize: 9, flex: 1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sk}</span>
            <span style={{ color: '#e2eeff', fontSize: 10, fontWeight: 700 }}>{ct}</span>
          </div>
        ))}
      </HUDPanel>

      {/* Active hubs */}
      {activeHubs.length > 0 && (
        <HUDPanel>
          <SectionLabel>HUBS ONLINE</SectionLabel>
          {activeHubs.map(h => {
            const hc = h === 'research' ? '#8b5cf6' : '#10b981'
            return (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hc, boxShadow: `0 0 7px ${hc}`, display: 'inline-block' }} />
                <span style={{ color: '#7aa3c4', fontSize: 10, fontWeight: 600, flex: 1 }}>{h.toUpperCase()}</span>
                <span style={{ color: hc, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em' }}>● LIVE</span>
              </div>
            )
          })}
        </HUDPanel>
      )}
    </div>
  )
}

// ─── Building Modal (complete redesign) ──────────────────────────────────────

function BuildingModal({ zone, onClose }) {
  const { name, desc, color, key, dept, role, agents } = zone

  const [actLog, setActLog] = useState(() =>
    Array.from({ length: 8 }, () => ({
      msg:  termMsg(key),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }))
  )
  const [metrics, setMetrics] = useState({ cpu: ri(55, 92), mem: ri(38, 78), thru: ri(60, 98) })

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      setActLog(prev => [{ msg: termMsg(key), time: now }, ...prev.slice(0, 9)])
      setMetrics({ cpu: ri(55, 92), mem: ri(38, 78), thru: ri(60, 98) })
    }, 2000)
    return () => clearInterval(t)
  }, [key])

  const working = agents.filter(a => a.animationState === 'working').length
  const walking = agents.filter(a => a.animationState === 'walking').length
  const idle    = agents.filter(a => a.animationState === 'idle').length

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(1,4,12,0.82)', backdropFilter: 'blur(10px)', animation: 'modalFadeIn 0.25s ease both' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', inset: 10, background: 'rgba(2,7,18,0.98)', border: `1px solid ${color}28`, borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: `0 0 120px ${color}10, inset 0 1px 0 ${color}18` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Chromatic top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent 0%, ${color}50 20%, ${color} 50%, ${color}50 80%, transparent 100%)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '13px 22px', borderBottom: `1px solid ${color}12`, display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(135deg, ${color}06 0%, transparent 50%)`, flexShrink: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: `${color}12`, border: `1.5px solid ${color}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 18px ${color}28, inset 0 0 12px ${color}08`, flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon points="10,1 19,5.5 19,14.5 10,19 1,14.5 1,5.5" fill="none" stroke={color} strokeWidth="1.4" />
              <circle cx="10" cy="10" r="3.5" fill={color} opacity="0.9" />
              <circle cx="10" cy="10" r="1.5" fill="white" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color, fontSize: 8.5, letterSpacing: '0.24em', marginBottom: 2, opacity: 0.65, fontFamily: '"JetBrains Mono", monospace' }}>ZONE INSPECTION · {dept?.toUpperCase()}</div>
            <div style={{ color: '#e2eeff', fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', fontFamily: '"Syne", sans-serif', textShadow: `0 0 20px ${color}50` }}>{name}</div>
            <div style={{ color: '#3d5f7a', fontSize: 10.5, marginTop: 1.5 }}>{role}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}0c`, border: `1px solid ${color}25`, borderRadius: 20, padding: '5px 14px', flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, display: 'inline-block', animation: 'pulseDot 1.4s ease infinite' }} />
            <span style={{ color, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em' }}>OPERATIONAL</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#4a6a84', padding: '7px 15px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.2s', flexShrink: 0 }}>
            ✕ CLOSE
          </button>
        </div>

        {/* 3-column body */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '210px 1fr 190px', overflow: 'hidden' }}>

          {/* Col 1: Metrics */}
          <div style={{ padding: '14px 16px', borderRight: `1px solid ${color}0e`, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Personnel */}
            <div>
              <SectionLabel>PERSONNEL</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[{ l: 'TOTAL', v: agents.length, c: '#e2eeff' }, { l: 'ACTIVE', v: working, c: '#10b981' }, { l: 'TRANSIT', v: walking, c: '#f59e0b' }, { l: 'IDLE', v: idle, c: '#5a7a9a' }].map(({ l, v, c }) => (
                  <div key={l} style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ color: c, fontSize: 20, fontWeight: 800, fontFamily: '"Syne", sans-serif', lineHeight: 1 }}>{v}</div>
                    <div style={{ color: '#2d4f6a', fontSize: 7.5, letterSpacing: '0.12em', marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* System metrics */}
            <div>
              <SectionLabel>SYSTEM METRICS</SectionLabel>
              {[{ l: 'CPU LOAD', v: metrics.cpu, c: '#06b6d4' }, { l: 'MEMORY', v: metrics.mem, c: '#8b5cf6' }, { l: 'THROUGHPUT', v: metrics.thru, c: '#10b981' }].map(({ l, v, c }) => (
                <div key={l} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#3d5f7a', fontSize: 8.5, letterSpacing: '0.08em' }}>{l}</span>
                    <span style={{ color: c, fontSize: 9, fontWeight: 700 }}>{v}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${v}%`, background: `linear-gradient(90deg, ${c}60, ${c})`, borderRadius: 3, transition: 'width 0.7s ease', boxShadow: `0 0 7px ${c}80` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* About */}
            <div style={{ background: `${color}05`, border: `1px solid ${color}10`, borderRadius: 10, padding: '10px 12px' }}>
              <SectionLabel>ABOUT</SectionLabel>
              <p style={{ color: '#3d5f7a', fontSize: 10.5, lineHeight: 1.65, marginTop: 2 }}>{desc}</p>
            </div>
          </div>

          {/* Col 2: Agent roster */}
          <div style={{ padding: '14px 16px', overflowY: 'auto', borderRight: `1px solid ${color}0e` }}>
            <SectionLabel>ACTIVE AGENTS ({agents.length})</SectionLabel>
            {agents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `${color}08`, border: `1px solid ${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke={color} strokeWidth="1.2" opacity="0.35" /><line x1="6" y1="11" x2="16" y2="11" stroke={color} strokeWidth="1.2" opacity="0.35" /></svg>
                </div>
                <div style={{ color: '#2d4f6a', fontSize: 11 }}>No agents in this zone</div>
                <div style={{ color: '#1d3045', fontSize: 9.5, marginTop: 4 }}>Agents will appear when assigned</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 8 }}>
                {agents.map(a => <AgentRosterCard key={a.id} agent={a} />)}
              </div>
            )}
          </div>

          {/* Col 3: Activity terminal */}
          <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SectionLabel>LIVE TERMINAL</SectionLabel>
            <div style={{ flex: 1, overflowY: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, lineHeight: 1.8 }}>
              {actLog.map((e, i) => (
                <div key={i} style={{ opacity: Math.max(0.18, 1 - i * 0.11), animation: i === 0 ? 'termEntry 0.3s ease' : 'none', marginBottom: 1 }}>
                  <span style={{ color: '#1d3a52', fontSize: 8 }}>{e.time} </span>
                  <span style={{ color: i === 0 ? color : '#2d4f6a' }}>{i === 0 ? '›' : ' '} {e.msg}</span>
                </div>
              ))}
            </div>
            {/* Terminal prompt */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${color}0e`, fontFamily: '"JetBrains Mono", monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: color, fontSize: 8.5, opacity: 0.75 }}>{key.toUpperCase()}@HUB&nbsp;$</span>
              <span style={{ display: 'inline-block', width: 6, height: 12, background: color, opacity: 0.8, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes termEntry   { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }
      `}</style>
    </div>
  )
}

// ─── Enhanced Agent Detail Panel ─────────────────────────────────────────────

function AgentDetailPanel({ agent, onClose }) {
  const color      = SKILL_COLORS[agent.skill_level] || '#06b6d4'
  const stateColor = agent.animationState === 'working' ? '#10b981' :
                     agent.animationState === 'walking' ? '#f59e0b' : '#5a7a9a'
  const stateLabel = agent.animationState === 'working' ? 'WORKING' :
                     agent.animationState === 'walking' ? 'IN TRANSIT' : 'IDLE'

  const [progress, setProgress] = useState(() => ri(15, 80))
  const [energy,   setEnergy]   = useState(() => ri(55, 100))

  useEffect(() => {
    const t = setInterval(() => {
      if (agent.animationState === 'working') setProgress(p => Math.min(99, p + ri(0, 3)))
      setEnergy(e => Math.max(38, Math.min(100, e + ri(-3, 3))))
    }, 1500)
    return () => clearInterval(t)
  }, [agent.animationState])

  const perfScore = useMemo(() =>
    agent.skill_level === 'expert' ? ri(90, 99) :
    agent.skill_level === 'senior' ? ri(76, 92) :
    agent.skill_level === 'mid'    ? ri(60, 79) : ri(44, 66)
  , [agent.id])

  return (
    <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(2,7,18,0.97)', border: `1px solid ${color}38`, borderRadius: 20, overflow: 'hidden', minWidth: 258, maxWidth: 295, boxShadow: `0 0 60px ${color}18, 0 8px 40px rgba(0,0,0,0.6)`, backdropFilter: 'blur(22px)', animation: 'slideIn 0.28s ease both', zIndex: 10 }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

      <div style={{ padding: '15px 18px' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: `${color}15`, border: `1px solid ${color}28`, borderRadius: 8, color, padding: '2px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✕</button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: `${color}14`, border: `1.5px solid ${color}42`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: agent.animationState === 'working' ? `0 0 22px ${color}50` : 'none', flexShrink: 0 }}>🧑‍💻</div>
          <div>
            <div style={{ color: '#e2eeff', fontWeight: 700, fontSize: 14.5 }}>{agent.name || 'Agent'}</div>
            <div style={{ color, fontSize: 10, opacity: 0.78, marginTop: 2 }}>{agent.role || 'AI Worker'}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 6, padding: '2px 7px' }}>
              <span style={{ color, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em' }}>⭐ {(agent.skill_level || 'N/A').toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${stateColor}0d`, border: `1px solid ${stateColor}22`, borderRadius: 10, padding: '7px 11px', marginBottom: 13 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor, boxShadow: `0 0 8px ${stateColor}`, display: 'inline-block', animation: agent.animationState !== 'idle' ? 'pulseDot 1.4s ease infinite' : 'none' }} />
          <span style={{ color: stateColor, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', flex: 1 }}>{stateLabel}</span>
          <span style={{ color: '#2d4f6a', fontSize: 8.5, fontFamily: '"JetBrains Mono", monospace' }}>{(agent.currentZone || 'HUB').toUpperCase()}</span>
        </div>

        {/* Progress bars */}
        {[{ l: 'TASK PROGRESS', v: progress, c: '#10b981' }, { l: 'ENERGY', v: energy, c: color }].map(({ l, v, c }) => (
          <div key={l} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#2d4f6a', fontSize: 8, letterSpacing: '0.1em', fontFamily: '"JetBrains Mono", monospace' }}>{l}</span>
              <span style={{ color: c, fontSize: 8.5, fontWeight: 700 }}>{v}%</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${v}%`, background: `linear-gradient(90deg, ${c}55, ${c})`, borderRadius: 2, transition: 'width 0.9s ease', boxShadow: `0 0 6px ${c}` }} />
            </div>
          </div>
        ))}

        {/* Perf score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)', borderRadius: 10, padding: '7px 11px', marginTop: 2 }}>
          <div>
            <div style={{ color: '#2d4f6a', fontSize: 8, letterSpacing: '0.1em', fontFamily: '"JetBrains Mono", monospace', marginBottom: 2 }}>PERFORMANCE</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} style={{ width: 18, height: 3, borderRadius: 2, background: i < Math.round(perfScore / 20) ? color : 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          </div>
          <div style={{ color: '#e2eeff', fontSize: 20, fontWeight: 800, fontFamily: '"Syne", sans-serif', textAlign: 'right' }}>
            {perfScore}<span style={{ color: '#2d4f6a', fontSize: 9, fontWeight: 400 }}>/100</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SimulationWorld3D() {
  const agents     = useStore(s => s.agents)
  const isActive   = useStore(s => s.isActive)
  const activeHubs = useStore(s => s.activeHubs)

  const [zoomTarget,    setZoomTarget]    = useState(null)
  const [selectedZone,  setSelectedZone]  = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)

  const resActive = activeHubs.includes('research')
  const devActive = activeHubs.includes('developer')

  const inZone = zones =>
    agents.filter(a => Array.isArray(zones) ? zones.includes(a.currentZone) : a.currentZone === zones)

  const agentsByBuilding = {
    hub:      inZone(['hub', 'returning']),
    enquiry:  inZone(['toEnquiry', 'enquiry']),
    research: inZone(['toResearch', 'research']),
    dev:      inZone(['toDev', 'dev']),
  }

  const handleBuildingClick = useCallback(key => {
    const b = BUILDINGS[key]
    setZoomTarget(key)
    setSelectedAgent(null)
    setSelectedZone({
      name: b.label, desc: b.desc, color: b.color, key,
      dept: b.dept,  role: b.role,
      agents: agentsByBuilding[key] || [],
    })
  }, [agentsByBuilding])

  const handleClose = () => {
    setZoomTarget(null)
    setSelectedZone(null)
    setSelectedAgent(null)
  }

  const bPos   = key => BUILDINGS[key].pos
  const BEAM_H = 1.5

  return (
    <div
      className="relative w-full"
      style={{ height: 580, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(6,182,212,0.22)', boxShadow: '0 0 90px rgba(6,182,212,0.09), 0 0 0 1px rgba(6,182,212,0.05)' }}
    >
      <Canvas
        camera={{ position: [0, 14, 22], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'radial-gradient(circle at 50% 20%, #16274d 0%, #091120 45%, #02040a 100%)' }}
        onClick={() => { if (zoomTarget) handleClose() }}
      >
        <SceneEnvironment isActive={isActive} />
        <CameraController zoomTarget={zoomTarget} />
        <CityGround isActive={isActive} />
        <CityBackdrop />

        {Object.values(BUILDINGS).map(b => (
          <Building3D
            key={b.key} config={b}
            isActive={
              b.key === 'enquiry'  ? true :
              b.key === 'hub'      ? (isActive || agentsByBuilding.hub.length > 0) :
              b.key === 'research' ? resActive :
              b.key === 'dev'      ? devActive : false
            }
            agentCount={agentsByBuilding[b.key]?.length || 0}
            onClick={() => handleBuildingClick(b.key)}
          />
        ))}

        {/* Holographic projector above selected building */}
        {zoomTarget && <HolographicProjector buildingKey={zoomTarget} />}

        {agents.map((agent, i) => (
          <HumanAgent3D
            key={agent.id} agent={agent} index={i}
            onSelect={a => { setSelectedAgent(a); setSelectedZone(null); setZoomTarget(null) }}
          />
        ))}

        <HumanAgent3D
          agent={{ id: 'router', name: 'Router', skill_level: 'expert', currentZone: 'enquiry', animationState: agentsByBuilding.enquiry.length > 0 ? 'working' : 'idle' }}
          index={-1}
          onSelect={a => { setSelectedAgent(a); setSelectedZone(null); setZoomTarget(null) }}
        />

        <ConnectionBeam from={[bPos('hub')[0], BEAM_H, bPos('hub')[2]]}         to={[bPos('enquiry')[0],  BEAM_H, bPos('enquiry')[2]]}  color="#06b6d4" active={isActive} />
        <ConnectionBeam from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]} to={[bPos('research')[0], BEAM_H, bPos('research')[2]]} color="#8b5cf6" active={resActive} />
        <ConnectionBeam from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]} to={[bPos('dev')[0],      BEAM_H, bPos('dev')[2]]}      color="#10b981" active={devActive} />

        {isActive && [0, 0.33, 0.66].map(d => (
          <DataPacket key={`he-${d}`} from={[bPos('hub')[0], BEAM_H, bPos('hub')[2]]} to={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]} color="#06b6d4" delay={d} />
        ))}
        {resActive && [0, 0.5].map(d => (
          <DataPacket key={`er-${d}`} from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]} to={[bPos('research')[0], BEAM_H, bPos('research')[2]]} color="#8b5cf6" delay={d} speed={0.35} />
        ))}
        {devActive && [0.25, 0.75].map(d => (
          <DataPacket key={`ed-${d}`} from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]} to={[bPos('dev')[0], BEAM_H, bPos('dev')[2]]} color="#10b981" delay={d} speed={0.35} />
        ))}

        <PatrolDrone orbitPhase={0}   color="#06b6d4" height={7.5} />
        <PatrolDrone orbitPhase={2.1} color="#8b5cf6" height={8.8} />
        <PatrolDrone orbitPhase={4.2} color="#10b981" height={7.0} />

        <AmbientParticles />
      </Canvas>

      {/* React overlays */}
      <LiveHUD agents={agents} isActive={isActive} activeHubs={activeHubs} />

      {!selectedZone && !selectedAgent && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(2,7,18,0.84)', border: '1px solid rgba(6,182,212,0.16)', borderRadius: 28, padding: '6px 18px', backdropFilter: 'blur(12px)', pointerEvents: 'none', animation: 'fadeUp 0.6s ease 0.4s both' }}>
          <span style={{ color: '#2d4f6a', fontSize: 10, letterSpacing: '0.1em', fontFamily: '"JetBrains Mono", monospace' }}>
            🖱 CLICK BUILDING OR AGENT TO INSPECT · SCROLL ZOOM · DRAG ORBIT
          </span>
        </div>
      )}

      {selectedAgent && !selectedZone && (
        <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}

      {selectedZone && (
        <BuildingModal zone={selectedZone} onClose={handleClose} />
      )}
    </div>
  )
}
