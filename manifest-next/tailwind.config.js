/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)',  'monospace'],
      },
      colors: {
        gold:   '#b8922a',
        'gold-light': '#faf3e0',
        ink:    '#111111',
        muted:  '#666666',
        border: '#e8e8e8',
      },
      animation: {
        'fade-up':  'fadeUp .6s ease both',
        'fade-in':  'fadeIn .3s ease both',
        'ticker':   'ticker 32s linear infinite',
        'float':    'float 6s ease-in-out infinite',
        'spin-slow':'spin 1s linear infinite',
      },
      keyframes: {
        fadeUp:  { from:{ opacity:0, transform:'translateY(20px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        fadeIn:  { from:{ opacity:0 }, to:{ opacity:1 } },
        ticker:  { to:{ transform:'translateX(-50%)' } },
        float:   { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-8px)' } },
      },
    },
  },
  plugins: [],
}
