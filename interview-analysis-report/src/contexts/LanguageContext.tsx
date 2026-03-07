import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type Lang, t as translate, type TranslationKey } from '../i18n';

interface LanguageContextType {
  lang: Lang;
  toggle: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getInitialLang(): Lang {
  const stored = localStorage.getItem('lang');
  if (stored === 'zh' || stored === 'en') return stored;
  // Default to browser language
  if (navigator.language.startsWith('en')) return 'en';
  return 'zh';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const toggle = () => setLang(prev => (prev === 'zh' ? 'en' : 'zh'));

  const t = useCallback((key: TranslationKey) => translate(key, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
