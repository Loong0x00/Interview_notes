import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, X, Plus, Tag, Pencil, Check } from 'lucide-react';
import Report from './components/Report';
import UploadPage from './components/UploadPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLang } from './contexts/LanguageContext';
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

function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Toggle language"
    >
      {lang === 'zh' ? 'EN' : '\u4e2d'}
    </button>
  );
}

function AppInner() {
  const { isAuthenticated, isLoading, logout, authFetch, user } = useAuth();
  const { t } = useLang();
  const [view, setView] = useState<View>('list');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [selectedReportName, setSelectedReportName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [newTagText, setNewTagText] = useState('');
  const [sortMode, setSortMode] = useState<'time-desc' | 'time-asc' | 'name-asc' | 'name-desc'>('time-desc');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
      fetchTags();
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

  const fetchTags = () => {
    authFetch('/api/tags').then(r => r.json()).then(d => setAllTags(d.tags || [])).catch(() => {});
  };

  const addTag = (reportName: string, tag: string) => {
    authFetch(`/api/reports/${encodeURIComponent(reportName)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    }).then(r => r.json()).then(d => {
      setReports(prev => prev.map(r => r.name === reportName ? { ...r, tags: d.tags } : r));
      fetchTags();
    }).catch(() => {});
  };

  const removeTag = (reportName: string, tag: string) => {
    authFetch(`/api/reports/${encodeURIComponent(reportName)}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    }).then(r => r.json()).then(d => {
      setReports(prev => prev.map(r => r.name === reportName ? { ...r, tags: d.tags } : r));
      fetchTags();
    }).catch(() => {});
  };

  const handleUploadComplete = (reportName: string) => {
    fetchReports();
    fetchTags();
    loadReport(reportName);
  };

  const saveDisplayName = (reportName: string, displayName: string) => {
    authFetch(`/api/reports/${encodeURIComponent(reportName)}/display-name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    }).then(r => {
      if (r.ok) {
        setReports(prev => prev.map(r => r.name === reportName ? { ...r, displayName } : r));
      }
    }).catch(() => {});
    setEditingName(null);
  };

  useEffect(() => {
    if (addingTagFor && tagInputRef.current) tagInputRef.current.focus();
  }, [addingTagFor]);

  useEffect(() => {
    if (editingName && editInputRef.current) editInputRef.current.focus();
  }, [editingName]);

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
      <button onClick={logout} className="text-sm text-text-secondary hover:text-text-primary transition-colors">{t('logout')}</button>
    </div>
  );

  // Upload view
  if (view === 'upload') {
    return (
      <UploadPage
        onComplete={handleUploadComplete}
        onBack={() => { setView('list'); fetchReports(); fetchTags(); }}
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
        onReloadReport={() => { if (selectedReportName) loadReport(selectedReportName); }}
      />
    );
  }

  // Sort and filter reports
  const interviewTypes = [...new Set(reports.map(r => r.interviewType).filter(Boolean))] as string[];
  const filteredReports = [...reports]
    .filter(r => !filterType || r.interviewType === filterType)
    .filter(r => !filterTag || r.tags.includes(filterTag))
    .sort((a, b) => {
      switch (sortMode) {
        case 'time-desc':
          return (b.uploadTime || b.date).localeCompare(a.uploadTime || a.date);
        case 'time-asc':
          return (a.uploadTime || a.date).localeCompare(b.uploadTime || b.date);
        case 'name-asc':
          return (a.displayName || a.position).localeCompare(b.displayName || b.position);
        case 'name-desc':
          return (b.displayName || b.position).localeCompare(a.displayName || a.position);
        default:
          return 0;
      }
    });

  // Report list view
  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary">
      <header className="bg-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20 flex-shrink-0">R</div>
            <h1 className="hidden sm:block text-xl font-bold text-text-primary tracking-tight">{t('appName')}</h1>
            <button
              onClick={() => setView('upload')}
              className="ml-4 text-xs px-3 py-1.5 sm:text-sm sm:px-5 sm:py-2 bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/10 flex-shrink-0"
            >
              {t('uploadNew')}
            </button>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <LangToggle />
            <ThemeToggle />
            <button onClick={logout} className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium">{t('logout')}</button>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        {reports.length > 0 && (interviewTypes.length > 0 || allTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {interviewTypes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t('roundLabel')}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setFilterType('')}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${!filterType ? 'bg-emerald-600 text-white shadow-sm' : 'bg-bg-surface text-text-secondary border border-border-main hover:border-emerald-400'}`}
                  >{t('allFilter')}</button>
                  {interviewTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(filterType === t ? '' : t)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${filterType === t ? 'bg-emerald-600 text-white shadow-sm' : 'bg-bg-surface text-text-secondary border border-border-main hover:border-emerald-400'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-2">{t('tagLabel')}</span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilterTag('')}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${!filterTag ? 'bg-emerald-600 text-white shadow-sm' : 'bg-bg-surface text-text-secondary border border-border-main hover:border-emerald-400'}`}
                  >{t('allFilter')}</button>
                  {allTags.map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterTag(filterTag === t ? '' : t)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${filterTag === t ? 'bg-emerald-600 text-white shadow-sm' : 'bg-bg-surface text-text-secondary border border-border-main hover:border-emerald-400'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sort buttons */}
        {reports.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider mr-1">{t('sortLabel')}</span>
            {([
              ['time-desc', t('sortTimeDesc')],
              ['time-asc', t('sortTimeAsc')],
              ['name-asc', t('sortNameAsc')],
              ['name-desc', t('sortNameDesc')],
            ] as [string, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortMode(key as typeof sortMode)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${sortMode === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-bg-surface text-text-secondary border border-border-main hover:border-emerald-400'}`}
              >{label}</button>
            ))}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="text-center py-24 bg-bg-surface rounded-3xl bento-shadow border border-border-main">
            <p className="text-text-secondary text-lg mb-6">{t('noReports')}</p>
            <button
              onClick={() => setView('upload')}
              className="px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-full hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              {t('uploadFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredReports.map(report => (
              <div
                key={report.name}
                className="w-full text-left bg-bg-surface rounded-2xl bento-shadow border border-transparent hover:border-emerald-500/30 p-8 transition-all group"
              >
                <div className="flex flex-wrap justify-between items-start cursor-pointer" onClick={() => loadReport(report.name)}>
                  <div>
                    <div className="flex items-center gap-2">
                      {editingName === report.name ? (
                        <form
                          className="inline-flex items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            saveDisplayName(report.name, editingDisplayName);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={editInputRef}
                            value={editingDisplayName}
                            onChange={(e) => setEditingDisplayName(e.target.value)}
                            onBlur={() => saveDisplayName(report.name, editingDisplayName)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingName(null); }}
                            className="text-xl font-bold bg-bg-base border border-border-main rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 text-text-primary"
                          />
                          <button type="submit" className="p-1 text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                        </form>
                      ) : (
                        <>
                          <h2 className="text-xl font-bold text-text-primary group-hover:text-emerald-600 transition-colors">{report.displayName || report.position}</h2>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingName(report.name); setEditingDisplayName(report.displayName || report.position); }}
                            className="p-1 text-text-secondary hover:text-emerald-600 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {report.uploadTime ? new Date(report.uploadTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-') : report.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-2 sm:mt-0">
                    {report.interviewType && (
                      <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                        {report.interviewType}
                      </span>
                    )}
                    <span className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider">
                      {t('analyzed')}
                    </span>
                  </div>
                </div>
                {/* Tags row */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {report.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-text-secondary text-xs font-medium rounded-full">
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTag(report.name, tag); }}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      ><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {addingTagFor === report.name ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newTagText.trim()) {
                          addTag(report.name, newTagText.trim());
                          setNewTagText('');
                          setAddingTagFor(null);
                        }
                      }}
                    >
                      <input
                        ref={tagInputRef}
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onBlur={() => { setAddingTagFor(null); setNewTagText(''); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setAddingTagFor(null); setNewTagText(''); } }}
                        placeholder={t('tagPlaceholder')}
                        maxLength={20}
                        className="w-20 px-2 py-1 text-xs bg-bg-base border border-border-main rounded-full focus:outline-none focus:border-emerald-500 text-text-primary"
                      />
                    </form>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingTagFor(report.name); setNewTagText(''); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-emerald-600 bg-transparent border border-dashed border-border-main rounded-full hover:border-emerald-400 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      {t('addTag')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <footer className="text-xs text-text-secondary text-center py-6">&copy; 2026 Loong0x00 &amp; AmandaWWW</footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
