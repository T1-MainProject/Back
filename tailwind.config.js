/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "fuschia-100": "var(--fuschia-100)",
        "fuschia-60": "var(--fuschia-60)",
        "fuschia-80": "var(--fuschia-80)",
        "iris-100": "var(--iris-100)",
        "iris-60": "var(--iris-60)",
        "iris-80": "var(--iris-80)",
      },
      fontFamily: {
        body: "var(--body-font-family)",
        "header-1": "var(--header-1-font-family)",
        "header-2": "var(--header-2-font-family)",
      },
    },
  },
  plugins: [],
};

