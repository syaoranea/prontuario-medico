/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f0f9',
          100: '#cce0f3',
          200: '#99c2e8',
          300: '#66a3dc',
          400: '#3385d1',
          500: '#0A6EBD',
          600: '#0958a5',
          700: '#07426d',
          800: '#042135',
          900: '#02101a',
        },
        secondary: {
          50: '#e8f7f2',
          100: '#d1efe6',
          200: '#a3dfcc',
          300: '#75cfb3',
          400: '#47bf99',
          500: '#12B886',
          600: '#0f9a70',
          700: '#0b735a',
          800: '#084d3a',
          900: '#04261d',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};