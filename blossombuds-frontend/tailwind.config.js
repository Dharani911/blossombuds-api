/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          text: "#4A4F41",       // Primary text & headings
          accent: "#F05D8B",     // Buttons / highlights (pink)
          cta: "#F6C320",        // Secondary CTA / icons (yellow)
          bg: "#FAF7E7",         // Site background
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "serif"], // Headings
        sans: ['Montserrat', "system-ui", "sans-serif"], // Body
      },
      keyframes: {
        "bb-marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "bb-marquee": "bb-marquee 22s linear infinite",
      },
      boxShadow: {
        soft: "0 10px 25px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
