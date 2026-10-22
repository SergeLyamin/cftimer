/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./www/**/*.{html,js}",  // поиск во всех HTML и JS файлах
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

