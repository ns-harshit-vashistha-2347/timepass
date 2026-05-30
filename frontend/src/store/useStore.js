import { create } from 'zustand'

const HUB_POSITION = { x: 140, y: 350 }       
const RESEARCH_POSITION = { x: 780, y: 320 } 

export const useStore = create((set, get) => ({

  // USER
  user: null,
  setUser: (user) => set({ user }),

  // AGENTS
  agents: [],

  setAgents: (agents) => {
    const currentAgents = get().agents  // get existing state
    const isResearching = get().isResearching

    // If a mission is active, don't reset positions
    if (isResearching) return

    const enhancedAgents = agents.map((agent, index) => {
      const existing = currentAgents.find(a => a.id === agent.id)
      return {
        ...agent,
        x: existing?.x ?? HUB_POSITION.x + (index % 3) * 30,
        y: existing?.y ?? HUB_POSITION.y + Math.floor(index / 3) * 30,
        targetX: existing?.targetX ?? HUB_POSITION.x,
        targetY: existing?.targetY ?? HUB_POSITION.y,
        currentZone: existing?.currentZone ?? 'hub',
        isMoving: existing?.isMoving ?? false,
        isWorking: existing?.isWorking ?? false,
        animationState: existing?.animationState ?? 'idle'
      }
    })
    set({ agents: enhancedAgents })
  },

  moveAgentsToResearch: () => {
    set((state) => ({
      agents: state.agents.map((agent, index) => ({
        ...agent,

        targetX: RESEARCH_POSITION.x + (index % 3) * 40,
        targetY: RESEARCH_POSITION.y + Math.floor(index / 3) * 40,

        currentZone: 'moving',
        isMoving: true,
        isWorking: false,
        animationState: 'walking'
      }))
    }))
  },

  setAgentsWorking: () => {
    set((state) => ({
      agents: state.agents.map((agent) => ({
        ...agent,
        currentZone: 'research',
        isMoving: false,
        isWorking: true,
        animationState: 'working'
      }))
    }))
  },

  returnAgentsToHub: () => {
    set((state) => ({
      agents: state.agents.map((agent, index) => ({
        ...agent,

        targetX: HUB_POSITION.x + (index % 3) * 30,
        targetY: HUB_POSITION.y + Math.floor(index / 3) * 30,

        currentZone: 'returning',
        isMoving: true,
        isWorking: false,
        animationState: 'walking'
      }))
    }))
  },

  finishReturn: () => {
    set((state) => ({
      agents: state.agents.map((agent) => ({
        ...agent,
        currentZone: 'hub',
        isMoving: false,
        isWorking: false,
        animationState: 'idle'
      }))
    }))
  },

  // RESEARCH
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  researchResult: null,
  setResearchResult: (result) => set({ researchResult: result }),

  isResearching: false,
  setIsResearching: (v) => set({ isResearching: v }),

  // ACTIVITY
  activityLog: [],

  addActivity: (message) => set((state) => ({
    activityLog: [
      {
        id: Date.now(),
        message,
        time: new Date().toLocaleTimeString()
      },
      ...state.activityLog.slice(0, 19)
    ]
  }))
}))