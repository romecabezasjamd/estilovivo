
export type ThemeColor = 'pink' | 'blue' | 'green' | 'lavender' | 'amber';

export interface ThemeColors {
    primary: string;
    light: string;
    dark: string;
    accent: string;
    secondary: string;
}

export const THEMES: Record<ThemeColor, ThemeColors> = {
    pink: {
        primary: '#ec4899',
        light: '#f472b6',
        dark: '#db2777',
        accent: '#14b8a6',
        secondary: '#a78bfa'
    },
    blue: {
        primary: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
        accent: '#06b6d4',
        secondary: '#818cf8'
    },
    green: {
        primary: '#10b981',
        light: '#34d399',
        dark: '#059669',
        accent: '#84cc16',
        secondary: '#6ee7b7'
    },
    lavender: {
        primary: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
        accent: '#ec4899',
        secondary: '#c084fc'
    },
    amber: {
        primary: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
        accent: '#10b981',
        secondary: '#fb923c'
    }
};

export const applyTheme = (themeName: ThemeColor) => {
    const theme = THEMES[themeName] || THEMES.pink;
    const root = document.documentElement;

    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-light', theme.light);
    root.style.setProperty('--color-primary-dark', theme.dark);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-secondary', theme.secondary);

    localStorage.setItem('estilovivo_theme', themeName);
};

export const getSavedTheme = (): ThemeColor => {
    return (localStorage.getItem('estilovivo_theme') as ThemeColor) || 'pink';
};
