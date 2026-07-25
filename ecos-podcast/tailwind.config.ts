import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a0806',
          800: '#100d0a',
          700: '#161210',
          600: '#1e1815',
          500: '#2a221d',
        },
        cream: {
          50: '#faf3e3',
          100: '#f5e9d3',
          200: '#e6d5b3',
          300: '#c7b58f',
          400: '#8f8168',
        },
        gold: {
          DEFAULT: '#c9a961',
          light: '#e3c885',
          dark: '#8a7440',
        },
        muted: '#3d2f1e',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'cursive'],
      },
      backgroundImage: {
        spotlight:
          'radial-gradient(ellipse at 50% 20%, rgba(201,169,97,0.18) 0%, rgba(10,8,6,0) 55%)',
        'kraft':
          'linear-gradient(135deg, #8a6f45 0%, #6b5638 45%, #4b3d29 100%)',
        'polaroid-shadow':
          'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)',
      },
      boxShadow: {
        soft: '0 20px 60px -20px rgba(0,0,0,0.6)',
        polaroid: '0 22px 45px -18px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.4)',
        stamp: 'inset 0 0 0 2px rgba(201,169,97,0.7)',
      },
      keyframes: {
        floatSlow: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        flicker: {
          '0%,100%': { opacity: '1' },
          '45%': { opacity: '0.92' },
          '55%': { opacity: '1' },
        },
      },
      animation: {
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        flicker: 'flicker 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
