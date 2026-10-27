/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'Cambria', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      colors: {
        surface: {
          50: '#f8fafc',
          900: '#0f172a',
          950: '#080d1a',
        },
      },
      boxShadow: {
        'glow-sky': '0 0 20px -5px rgba(56, 189, 248, 0.25)',
        'glow-emerald': '0 0 20px -5px rgba(52, 211, 153, 0.25)',
        'glow-amber': '0 0 20px -5px rgba(251, 191, 36, 0.25)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
