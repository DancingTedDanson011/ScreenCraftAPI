/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Primary Colors (GitHub Dark inspired)
        background: '#0D1117',
        surface: '#161B22',
        'surface-hover': '#21262D',
        border: '#30363D',

        // Text Colors
        'text-primary': '#F0F6FC',
        'text-secondary': '#8B949E',
        'text-muted': '#6E7681',

        // Accent Colors
        'accent-primary': '#238636',
        'accent-secondary': '#1F6FEB',
        'accent-warning': '#D29922',
        'accent-error': '#F85149',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: '0.75rem',     // 12px
        sm: '0.875rem',    // 14px
        base: '1rem',      // 16px
        lg: '1.125rem',    // 18px
        xl: '1.25rem',     // 20px
        '2xl': '1.5rem',   // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem',  // 36px
        '5xl': '3rem',     // 48px
        '6xl': '3.75rem',  // 60px
      },
      spacing: {
        '1': '0.25rem',  // 4px
        '2': '0.5rem',   // 8px
        '3': '0.75rem',  // 12px
        '4': '1rem',     // 16px
        '5': '1.25rem',  // 20px
        '6': '1.5rem',   // 24px
        '8': '2rem',     // 32px
        '10': '2.5rem',  // 40px
        '12': '3rem',    // 48px
        '16': '4rem',    // 64px
        '20': '5rem',    // 80px
        '24': '6rem',    // 96px
      },
      borderRadius: {
        sm: '0.25rem',   // 4px
        DEFAULT: '0.5rem',    // 8px
        md: '0.5rem',    // 8px
        lg: '0.75rem',   // 12px
        xl: '1rem',      // 16px
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.4)',
        md: '0 4px 6px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
        glow: '0 0 20px rgba(35, 134, 54, 0.3)',
      },
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)',
        'gradient-cta': 'linear-gradient(90deg, #238636 0%, #2EA043 100%)',
      },
    },
  },
  plugins: [],
}
