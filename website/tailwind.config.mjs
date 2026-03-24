/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0A',
        'bg-elevated': '#141414',
        'bg-subtle': '#1A1A1A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1A1',
        'text-muted': '#6B6B6B',
        'accent': '#3B82F6',
        'accent-hover': '#2563EB',
        'border-default': '#262626',
        'border-hover': '#404040',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'content': '1200px',
      },
    },
  },
  plugins: [],
};
