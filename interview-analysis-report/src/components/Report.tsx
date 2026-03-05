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
  BarChart3,
} from 'lucide-react';
import type { AnalysisReport, DialogueStep, TranscriptSegment } from '../types';
import TranscriptChat from './TranscriptChat';
import { useAuth } from '../contexts/AuthContext';

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

const ANSWER_TRUNCATE_LINES = 3;
const ANSWER_LINE_HEIGHT = 1.625; // leading-relaxed = 1.625
const ANSWER_FONT_SIZE = 14; // text-sm = 14px
const ANSWER_MAX_COLLAPSED_HEIGHT = ANSWER_TRUNCATE_LINES * ANSWER_LINE_HEIGHT * ANSWER_FONT_SIZE;

const CollapsibleAnswer: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsTruncation(contentRef.current.scrollHeight > ANSWER_MAX_COLLAPSED_HEIGHT + 10);
    }
  }, [content]);

  return (
    <div>
      <motion.div
        ref={contentRef}
        initial={false}
        animate={{ height: expanded || !needsTruncation ? 'auto' : ANSWER_MAX_COLLAPSED_HEIGHT }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="text-base leading-relaxed text-text-primary overflow-hidden relative"
      >
        {content}
        {!expanded && needsTruncation && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg-surface to-transparent" />
        )}
      </motion.div>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
        >
          {expanded ? '收起' : '展开查看完整回答'}
        </button>
      )}
    </div>
  );
};

