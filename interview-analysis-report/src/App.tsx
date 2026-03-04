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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-500 text-sm">Loading...</div>
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
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{user?.username}</span>
      <button onClick={logout} className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">退出</button>
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
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

  // Report list view
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Interview Analysis Reports</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {userMenu}
            <button
              onClick={() => setView('upload')}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Upload Audio
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {reports.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 dark:text-zinc-500 text-lg mb-4">No reports yet</p>
            <button
              onClick={() => setView('upload')}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Upload Your First Interview
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <button
                key={report.name}
                onClick={() => loadReport(report.name)}
                className="w-full text-left bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{report.position}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{report.date}</p>
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
