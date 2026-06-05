/**
 * SimulationWorld3D.jsx  —  Replace SimulationWorld.jsx with this file.
 *
 * Full 3D cyberpunk city using React Three Fiber.
 * Features:
 *   • 3-D isometric-ish city with neon-lit skyscrapers
 *   • Animated agent robots walking between buildings
 *   • Data-packet beams flying along active routes
 *   • Smooth camera zoom-to-building on click
 *   • Rich inspection panel slide-in overlay
 *   • Holographic rings + glow on active hubs
 *   • Stars, fog, directional + point lights
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

// ─── World constants ──────────────────────────────────────────────────────────

const BUILDINGS = {
  hub: {
    pos:   [-10, 0, 0],
    size:  [3,   6, 2.5],
    color: '#06b6d4',
    label: 'AGENT HUB',
    desc:  'Central factory. Spawns and manages all AI agents on demand.',
    key:   'hub',
  },
  enquiry: {
    pos:   [-2.5, 0, 0],
    size:  [3.8,  9.5, 3],
    color: '#f59e0b',
    label: 'ENQUIRY DEPT',
    desc:  'Smart front-door. Routes queries to the right hub using LLM reasoning.',
    key:   'enquiry',
  },
  research: {
    pos:   [5,  0, 0],
    size:  [3,  6.5, 2.5],
    color: '#8b5cf6',
    label: 'RESEARCH LAB',
    desc:  'Deep analysis, fact-finding, market research and written reports.',
    key:   'research',
  },
  dev: {
    pos:   [10, 0, 0],
    size:  [2.5,5, 2],
    color: '#10b981',
    label: 'DEV HUB',
    desc:  'Full-stack builds, architecture decisions, code reviews and DevOps.',
    key:   'dev',
  },
}

// Agent road Y and Z in 3-D space (agents walk "in front of" buildings)
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

const DEFAULT_CAM   = new THREE.Vector3(0, 14, 22)
const DEFAULT_LOOK  = new THREE.Vector3(0, 3, 0)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToVec3(hex) {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

// ─── Camera controller — smoothly lerps to zoom target ────────────────────────

function CameraController({ zoomTarget, onZoomDone }) {
  const { camera } = useThree()
  const ctrlRef    = useRef()

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
      tCamPos.current.set(bx, bh * 0.6 + 4, b.pos[2] + 9)
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
      ref={ctrlRef}
      enablePan={false}
      minDistance={6}
      maxDistance={35}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2.2}
      enabled={!zoomTarget}
    />
  )
}

// ─── City Ground — dark tarmac + glowing grid ──────────────────────────────────

function CityGround({ isActive }) {
  return (
    <group>
      {/* Main ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#040d18" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* Grid lines — use line segments */}
      {Array.from({ length: 25 }, (_, i) => {
        const x = -12 + i
        return (
          <line key={`v${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([x, 0, -8, x, 0, 8])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#06b6d4" opacity={0.04} transparent />
          </line>
        )
      })}
      {Array.from({ length: 17 }, (_, i) => {
        const z = -8 + i
        return (
          <line key={`h${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([-12, 0, z, 13, 0, z])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#06b6d4" opacity={0.04} transparent />
          </line>
        )
      })}

      {/* Road strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, ROAD_Z]}>
        <planeGeometry args={[28, 2.5]} />
        <meshStandardMaterial color="#060d1a" roughness={0.8} />
      </mesh>

      {/* Road center dashes */}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-13 + i * 2, 0.02, ROAD_Z]}>
          <planeGeometry args={[0.9, 0.08]} />
          <meshStandardMaterial
            color={isActive ? '#06b6d4' : '#1a3050'}
            emissive={isActive ? '#06b6d4' : '#0a1828'}
            emissiveIntensity={isActive ? 0.8 : 0.2}
          />
        </mesh>
      ))}

      {/* Street lamps */}
      {[-9, -6, -1, 2, 6, 9].map(x => (
        <group key={x} position={[x, 0, 3.8]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 4, 6]} />
            <meshStandardMaterial color="#0d1f35" />
          </mesh>
          <mesh position={[0.5, 3.8, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial
              color="#fde68a"
              emissive="#fde68a"
              emissiveIntensity={isActive ? 2 : 0.5}
            />
          </mesh>
          {isActive && (
            <pointLight position={[0.5, 3.8, 0]} color="#f59e0b" intensity={0.4} distance={5} />
          )}
        </group>
      ))}
    </group>
  )
}

