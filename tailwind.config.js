/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        toloba: {
          light: '#e1ecd8',
          DEFAULT: '#105c38', // Deep green matching the new logo
          dark: '#0a4227',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        cursive: ['"Dancing Script"', 'cursive'], // For the signature
      },
      backgroundImage: {
        'fatemi-pattern': "url('/bg-pattern.avif')",
      },
      keyframes: {
        'logo-zoom': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
      animation: {
        'logo-zoom': 'logo-zoom 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
