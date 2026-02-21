
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Dialect, TRANSLATIONS, DIALECT_OVERRIDES, TranslationSchema } from '../utils/translations';

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
        }
    };

    const setDialect = (d: Dialect) => {
        setDialectState(d);
        localStorage.setItem('estilovivo_dialect', d);
    };

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
