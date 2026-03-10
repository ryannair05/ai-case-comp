import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        vellum: {
          DEFAULT: "#F7F5EF",
          border: "#E4E0D6",
        },
        ink: {
          DEFAULT: "#0A0A0F",
          1: "#111118",
          2: "#1A1A24",
          3: "#242432",
        },
        bone: {
          DEFAULT: "#F0EDE6",
          dim: "#9B9790",
          faint: "#3A3A48",
        },
        amber: {
          DEFAULT: "#E8C547",
          dim: "rgba(232,197,71,0.15)",
          glow: "rgba(232,197,71,0.08)",
        },
        jade: {
          DEFAULT: "#4EC994",
          dim: "rgba(78,201,148,0.15)",
        },
      },
      backgroundImage: {
        "gradient-premium": "linear-gradient(to bottom, #0A0A0F, #111118)",
      },
    },
  },
  plugins: [],
};

export default config;
