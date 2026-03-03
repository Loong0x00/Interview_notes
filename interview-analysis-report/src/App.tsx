import { useState, useEffect } from 'react';
import Report from './components/Report';
import UploadPage from './components/UploadPage';
import type { AnalysisReport, ReportListItem } from './types';

type View = 'list' | 'report' | 'upload';

export default function App() {
  const [view, setView] = useState<View>('list');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = () => {
    setLoading(true);
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => {
        setReports(data.reports);
        // Auto-load first report if only one exists and on list view
        if (data.reports.length === 1 && view === 'list') {
          loadReport(data.reports[0].name);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        setError('Failed to load reports: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const loadReport = (name: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => {
        setSelectedReport(data);
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
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-zinc-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  // If we have a loaded report, show it
  if (view === 'report' && selectedReport) {
    return (
      <Report
        data={selectedReport}
        onBack={() => { setSelectedReport(null); setView('list'); }}
      />
    );
  }

  // Report list view
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
            <h1 className="text-lg font-bold text-zinc-900">Interview Analysis Reports</h1>
          </div>
          <button
            onClick={() => setView('upload')}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Upload Audio
          </button>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {reports.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg mb-4">No reports yet</p>
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
                className="w-full text-left bg-white rounded-xl shadow-sm border border-zinc-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <h2 className="text-lg font-semibold text-zinc-900">{report.position}</h2>
                <p className="text-sm text-zinc-500 mt-1">{report.date}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