// ─── 3-D Building ────────────────────────────────────────────────────────────

function Building3D({ config, isActive, agentCount, onClick }) {
  const meshRef   = useRef()
  const ringRef   = useRef()
  const glowRef   = useRef()
  const [hovered, setHovered] = useState(false)
  const { pos, size, color, label } = config
  const [bx, , bz] = pos
  const [bw, bh, bd] = size

  // Edge geometry for wireframe outline
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd)), [bw, bh, bd])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ringRef.current)  ringRef.current.rotation.y = t * 0.4
    if (glowRef.current)  glowRef.current.intensity = isActive ? (0.8 + Math.sin(t * 2) * 0.3) : 0
    if (meshRef.current) {
      const target = hovered ? 1.03 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
    }
  })

  // Window grid
  const windows = useMemo(() => {
    const wins = []
    const cols   = bw > 3.2 ? 4 : 3
    const floors = Math.floor(bh / 1.4) - 1
    for (let fi = 0; fi < floors; fi++) {
      for (let ci = 0; ci < cols; ci++) {
        const wx = bx - bw / 2 + (ci + 0.7) * (bw / (cols))
        const wy = 0.8 + fi * 1.35
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
      {/* Active point light */}
      <pointLight ref={glowRef} color={color} intensity={0} distance={12} decay={2} />

      {/* Building body */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <meshStandardMaterial
          color="#040e1c"
          emissive={color}
          emissiveIntensity={isActive ? 0.06 : (hovered ? 0.04 : 0.015)}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={isActive ? 0.55 : (hovered ? 0.4 : 0.18)} />
      </lineSegments>

      {/* Windows */}
      {windows.map(({ wx, wy, lit, fi, ci }) => (
        <mesh key={`w${fi}-${ci}`} position={[wx - bx, wy - bh / 2, bd / 2 + 0.01]}>
          <planeGeometry args={[0.22, 0.38]} />
          <meshStandardMaterial
            color={lit ? color : '#060f1e'}
            emissive={lit ? color : '#000'}
            emissiveIntensity={isActive ? 0.9 : (lit ? 0.25 : 0)}
            transparent
            opacity={lit ? 0.95 : 0.4}
          />
        </mesh>
      ))}

      {/* Roof platform */}
      <mesh position={[0, bh / 2 + 0.15, 0]}>
        <boxGeometry args={[bw + 0.3, 0.2, bd + 0.3]} />
        <meshStandardMaterial color="#060f1e" emissive={color} emissiveIntensity={isActive ? 0.3 : 0.05} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, bh / 2 + 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 2, 8]} />
        <meshStandardMaterial color="#0d2040" emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, bh / 2 + 2.3, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 3 : 0.6}
        />
      </mesh>
      {isActive && (
        <>
          <pointLight position={[0, bh / 2 + 2.3, 0]} color={color} intensity={1.5} distance={6} />
          {/* Pulsing ring sphere */}
          <mesh position={[0, bh / 2 + 2.3, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.12} />
          </mesh>
        </>
      )}

      {/* Spinning holographic ring at base when active */}
      {isActive && (
        <group ref={ringRef} position={[0, -bh / 2 + 0.1, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[bw * 0.75, 0.04, 8, 32]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.7} />
          </mesh>
        </group>
      )}

      {/* Vertical edge glow pillars */}
      {isActive && [[-bw/2, -bz/2], [bw/2, -bz/2], [-bw/2, bz/2], [bw/2, bz/2]].map(([ex, ez], i) => (
        <mesh key={i} position={[ex, 0, ez]}>
          <cylinderGeometry args={[0.04, 0.04, bh, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Floating label */}
      <Billboard position={[0, bh / 2 + 3.2, 0]}>
        <Text
          fontSize={0.36}
          color={isActive ? 'white' : color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.12}
          outlineColor={color}
          outlineWidth={isActive ? 0.012 : 0}
        >
          {label}
        </Text>
        {agentCount > 0 && (
          <Text
            position={[0, -0.5, 0]}
            fontSize={0.26}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {`● ${agentCount} AGENT${agentCount > 1 ? 'S' : ''}`}
          </Text>
        )}
      </Billboard>
    </group>
  )
}

// ─── 3-D Agent robot ──────────────────────────────────────────────────────────

function Agent3D({ agent, index }) {
  const groupRef  = useRef()
  const leftLeg   = useRef()
  const rightLeg  = useRef()
  const leftArm   = useRef()
  const rightArm  = useRef()
  const eyeGlow   = useRef()
  const particles = useRef([])

  const color   = SKILL_COLORS[agent.skill_level] || '#06b6d4'
  const zone    = agent.currentZone || 'hub'
  const walking = agent.animationState === 'walking'
  const working = agent.animationState === 'working'

  // Target 3D position from zone
  const targetPos = useMemo(() => {
    const base = ZONE_3D[zone] || ZONE_3D.hub
    const col  = index % 3
    const row  = Math.floor(index / 3)
    return new THREE.Vector3(base[0] + (col - 1) * 0.55, base[1], base[2] + row * 0.55)
  }, [zone, index])

  const curPos = useRef(targetPos.clone())

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const spd = walking ? 0.04 : 0.08

    curPos.current.lerp(targetPos, spd)
    if (groupRef.current) groupRef.current.position.copy(curPos.current)

    if (walking) {
      const swing = Math.sin(t * 6) * 0.45
      if (leftLeg.current)  leftLeg.current.rotation.x   =  swing
      if (rightLeg.current) rightLeg.current.rotation.x  = -swing
      if (leftArm.current)  leftArm.current.rotation.x   = -swing * 0.6
      if (rightArm.current) rightArm.current.rotation.x  =  swing * 0.6
      if (groupRef.current) {
        groupRef.current.position.y = curPos.current.y + Math.abs(Math.sin(t * 6)) * 0.04
      }
    } else {
      if (leftLeg.current)  leftLeg.current.rotation.x  = 0
      if (rightLeg.current) rightLeg.current.rotation.x = 0
      if (leftArm.current)  leftArm.current.rotation.x  = 0
      if (rightArm.current) rightArm.current.rotation.x = 0
    }

    if (working) {
      if (groupRef.current) groupRef.current.position.y = curPos.current.y + Math.sin(t * 3) * 0.04
      if (leftArm.current)  leftArm.current.rotation.x  = -0.7 + Math.sin(t * 4) * 0.3
      if (rightArm.current) rightArm.current.rotation.x = -0.7 - Math.sin(t * 4) * 0.3
      if (eyeGlow.current)  eyeGlow.current.intensity   = 0.5 + Math.sin(t * 5) * 0.3
    } else {
      if (eyeGlow.current) eyeGlow.current.intensity = 0.1
    }
  })

  return (
    <group ref={groupRef}>
      {/* Eye glow light */}
      <pointLight ref={eyeGlow} position={[0, 0.75, 0.2]} color={color} intensity={0.1} distance={1.5} />

      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -AGENT_Y + 0.01, 0]}>
        <circleGeometry args={[0.25, 12]} />
        <meshStandardMaterial color="#000" transparent opacity={0.35} />
      </mesh>

      {/* Left leg */}
      <group ref={leftLeg} position={[-0.1, 0.16, 0]}>
        <mesh position={[0, -0.18, 0]}>
          <boxGeometry args={[0.12, 0.36, 0.1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={rightLeg} position={[0.1, 0.16, 0]}>
        <mesh position={[0, -0.18, 0]}>
          <boxGeometry args={[0.12, 0.36, 0.1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Body */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.36, 0.44, 0.22]} />
        <meshStandardMaterial color="#061828" emissive={color} emissiveIntensity={working ? 0.2 : 0.1} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Chest badge */}
      <mesh position={[0, 0.48, 0.115]}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={working ? 2 : 0.8} transparent opacity={0.9} />
      </mesh>

      {/* Left arm */}
      <group ref={leftArm} position={[-0.22, 0.5, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.1, 0.28, 0.1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rightArm} position={[0.22, 0.5, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.1, 0.28, 0.1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.32, 0.28, 0.24]} />
        <meshStandardMaterial color="#061828" emissive={color} emissiveIntensity={0.15} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 0.96, 0.13]}>
        <boxGeometry args={[0.24, 0.16, 0.02]} />
        <meshStandardMaterial color="#000" transparent opacity={0.85} roughness={0} metalness={1} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 0.97, 0.15]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0.07, 0.97, 0.15]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
      </mesh>
      {/* Head antenna */}
      <mesh position={[0, 1.14, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>

      {/* Working particles */}
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
      ref.current.position.x = Math.sin(t * 2.5) * 0.35
      ref.current.position.y = 0.6 + Math.abs(Math.sin(t * 1.8)) * 0.6
      ref.current.position.z = Math.cos(t * 2.5) * 0.35
      ref.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.35
    }
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.05, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.7} />
    </mesh>
  )
}

