import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

interface RegisterPageProps {
  onGoLogin: () => void;
}

export default function RegisterPage({ onGoLogin }: RegisterPageProps) {
  const { register } = useAuth();
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, password, inviteCode);
    } catch (err: any) {
      setError(err.message || t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
            R
          </div>
          <span className="text-2xl font-bold text-text-primary tracking-tight">{t('appName')}</span>
        </div>

        <div className="bg-bg-surface rounded-3xl bento-shadow border border-border-main p-10">
          <h2 className="text-2xl font-bold text-text-primary mb-8 text-center">{t('createAccount')}</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2 ml-1">{t('username')}</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border-main rounded-2xl text-base bg-bg-base text-text-primary focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2 ml-1">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border-main rounded-2xl text-base bg-bg-base text-text-primary focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-2 ml-1">{t('inviteCode')}</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.trim())}
                placeholder={t('pasteInviteCode')}
                required
                className="w-full px-4 py-3 border border-border-main rounded-2xl text-base font-mono bg-bg-base text-text-primary focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base font-bold shadow-lg shadow-emerald-500/20 mt-2"
            >
              {loading ? t('registering') : t('register')}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-text-secondary font-medium">
            {t('hasAccount')}
            <button onClick={onGoLogin} className="text-emerald-600 hover:text-emerald-700 font-bold ml-1 transition-colors">
              {t('loginNow')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
