/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./www/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        timer: ['Ubuntu Mono', 'monospace'],
      },
      width: {
        'menu': '300px',
      }
    }
  },
  plugins: [],
}

