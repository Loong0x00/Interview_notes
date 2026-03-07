import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Clock,
  MessageSquare,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  Brain,
  MessageCircle,
  ArrowLeft,
  Briefcase,
  Upload,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Menu,
  X,
} from 'lucide-react';
import type { AnalysisReport, DialogueStep, TranscriptSegment } from '../types';
import TranscriptChat from './TranscriptChat';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

// --- Types ---

interface TableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  className?: string;
}

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  id: string;
}

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5 }}
    className={`bg-bg-surface rounded-3xl bento-shadow border border-border-main overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "amber" | "red" | "zinc" }) => {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800/50",
    green: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800/50",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800/50",
    zinc: "bg-bg-base text-text-secondary border-border-main",
  };
  return (
    <span className={`px-4 py-1 rounded-full text-xs font-bold border whitespace-nowrap uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
};

const Table = ({ headers, rows, className = "" }: TableProps) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm text-left">
      <thead className="text-[10px] text-text-secondary uppercase tracking-widest bg-bg-base border-b border-border-main">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="px-8 py-4 font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-main">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-900/5 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className={`px-8 py-5 text-text-primary ${j === row.length - 1 ? 'whitespace-pre-wrap' : 'whitespace-nowrap font-medium'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Section = ({ title, icon, children, id }: SectionProps) => (
  <section id={id} className="scroll-mt-24 mb-16">
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-4 mb-8"
    >
      <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
        {icon}
      </div>
      <h2 className="text-3xl font-bold text-text-primary tracking-tight">{title}</h2>
    </motion.div>
    {children}
  </section>
);

const DialogueChainView: React.FC<{ title: string; steps: DialogueStep[] }> = ({ title, steps: rawSteps }) => {
  // Filter out trigger steps — they'll be rendered inline below their preceding answer
  const steps = rawSteps.filter(s => s.type !== 'trigger');
  // Build a map: for each answer step index in rawSteps, find its following trigger
  const triggerAfter = new Map<number, DialogueStep>();
  for (let i = 0; i < rawSteps.length - 1; i++) {
    if (rawSteps[i].type === 'answer' && rawSteps[i + 1].type === 'trigger') {
      triggerAfter.set(i, rawSteps[i + 1]);
    }
  }
  // Map filtered step indices back to rawSteps indices for trigger lookup
  const rawIndices: number[] = [];
  rawSteps.forEach((s, i) => { if (s.type !== 'trigger') rawIndices.push(i); });

  return (
  <Card className="mb-8">
    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 flex justify-between items-center">
      <h3 className="font-bold text-text-primary">{title}</h3>
    </div>
    <div className="p-8">
      <div className="relative pl-10 space-y-10 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border-main">
        {steps.map((step, idx) => {
          const trigger = triggerAfter.get(rawIndices[idx]);
          return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="relative"
          >
            <div className={`absolute -left-[37px] w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 bg-bg-surface
              ${step.type === 'question' ? 'border-blue-500' :
                step.type === 'clarification' ? 'border-amber-500' :
                'border-emerald-500'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                 step.type === 'question' ? 'bg-blue-500' :
                 step.type === 'clarification' ? 'bg-amber-500' :
                 'bg-emerald-500'
              }`} />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-[11px] font-bold uppercase tracking-widest
                  ${step.type === 'question' ? 'text-blue-600' :
                    step.type === 'clarification' ? 'text-amber-600' :
                    'text-emerald-600'}`}>
                  {step.label || (step.type === 'question' ? '面试官提问' : step.type === 'clarification' ? '面试官澄清' : '候选人回答')}
                </span>
                {step.time && <span className="text-[11px] text-text-secondary font-mono bg-bg-base px-2 py-0.5 rounded-full">{formatTimeString(step.time)}</span>}
              </div>

              {step.type === 'answer' ? (
                <>
                  <div className="text-base leading-relaxed text-text-primary">
                    {step.content}
                  </div>
                  {trigger && (
                    <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 flex items-start gap-3 text-sm">
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">触发追问</span>
                      <span className="text-amber-800 dark:text-amber-200 leading-relaxed font-medium">"{trigger.content}"</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-base leading-relaxed text-text-primary font-medium">
                  {step.content}
                </div>
              )}
            </div>
          </motion.div>
          );
        })}
      </div>
    </div>
  </Card>
  );
};

