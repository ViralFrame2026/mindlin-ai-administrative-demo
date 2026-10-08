import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#162337",
        navy: "#0b1d35",
        cobalt: "#246bfd",
        mist: "#f4f7fb",
        line: "#dfe7f1",
      },
      boxShadow: {
        panel: "0 14px 42px rgba(15, 35, 62, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
