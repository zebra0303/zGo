/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "board-bg": "var(--wood-bg)",
        "board-line": "var(--board-line)",
      },
    },
  },
  plugins: [],
};
