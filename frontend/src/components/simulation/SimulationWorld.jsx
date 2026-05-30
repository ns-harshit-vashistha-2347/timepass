import { useState } from 'react'
import { useStore } from '../../store/useStore'
import Building from './Building'
import AgentSprite from './AgentSprite'
import MovementPath from './MovementPath'

export default function SimulationWorld() {
  const agents = useStore((s) => s.agents)
  const isResearching = useStore((s) => s.isResearching)
  const [selectedZone, setSelectedZone] = useState(null)

  const hubAgents = agents.filter(a => a.currentZone === 'hub')
  const researchAgents = agents.filter(a => 
    a.currentZone === 'research' || a.currentZone === 'moving' || a.currentZone === 'returning'
  )

  return (
    <div className="relative w-full h-[600px] overflow-hidden rounded-xl border border-violet-500/20 bg-[#080510]">

      {/* Grid Background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />

      {/* Ambient corner glows */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)' }} />

      {/* Roads */}
      <MovementPath isResearching={isResearching} />

      {/* Buildings */}
      <Building
        title="AGENT HUB"
        subtitle={`${hubAgents.length} agents stationed`}
        x={60} y={220} width={220} height={220}
        color="violet"
        isActive={!isResearching}
        onClick={() => setSelectedZone({ name: 'AGENT HUB', agents: hubAgents })}
      />

      <Building
        title="RESEARCH LAB"
        subtitle={`${researchAgents.length} agents working`}
        x={720} y={170} width={260} height={260}
        color="purple"
        isActive={isResearching}
        onClick={() => setSelectedZone({ name: 'RESEARCH LAB', agents: researchAgents })}
      />

      {/* Agents */}
      {agents.map((agent) => (
        <AgentSprite key={agent.id} agent={agent} />
      ))}

      {/* Zone Detail Overlay */}
      {selectedZone && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end"
          onClick={() => setSelectedZone(null)}>
          <div
            className="w-full p-6 rounded-t-2xl border-t border-violet-500/30"
            style={{ background: '#0f0820' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs tracking-[0.3em] text-violet-400 mb-1">ZONE DETAIL</div>
                <div className="text-white font-black text-lg tracking-wider">{selectedZone.name}</div>
              </div>
              <button onClick={() => setSelectedZone(null)}
                className="text-violet-400 hover:text-white text-xl">✕</button>
            </div>

            {selectedZone.agents.length === 0 ? (
              <div className="text-violet-400/50 text-sm text-center py-4">No agents in this zone</div>
            ) : (
              <div className="flex gap-6 overflow-x-auto pb-2">
                {selectedZone.agents.map(agent => (
                  <div key={agent.id} className="flex flex-col items-center gap-2 flex-shrink-0">
                    <AgentSprite agent={agent} size="lg" static />
                    <div className="text-center">
                      <div className="text-xs text-white font-semibold">{agent.name}</div>
                      <div className="text-xs text-violet-400">{agent.role}</div>
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                        agent.animationState === 'working' 
                          ? 'bg-green-500/20 text-green-400'
                          : agent.animationState === 'walking'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-violet-500/20 text-violet-400'
                      }`}>
                        {agent.animationState}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}