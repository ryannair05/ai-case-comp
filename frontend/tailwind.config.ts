import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          400: "#00BFA5",
          500: "#00897B",
          600: "#00796B",
          700: "#00695C",
          900: "#004D40",
          950: "#002921",
        },
        brand: {
          navy: "#0B1929",
          teal: "#00BFA5",
          amber: "#FFB300",
        },
      },
    },
  },
  plugins: [],
};

export default config;
