import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Inter only - use for everything including code
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // Simple Design System typography tokens (from Figma)
        'title-hero': ['72px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-3px' }],
        'title-page': ['48px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-2px' }],
        'title-doc': ['40px', { lineHeight: '48px', fontWeight: '600', letterSpacing: '-0.8px' }],
        'subtitle': ['32px', { lineHeight: '1.2', fontWeight: '400' }],
        'heading-h1': ['32px', { lineHeight: '40px', fontWeight: '600', letterSpacing: '-0.64px' }],
        'heading': ['24px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-2px' }],
        'heading-h2': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'subheading': ['20px', { lineHeight: '1.2', fontWeight: '400' }],
        'heading-h3': ['20px', { lineHeight: '24px', fontWeight: '600' }],
        'body-base': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-small': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        'body-xs': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'input': ['16px', { lineHeight: '1', fontWeight: '400' }],
        'code': ['16px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      colors: {
        // Brand colors
        brand: { 
          blue: '#4077ed',
          'blue-light': '#e8effe',
          green: '#14ae5c',
          'green-light': '#e6f7ed',
        },
        // Text colors - semantic naming
        text: { 
          primary: '#1e1e1e', 
          secondary: '#5a5a5a', 
          muted: '#757575',
          tertiary: '#b3b3b3',
          inverted: '#ffffff',
        },
        // Surface/background colors
        surface: { 
          DEFAULT: '#ffffff', 
          secondary: '#f5f5f5', 
          tertiary: '#E8E8E8',
          hover: '#e6e6e6',
        },
        // Border colors
        border: { 
          DEFAULT: '#d9d9d9', 
          light: '#f0f0f0',
          subtle: '#e5e5e5',
        },
        // Icon colors
        icon: { 
          DEFAULT: '#1e1e1e', 
          muted: '#757575',
        },
        // Status colors (for admin dashboard metrics)
        status: {
          error: '#ef4444',
          'error-light': '#fef2f2',
          success: '#22c55e',
          'success-light': '#f0fdf4',
          warning: '#f59e0b',
          'warning-light': '#fffbeb',
          info: '#3b82f6',
          'info-light': '#eff6ff',
        },
        // Chart accent colors
        chart: {
          blue: '#4077ed',
          green: '#22c55e',
          yellow: '#f59e0b',
          red: '#ef4444',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        },
      },
      // Simple Design System spacing tokens
      spacing: {
        'sds-100': '4px',
        'sds-200': '8px',
        'sds-300': '12px',
        'sds-400': '16px',
        'sds-600': '24px',
        'sds-800': '32px',
        'sds-1600': '64px',
        // Admin dashboard specific
        'sidebar': '240px',
        'sidebar-collapsed': '64px',
        'topbar': '64px',
      },
      maxWidth: {
        'content': '1400px',
      },
      width: {
        'sidebar': '240px',
        'sidebar-collapsed': '64px',
      },
      height: {
        'topbar': '64px',
      },
      borderRadius: {
        // Simple Design System radius tokens (from Figma)
        'sds-100': '4px',
        'sds-200': '8px',
        'sds-400': '16px',
        'sds-xl': '24px',
        // Legacy
        'sds': '8px',
        'card': '16px',
      },
      boxShadow: {
        // Simple Design System shadow tokens (from Figma)
        'sds-100': '0px 1px 2px rgba(12,12,13,0.05)',
        'sds-200': '0px 1px 4px rgba(12,12,13,0.05), 0px 1px 4px rgba(12,12,13,0.1)',
        'sds-300': '0px 4px 4px rgba(12,12,13,0.05), 0px 4px 4px rgba(12,12,13,0.1)',
        'sds-400': '0px 4px 24px rgba(0,0,0,0.16)',
        // Card shadows
        'card': '0px 1px 3px rgba(0,0,0,0.05)',
        'card-hover': '0px 2px 8px rgba(0,0,0,0.08)',
      },
      zIndex: {
        'dropdown': '50',
        'modal': '100',
        'tooltip': '200',
      },
    },
  },
};

export default config;
