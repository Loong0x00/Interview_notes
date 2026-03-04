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
  Briefcase,
  MessageCircle
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
    className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:shadow-zinc-900/50 border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "amber" | "red" | "zinc" }) => {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    green: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${colors[color]}`}>
      {children}
    </span>
  );
};

const Table = ({ headers, rows, className = "" }: TableProps) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-700">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="px-6 py-3 font-medium tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className={`px-6 py-4 text-zinc-700 dark:text-zinc-300 ${j === row.length - 1 ? 'whitespace-pre-wrap' : 'whitespace-nowrap'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Section = ({ title, icon, children, id }: SectionProps) => (
  <section id={id} className="scroll-mt-24 mb-12">
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-3 mb-6"
    >
      <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</h2>
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
        className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 overflow-hidden relative"
      >
        {content}
        {!expanded && needsTruncation && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent" />
        )}
      </motion.div>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          {expanded ? '收起' : '展开查看完整回答'}
        </button>
      )}
    </div>
  );
};

const DialogueChainView: React.FC<{ title: string; steps: DialogueStep[] }> = ({ title, steps: rawSteps }) => {
  // Remove trailing trigger — chain ended, no follow-up question was triggered
  const steps = rawSteps.length > 0 && rawSteps[rawSteps.length - 1].type === 'trigger' ? rawSteps.slice(0, -1) : rawSteps;
  return (
  <Card className="mb-6">
    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-between items-center">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
    </div>
    <div className="p-6">
      <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-700">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="relative"
          >
            <div className={`absolute -left-[29px] w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white dark:bg-zinc-900
              ${step.type === 'question' ? 'border-blue-500 text-blue-500' :
                step.type === 'trigger' ? 'border-amber-500 text-amber-500' :
                step.type === 'clarification' ? 'border-purple-500 text-purple-500' :
                'border-emerald-500 text-emerald-500'}`}>
              <div className={`w-2 h-2 rounded-full ${
                 step.type === 'question' ? 'bg-blue-500' :
                 step.type === 'trigger' ? 'bg-amber-500' :
                 step.type === 'clarification' ? 'bg-purple-500' :
                 'bg-emerald-500'
              }`} />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider
                  ${step.type === 'question' ? 'text-blue-600' :
                    step.type === 'trigger' ? 'text-amber-600' :
                    step.type === 'clarification' ? 'text-purple-600' :
                    'text-emerald-600'}`}>
                  {step.label || (step.type === 'question' ? '面试官提问' : step.type === 'trigger' ? '触发关键词' : step.type === 'clarification' ? '面试官澄清' : '候选人回答')}
                </span>
                {step.time && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">{step.time}</span>}
              </div>

              {step.type === 'answer' ? (
                <CollapsibleAnswer content={step.content} />
              ) : (
                <div className={`text-sm leading-relaxed ${step.type === 'trigger' ? 'font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-100 dark:border-amber-800 inline-block' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {step.content}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </Card>
  );
};

// --- Helpers ---

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-50 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="mr-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                &larr;
              </button>
            )}
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              R
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 hidden sm:block">面试对话分析报告</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1"><User size={14} /> {meta.position}</span>
            <span className="hidden sm:flex items-center gap-1"><Clock size={14} /> {meta.date}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:col-span-3">
            <nav className="sticky top-24 space-y-1">
              {[
                { id: 'summary', label: '一、候选人表现摘要', icon: CheckCircle2 },
                { id: 'basic-info', label: '二、基本信息', icon: User },
                { id: 'questions', label: '三、面试官问题列表', icon: MessageSquare },
                { id: 'chains', label: '四、对话链分析', icon: TrendingUp },
                { id: 'focus', label: '五、面试官关注图谱', icon: Target },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-white dark:hover:bg-zinc-800 hover:text-indigo-600 hover:shadow-sm dark:hover:shadow-zinc-900/50 transition-all group"
                >
                  <item.icon size={16} className="group-hover:text-indigo-600 transition-colors" />
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-12">

            {/* 1. Candidate Summary */}
            <Section id="summary" title="一、候选人表现摘要" icon={<CheckCircle2 size={20} />}>
              <div className="space-y-6">
                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Briefcase size={18} className="text-zinc-500 dark:text-zinc-400" /> 关键背景
                  </div>
                  <Table
                    headers={['项目', '内容']}
                    rows={candidateSummary.background.map(b => [b.label, b.content])}
                  />
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Brain size={18} className="text-zinc-500 dark:text-zinc-400" /> 展现能力
                    </div>
                    <div className="p-6 space-y-4">
                      {candidateSummary.abilities.map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{item.label}：</span>
                            <span className="text-zinc-600 dark:text-zinc-400 text-sm">{item.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-zinc-500 dark:text-zinc-400" /> 潜在风险
                    </div>
                    <div className="p-6 space-y-4">
                      {candidateSummary.risks.map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{item.label}：</span>
                            <span className="text-zinc-600 dark:text-zinc-400 text-sm">{item.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </Section>

            {/* 2. Basic Info */}
            <Section id="basic-info" title="二、基本信息" icon={<User size={20} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">角色识别</div>
                  <Table
                    headers={['角色', 'Speaker', '判定依据']}
                    rows={basicInfo.roles.map(r => [
                      <Badge color={r.role === '候选人' ? 'blue' : 'zinc'}>{r.role}</Badge>,
                      r.speaker,
                      r.evidence,
                    ])}
                  />
                </Card>

                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">面试时长</div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 dark:text-zinc-400">总时长</span>
                      <span className="font-mono font-medium">{basicInfo.duration.totalDuration}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${basicInfo.duration.progressPercent}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-2">
                      <div>
                        <p>自我介绍: {basicInfo.duration.selfIntroEnd}</p>
                        <p>正式问答: {basicInfo.duration.formalQARange}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-indigo-600 font-bold text-sm">有效问答: {basicInfo.duration.effectiveQADuration}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            {/* 3. Questions List */}
            <Section id="questions" title="三、面试官问题列表" icon={<MessageSquare size={20} />}>
              <div className="flex flex-wrap gap-2 mb-4">
                {(['全部', '预设', '追问', '澄清'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setQuestionFilter(tab)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      questionFilter === tab
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {tab}
                    {tab !== '全部' && (
                      <span className="ml-1 opacity-70">
                        {tab === '预设' ? questionStats.preset : tab === '追问' ? questionStats.followUp : questionStats.clarification}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:items-start">
                {/* Left: Question table */}
                <Card className="xl:max-h-[800px] overflow-y-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-700">
                        <tr>
                          <th className="px-6 py-3 font-medium tracking-wider">编号</th>
                          <th className="px-6 py-3 font-medium tracking-wider">问题文本</th>
                          <th className="px-6 py-3 font-medium tracking-wider">类型</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredQuestions.map((q, i) => (
                          <tr
                            key={i}
                            onClick={() => q.timestamp && handleQuestionClick(q.timestamp)}
                            className={`transition-colors ${q.timestamp ? 'cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-950/60' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'}`}
                          >
                            <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {q.id}
                                {q.timestamp && <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{q.timestamp}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{q.text}</td>
                            <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                              <Badge color={getQuestionBadgeColor(q.type)}>{q.type}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">统计：</span>
                    <span>预设问题: {questionStats.preset}</span>
                    <span>追问: {questionStats.followUp}</span>
                    <span>澄清: {questionStats.clarification}</span>
                  </div>
                </Card>

                {/* Right: Transcript chat */}
                <Card className="xl:max-h-[800px] flex flex-col xl:sticky xl:top-4">
                  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={16} className="text-zinc-500 dark:text-zinc-400" />
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">转写全文</h3>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{transcript.length} 条对话</span>
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

            {/* 4. Dialogue Chains */}
            <Section id="chains" title="四、对话链分析" icon={<TrendingUp size={20} />}>
              {(() => {
                const sorted = [...dialogueChains].sort((a, b) => b.steps.length - a.steps.length);
                // Top 2 are key chains (full width), rest are secondary (2-column)
                const key = sorted.slice(0, 2);
                const rest = sorted.slice(2);
                return (
                  <>
                    {key.map((chain, idx) => (
                      <DialogueChainView key={`key-${idx}`} title={chain.title} steps={chain.steps} />
                    ))}
                    {rest.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {rest.map((chain, idx) => (
                          <DialogueChainView key={`rest-${idx}`} title={chain.title} steps={chain.steps} />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </Section>

            {/* 5. Focus Map */}
            <Section id="focus" title="五、面试官关注图谱" icon={<Target size={20} />}>
              <Card className="mb-6">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">话题深度热力图</div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topInsight && (
                  <Card className="p-6 bg-red-50/50 dark:bg-red-950/50 border-red-100 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={20} />
                      <div>
                        <h3 className="font-bold text-red-900 dark:text-red-200 mb-2">极高关注：{topInsight.title}</h3>
                        <div className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
                          <p>{topInsight.description}</p>
                          <ul className="list-disc pl-4 mt-2 space-y-1">
                            {topInsight.points.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                          {topInsight.coreQuestion && (
                            <div className="mt-3 font-semibold text-red-900 dark:text-red-200">
                              核心问题：{topInsight.coreQuestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {secondInsight && (
                  <Card className="p-6 bg-amber-50/50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Search className="text-amber-600 dark:text-amber-400 mt-1 shrink-0" size={20} />
                      <div>
                        <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-2">高关注：{secondInsight.title}</h3>
                        <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                          <p>{secondInsight.description}</p>
                          <ul className="list-disc pl-4 mt-2 space-y-1">
                            {secondInsight.points.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </Section>

            <footer className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-12 border-t border-zinc-200 dark:border-zinc-700 mt-12">
              <p>本报告由 AI 分析层（{meta.model}）依据 CLAUDE.md 5步分析流程生成</p>
              <p className="mt-1">原始数据来源：{meta.source}</p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  );
}