// ─── Animated data packet ──────────────────────────────────────────────────────

function DataPacket({ from, to, color, delay, speed = 0.45 }) {
  const ref     = useRef()
  const t       = useRef(delay)
  const fromVec = useMemo(() => new THREE.Vector3(...from), [])
  const toVec   = useMemo(() => new THREE.Vector3(...to), [])

  useFrame((_, delta) => {
    t.current = (t.current + delta * speed) % 1
    if (ref.current) {
      const arc = Math.sin(t.current * Math.PI) * 0.8
      ref.current.position.lerpVectors(fromVec, toVec, t.current)
      ref.current.position.y += arc
      ref.current.material.opacity = Math.sin(t.current * Math.PI)
    }
  })

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={1} />
    </mesh>
  )
}

// ─── Static beam between buildings ────────────────────────────────────────────

function ConnectionBeam({ from, to, color, active }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [])
  const geom   = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints(points)
    return g
  }, [points])

  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={active ? 0.45 : 0.07} />
    </line>
  )
}

// ─── Scene lighting + environment ─────────────────────────────────────────────

function SceneEnvironment({ isActive }) {
  const moonRef = useRef()
  useFrame(({ clock }) => {
    if (moonRef.current) moonRef.current.intensity = 0.12 + Math.sin(clock.getElapsedTime() * 0.3) * 0.02
  })
  return (
    <>
      <fog attach="fog" args={['#020810', 22, 55]} />
      <ambientLight intensity={0.06} />
      <directionalLight
        ref={moonRef}
        position={[-8, 20, -5]}
        intensity={0.12}
        color="#a0c8f0"
      />
      <Stars radius={80} depth={40} count={1800} factor={3} saturation={0.2} fade speed={0.4} />
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SimulationWorld3D() {
  const agents     = useStore(s => s.agents)
  const isActive   = useStore(s => s.isActive)
  const activeHubs = useStore(s => s.activeHubs)

  const [zoomTarget,   setZoomTarget]   = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)

  const resActive = activeHubs.includes('research')
  const devActive = activeHubs.includes('developer')

  const inZone = (zones) =>
    agents.filter(a => Array.isArray(zones) ? zones.includes(a.currentZone) : a.currentZone === zones)

  const agentsByBuilding = {
    hub:      inZone(['hub', 'returning']),
    enquiry:  inZone(['toEnquiry', 'enquiry']),
    research: inZone(['toResearch', 'research']),
    dev:      inZone(['toDev', 'dev']),
  }

  const handleBuildingClick = useCallback((key) => {
    const b = BUILDINGS[key]
    setZoomTarget(key)
    setSelectedZone({
      name:   b.label,
      desc:   b.desc,
      color:  b.color,
      key,
      agents: agentsByBuilding[key] || [],
    })
  }, [agentsByBuilding])

  const handleClose = () => {
    setZoomTarget(null)
    setSelectedZone(null)
  }

  // Beam endpoints at building face (y = mid-height)
  const beamY = (key) => BUILDINGS[key].size[1] / 2
  const bPos  = (key) => BUILDINGS[key].pos

  // Road elevation for beams
  const BEAM_H = 1.5

  return (
    <div className="relative w-full" style={{ height: 580, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 0 60px rgba(6,182,212,0.06)' }}>

      {/* ─── Three.js canvas ─────────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 14, 22], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(180deg,#02080f 0%,#050e1c 60%,#071525 100%)' }}
        onClick={() => {
          if (zoomTarget) handleClose()
        }}
      >
        <SceneEnvironment isActive={isActive} />
        <CameraController zoomTarget={zoomTarget} />

        <CityGround isActive={isActive} />

        {/* ── Buildings ── */}
        {Object.values(BUILDINGS).map(b => (
          <Building3D
            key={b.key}
            config={b}
            isActive={
              b.key === 'enquiry' ? true :
              b.key === 'hub'     ? (!isActive || agentsByBuilding.hub.length > 0) :
              b.key === 'research'? resActive :
              b.key === 'dev'     ? devActive : false
            }
            agentCount={agentsByBuilding[b.key]?.length || 0}
            onClick={() => handleBuildingClick(b.key)}
          />
        ))}

        {/* ── Agents ── */}
        {agents.map((agent, i) => (
          <Agent3D key={agent.id} agent={agent} index={i} />
        ))}

        {/* ── Static router agent always at Enquiry ── */}
        <Agent3D
          agent={{
            id: 'router', name: 'Router', skill_level: 'expert',
            currentZone:   'enquiry',
            animationState: agentsByBuilding.enquiry.length > 0 ? 'working' : 'idle',
          }}
          index={-1}
        />

        {/* ── Connection beams ── */}
        <ConnectionBeam
          from={[bPos('hub')[0], BEAM_H, bPos('hub')[2]]}
          to={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
          color="#06b6d4"
          active={isActive}
        />
        <ConnectionBeam
          from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
          to={[bPos('research')[0], BEAM_H, bPos('research')[2]]}
          color="#8b5cf6"
          active={resActive}
        />
        <ConnectionBeam
          from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
          to={[bPos('dev')[0], BEAM_H, bPos('dev')[2]]}
          color="#10b981"
          active={devActive}
        />

        {/* ── Data packets ── */}
        {isActive && (
          <>
            {[0, 0.33, 0.66].map(d => (
              <DataPacket
                key={`hub-enq-${d}`}
                from={[bPos('hub')[0], BEAM_H, bPos('hub')[2]]}
                to={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
                color="#06b6d4"
                delay={d}
              />
            ))}
          </>
        )}
        {resActive && (
          <>
            {[0, 0.5].map(d => (
              <DataPacket
                key={`enq-res-${d}`}
                from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
                to={[bPos('research')[0], BEAM_H, bPos('research')[2]]}
                color="#8b5cf6"
                delay={d}
                speed={0.35}
              />
            ))}
          </>
        )}
        {devActive && (
          <>
            {[0.25, 0.75].map(d => (
              <DataPacket
                key={`enq-dev-${d}`}
                from={[bPos('enquiry')[0], BEAM_H, bPos('enquiry')[2]]}
                to={[bPos('dev')[0], BEAM_H, bPos('dev')[2]]}
                color="#10b981"
                delay={d}
                speed={0.35}
              />
            ))}
          </>
        )}
      </Canvas>

      {/* ─── HUD: hint ───────────────────────────────────────────── */}
      {!selectedZone && (
        <div
          className="absolute bottom-4 left-1/2"
          style={{
            transform:  'translateX(-50%)',
            background: 'rgba(3,11,24,0.75)',
            border:     '1px solid rgba(6,182,212,0.2)',
            borderRadius: 24,
            padding:    '6px 18px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            animation: 'fadeUp 0.6s ease 0.4s both',
          }}
        >
          <span style={{ color: '#7aa3c4', fontSize: 11, letterSpacing: '0.1em' }}>
            🖱 CLICK ANY BUILDING TO INSPECT  ·  SCROLL TO ZOOM  ·  DRAG TO ORBIT
          </span>
        </div>
      )}

      {/* ─── Building inspection panel ───────────────────────────── */}
      {selectedZone && (
        <BuildingInspectionPanel zone={selectedZone} onClose={handleClose} />
      )}
    </div>
  )
}

// ─── Building inspection overlay ──────────────────────────────────────────────

function BuildingInspectionPanel({ zone, onClose }) {
  const { name, desc, color, agents } = zone

  return (
    <div
      className="absolute inset-0 flex items-end"
      style={{ background: 'rgba(2,8,20,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{
          background:   'rgba(5,14,28,0.97)',
          border:       `1px solid ${color}30`,
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          boxShadow:    `0 -12px 60px ${color}18`,
          animation:    'slideUpPanel 0.35s cubic-bezier(0.34,1.26,0.64,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 4, background: `${color}40` }} />
        </div>

        <div className="px-6 pb-6 pt-2">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-xs tracking-widest mb-1" style={{ color, opacity: 0.7 }}>ZONE INSPECTION</div>
              <h3 className="text-2xl font-bold tracking-wider" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif', textShadow: `0 0 20px ${color}60` }}>
                {name}
              </h3>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#5a7a9a', maxWidth: 440 }}>{desc}</p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: `${color}15`,
                border:     `1px solid ${color}30`,
                borderRadius: 10,
                color,
                padding:    '6px 14px',
                fontSize:   12,
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 mb-5">
            {[
              { label: 'AGENTS', value: agents.length },
              { label: 'WORKING', value: agents.filter(a => a.animationState === 'working').length },
              { label: 'IN TRANSIT', value: agents.filter(a => a.animationState === 'walking').length },
              { label: 'IDLE', value: agents.filter(a => a.animationState === 'idle').length },
            ].map(({ label, value }) => (
              <div key={label} style={{
                flex: 1, background: `${color}08`, border: `1px solid ${color}20`,
                borderRadius: 12, padding: '10px 12px', textAlign: 'center',
              }}>
                <div className="text-xl font-bold" style={{ color: '#e8f4ff', fontFamily: '"Syne", sans-serif' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color, opacity: 0.6, letterSpacing: '0.1em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Agent cards */}
          {agents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#3d6080', fontSize: 13 }}>
              No agents currently assigned to this zone.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {agents.map(agent => {
                const ac = SKILL_COLORS[agent.skill_level] || '#06b6d4'
                const stateColor = agent.animationState === 'working' ? '#10b981' : agent.animationState === 'walking' ? '#f59e0b' : '#5a7a9a'
                return (
                  <div key={agent.id} style={{
                    flexShrink: 0,
                    background: `${ac}08`,
                    border: `1px solid ${ac}25`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    minWidth: 160,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Status glow bar */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, transparent, ${ac}, transparent)`,
                      opacity: agent.animationState === 'working' ? 1 : 0.3,
                    }} />

                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${ac}18`, border: `1px solid ${ac}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, marginBottom: 10,
                      boxShadow: agent.animationState === 'working' ? `0 0 16px ${ac}50` : 'none',
                    }}>
                      🤖
                    </div>

                    <div style={{ color: '#e8f4ff', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                      {agent.name?.split(' ')[0] ?? 'Agent'}
                    </div>
                    <div style={{ color: '#5a7a9a', fontSize: 10, marginBottom: 8 }}>
                      {agent.role ?? 'Unknown role'}
                    </div>

                    {/* Skill badge */}
                    <div style={{
                      display: 'inline-block',
                      background: `${ac}18`, border: `1px solid ${ac}40`,
                      borderRadius: 6, padding: '2px 8px', fontSize: 9,
                      color: ac, fontWeight: 700, letterSpacing: '0.1em',
                      marginBottom: 6,
                    }}>
                      {agent.skill_level?.toUpperCase()}
                    </div>

                    {/* State indicator */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: stateColor,
                        boxShadow: `0 0 6px ${stateColor}`,
                        animation: agent.animationState !== 'idle' ? 'pulseDot 1.5s ease infinite' : 'none',
                      }} />
                      <span style={{ color: stateColor, fontWeight: 600, textTransform: 'uppercase' }}>
                        {agent.animationState}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUpPanel {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}