import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
