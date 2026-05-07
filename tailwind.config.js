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
      },
      animation: {
        'spin-fast': 'spin 500ms linear infinite',
      },
    },
  },
  plugins: [],
}
