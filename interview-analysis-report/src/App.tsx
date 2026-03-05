import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import Report from './components/Report';
import UploadPage from './components/UploadPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import type { AnalysisReport, ReportListItem } from './types';

type View = 'list' | 'report' | 'upload' | 'login' | 'register';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}

function AppInner() {
  const { isAuthenticated, isLoading, logout, authFetch, user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [selectedReportName, setSelectedReportName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = (res: Response) => {
    if (res.status === 401) {
      logout();
      return true;
    }
    return false;
  };

  const fetchReports = () => {
    setLoading(true);
    authFetch('/api/reports')
      .then(res => {
        if (handleAuthError(res)) return;
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setReports(data.reports);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load reports: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchReports();
      // Auto-resume upload page if there's an active pipeline job
      authFetch('/api/pipeline/jobs')
        .then(res => res.json())
        .then((jobs: Array<{ status: string }>) => {
          if (jobs.some(j => !['done', 'error'].includes(j.status))) {
            setView('upload');
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const loadReport = (name: string) => {
    setLoading(true);
    setError(null);
    authFetch(`/api/reports/${encodeURIComponent(name)}`)
      .then(res => {
        if (handleAuthError(res)) return;
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setSelectedReport(data);
        setSelectedReportName(name);
        setView('report');
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load report: ' + err.message);
        setLoading(false);
      });
  };

  const handleUploadComplete = (reportName: string) => {
    fetchReports();
    loadReport(reportName);
  };

  // Auth loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated - show login/register
  if (!isAuthenticated) {
    if (view === 'register') {
      return <RegisterPage onGoLogin={() => setView('login')} />;
    }
    return <LoginPage onGoRegister={() => setView('register')} />;
  }

  const userMenu = (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary">{user?.username}</span>
      <button onClick={logout} className="text-sm text-text-secondary hover:text-text-primary transition-colors">退出</button>
    </div>
  );

  // Upload view
  if (view === 'upload') {
    return (
      <UploadPage
        onComplete={handleUploadComplete}
        onBack={() => { setView('list'); fetchReports(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-text-secondary text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  // If we have a loaded report, show it
  if (view === 'report' && selectedReport) {
    return (
      <Report
        data={selectedReport}
        reportName={selectedReportName ?? undefined}
        onBack={() => { setSelectedReport(null); setSelectedReportName(null); setView('list'); }}
      />
    );
  }

  // Sort reports by date descending
  const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));

  // Report list view
  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary">
      <header className="bg-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">R</div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">面试分析大师</h1>
            <button
              onClick={() => setView('upload')}
              className="ml-4 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/10"
            >
              上传新面试
            </button>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={logout} className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium">退出登录</button>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sortedReports.length === 0 ? (
          <div className="text-center py-24 bg-bg-surface rounded-3xl bento-shadow border border-border-main">
            <p className="text-text-secondary text-lg mb-6">暂无报告，开始您的第一次分析吧</p>
            <button
              onClick={() => setView('upload')}
              className="px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-full hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              上传第一份面试
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {sortedReports.map(report => (
              <button
                key={report.name}
                onClick={() => loadReport(report.name)}
                className="w-full text-left bg-bg-surface rounded-2xl bento-shadow border border-transparent hover:border-emerald-500/30 p-8 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary group-hover:text-emerald-600 transition-colors">{report.position}</h2>
                    <p className="text-sm text-text-secondary mt-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {report.date}
                    </p>
                  </div>
                  <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider">
                    已分析
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
