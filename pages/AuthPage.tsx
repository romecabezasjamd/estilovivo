import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Sparkles, AlertCircle, Calendar, Languages, Globe, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../src/context/LanguageContext';
import { languages, dialects } from '../src/utils/translations';
import Logo from '../components/Logo';

interface AuthPageProps {
    onAuthSuccess: (user: any) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [view, setView] = useState<'auth' | 'forgot' | 'reset'>('auth');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
    const [birthDate, setBirthDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(null);
    const { t, language, setLanguage, dialect, setDialect } = useLanguage();
    const [showLangMenu, setShowLangMenu] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            setResetToken(token);
            setView('reset');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();

            if (view === 'forgot') {
                await api.forgotPassword(normalizedEmail);
                setSuccessMessage(t('recoveryEmailSent'));
                return;
            }

            if (view === 'reset' && resetToken) {
                if (password !== confirmPassword) {
                    throw new Error(t('passwordsDoNotMatch'));
                }
                await api.resetPassword({ token: resetToken, newPassword: password });
                setSuccessMessage(t('passwordChangedSuccess'));
                setTimeout(() => {
                    setView('auth');
                    window.history.replaceState({}, '', window.location.pathname);
                }, 2000);
                return;
            }

            if (isLogin) {
                const data = await api.login({ email: normalizedEmail, password });
                onAuthSuccess(data.user);
            } else {
                const data = await api.register({
                    email: normalizedEmail,
                    password,
                    name,
                    gender,
                    birthDate: birthDate || undefined
                });
                onAuthSuccess(data.user);
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/5 rounded-full blur-3xl" />

            {/* Language Selector */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="bg-white/80 backdrop-blur-md border border-gray-100 p-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                >
                    <Languages size={18} className="text-primary" />
                    <span className="text-xs font-bold uppercase text-gray-600">
                        {languages.find(l => l.id === language)?.label}
                        {language === 'es' && dialect !== 'none' && ` (${dialects.find(d => d.id === dialect)?.label})`}
                    </span>
                </button>

                {showLangMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-fade-in-down">
                        <div className="p-2 border-b border-gray-50 mb-1 flex items-center gap-2">
                            <Globe size={14} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('language')}</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {languages.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => {
                                        setLanguage(l.id);
                                        if (l.id !== 'es') setShowLangMenu(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-colors ${language === l.id ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>

                        {language === 'es' && (
                            <div className="mt-2 pt-2 border-t border-gray-50">
                                <span className="p-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('dialect')}</span>
                                {dialects.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => {
                                            setDialect(d.id);
                                            setShowLangMenu(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-colors ${dialect === d.id ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <Logo variant="icon" size={80} />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                        {view === 'forgot' ? t('forgotPassword') : view === 'reset' ? t('resetPassword') : t('welcome')}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {view === 'forgot' ? 'Introduce tu email para recuperar tu acceso' : view === 'reset' ? 'Crea una contraseña nueva y segura' : t('subtitle')}
                    </p>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl shadow-gray-200/50 border border-gray-100">
                    {view === 'auth' && (
                        <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
                            <button
                                onClick={() => setIsLogin(true)}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${isLogin ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
                            >
                                {t('login')}
                            </button>
                            <button
                                onClick={() => setIsLogin(false)}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${!isLogin ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
                            >
                                {t('register')}
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {view === 'auth' ? (
                            <>
                                {!isLogin && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('name')}</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                                <input
                                                    type="text"
                                                    required
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                                    placeholder={t('name')}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('birthDate')}</label>
                                            <div className="relative group">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                                <input
                                                    type="date"
                                                    value={birthDate}
                                                    onChange={(e) => setBirthDate(e.target.value)}
                                                    className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('gender')}</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['female', 'male', 'other'] as const).map(option => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => setGender(option)}
                                                        className={`py-3 rounded-xl text-sm font-bold transition-all ${gender === option ? 'bg-primary text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                                    >
                                                        {t(option as any)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('email')}</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                            placeholder="ejemplo@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('password')}</label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={() => setView('forgot')}
                                                className="text-[10px] font-bold text-primary hover:text-teal-700 transition-colors uppercase tracking-widest"
                                            >
                                                {t('forgotPassword')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors p-1"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : view === 'forgot' ? (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('email')}</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                            placeholder="ejemplo@email.com"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setView('auth')}
                                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                                >
                                    {t('back')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('newPassword')}</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{t('confirmPassword')}</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-gray-800"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center space-x-2 p-4 bg-red-50 text-red-500 rounded-2xl animate-fade-in">
                                <AlertCircle size={18} />
                                <span className="text-xs font-bold">{error}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="flex items-center space-x-2 p-4 bg-green-50 text-green-600 rounded-2xl animate-fade-in">
                                <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">✓</div>
                                <span className="text-xs font-bold">{successMessage}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary hover:bg-teal-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transform active:scale-95 transition-all flex items-center justify-center space-x-2 mt-4"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>
                                        {view === 'forgot' ? t('continueAction') :
                                            view === 'reset' ? t('save') :
                                                isLogin ? t('enterNow') : t('createAccount')}
                                    </span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
