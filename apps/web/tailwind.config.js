/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          base: '#070b14',
          raised: '#0c1220',
          overlay: '#111827',
          card: '#1a2332',
          border: '#1e293b',
          hover: '#243044',
        },
        sentinel: {
          950: '#070b14',
          900: '#0c1220',
          800: '#111827',
          700: '#1a2332',
          600: '#243044',
          500: '#2d3a4d',
          400: '#475569',
          300: '#64748b',
          200: '#94a3b8',
          100: '#cbd5e1',
          50: '#f1f5f9',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          emerald: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          rose: '#f43f5e',
          coral: '#fb7185',
          orange: '#f97316',
        },
        severity: {
          critical: '#ef4444',
          high: '#f97316',
          elevated: '#f59e0b',
          low: '#22c55e',
          info: '#3b82f6',
        },
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 4px 1px rgba(239,68,68,0.4)' },
          '50%': { boxShadow: '0 0 8px 3px rgba(239,68,68,0.7)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
