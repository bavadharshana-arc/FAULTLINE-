/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#ffffff',
          darker: '#f8f7fc',
          panel: 'rgba(255, 255, 255, 0.85)',
          card: 'rgba(255, 255, 255, 0.92)',
          surface: 'rgba(248, 247, 252, 0.90)',
          hover: 'rgba(241, 238, 251, 0.70)',
          border: 'rgba(226, 232, 240, 0.85)',
          borderHi: 'rgba(139, 92, 246, 0.35)',
        },
        faultline: {
          purple: '#7c3aed',
          magenta: '#c026d3',
          pink: '#e11d48',
          violet: '#6d28d9',
          indigo: '#4f46e5',
          cyan: '#0284c7',
          red: '#e11d48',
          amber: '#d97706',
          green: '#059669',
          text: '#0f172a',
          textDim: '#64748b',
          textMuted: '#94a3b8',
        },
      },
      boxShadow: {
        'glow-purple': '0 8px 30px -4px rgba(139, 92, 246, 0.22)',
        'glow-magenta': '0 8px 30px -4px rgba(217, 70, 239, 0.22)',
        'glow-red': '0 8px 30px -4px rgba(244, 63, 94, 0.25)',
        'glow-green': '0 8px 30px -4px rgba(16, 185, 129, 0.22)',
        'glow-cyan': '0 8px 30px -4px rgba(14, 165, 233, 0.22)',
        'panel': '0 10px 30px -4px rgba(112, 80, 210, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        'glass': '0 8px 24px 0 rgba(112, 80, 210, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        'pill': '0 4px 16px -2px rgba(124, 58, 237, 0.28)',
        'orb': '0 0 120px 40px rgba(139, 92, 246, 0.12), 0 0 160px 80px rgba(217, 70, 239, 0.08)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 5s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px -3px rgba(244, 63, 94, 0.3)' },
          '50%': { boxShadow: '0 0 35px 2px rgba(244, 63, 94, 0.55)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
