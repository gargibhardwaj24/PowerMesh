/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'pm-void':     'var(--pm-void)',
        'pm-surface':  'var(--pm-surface)',
        'pm-raised':   'var(--pm-raised)',
        'pm-line':     'var(--pm-line)',
        'pm-text':     'var(--pm-text)',
        'pm-muted':    'var(--pm-muted)',
        'pm-faint':    'var(--pm-faint)',
        'pm-steel':    'var(--pm-steel)',
        'pm-gold':     'var(--pm-gold)',
        'pm-gold-dim': 'var(--pm-gold-dim)',
        'pm-cream':    'var(--pm-cream)',
        'pm-run':      'var(--pm-run)',
        'pm-ok':       'var(--pm-ok)',
        'pm-warn':     'var(--pm-warn)',
        'pm-stop':     'var(--pm-stop)',
      },
      fontFamily: {
        display: ['Quicksand', 'sans-serif'],
        ui:      ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '32': '2rem',
        '24': '1.5rem',
        '18': '1.125rem',
        '15': '0.9375rem',
        '13': '0.8125rem',
        '12': '0.75rem',
        '11': '0.6875rem',
      },
      borderRadius: {
        card:   '10px',
        input:  '6px',
        pill:   '9999px',
      },
    },
  },
  plugins: [],
}