// --- Helpers ---

function formatTimeString(timeStr: string): string {
  const convertSeconds = (s: number): string => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  const parts = timeStr.split('~').map(p => p.trim());
  const converted = parts.map(p => {
    const match = p.match(/([\d.]+)\s*s/);
    if (!match) return p;
    return convertSeconds(parseFloat(match[1]));
  });
  return converted.join(' ~ ');
}

function getQuestionBadgeColor(type: string): "blue" | "green" | "amber" | "red" | "zinc" {
  switch (type) {
    case '追问': return 'blue';
    case '澄清': return 'amber';
    case '预设': return 'zinc';
    default: return 'zinc';
  }
}

function getFocusLevelBadgeColor(level: string): "blue" | "green" | "amber" | "red" | "zinc" {
  if (level.includes('极高')) return 'red';
  if (level.includes('高')) return 'amber';
  if (level.includes('中')) return 'blue';
  return 'zinc';
}

// --- Reanalyze Panel ---

const ReanalyzePanel: React.FC<{
  reportName?: string;
  hasExistingJD: boolean;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onReloadReport?: () => void;
  t: (key: any) => string;
}> = ({ reportName, hasExistingJD, authFetch, onReloadReport, t }) => {
  const [expanded, setExpanded] = useState(false);
  const [jdText, setJdText] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleSubmit = async () => {
    if (!reportName) return;
    if (!jdText.trim() && !cvFile) {
      setError(t('needMaterial'));
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('提交中...');

    try {
      const formData = new FormData();
      if (jdText.trim()) formData.append('jdText', jdText.trim());
      if (cvFile) formData.append('cv', cvFile);

      const res = await authFetch(`/api/reports/${encodeURIComponent(reportName)}/reanalyze`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(data.error || '重新分析失败');
      }

      const { jobId: newJobId } = await res.json();

      // Get SSE nonce
      const nonceRes = await authFetch('/api/pipeline/nonce', { method: 'POST' });
      const { nonce } = await nonceRes.json();

      // Listen for progress via SSE
      const es = new EventSource(`/api/pipeline/events/${newJobId}?nonce=${encodeURIComponent(nonce)}`);
      es.onmessage = (event) => {
        const job = JSON.parse(event.data);
        setProgress(job.progress || '分析中...');
        if (job.status === 'done') {
          es.close();
          setLoading(false);
          setProgress(t('reanalyzeDone'));
          setTimeout(() => {
            if (onReloadReport) {
              onReloadReport();
            } else {
              window.location.reload();
            }
          }, 1000);
        } else if (job.status === 'error') {
          es.close();
          setLoading(false);
          setError(job.error || '分析失败');
        }
      };
      es.onerror = () => {
        es.close();
        setLoading(false);
        setError('连接中断，请刷新页面查看结果');
      };
    } catch (err: any) {
      setLoading(false);
      setError(err.message || '提交失败');
    }
  };

  if (!reportName) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        disabled={loading}
        className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-text-secondary bg-bg-base border border-border-main rounded-2xl hover:text-emerald-600 hover:border-emerald-400 transition-all"
      >
        <Upload size={16} />
        {hasExistingJD ? t('updateAndReanalyze') : t('addMaterialsHint')}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 bg-bg-surface rounded-2xl bento-shadow border border-border-main p-6 space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary flex items-center gap-2">
              <FileText size={14} /> {t('jdLabel')}
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder={t('jdTextPlaceholder')}
              disabled={loading}
              className="w-full h-32 px-4 py-3 text-sm bg-bg-base border border-border-main rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all disabled:opacity-50"
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-secondary flex items-center gap-2">
              <Upload size={14} /> {t('cvLabel')}
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              disabled={loading}
              className="w-full text-sm text-text-secondary file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-emerald-50 dark:file:bg-emerald-900/20 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900/30 file:cursor-pointer disabled:opacity-50 file:transition-colors"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {loading && progress && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> {progress}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (!jdText.trim() && !cvFile)}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-600 rounded-full hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> {t('analyzing')}</>
            ) : (
              <><RefreshCw size={16} /> {t('reanalyze')}</>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
};

// --- Position Section (always rendered) ---

const PositionSection: React.FC<{
  data: AnalysisReport;
  positionNum: string;
  reportName?: string;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onReloadReport?: () => void;
  t: (key: any) => string;
}> = ({ data, positionNum, reportName, authFetch, onReloadReport, t }) => {
  const [contextInfo, setContextInfo] = useState<{ jd_text: string | null; cv_text: string | null } | null>(null);

  useEffect(() => {
    if (!reportName) return;
    authFetch(`/api/reports/${encodeURIComponent(reportName)}/context`)
      .then(res => res.ok ? res.json() : { jd_text: null, cv_text: null })
      .then(ctx => setContextInfo(ctx))
      .catch(() => setContextInfo({ jd_text: null, cv_text: null }));
  }, [reportName, authFetch]);

  const hasJD = !!contextInfo?.jd_text;
  const isInferred = !hasJD;

  return (
    <Section id="position" title={`${positionNum}. ${t('positionSummary')}`} icon={<Briefcase size={24} />}>
      {/* Hint banner */}
      {isInferred && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 text-sm text-blue-800 dark:text-blue-200 font-medium">
          <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
          <span>{t('inferredHint')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card -- position profile */}
        {data.positionSummary && (
          <div className={`bg-bg-surface rounded-2xl bento-shadow border border-border-main p-6 space-y-6 ${!data.fitAnalysis ? 'md:col-span-2' : ''}`}>
            <h3 className="text-lg font-bold text-text-primary">
              {isInferred ? t('positionInferred') : t('positionProfile')}
            </h3>

            {/* responsibilities */}
            <div className="space-y-3">
              <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                {isInferred ? t('inferredResponsibilities') : t('jdResponsibilities')}
              </span>
              {data.positionSummary.responsibilities.map((r, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-base text-text-primary font-medium">{r}</span>
                </div>
              ))}
            </div>

            {/* interview actual work */}
            {data.positionSummary.interviewActualWork && data.positionSummary.interviewActualWork.length > 0 && (
              <div className="space-y-3">
                <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">{t('actualWork')}</span>
                {data.positionSummary.interviewActualWork.map((w, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    <span className="text-base text-text-primary font-medium">{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* conflicts */}
            {data.positionSummary.conflictsHighlighted && data.positionSummary.conflictsHighlighted.length > 0 &&
              data.positionSummary.conflictsHighlighted.some(c => c !== '无明显冲突' && c !== '无JD对比') && (
              <div className="space-y-3">
                {data.positionSummary.conflictsHighlighted
                  .filter(c => c !== '无明显冲突' && c !== '无JD对比')
                  .map((conflict, i) => (
                    <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <span className="text-base text-red-800 dark:text-red-200 font-medium">{conflict}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* hidden requirements */}
            {data.positionSummary.hiddenRequirements && data.positionSummary.hiddenRequirements.length > 0 && (
              <div className="space-y-3">
                <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">{t('hiddenRequirements')}</span>
                {data.positionSummary.hiddenRequirements.map((req, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                    <span className="text-base text-text-primary font-medium">{req}</span>
                  </div>
                ))}
              </div>
            )}

            {/* KPIs */}
            {data.positionSummary.keyKPIs.length > 0 && (
              <div className="space-y-3">
                <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">{t('keyKPIs')}</span>
                {data.positionSummary.keyKPIs.map((kpi, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                    <span className="text-base text-text-primary font-medium">{kpi}</span>
                  </div>
                ))}
              </div>
            )}

            {/* work intensity, team, requirements */}
            <div className="pt-4 border-t border-border-main space-y-4">
              <div className="text-base">
                <span className="font-bold text-text-secondary">{t('workIntensity')}</span>
                <span className="text-text-primary font-medium">{data.positionSummary.workIntensity}</span>
              </div>
              <div className="text-base">
                <span className="font-bold text-text-secondary">{t('teamCulture')}</span>
                <span className="text-text-primary font-medium">{data.positionSummary.teamCulture}</span>
              </div>
              {data.positionSummary.requirements.length > 0 && (
                <div className="space-y-3">
                  <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">{t('hardRequirements')}</span>
                  {data.positionSummary.requirements.map((r, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                      <span className="text-base text-text-primary font-medium">{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.positionSummary.highlights && (
              <div className="text-base bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{t('highlights')}</span>
                <span className="text-emerald-900 dark:text-emerald-100 font-medium">{data.positionSummary.highlights}</span>
              </div>
            )}
          </div>
        )}

        {/* Right Card -- fit analysis */}
        {data.fitAnalysis && (
          <div className={`bg-bg-surface rounded-2xl bento-shadow border border-border-main p-6 space-y-6 ${!data.positionSummary ? 'md:col-span-2' : ''}`}>
            <h3 className="text-lg font-bold text-text-primary">
              {isInferred ? t('fitInferred') : t('fitScore')}
            </h3>

            <div className="text-center py-4">
              <div className={`text-6xl font-black mb-2 ${
                data.fitAnalysis.overallScore >= 80 ? 'text-emerald-600' :
                data.fitAnalysis.overallScore >= 60 ? 'text-amber-500' :
                'text-red-600'
              }`}>
                {data.fitAnalysis.overallScore}
              </div>
              <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">{t('overallFitScore')}</div>
              <p className="text-base text-text-primary leading-relaxed font-bold">
                {data.fitAnalysis.recommendation}
              </p>
            </div>

            {(data.fitAnalysis.hardSkillMatch || data.fitAnalysis.softSkillMatch || data.fitAnalysis.experienceRelevance) && (
              <div className="space-y-4 pt-4 border-t border-border-main">
                {data.fitAnalysis.hardSkillMatch && (
                  <div className="text-base">
                    <span className="font-bold text-text-secondary">{t('hardSkillMatch')}</span>
                    <span className="text-text-primary font-medium">{data.fitAnalysis.hardSkillMatch}</span>
                  </div>
                )}
                {data.fitAnalysis.softSkillMatch && (
                  <div className="text-base">
                    <span className="font-bold text-text-secondary">{t('softSkillMatch')}</span>
                    <span className="text-text-primary font-medium">{data.fitAnalysis.softSkillMatch}</span>
                  </div>
                )}
                {data.fitAnalysis.experienceRelevance && (
                  <div className="text-base">
                    <span className="font-bold text-text-secondary">{t('experienceRelevance')}</span>
                    <span className="text-text-primary font-medium">{data.fitAnalysis.experienceRelevance}</span>
                  </div>
                )}
              </div>
            )}

            {/* Desktop: table view */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border-main">
              <Table
                headers={[t('dimensionCol'), isInferred ? t('inferredRequirement') : t('jdRequirement'), t('candidateEvidence'), t('scoreCol'), t('commentCol')]}
                rows={data.fitAnalysis.dimensions.map(d => [
                  d.dimension,
                  d.jdRequirement,
                  d.candidateEvidence,
                  <Badge color={d.score >= 80 ? 'green' : d.score >= 60 ? 'amber' : 'red'}>{d.score}</Badge>,
                  d.comment,
                ])}
              />
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden space-y-3">
              {data.fitAnalysis.dimensions.map((d, i) => (
                <div key={i} className="rounded-xl border border-border-main bg-bg-surface p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">{d.dimension}</span>
                    <Badge color={d.score >= 80 ? 'green' : d.score >= 60 ? 'amber' : 'red'}>{d.score}</Badge>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{isInferred ? t('inferredRequirement') : t('jdRequirement')}</span>
                    <p className="text-sm text-text-primary mt-0.5">{d.jdRequirement}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('candidateEvidence')}</span>
                    <p className="text-sm text-text-primary mt-0.5">{d.candidateEvidence}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('commentCol')}</span>
                    <p className="text-sm text-text-primary mt-0.5">{d.comment}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">{t('strengthMatch')}</span>
                {data.fitAnalysis.strengths.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-sm text-text-primary font-bold">{s}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <span className="text-sm font-bold text-amber-600 uppercase tracking-wider">{t('gapsToImprove')}</span>
                {data.fitAnalysis.gaps.map((g, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                    <span className="text-sm text-text-primary font-bold">{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reanalyze Panel */}
      <ReanalyzePanel
        reportName={reportName}
        hasExistingJD={hasJD}
        authFetch={authFetch}
        onReloadReport={onReloadReport}
        t={t}
      />
    </Section>
  );
};

// --- Main Report Component ---

interface ReportProps {
  data: AnalysisReport;
  reportName?: string;
  onBack?: () => void;
  onReloadReport?: () => void;
}

export default function Report({ data, reportName, onBack, onReloadReport }: ReportProps) {
  const { meta, basicInfo, questions, questionStats, dialogueChains, focusMap, candidateSummary } = data;
  const { authFetch } = useAuth();
  const { t, lang } = useLang();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [questionFilter, setQuestionFilter] = useState<'全部' | '预设' | '追问' | '澄清'>('全部');
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const interviewerSpeaker = useMemo(() => {
    const role = basicInfo.roles.find(r => r.role === '面试官');
    if (!role) return '2';
    return role.speaker.replace(/\D/g, '');
  }, [basicInfo.roles]);

  useEffect(() => {
    if (!reportName) return;
    setTranscriptLoading(true);
    authFetch(`/api/reports/${encodeURIComponent(reportName)}/transcript`)
      .then(res => res.ok ? res.json() : [])
      .then((segments: TranscriptSegment[]) => setTranscript(segments))
      .catch(() => setTranscript([]))
      .finally(() => setTranscriptLoading(false));
  }, [reportName, authFetch]);

  const handleQuestionClick = (timestamp?: string) => {
    if (!timestamp || transcript.length === 0) return;
    const ms = parseFloat(timestamp.replace('s', '')) * 1000;
    let bestIdx = 0;
    let bestDiff = Infinity;
    transcript.forEach((seg, i) => {
      const diff = Math.abs(seg.start_ms - ms);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    setActiveSegmentIndex(bestIdx);
    const el = document.getElementById(`transcript-seg-${bestIdx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setActiveSegmentIndex(null), 3000);
  };

  // Sort questions by id (Q1, Q2, Q3...) to ensure chronological order
  const sortedQuestions = [...questions].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  const filteredQuestions = questionFilter === '全部'
    ? sortedQuestions
    : sortedQuestions.filter(q => q.type === questionFilter);

  // Find the top two insights for the highlight cards
  const topInsight = focusMap.insights.find(i => i.level.includes('极高'));
  const secondInsight = focusMap.insights.find(i => i.level.includes('高') && !i.level.includes('极高'));

  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-200">

      {/* Header */}
      <header className="bg-bg-base/80 sticky top-0 z-50 backdrop-blur-xl border-b border-border-main/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-text-secondary bg-bg-surface bento-shadow border border-border-main rounded-full hover:text-emerald-600 transition-all">
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">{t('back')}</span>
              </button>
            )}
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
              R
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">{t('interviewAnalysis')}</h1>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold text-text-secondary">
            <span className="flex items-center gap-2 bg-bg-surface px-4 py-2 rounded-full bento-shadow border border-border-main"><User size={16} className="text-emerald-600" /> {meta.position}</span>
            <span className="hidden sm:flex items-center gap-2 bg-bg-surface px-4 py-2 rounded-full bento-shadow border border-border-main"><Clock size={16} className="text-emerald-600" /> {meta.date}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:col-span-3">
            <nav className="sticky top-32 space-y-2">
              {(() => {
                const sectionNumbers = lang === 'zh'
                  ? ['一', '二', '三', '四', '五', '六', '七', '八']
                  : ['1', '2', '3', '4', '5', '6', '7', '8'];
                const navItems = [
                  { id: 'position', label: t('positionSummary'), icon: Briefcase },
                  { id: 'summary', label: t('candidateSummary'), icon: CheckCircle2 },
                  { id: 'questions', label: t('questionList'), icon: MessageSquare },
                  { id: 'chains', label: t('dialogueChains'), icon: TrendingUp },
                  { id: 'focus', label: t('focusMap'), icon: Target },
                ];
                return navItems.map((item, idx) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-text-secondary rounded-2xl hover:bg-bg-surface hover:text-emerald-600 hover:bento-shadow border border-transparent hover:border-border-main transition-all group"
                  >
                    <item.icon size={18} className="group-hover:text-emerald-600 transition-colors" />
                    {sectionNumbers[idx]}. {item.label}
                  </a>
                ));
              })()}
            </nav>
          </aside>

          {/* Mobile Nav Floating Button + Drawer */}
          <div className="lg:hidden">
            {/* Floating menu button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-colors"
              aria-label={t('navigation')}
            >
              <Menu size={24} />
            </button>

            {/* Overlay backdrop */}
            {mobileNavOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={() => setMobileNavOpen(false)}
              />
            )}

            {/* Slide-in drawer */}
            <div
              className={`fixed top-0 left-0 z-50 h-full w-72 bg-bg-main border-r border-border-main shadow-2xl transform transition-transform duration-300 ease-in-out ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-border-main">
                <span className="text-lg font-bold text-text-primary">{t('navigation')}</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-2 rounded-xl hover:bg-bg-surface transition-colors"
                  aria-label={t('navigation')}
                >
                  <X size={20} className="text-text-secondary" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {(() => {
                  const sectionNumbers = lang === 'zh'
                    ? ['一', '二', '三', '四', '五', '六', '七', '八']
                    : ['1', '2', '3', '4', '5', '6', '7', '8'];
                  const navItems = [
                    { id: 'position', label: t('positionSummary'), icon: Briefcase },
                    { id: 'summary', label: t('candidateSummary'), icon: CheckCircle2 },
                    { id: 'questions', label: t('questionList'), icon: MessageSquare },
                    { id: 'chains', label: t('dialogueChains'), icon: TrendingUp },
                    { id: 'focus', label: t('focusMap'), icon: Target },
                  ];
                  return navItems.map((item, idx) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-text-secondary rounded-2xl hover:bg-bg-surface hover:text-emerald-600 hover:bento-shadow border border-transparent hover:border-border-main transition-all group"
                    >
                      <item.icon size={18} className="group-hover:text-emerald-600 transition-colors" />
                      {sectionNumbers[idx]}. {item.label}
                    </a>
                  ));
                })()}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-16">

            {/* Dynamic section numbering */}
            {(() => {
              const sectionNumbers = lang === 'zh'
                ? ['一', '二', '三', '四', '五', '六', '七', '八']
                : ['1', '2', '3', '4', '5', '6', '7', '8'];
              let sectionIdx = 0;
              const nextNum = () => sectionNumbers[sectionIdx++];
              const positionNum = nextNum();
              const summaryNum = nextNum();
              const questionsNum = nextNum();
              const chainsNum = nextNum();
              const focusNum = nextNum();

              return (<>

            {/* Position Summary + Fit Analysis (always shown) */}
            <PositionSection
              data={data}
              positionNum={positionNum}
              reportName={reportName}
              authFetch={authFetch}
              onReloadReport={onReloadReport}
              t={t}
            />

            {/* Candidate Summary */}
            <Section id="summary" title={`${summaryNum}. ${t('candidateSummary')}`} icon={<CheckCircle2 size={24} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                  <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary flex items-center gap-3">
                    <Brain size={20} className="text-emerald-600" /> {t('abilities')}
                  </div>
                  <div className="p-8 space-y-6">
                    {candidateSummary.abilities.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <div>
                          <span className="font-bold text-text-primary text-base">{item.label}：</span>
                          <span className="text-text-secondary text-base font-medium leading-relaxed">{item.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary flex items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" /> {t('risks')}
                  </div>
                  <div className="p-8 space-y-6">
                    {candidateSummary.risks.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                        <div>
                          <span className="font-bold text-text-primary text-base">{item.label}：</span>
                          <span className="text-text-secondary text-base font-medium leading-relaxed">{item.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </Section>

            {/* Questions List */}
            <Section id="questions" title={`${questionsNum}. ${t('questionList')}`} icon={<MessageSquare size={24} />}>
              <div className="flex flex-wrap gap-3 mb-8">
                {([
                  { value: '全部' as const, label: t('allFilter') },
                  { value: '预设' as const, label: t('preset') },
                  { value: '追问' as const, label: t('followUp') },
                  { value: '澄清' as const, label: t('clarification') },
                ]).map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setQuestionFilter(tab.value)}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
                      questionFilter === tab.value
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/25'
                        : 'bg-bg-surface text-text-secondary border-border-main hover:border-emerald-400 hover:text-emerald-600 bento-shadow'
                    }`}
                  >
                    {tab.label}
                    {tab.value !== '全部' && (
                      <span className="ml-2 opacity-60">
                        {tab.value === '预设' ? questionStats.preset : tab.value === '追问' ? questionStats.followUp : questionStats.clarification}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left: Question table */}
                <Card className="xl:col-span-7 xl:max-h-[800px] flex flex-col">
                  <div className="overflow-y-auto flex-1 divide-y divide-border-main">
                    {filteredQuestions.map((q, i) => (
                      <div
                        key={i}
                        onClick={() => q.timestamp && handleQuestionClick(q.timestamp)}
                        className={`flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-4 px-4 md:px-6 py-4 transition-all duration-200 ${q.timestamp ? 'cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10' : 'hover:bg-bg-base/40'}`}
                      >
                        <span className="shrink-0 w-12 text-center px-2 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">{q.id}</span>
                        <Badge color={getQuestionBadgeColor(q.type)}>{q.type}</Badge>
                        <span className="flex-1 text-sm text-text-primary font-medium leading-relaxed">
                          {q.text}
                          {q.timestamp && <span className="ml-2 text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">{formatTimeString(q.timestamp)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-bg-base p-6 border-t border-border-main flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
                    <span className="text-text-primary">{t('stats')}</span>
                    <span>{t('preset')}: {questionStats.preset}</span>
                    <span>{t('followUp')}: {questionStats.followUp}</span>
                    <span>{t('clarification')}: {questionStats.clarification}</span>
                  </div>
                </Card>

                {/* Right: Transcript chat */}
                <Card className="xl:col-span-5 xl:max-h-[800px] flex flex-col xl:sticky xl:top-28">
                  <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle size={20} className="text-emerald-600" />
                      <h3 className="font-bold text-text-primary">{t('transcriptFull')}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{transcript.length} {t('roundsOfDialogue')}</span>
                  </div>
                  <TranscriptChat
                    segments={transcript}
                    interviewerSpeaker={interviewerSpeaker}
                    activeSegmentIndex={activeSegmentIndex}
                    loading={transcriptLoading}
                    containerRef={chatContainerRef}
                  />
                </Card>
              </div>
            </Section>

            {/* Dialogue Chains */}
            <Section id="chains" title={`${chainsNum}. ${t('dialogueChains')}`} icon={<TrendingUp size={24} />}>
              {(() => {
                const sorted = [...dialogueChains].sort((a, b) => b.steps.length - a.steps.length);
                const key = sorted.slice(0, 2);
                const rest = sorted.slice(2);
                return (
                  <div className="space-y-8">
                    {key.map((chain, idx) => (
                      <DialogueChainView key={`key-${idx}`} title={chain.title.replace(/^链条\s*[A-Za-z][\s：:]+/, '')} steps={chain.steps} />
                    ))}
                    {rest.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {rest.map((chain, idx) => (
                          <DialogueChainView key={`rest-${idx}`} title={chain.title.replace(/^链条\s*[A-Za-z][\s：:]+/, '')} steps={chain.steps} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Section>

            {/* Focus Map */}
            <Section id="focus" title={`${focusNum}. ${t('focusMap')}`} icon={<Target size={24} />}>
              <Card className="mb-8">
                <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">{t('topicHeatmap')}</div>
                {/* Desktop: table */}
                <div className="hidden md:block">
                  <Table
                    headers={[t('topicCol'), t('depthCol'), t('questionsCol'), t('levelCol')]}
                    rows={focusMap.topics.map(topic => [
                      topic.topic,
                      topic.depth,
                      topic.questions,
                      <Badge color={getFocusLevelBadgeColor(topic.level)}>{topic.level}</Badge>,
                    ])}
                  />
                </div>
                {/* Mobile: collapsible cards */}
                <div className="md:hidden divide-y divide-border-main">
                  {focusMap.topics.map((topic, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-text-primary text-sm">{topic.topic}</span>
                          <Badge color={getFocusLevelBadgeColor(topic.level)}>{topic.level}</Badge>
                        </div>
                        <ChevronDown size={16} className="text-text-secondary transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-6 pb-4 space-y-2 text-sm">
                        <div><span className="font-bold text-text-secondary">{t('depthCol')}:</span> <span className="text-text-primary">{topic.depth}</span></div>
                        <div><span className="font-bold text-text-secondary">{t('questionsCol')}:</span> <span className="text-text-primary">{topic.questions}</span></div>
                      </div>
                    </details>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {topInsight && (
                  <Card className="p-8 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-600 shrink-0">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-red-900 dark:text-red-200 mb-4">{t('extremelyHigh')}: {topInsight.title}</h3>
                        <div className="text-base text-red-800 dark:text-red-300 leading-relaxed font-medium">
                          <p className="mb-4">{topInsight.description}</p>
                          <ul className="space-y-3">
                            {topInsight.points.map((p, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                          {topInsight.coreQuestion && (
                            <div className="mt-6 p-4 rounded-2xl bg-red-100/50 dark:bg-red-900/40 border border-red-200/50 dark:border-red-700/50 font-bold text-red-900 dark:text-red-100">
                              {t('coreQuestion')}: {topInsight.coreQuestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {secondInsight && (
                  <Card className="p-8 bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600 shrink-0">
                        <Search size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-4">{t('highFocus')}: {secondInsight.title}</h3>
                        <div className="text-base text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                          <p className="mb-4">{secondInsight.description}</p>
                          <ul className="space-y-3">
                            {secondInsight.points.map((p, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </Section>


              </>);
            })()}

            <footer className="text-center text-text-secondary text-sm font-medium py-16 border-t border-border-main mt-16">
              <p>{t('footerAI')}（{meta.model}）{t('footerProcedure')}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60">{t('footerSource')}: {meta.source}</p>
              {reportName && (
                <p className="mt-4 text-xs text-text-secondary">{t('footerDataSource')}: {reportName}</p>
              )}
              <p className="mt-4 text-xs text-text-secondary">&copy; 2026 Loong0x00 &amp; AmandaWWW</p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  );
}