const DialogueChainView: React.FC<{ title: string; steps: DialogueStep[] }> = ({ title, steps: rawSteps }) => {
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());
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

  const toggleAnswer = (idx: number) => {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
  <Card className="mb-8">
    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 flex justify-between items-center">
      <h3 className="font-bold text-text-primary">{title}</h3>
    </div>
    <div className="p-8">
      <div className="relative pl-10 space-y-10 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border-main">
        {steps.map((step, idx) => {
          const trigger = triggerAfter.get(rawIndices[idx]);
          const isAnswerExpanded = expandedAnswers.has(idx);
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
                  {trigger && !isAnswerExpanded ? (
                    <div className="text-base leading-relaxed text-text-secondary font-medium italic">
                      "{trigger.content}"
                    </div>
                  ) : (
                    <CollapsibleAnswer content={step.content} />
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => toggleAnswer(idx)}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                    >
                      {isAnswerExpanded ? '收起回答' : '展开回答'}
                    </button>
                  </div>
                  {trigger && isAnswerExpanded && (
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

// --- Main Report Component ---

interface ReportProps {
  data: AnalysisReport;
  reportName?: string;
  onBack?: () => void;
}

export default function Report({ data, reportName, onBack }: ReportProps) {
  const { meta, basicInfo, questions, questionStats, dialogueChains, focusMap, candidateSummary } = data;
  const { authFetch } = useAuth();

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
                <span className="hidden sm:inline">返回</span>
              </button>
            )}
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
              R
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">面试对话分析</h1>
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
                const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];
                const navItems = [
                  data.positionSummary ? { id: 'position', label: '岗位摘要', icon: Briefcase } : null,
                  { id: 'summary', label: '表现摘要', icon: CheckCircle2 },
                  { id: 'questions', label: '问题列表', icon: MessageSquare },
                  { id: 'chains', label: '对话链分析', icon: TrendingUp },
                  { id: 'focus', label: '关注图谱', icon: Target },
                  data.fitAnalysis ? { id: 'fit', label: '契合度分析', icon: BarChart3 } : null,
                ].filter(Boolean) as { id: string; label: string; icon: React.FC<any> }[];
                return navItems.map((item, idx) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-text-secondary rounded-2xl hover:bg-bg-surface hover:text-emerald-600 hover:bento-shadow border border-transparent hover:border-border-main transition-all group"
                  >
                    <item.icon size={18} className="group-hover:text-emerald-600 transition-colors" />
                    {chineseNumbers[idx]}、{item.label}
                  </a>
                ));
              })()}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-16">

            {/* Dynamic section numbering */}
            {(() => {
              const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];
              let sectionIdx = 0;
              const nextNum = () => chineseNumbers[sectionIdx++];
              const positionNum = data.positionSummary ? nextNum() : '';
              const summaryNum = nextNum();
              const questionsNum = nextNum();
              const chainsNum = nextNum();
              const focusNum = nextNum();
              const fitNum = data.fitAnalysis ? nextNum() : '';

              return (<>

            {/* Position Summary (conditional) */}
            {data.positionSummary && (
              <Section id="position" title={`${positionNum}、岗位摘要`} icon={<Briefcase size={24} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card>
                    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">
                      核心职责与要求
                    </div>
                    <div className="p-8 space-y-5">
                      {data.positionSummary.responsibilities.map((r, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                          <span className="text-base text-text-primary font-medium">{r}</span>
                        </div>
                      ))}
                      {data.positionSummary.requirements.length > 0 && (
                        <div className="pt-4 border-t border-border-main space-y-5">
                          {data.positionSummary.requirements.map((r, i) => (
                            <div key={i} className="flex gap-4">
                              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                              <span className="text-base text-text-primary font-medium">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                  <Card>
                    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">
                      工作环境
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="text-base">
                        <span className="font-bold text-text-secondary">工作强度：</span>
                        <span className="text-text-primary font-medium">{data.positionSummary.workIntensity}</span>
                      </div>
                      <div className="text-base">
                        <span className="font-bold text-text-secondary">团队文化：</span>
                        <span className="text-text-primary font-medium">{data.positionSummary.teamCulture}</span>
                      </div>
                      {data.positionSummary.keyKPIs.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-base font-bold text-text-secondary">关键 KPI：</span>
                          {data.positionSummary.keyKPIs.map((kpi, i) => (
                            <div key={i} className="flex gap-4 ml-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0" />
                              <span className="text-base text-text-primary font-medium">{kpi}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {data.positionSummary.highlights && (
                        <div className="text-base bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">亮点：</span>
                          <span className="text-emerald-900 dark:text-emerald-100 font-medium">{data.positionSummary.highlights}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Section>
            )}

            {/* Candidate Summary */}
            <Section id="summary" title={`${summaryNum}、候选人表现摘要`} icon={<CheckCircle2 size={24} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                  <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary flex items-center gap-3">
                    <Brain size={20} className="text-emerald-600" /> 展现能力
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
                    <AlertTriangle size={20} className="text-amber-500" /> 潜在风险
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
            <Section id="questions" title={`${questionsNum}、面试官问题列表`} icon={<MessageSquare size={24} />}>
              <div className="flex flex-wrap gap-3 mb-8">
                {(['全部', '预设', '追问', '澄清'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setQuestionFilter(tab)}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
                      questionFilter === tab
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/25'
                        : 'bg-bg-surface text-text-secondary border-border-main hover:border-emerald-400 hover:text-emerald-600 bento-shadow'
                    }`}
                  >
                    {tab}
                    {tab !== '全部' && (
                      <span className="ml-2 opacity-60">
                        {tab === '预设' ? questionStats.preset : tab === '追问' ? questionStats.followUp : questionStats.clarification}
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
                        className={`flex items-center gap-4 px-6 py-4 transition-all duration-200 ${q.timestamp ? 'cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10' : 'hover:bg-bg-base/40'}`}
                      >
                        <span className="shrink-0 w-12 text-center px-2 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">{q.id}</span>
                        <Badge color={getQuestionBadgeColor(q.type)}>{q.type}</Badge>
                        <span className="flex-1 text-sm text-text-primary font-medium leading-relaxed truncate">
                          {q.text}
                          {q.timestamp && <span className="ml-2 text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">{formatTimeString(q.timestamp)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-bg-base p-6 border-t border-border-main flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
                    <span className="text-text-primary">数据统计</span>
                    <span>预设: {questionStats.preset}</span>
                    <span>追问: {questionStats.followUp}</span>
                    <span>澄清: {questionStats.clarification}</span>
                  </div>
                </Card>

                {/* Right: Transcript chat */}
                <Card className="xl:col-span-5 xl:max-h-[800px] flex flex-col xl:sticky xl:top-28">
                  <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle size={20} className="text-emerald-600" />
                      <h3 className="font-bold text-text-primary">转写全文</h3>
                    </div>
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{transcript.length} 轮对话</span>
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
            <Section id="chains" title={`${chainsNum}、对话链分析`} icon={<TrendingUp size={24} />}>
              {(() => {
                const sorted = [...dialogueChains].sort((a, b) => b.steps.length - a.steps.length);
                const key = sorted.slice(0, 2);
                const rest = sorted.slice(2);
                return (
                  <div className="space-y-8">
                    {key.map((chain, idx) => (
                      <DialogueChainView key={`key-${idx}`} title={chain.title} steps={chain.steps} />
                    ))}
                    {rest.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {rest.map((chain, idx) => (
                          <DialogueChainView key={`rest-${idx}`} title={chain.title} steps={chain.steps} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </Section>

            {/* Focus Map */}
            <Section id="focus" title={`${focusNum}、面试官关注图谱`} icon={<Target size={24} />}>
              <Card className="mb-8">
                <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">话题深度热力图</div>
                <Table
                  headers={['话题', '追问层数', '涉及问题', '关注等级']}
                  rows={focusMap.topics.map(t => [
                    t.topic,
                    t.depth,
                    t.questions,
                    <Badge color={getFocusLevelBadgeColor(t.level)}>{t.level}</Badge>,
                  ])}
                />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {topInsight && (
                  <Card className="p-8 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-600 shrink-0">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-red-900 dark:text-red-200 mb-4">极高关注：{topInsight.title}</h3>
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
                              核心问题：{topInsight.coreQuestion}
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
                        <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-4">高关注：{secondInsight.title}</h3>
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

            {/* Fit Analysis (conditional) */}
            {data.fitAnalysis && (
              <Section id="fit" title={`${fitNum}、契合度分析`} icon={<BarChart3 size={24} />}>
                {/* Overall Score */}
                <Card className="mb-8">
                  <div className="p-10 flex flex-col items-center text-center">
                    <div className={`text-7xl font-black mb-4 ${
                      data.fitAnalysis.overallScore >= 80 ? 'text-emerald-600' :
                      data.fitAnalysis.overallScore >= 60 ? 'text-amber-500' :
                      'text-red-600'
                    }`}>
                      {data.fitAnalysis.overallScore}
                    </div>
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-6">综合契合度评分</div>
                    <p className="text-lg text-text-primary max-w-2xl leading-relaxed font-bold">
                      {data.fitAnalysis.recommendation}
                    </p>
                  </div>
                </Card>

                {/* Dimensions Table */}
                <Card className="mb-8">
                  <Table
                    headers={['维度', 'JD 要求', '候选人证据', '得分', '评价']}
                    rows={data.fitAnalysis.dimensions.map(d => [
                      d.dimension,
                      d.jdRequirement,
                      d.candidateEvidence,
                      <Badge color={d.score >= 80 ? 'green' : d.score >= 60 ? 'amber' : 'red'}>{d.score}</Badge>,
                      d.comment,
                    ])}
                  />
                </Card>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card>
                    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">
                      优势匹配
                    </div>
                    <div className="p-8 space-y-5">
                      {data.fitAnalysis.strengths.map((s, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                          <span className="text-base text-text-primary font-bold">{s}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <div className="px-8 py-5 border-b border-border-main bg-bg-base/50 font-bold text-text-primary">
                      待提升
                    </div>
                    <div className="p-8 space-y-5">
                      {data.fitAnalysis.gaps.map((g, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                          <span className="text-base text-text-primary font-bold">{g}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </Section>
            )}

              </>);
            })()}

            <footer className="text-center text-text-secondary text-sm font-medium py-16 border-t border-border-main mt-16">
              <p>本报告由 AI 分析层（{meta.model}）依据高阶分析流程生成</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60">原始数据：{meta.source}</p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  );
}
