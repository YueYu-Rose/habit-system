/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    /* 保留既有 index.css 的全量组件样式，避免 Preflight 重置布局与字号 */
    preflight: false,
  },
  theme: {
    extend: {
      maxWidth: {
        "iphone-screen": "393px",
        "iphone-frame": "417px",
      },
      minHeight: {
        "iphone-screen": "852px",
        "iphone-frame": "876px",
      },
      colors: {
        primary: "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        "efficiency-1": "var(--color-efficiency-1)",
        "efficiency-2": "var(--color-efficiency-2)",
        "efficiency-3": "var(--color-efficiency-3)",
        "efficiency-4": "var(--color-efficiency-4)",
        "efficiency-5": "var(--color-efficiency-5)",
        "efficiency-6": "var(--color-efficiency-6)",
        "efficiency-7": "var(--color-efficiency-7)",
        "efficiency-8": "var(--color-efficiency-8)",
        "efficiency-9": "var(--color-efficiency-9)",
        "efficiency-10": "var(--color-efficiency-10)",
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-lg": "var(--shadow-card-lg)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        pill: "var(--radius-pill)",
      },
    },
  },
  plugins: [],
};
