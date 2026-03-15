/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "board-bg": "var(--wood-bg)",
        "board-line": "var(--board-line)",
        primary: "var(--primary)",
      },
      fontFamily: {
        sans: ["var(--font-family)"],
      },
    },
  },
  plugins: [],
};
