import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a', // page background
        panel: '#1e293b',
        panel2: '#273449',
        line: '#334155', // borders
        fg: '#e2e8f0', // primary text
        muted: '#94a3b8',
        accent: '#38bdf8',
        danger: '#f87171',
        ok: '#34d399',
      },
      borderRadius: {
        xl: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
