/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors for Notion-like feel
        'notion-bg': '#FFFFFF',
        'notion-sidebar': '#F7F7F5',
        'notion-border': '#E9E9E7',
        'notion-text': '#37352F',
        'notion-gray': '#ACABA9',
      }
    },
  },
  plugins: [],
}
