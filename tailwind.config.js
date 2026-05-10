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
        page: 'rgb(var(--l-page) / <alpha-value>)',
        'page-dim': 'rgb(var(--l-page-dim) / <alpha-value>)',
        card: 'rgb(var(--l-card) / <alpha-value>)',
        'card-hover': 'rgb(var(--l-card-hover) / <alpha-value>)',
        badge: 'rgb(var(--l-badge) / <alpha-value>)',
        brown: {
          DEFAULT: 'rgb(var(--l-text) / <alpha-value>)',
          secondary: 'rgb(var(--l-text-secondary) / <alpha-value>)',
          subtle: 'rgb(var(--l-text-subtle) / <alpha-value>)',
          muted: 'rgb(var(--l-text-muted) / <alpha-value>)',
          faint: 'rgb(var(--l-text-faint) / <alpha-value>)',
        },
        'beige-border': 'rgb(var(--l-border) / <alpha-value>)',
        'beige-active': 'rgb(var(--l-border-active) / <alpha-value>)',
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
