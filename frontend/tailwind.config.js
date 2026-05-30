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
        bg:     '#080510',
        text:   '#c9b8e8',
        muted:  '#5c4d7a',
        accent: '#a855f7',
        green:  '#34d399',
        yellow: '#fbbf24',
        red:    '#f87171',
        border: '#2a1a45',
      }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%':   { textShadow: '0 0 4px #a855f7' },
          '100%': { textShadow: '0 0 16px #a855f7, 0 0 32px #a855f7' },
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
