import { TypeAnimation } from 'react-type-animation'
import { useStore } from '../store/useStore'

export default function ActivityLog() {
  const activityLog = useStore((s) => s.activityLog)

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="text-xs text-indigo-500/60 uppercase tracking-widest mb-1">System</div>
        <h2 className="text-indigo-400 text-sm font-bold tracking-wider">ACTIVITY LOG</h2>
      </div>
      <div className="space-y-2">
        {activityLog.map((entry, i) => (
          <div key={entry.id} className="text-xs border-l-2 border-indigo-500/20 pl-3 py-1">
            <div className="text-indigo-500/50 mb-0.5">{entry.time}</div>
            {/* Typewriter only on the latest entry */}
            {i === 0 ? (
              <TypeAnimation
                sequence={[entry.message]}
                speed={80}
                cursor={false}
                className="text-indigo-200/80 leading-relaxed"
              />
            ) : (
              <div className="text-indigo-200/60 leading-relaxed">{entry.message}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}