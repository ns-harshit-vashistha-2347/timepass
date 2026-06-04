import { TypeAnimation } from 'react-type-animation'
import { useStore } from '../store/useStore'

export default function ActivityLog() {
  const activityLog = useStore((s) => s.activityLog)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
        <span className="text-xs font-bold tracking-widest" style={{ color: '#3d6080', fontFamily: '"JetBrains Mono", monospace' }}>
          SYSTEM LOG
        </span>
      </div>

      <div className="space-y-1.5">
        {activityLog.map((entry, i) => (
          <div key={entry.id} className="flex gap-2 text-xs"
            style={{ borderLeft: `2px solid ${i === 0 ? 'rgba(6,182,212,0.4)' : 'rgba(26,58,92,0.4)'}`, paddingLeft: 8 }}>
            <span className="flex-shrink-0 opacity-40" style={{ color: '#5a7a9a', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
              {entry.time}
            </span>
            {i === 0 ? (
              <TypeAnimation
                sequence={[entry.message]}
                speed={85}
                cursor={false}
                className="leading-relaxed"
                style={{ color: '#7aa3c4', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}
              />
            ) : (
              <span className="leading-relaxed" style={{ color: '#3d6080', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
                {entry.message}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
