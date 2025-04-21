import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['class'],
  safelist: ['dark'],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            blockquote: {
              quotes: "none"
            },
            a: {
              color: "#55d"
            },
          },
        }
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
