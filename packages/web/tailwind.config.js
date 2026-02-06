/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        opus: {
          primary: 'var(--color-opus-primary)',
          light: 'var(--color-opus-light)',
          dark: 'var(--color-opus-dark)',
          bg: 'var(--color-opus-bg)',
        },
        codex: {
          primary: 'var(--color-codex-primary)',
          light: 'var(--color-codex-light)',
          dark: 'var(--color-codex-dark)',
          bg: 'var(--color-codex-bg)',
        },
        gemini: {
          primary: 'var(--color-gemini-primary)',
          light: 'var(--color-gemini-light)',
          dark: 'var(--color-gemini-dark)',
          bg: 'var(--color-gemini-bg)',
        },
        owner: {
          primary: 'var(--color-owner-primary)',
          light: 'var(--color-owner-light)',
          dark: 'var(--color-owner-dark)',
          bg: 'var(--color-owner-bg)',
        },
        cafe: {
          white: 'var(--color-base-white)',
          black: 'var(--color-base-black)',
        },
      },
    },
  },
  plugins: [],
};
