
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    const [language, setLanguageState] = useState<Language>('es');
    const [dialect, setDialectState] = useState<Dialect>('none');

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        try { localStorage.setItem('estilovivo_lang', lang); } catch {}
        if (lang !== 'es') {
            setDialectState('none');
            try { localStorage.setItem('estilovivo_dialect', 'none'); } catch {}
            api.updateUserPreferences({ language: lang, dialect: 'none' }).catch(() => {});
        } else {
            api.updateUserPreferences({ language: lang }).catch(() => {});
        }
    }, []);

    const setDialect = useCallback((d: Dialect) => {
        setDialectState(d);
        try { localStorage.setItem('estilovivo_dialect', d); } catch {}
        api.updateUserPreferences({ dialect: d }).catch(() => {});
    }, []);

    // Sync from server when user loads — API is source of truth
    useEffect(() => {
        const handler = (e: Event) => {
            const user = (e as CustomEvent).detail;
            if (user?.language) {
                setLanguageState(user.language as Language);
                try { localStorage.setItem('estilovivo_lang', user.language); } catch {}
            }
            if (user?.dialect) {
                setDialectState(user.dialect as Dialect);
                try { localStorage.setItem('estilovivo_dialect', user.dialect); } catch {}
            }
        };
        window.addEventListener('ev:user-loaded', handler as EventListener);
        return () => window.removeEventListener('ev:user-loaded', handler as EventListener);
    }, []);

    const t = useCallback((key: keyof TranslationSchema): string => {
        const base = TRANSLATIONS[language][key];

        if (language === 'es' && dialect !== 'none') {
            const override = DIALECT_OVERRIDES[dialect][key];
            return override || base;
        }

        return base;
    }, [language, dialect]);

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
