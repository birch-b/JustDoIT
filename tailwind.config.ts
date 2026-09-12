import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // CSS border 统一加粗，与 SVG stroke 1.8px 风格一致
      borderWidth: {
        sketch: "1.5px",
      },
      colors: {
        sketch: {
          // 奶米主背景 (255,242,225)
          bg: "#FFF2E1",
          // 深棕主描边/文字 (99,68,66)
          line: "#634442",
          // 深棕次要文字（65% 透明）
          lineSub: "rgba(99,68,66,0.65)",
          // 深棕 hover 浮层（12% 透明）
          hover: "rgba(99,68,66,0.12)",
          // 薄荷灰绿点缀色 (169,200,194)
          accent: "#A9C8C2",
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        sc: ['"Noto Sans SC"', 'sans-serif'],
        en: ['Inter', 'sans-serif'],
      },
      // 整体字重再加粗一档：light 500 / normal 600 / medium 700
      fontWeight: {
        light: "500",
        normal: "600",
        medium: "700",
        semibold: "700",
      },
    },
  },
  plugins: [],
} satisfies Config;
