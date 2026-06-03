import { create } from 'zustand'

// These positions match exactly the SimulationWorld canvas coordinates
// Canvas is 1200x560, ground at y=490
// Agent walk y = 468 (ground level feet position)
const POSITIONS = {
  hub:      { x: 140,  y: 462 },
  enquiry:  { x: 558,  y: 462 },
  research: { x: 922,  y: 462 },
  dev:      { x: 1092, y: 462 },
}

export const useStore = create((set, get) => ({

  // ─── USER ────────────────────────────────────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),

  // ─── AGENTS ──────────────────────────────────────────────────────────────
  agents: [],

  setAgents: (agents) => {
    const current = get().agents
    const isActive = get().isActive
    if (isActive) return  

    const enhanced = agents.map((agent, i) => {
      const existing = current.find(a => a.id === agent.id)
      const col = i % 3
      const row = Math.floor(i / 3)
      const spawnX = POSITIONS.hub.x + (col - 1) * 28
      const spawnY = POSITIONS.hub.y - row * 18

      return {
        ...agent,
        x:             existing?.x             ?? spawnX,
        y:             existing?.y             ?? spawnY,
        targetX:       existing?.targetX       ?? spawnX,
        targetY:       existing?.targetY       ?? spawnY,
        currentZone:   existing?.currentZone   ?? 'hub',
        isMoving:      existing?.isMoving      ?? false,
        isWorking:     existing?.isWorking     ?? false,
        animationState: existing?.animationState ?? 'idle',
      }
    })
    set({ agents: enhanced })
  },

  // Step 1 — all agents walk from Hub → Enquiry Dept
  moveAgentsToEnquiry: () => {
    set(state => ({
      agents: state.agents.map((agent, i) => ({
        ...agent,
        targetX: POSITIONS.enquiry.x + (i % 3) * 28 - 28,
        targetY: POSITIONS.enquiry.y - Math.floor(i / 3) * 22,
        currentZone:   'toEnquiry',
        isMoving:      true,
        isWorking:     false,
        animationState: 'walking',
      }))
    }))
  },

  // Step 2 — agents arrived at Enquiry, now routing
  setAgentsRouting: () => {
    set(state => ({
      agents: state.agents.map(agent => ({
        ...agent,
        currentZone:   'enquiry',
        isMoving:      false,
        isWorking:     true,
        animationState: 'working',
      }))
    }))
  },

  // Step 3 — dispatch agents to hub(s) after routing decision
  // hubs = ['research'] | ['developer'] | ['research', 'developer']
  dispatchAgents: (hubs) => {
    set(state => {
      const total = state.agents.length

      if (hubs.length === 1) {
        const pos  = hubs[0] === 'research' ? POSITIONS.research : POSITIONS.dev
        const zone = hubs[0] === 'research' ? 'toResearch' : 'toDev'
        return {
          agents: state.agents.map((agent, i) => ({
            ...agent,
            targetX: pos.x + (i % 3) * 30 - 30,
            targetY: pos.y - Math.floor(i / 3) * 22,
            currentZone:   zone,
            isMoving:      true,
            isWorking:     false,
            animationState: 'walking',
          }))
        }
      }

      // Split: first half → research, second half → dev
      const half = Math.ceil(total / 2)
      return {
        agents: state.agents.map((agent, i) => {
          const goResearch  = i < half
          const pos         = goResearch ? POSITIONS.research : POSITIONS.dev
          const zone        = goResearch ? 'toResearch' : 'toDev'
          const localIdx    = goResearch ? i : i - half
          return {
            ...agent,
            targetX: pos.x + (localIdx % 3) * 30 - 30,
            targetY: pos.y - Math.floor(localIdx / 3) * 22,
            currentZone:   zone,
            isMoving:      true,
            isWorking:     false,
            animationState: 'walking',
          }
        })
      }
    })
  },

  // Step 4 — agents reached their hub, start working
  setAgentsWorking: () => {
    set(state => ({
      agents: state.agents.map(agent => ({
        ...agent,
        currentZone: agent.currentZone === 'toResearch' ? 'research'
                    : agent.currentZone === 'toDev'      ? 'dev'
                    : agent.currentZone,
        isMoving:      false,
        isWorking:     true,
        animationState: 'working',
      }))
    }))
  },

  // Step 5 — all agents walk back to Hub
  returnAgentsToHub: () => {
    set(state => ({
      agents: state.agents.map((agent, i) => ({
        ...agent,
        targetX: POSITIONS.hub.x + (i % 3) * 32 - 32,
        targetY: POSITIONS.hub.y - Math.floor(i / 3) * 22,
        currentZone:   'returning',
        isMoving:      true,
        isWorking:     false,
        animationState: 'walking',
      }))
    }))
  },

  // Step 6 — arrived back, reset
  finishReturn: () => {
    set(state => ({
      agents: state.agents.map((agent, i) => ({
        ...agent,
        targetX: POSITIONS.hub.x + (i % 3) * 32 - 32,
        targetY: POSITIONS.hub.y - Math.floor(i / 3) * 22,
        currentZone:   'hub',
        isMoving:      false,
        isWorking:     false,
        animationState: 'idle',
      }))
    }))
  },

  // ─── SESSION STATE ────────────────────────────────────────────────────────
  isActive: false,
  setIsActive: (v) => set({ isActive: v }),

  activeHubs: [],          // ['research'] | ['developer'] | ['research','developer']
  setActiveHubs: (hubs) => set({ activeHubs: hubs }),

  enquirySessionId: null,
  setEnquirySessionId: (id) => set({ enquirySessionId: id }),

  researchSessionId: null,
  setResearchSessionId: (id) => set({ researchSessionId: id }),

  devSessionId: null,
  setDevSessionId: (id) => set({ devSessionId: id }),

  researchResult: null,
  setResearchResult: (r) => set({ researchResult: r }),

  devResult: null,
  setDevResult: (r) => set({ devResult: r }),

  // ─── ACTIVITY LOG ────────────────────────────────────────────────────────
  activityLog: [],
  addActivity: (message) => set(state => ({
    activityLog: [
      { id: Date.now(), message, time: new Date().toLocaleTimeString() },
      ...state.activityLog.slice(0, 19)
    ]
  })),
}))