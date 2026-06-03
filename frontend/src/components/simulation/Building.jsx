export default function Building({ title, subtitle, x, y, width, height, color, isActive, onClick }) {

  const primary = color === 'violet' ? '#4f46e5' : '#7c3aed'
  const glow = `${primary}44`

  return (
    <div
      onClick={onClick}
      className="absolute cursor-pointer transition-all duration-500 hover:scale-[1.02]"
      style={{ left: x, top: y, width, height }}
    >
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-2xl transition-all duration-500"
        style={{
          boxShadow: isActive
            ? `0 0 60px ${primary}55, 0 0 120px ${primary}22`
            : `0 0 20px ${primary}22`,
          border: `1px solid ${isActive ? primary + '88' : primary + '22'}`,
          borderRadius: '16px'
        }}
      />

      {/* Main body */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0f0820 0%, #1a0d35 50%, #0f0820 100%)` }}>

        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }} />

        {/* Corner brackets — top left */}
        <div className="absolute top-3 left-3 w-4 h-4"
          style={{ borderTop: `2px solid ${primary}`, borderLeft: `2px solid ${primary}` }} />
        {/* top right */}
        <div className="absolute top-3 right-3 w-4 h-4"
          style={{ borderTop: `2px solid ${primary}`, borderRight: `2px solid ${primary}` }} />
        {/* bottom left */}
        <div className="absolute bottom-3 left-3 w-4 h-4"
          style={{ borderBottom: `2px solid ${primary}`, borderLeft: `2px solid ${primary}` }} />
        {/* bottom right */}
        <div className="absolute bottom-3 right-3 w-4 h-4"
          style={{ borderBottom: `2px solid ${primary}`, borderRight: `2px solid ${primary}` }} />

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.35em] font-bold"
              style={{ color: primary }}>{title}</div>
            <div className="text-[9px] mt-0.5" style={{ color: primary + '88' }}>{subtitle}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Status LEDs */}
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isActive && i === 0 ? primary : primary + '33',
                  boxShadow: isActive && i === 0 ? `0 0 6px ${primary}` : 'none',
                  animation: isActive && i === 0 ? 'pulse 1.5s infinite' : 'none'
                }} />
            ))}
          </div>
        </div>

        {/* Terminal grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg relative overflow-hidden"
              style={{
                background: isActive ? `${primary}0a` : 'rgba(0,0,0,0.4)',
                border: `1px solid ${isActive ? primary + '30' : primary + '10'}`
              }}>
              {/* Horizontal line details inside each cell */}
              <div className="absolute top-2 left-2 right-2 h-px"
                style={{ background: `${primary}${isActive ? '40' : '15'}` }} />
              <div className="absolute bottom-2 left-2 right-2 h-px"
                style={{ background: `${primary}${isActive ? '25' : '10'}` }} />
              {/* Scan line animation */}
              {isActive && (
                <div className="absolute w-full h-0.5"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${primary}60, transparent)`,
                    animation: `scanDown ${1.5 + i * 0.3}s linear infinite`,
                  }} />
              )}
            </div>
          ))}
        </div>

        {/* Bottom hint */}
        <div className="absolute bottom-2 right-4 text-[8px] tracking-[0.2em]"
          style={{ color: primary + '50' }}>CLICK TO INSPECT</div>

      </div>
    </div>
  )
}