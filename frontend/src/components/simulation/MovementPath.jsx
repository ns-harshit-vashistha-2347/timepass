export default function MovementPath({ isResearching }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Base road — always visible, dim */}
      <line x1="280" y1="330" x2="720" y2="300"
        stroke="rgba(79,70,229,0.08)"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Animated flow line — only when researching */}
      {isResearching && (
        <line x1="280" y1="330" x2="720" y2="300"
          stroke="rgba(0,229,255,0.7)"
          strokeWidth="3"
          strokeDasharray="16 12"
          strokeLinecap="round"
          filter="url(#glow)"
          style={{
            animation: 'dashFlow 1s linear infinite'
          }}
        />
      )}
    </svg>
  )
}