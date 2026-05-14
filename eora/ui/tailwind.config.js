/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      animation: {
        'fadeIn':      'fadeIn 0.4s ease-out',
        'slideIn':     'slideIn 0.3s ease-out',
        'pulse-soft':  'pulse-soft 2s ease-in-out infinite',
        'pop':         'pop 0.45s cubic-bezier(.17,.67,.36,1.35)',
        'shake':       'shake 0.55s cubic-bezier(.36,.07,.19,.97) both',
        'bounceIn':    'bounceIn 0.5s cubic-bezier(.17,.67,.36,1.35)',
        'slideUp':     'slideUp 0.4s ease-out',
        'toastIn':     'toastIn 0.35s cubic-bezier(.21,1.02,.73,1)',
        'toastOut':    'toastOut 0.25s ease-in forwards',
        'stageEnter':  'stageEnter 0.4s cubic-bezier(.21,1.02,.73,1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-8px)' },
          '30%': { transform: 'translateX(7px)' },
          '45%': { transform: 'translateX(-6px)' },
          '60%': { transform: 'translateX(5px)' },
          '75%': { transform: 'translateX(-3px)' },
          '90%': { transform: 'translateX(2px)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.1)', opacity: '1' },
          '70%':  { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        toastOut: {
          '0%':   { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(110%)' },
        },
        stageEnter: {
          '0%':   { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
