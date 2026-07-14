
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Dialect, TRANSLATIONS, DIALECT_OVERRIDES, TranslationSchema } from '../utils/translations';
import { api } from '../../services/api';

interface LanguageContextType {
    language: Language;
    dialect: Dialect;
    setLanguage: (lang: Language) => void;
    setDialect: (dialect: Dialect) => void;
    t: (key: keyof TranslationSchema) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        return (localStorage.getItem('estilovivo_lang') as Language) || 'es';
    });

    const [dialect, setDialectState] = useState<Dialect>(() => {
        return (localStorage.getItem('estilovivo_dialect') as Dialect) || 'none';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('estilovivo_lang', lang);
        if (lang !== 'es') {
            setDialectState('none');
            localStorage.setItem('estilovivo_dialect', 'none');
            api.updateUserPreferences({ language: lang, dialect: 'none' }).catch(() => {});
        } else {
            api.updateUserPreferences({ language: lang }).catch(() => {});
        }
    };

    const setDialect = (d: Dialect) => {
        setDialectState(d);
        localStorage.setItem('estilovivo_dialect', d);
        api.updateUserPreferences({ dialect: d }).catch(() => {});
    };

    // Sync from server when user loads
    useEffect(() => {
        const handler = (e: Event) => {
            const user = (e as CustomEvent).detail;
            if (user?.language) {
                setLanguageState(user.language as Language);
                localStorage.setItem('estilovivo_lang', user.language);
            }
            if (user?.dialect) {
                setDialectState(user.dialect as Dialect);
                localStorage.setItem('estilovivo_dialect', user.dialect);
            }
        };
        window.addEventListener('ev:user-loaded', handler as EventListener);
        return () => window.removeEventListener('ev:user-loaded', handler as EventListener);
    }, []);

    const t = (key: keyof TranslationSchema): string => {
        const base = TRANSLATIONS[language][key];

        // Only apply dialects if language is Spanish (es) or if it's explicitly allowed
        if (language === 'es' && dialect !== 'none') {
            const override = DIALECT_OVERRIDES[dialect][key];
            return override || base;
        }

        return base;
    };

    return (
        <LanguageContext.Provider value={{ language, dialect, setLanguage, setDialect, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
