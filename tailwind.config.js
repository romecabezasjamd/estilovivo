/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
            },
            colors: {
                primary: 'var(--color-primary)',
                'primary-light': 'var(--color-primary-light)',
                'primary-dark': 'var(--color-primary-dark)',
                accent: 'var(--color-accent)',
                secondary: 'var(--color-secondary)',
                surface: {
                    base: 'var(--bg-base)',
                    card: 'var(--bg-card)',
                    hover: 'var(--bg-card-hover)',
                    elevated: 'var(--bg-elevated)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                },
                border: {
                    light: 'var(--border-light)',
                    subtle: 'var(--border-subtle)',
                },
                lavender: {
                    50: '#F5F3FF',
                    100: '#EDE9FE',
                },
                gold: '#FB8B24',
            },
            keyframes: {
                'wash-spin': {
                    '0%': { transform: 'rotate(0deg) scale(1)' },
                    '50%': { transform: 'rotate(180deg) scale(1.15)' },
                    '100%': { transform: 'rotate(360deg) scale(1)' },
                }
            },
            animation: {
                'wash': 'wash-spin 0.6s ease-in-out 3',
            }
        },
    },
    plugins: [],
}
