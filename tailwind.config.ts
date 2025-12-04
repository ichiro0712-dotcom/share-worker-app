import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ワーカー向けカラー（デフォルト）
        primary: {
          DEFAULT: "#FF3333",
          dark: "#E62E2E",
          light: "#FFE5E5",
        },
        secondary: {
          DEFAULT: "#3895FF",
          dark: "#2D7AD9",
          light: "#E5F2FF",
        },
        // 管理者向けカラー
        admin: {
          primary: "#2563EB",
          "primary-dark": "#1D4ED8",
          "primary-light": "#DBEAFE",
          sidebar: "#111827",
        },
        // 共通
        background: "#F7F7F7",
        surface: "#FFFFFF",
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'tag': '6px',
        'badge': '20px',
        'admin-card': '8px',
        'admin-button': '6px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)',
        'primary': '0 2px 8px rgba(255, 51, 51, 0.3)',
        'secondary': '0 2px 8px rgba(56, 149, 255, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config;
