import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        background: '#0D1117',
        surface: {
          DEFAULT: '#161B22',
          hover: '#21262D',
        },
        border: '#30363D',
        text: {
          primary: '#F0F6FC',
          secondary: '#8B949E',
          muted: '#6E7681',
        },
        accent: {
          primary: '#238636',
          secondary: '#1F6FEB',
          warning: '#D29922',
          error: '#F85149',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
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
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#8B949E',
            '--tw-prose-body': '#8B949E',
            '--tw-prose-headings': '#F0F6FC',
            '--tw-prose-lead': '#8B949E',
            '--tw-prose-links': '#1F6FEB',
            '--tw-prose-bold': '#F0F6FC',
            '--tw-prose-counters': '#6E7681',
            '--tw-prose-bullets': '#6E7681',
            '--tw-prose-hr': '#30363D',
            '--tw-prose-quotes': '#8B949E',
            '--tw-prose-quote-borders': '#30363D',
            '--tw-prose-captions': '#6E7681',
            '--tw-prose-code': '#1F6FEB',
            '--tw-prose-pre-code': '#F0F6FC',
            '--tw-prose-pre-bg': '#161B22',
            '--tw-prose-th-borders': '#30363D',
            '--tw-prose-td-borders': '#30363D',
            'h1': {
              marginTop: '2.5rem',
              marginBottom: '1.5rem',
              fontSize: '2.25rem',
              fontWeight: '700',
              lineHeight: '1.2',
            },
            'h2': {
              marginTop: '2.5rem',
              marginBottom: '1.25rem',
              fontSize: '1.75rem',
              fontWeight: '600',
              lineHeight: '1.3',
            },
            'h3': {
              marginTop: '2rem',
              marginBottom: '1rem',
              fontSize: '1.375rem',
              fontWeight: '600',
              lineHeight: '1.4',
            },
            'h4': {
              marginTop: '1.75rem',
              marginBottom: '0.875rem',
              fontSize: '1.125rem',
              fontWeight: '600',
            },
            'p': {
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
              lineHeight: '1.75',
            },
            'ul': {
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            },
            'ol': {
              marginTop: '1.25rem',
              marginBottom: '1.25rem',
            },
            'li': {
              marginTop: '0.625rem',
              marginBottom: '0.625rem',
            },
            'pre': {
              marginTop: '1.75rem',
              marginBottom: '1.75rem',
              padding: '1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid #30363D',
            },
            'code': {
              color: '#1F6FEB',
              backgroundColor: 'rgba(31, 111, 235, 0.1)',
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              color: '#F0F6FC',
            },
            'blockquote': {
              marginTop: '1.75rem',
              marginBottom: '1.75rem',
              paddingLeft: '1.25rem',
              borderLeftWidth: '3px',
            },
            'table': {
              marginTop: '1.75rem',
              marginBottom: '1.75rem',
            },
            'th': {
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
            },
            'td': {
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
            },
            'a': {
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            'hr': {
              marginTop: '2.5rem',
              marginBottom: '2.5rem',
            },
            'img': {
              marginTop: '2rem',
              marginBottom: '2rem',
              borderRadius: '0.5rem',
            },
            '> :first-child': {
              marginTop: '0',
            },
            '> :last-child': {
              marginBottom: '0',
            },
          },
        },
        lg: {
          css: {
            'h1': {
              marginTop: '3rem',
              marginBottom: '1.75rem',
              fontSize: '2.5rem',
            },
            'h2': {
              marginTop: '3rem',
              marginBottom: '1.5rem',
              fontSize: '2rem',
            },
            'h3': {
              marginTop: '2.25rem',
              marginBottom: '1.125rem',
              fontSize: '1.5rem',
            },
            'p': {
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
            },
            'pre': {
              marginTop: '2rem',
              marginBottom: '2rem',
              padding: '1.5rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    typography({
      className: 'prose',
    }),
  ],
};
