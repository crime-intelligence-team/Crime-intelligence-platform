/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'full': '9999px',
      },
      colors: {
        bg: {
          canvas: '#0B0F14',
          surface: '#10161D',
          'surface-2': '#161D26',
          elevated: '#1C2530',
          'surface-hover': '#1C2530',
        },
        border: {
          subtle: '#232C38',
          default: '#2D3947',
          strong: '#3D4C5E',
        },
        text: {
          primary: '#E7ECF2',
          secondary: '#9AACC0',
          tertiary: '#64758A',
          disabled: '#3E4B5A',
        },
        brand: {
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          950: '#0F1E33',
        },
        severity: {
          critical: '#EF4444',
          high: '#F97316',
          medium: '#EAB308',
          low: '#22C55E',
          info: '#38BDF8',
          closed: '#64758A',
        },
        'severity-tint': {
          critical: '#2A1315',
          high: '#2B1A0C',
          medium: '#2A2410',
          low: '#10241A',
          info: '#0E2430',
          closed: '#1A2029',
        },
        viz: {
          1: '#38BDF8',
          2: '#A78BFA',
          3: '#34D399',
          4: '#FB923C',
          5: '#F472B6',
          6: '#FACC15',
          7: '#818CF8',
          8: '#4ADE80',
        },
        // "sentinel" is this app's grayscale text/border scale, used
        // throughout components (Sidebar, TopBar, NetworkGraphView, every
        // Governance* page, etc.) but never defined here — every
        // text-sentinel-*/border-sentinel-* class was silently generating
        // no CSS at all, which is what produced invisible text and
        // transparent panels. Values match Tailwind's own slate scale —
        // confirmed against NetworkGraphView's hardcoded Cytoscape hex
        // colors (#64748b, #f1f5f9), which are exact slate-500/slate-100.
        sentinel: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // "surface" is the same panel-background scale as `bg`/`border`
        // above, just under the key names most components actually use —
        // aliased to identical hex values so both naming schemes render
        // consistently.
        surface: {
          base: '#0B0F14',
          card: '#10161D',
          raised: '#1C2530',
          hover: '#1C2530',
          border: '#232C38',
        },
        // "accent" is this app's interactive/semantic color set (buttons,
        // focus rings, isolate/danger actions) — also previously undefined.
        accent: {
          blue: '#3B82F6',
          rose: '#F43F5E',
          amber: '#F59E0B',
          coral: '#F97066',
          emerald: '#10B981',
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
