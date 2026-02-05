/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        opus: { primary: '#9B7EBD', secondary: '#E8DFF0' },
        codex: { primary: '#5B8C5A', secondary: '#E0EBE0' },
        gemini: { primary: '#5B9BD5', secondary: '#E0ECF5' },
      },
    },
  },
  plugins: [],
};
