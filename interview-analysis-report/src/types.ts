// TypeScript interfaces for interview analysis report data

export interface RoleIdentification {
  role: string;        // e.g. "候选人", "面试官"
  speaker: string;     // e.g. "Speaker 1"
  evidence: string;    // 判定依据
}

export interface InterviewDuration {
  totalDuration: string;       // e.g. "~24分41秒"
  progressPercent: number;     // 0-100 for progress bar
  selfIntroEnd: string;        // e.g. "~67s"
  formalQARange: string;       // e.g. "~68s - 1310s"
  effectiveQADuration: string; // e.g. "~20分钟"
}

export interface Question {
  id: string;          // e.g. "Q1"
  text: string;        // 问题文本
  type: "预设" | "追问" | "澄清";
  timestamp?: string;  // e.g. "68.1s"
}

export interface QuestionStats {
  preset: number;      // 预设问题数
  followUp: number;    // 追问数
  clarification: number; // 澄清数
}

export interface DialogueStep {
  type: "question" | "answer" | "trigger" | "clarification";
  label?: string;      // e.g. "Q1 预设"
  content: string;
  time?: string;       // e.g. "68s~173s"
}

export interface DialogueChain {
  title: string;       // e.g. "链条 A：职业转型经历"
  steps: DialogueStep[];
}

export interface FocusTopicRow {
  topic: string;
  depth: string;       // e.g. "4层"
  questions: string;   // e.g. "Q2 → Q3 → Q4 → Q5 → Q6"
  level: string;       // e.g. "极高关注", "高关注", "中等关注", "低关注", "一带而过"
}

export interface FocusInsight {
  level: string;       // e.g. "极高关注", "高关注"
  title: string;       // e.g. "产品评测能力"
  description: string; // main description text
  points: string[];    // bullet points
  coreQuestion?: string; // optional concluding emphasis
}

export interface BackgroundItem {
  label: string;       // e.g. "主要实习经历"
  content: string;
}

export interface AbilityItem {
  label: string;       // e.g. "产品思维"
  description: string;
}

export interface RiskItem {
  label: string;       // e.g. "技术深度有限"
  description: string;
}

export interface CandidateSummary {
  background: BackgroundItem[];
  abilities: AbilityItem[];
  risks: RiskItem[];
}

export interface BasicInfo {
  roles: RoleIdentification[];
  duration: InterviewDuration;
}

export interface ReportMeta {
  position: string;    // e.g. "小米创新 AI 产品经理（实习）"
  date: string;        // e.g. "2026-03-03"
  model: string;       // e.g. "Claude claude-sonnet-4-6"
  source: string;      // e.g. "讯飞 ASR v2 转写结构化 JSON"
}

export interface AnalysisReport {
  meta: ReportMeta;
  basicInfo: BasicInfo;
  questions: Question[];
  questionStats: QuestionStats;
  dialogueChains: DialogueChain[];
  focusMap: {
    topics: FocusTopicRow[];
    insights: FocusInsight[];
  };
  candidateSummary: CandidateSummary;
}

export interface TranscriptSegment {
  speaker: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

// API response types
export interface ReportListItem {
  name: string;        // file base name, e.g. "小米创新AI产品经理"
  position: string;
  date: string;
}

export interface ApiReportListResponse {
  reports: ReportListItem[];
}

// Pipeline job types
export type PipelineJobStatus =
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "converting"
  | "done"
  | "error";

export interface PipelineJob {
  id: string;
  fileName: string;
  status: PipelineJobStatus;
  progress: string;
  createdAt: number;
  result?: string;
  error?: string;
}
