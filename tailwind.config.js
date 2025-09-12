/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Crimson Text', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        paper: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        'paper-lifted': '0 2px 15px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
