/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        page: '#f0eee6',
        'page-dim': '#e3dacc',
        card: '#faf9f5',
        'card-hover': '#ffffff',
        'badge': '#d5cdb8',
        brown: {
          DEFAULT: '#2d2920',
          secondary: '#5c5545',
          subtle: '#7a7263',
          muted: '#a09885',
          faint: '#bfb8a8',
        },
        'beige-border': '#e0dbcd',
        'beige-active': '#ede6d5',
        d: {
          page: 'rgb(var(--d-page) / <alpha-value>)',
          container: 'rgb(var(--d-container) / <alpha-value>)',
          card: 'rgb(var(--d-card) / <alpha-value>)',
          'card-hover': 'rgb(var(--d-card-hover) / <alpha-value>)',
          seg: 'rgb(var(--d-seg) / <alpha-value>)',
          footer: 'rgb(var(--d-footer) / <alpha-value>)',
          white: 'rgb(var(--d-white) / <alpha-value>)',
          'text-secondary': 'rgb(var(--d-text-secondary) / <alpha-value>)',
          'text-subtle': 'rgb(var(--d-text-subtle) / <alpha-value>)',
          'text-muted': 'rgb(var(--d-text-muted) / <alpha-value>)',
          'text-faint': 'rgb(var(--d-text-faint) / <alpha-value>)',
          'border-selected': 'rgb(var(--d-border-selected) / <alpha-value>)',
          'scrollbar-thumb': 'rgb(var(--d-scrollbar-thumb) / <alpha-value>)',
          'scrollbar-thumb-hover': 'rgb(var(--d-scrollbar-thumb-hover) / <alpha-value>)',
        },
      },
      animation: {
        'spin-fast': 'spin 500ms linear infinite',
      },
    },
  },
  plugins: [],
}
