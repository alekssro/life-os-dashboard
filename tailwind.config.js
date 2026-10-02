/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: 'var(--paper-bg)',
          card: 'var(--paper-card)',
          border: 'var(--paper-border)',
          text: 'var(--paper-text)',
          muted: 'var(--paper-muted)',
          accent: 'var(--paper-accent)',
          star: 'var(--paper-star)',
          tag: 'var(--paper-tag)',
          highlight: 'var(--paper-highlight)',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'eink': '0 0 0 1px var(--paper-border)',
        'paper-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
