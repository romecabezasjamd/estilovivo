/** @type {import('tailwindcss').Config} */
export default {
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
