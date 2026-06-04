/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        hub: {
          bg:       '#030b18',
          surface:  '#071628',
          card:     '#0d2040',
          border:   '#1a3a5c',
          amber:    '#f59e0b',
          cyan:     '#06b6d4',
          violet:   '#8b5cf6',
          green:    '#10b981',
          red:      '#ef4444',
          textpri:  '#e8f4ff',
          textsec:  '#7aa3c4',
          textmut:  '#3d6080',
        }
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':        'float 4s ease-in-out infinite',
        'glow-amber':   'glowAmber 2s ease-in-out infinite alternate',
        'glow-cyan':    'glowCyan 2s ease-in-out infinite alternate',
        'orbit':        'orbit 8s linear infinite',
        'orbit-rev':    'orbit 12s linear infinite reverse',
        'scan-line':    'scanLine 3s linear infinite',
        'shimmer':      'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-8px)' },
        },
        glowAmber: {
          '0%':   { boxShadow: '0 0 8px #f59e0b44' },
          '100%': { boxShadow: '0 0 24px #f59e0b88, 0 0 48px #f59e0b33' },
        },
        glowCyan: {
          '0%':   { boxShadow: '0 0 8px #06b6d444' },
          '100%': { boxShadow: '0 0 24px #06b6d488, 0 0 48px #06b6d433' },
        },
        orbit: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        scanLine: {
          '0%':   { top: '-2px' },
          '100%': { top: '100%' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      }
    }
  },
  plugins: []
}
