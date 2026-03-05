import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onGoRegister: () => void;
}

export default function LoginPage({ onGoRegister }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[var(--brand)] rounded-2xl flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold text-[var(--text-primary)]">Interview Analysis</span>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] dark:shadow-none border border-[var(--border-color)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6 text-center">登录</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-xl text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-xl text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)] outline-none transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[var(--brand)] text-white rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
            没有账号？
            <button onClick={onGoRegister} className="text-[var(--brand)] hover:opacity-80 font-medium ml-1 transition-opacity">
              注册
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
