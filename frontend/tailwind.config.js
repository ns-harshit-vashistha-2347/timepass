/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', 'monospace'],
      },
      colors: {
        cyber: {
          bg:     '#f0f4ff',
          text:   '#1e293b',
          muted:  '#64748b',
          accent: '#4f46e5',
          green:  '#059669',
          yellow: '#d97706',
          red:    '#dc2626',
          border: '#e2e8f0',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%':   { textShadow: '0 0 4px #4f46e5' },
          '100%': { textShadow: '0 0 16px #4f46e5, 0 0 32px #4f46e5' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    }
  },
  plugins: []
}
