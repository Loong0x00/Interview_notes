export type Lang = 'zh' | 'en';

const translations = {
  // App name
  appName: { zh: '面试分析大师', en: 'Interview Analyzer' },

  // Auth
  welcomeBack: { zh: '欢迎回来', en: 'Welcome Back' },
  createAccount: { zh: '创建账号', en: 'Create Account' },
  username: { zh: '用户名', en: 'Username' },
  password: { zh: '密码', en: 'Password' },
  inviteCode: { zh: '邀请码', en: 'Invite Code' },
  pasteInviteCode: { zh: '粘贴邀请码', en: 'Paste invite code' },
  login: { zh: '登录', en: 'Log In' },
  loggingIn: { zh: '正在登录...', en: 'Logging in...' },
  register: { zh: '注册', en: 'Sign Up' },
  registering: { zh: '正在注册...', en: 'Signing up...' },
  loginFailed: { zh: '登录失败', en: 'Login failed' },
  registerFailed: { zh: '注册失败', en: 'Registration failed' },
  noAccount: { zh: '没有账号？', en: "Don't have an account?" },
  signUpNow: { zh: '立即注册', en: 'Sign up' },
  hasAccount: { zh: '已有账号？', en: 'Already have an account?' },
  loginNow: { zh: '登录', en: 'Log in' },
  logout: { zh: '退出登录', en: 'Log Out' },

  // List page
  uploadNew: { zh: '上传新面试', en: 'New Upload' },
  noReports: { zh: '暂无报告，开始您的第一次分析吧', en: 'No reports yet. Start your first analysis!' },
  uploadFirst: { zh: '上传第一份面试', en: 'Upload First Interview' },
  analyzed: { zh: '已分析', en: 'Analyzed' },
  roundLabel: { zh: '轮次', en: 'Round' },
  tagLabel: { zh: '标签', en: 'Tags' },
  allFilter: { zh: '全部', en: 'All' },
  sortLabel: { zh: '排序', en: 'Sort' },
  sortTimeDesc: { zh: '上传时间 ↓', en: 'Date ↓' },
  sortTimeAsc: { zh: '上传时间 ↑', en: 'Date ↑' },
  sortNameAsc: { zh: '名称 A-Z', en: 'Name A-Z' },
  sortNameDesc: { zh: '名称 Z-A', en: 'Name Z-A' },
  addTag: { zh: '标签', en: 'Tag' },
  tagPlaceholder: { zh: '标签名', en: 'Tag name' },

  // Upload page
  uploadInterview: { zh: '上传面试', en: 'Upload Interview' },
  back: { zh: '返回', en: 'Back' },
  jdTitle: { zh: '岗位 JD', en: 'Job Description' },
  jdDesc: { zh: '提供后将生成岗位画像与契合度', en: 'Enables position profile & fit analysis' },
  jdPlaceholder: { zh: '粘贴岗位描述...', en: 'Paste job description...' },
  cvTitle: { zh: '求职者简历', en: 'Resume / CV' },
  cvDesc: { zh: '支持 PDF、Word 格式', en: 'PDF or Word format' },
  cvSelect: { zh: '点击选择简历', en: 'Click to select resume' },
  interviewRound: { zh: '面试轮次', en: 'Interview Round' },
  roundDesc: { zh: '选填，用于分类筛选', en: 'Optional, for filtering' },
  roundNone: { zh: '未指定', en: 'Not specified' },
  roundFirst: { zh: '一面', en: '1st Round' },
  roundSecond: { zh: '二面', en: '2nd Round' },
  roundThird: { zh: '三面', en: '3rd Round' },
  roundHR: { zh: 'HR面', en: 'HR Round' },
  roundFinal: { zh: '终面', en: 'Final Round' },
  modeAudio: { zh: '面试录音', en: 'Audio' },
  modeTranscript: { zh: '面试逐字稿', en: 'Transcript' },
  quotaRemaining: { zh: '转写余量', en: 'Quota' },
  quotaUnlimited: { zh: '不限', en: 'Unlimited' },
  quotaMinutes: { zh: '分钟', en: 'min' },
  uploadAudio: { zh: '上传面试录音', en: 'Upload Interview Audio' },
  uploadTranscript: { zh: '上传逐字稿文件', en: 'Upload Transcript File' },
  dropHint: { zh: '拖拽文件到此处或点击选择开始 AI 分析', en: 'Drag & drop or click to start AI analysis' },
  changeFile: { zh: '点击更换文件', en: 'Click to change file' },
  startAnalysis: { zh: '开始分析', en: 'Start Analysis' },
  uploading: { zh: '正在上传', en: 'Uploading' },
  costWarning: { zh: '请确认信息无误后再提交，每次分析会消耗 AI 额度', en: 'Each analysis consumes AI credits. Please confirm before submitting.' },
  progressTitle: { zh: '处理进度', en: 'Progress' },
  stepTranscription: { zh: '语音转写', en: 'Transcription' },
  stepAnalysis: { zh: 'AI 分析', en: 'AI Analysis' },
  processing: { zh: '正在处理：', en: 'Processing: ' },
  cancelTask: { zh: '终止任务', en: 'Cancel' },
  analysisDone: { zh: '分析完成！正在进入报告...', en: 'Done! Loading report...' },
  processFailed: { zh: '处理失败', en: 'Processing Failed' },
  unknownError: { zh: '发生了未知错误', en: 'An unknown error occurred' },
  retry: { zh: '重新尝试', en: 'Retry' },

  // Report page
  interviewAnalysis: { zh: '面试对话分析', en: 'Interview Analysis' },
  positionSummary: { zh: '岗位摘要', en: 'Position Summary' },
  candidateSummary: { zh: '候选人表现摘要', en: 'Candidate Summary' },
  questionList: { zh: '面试官问题列表', en: 'Interviewer Questions' },
  dialogueChains: { zh: '对话链分析', en: 'Dialogue Chains' },
  focusMap: { zh: '面试官关注图谱', en: 'Focus Map' },
  abilities: { zh: '展现能力', en: 'Demonstrated Abilities' },
  risks: { zh: '潜在风险', en: 'Potential Risks' },
  preset: { zh: '预设', en: 'Preset' },
  followUp: { zh: '追问', en: 'Follow-up' },
  clarification: { zh: '澄清', en: 'Clarification' },
  stats: { zh: '数据统计', en: 'Statistics' },
  transcriptFull: { zh: '转写全文', en: 'Full Transcript' },
  roundsOfDialogue: { zh: '轮对话', en: 'turns' },
  topicHeatmap: { zh: '话题深度热力图', en: 'Topic Depth Heatmap' },
  topicCol: { zh: '话题', en: 'Topic' },
  depthCol: { zh: '追问层数', en: 'Depth' },
  questionsCol: { zh: '涉及问题', en: 'Questions' },
  levelCol: { zh: '关注等级', en: 'Level' },
  extremelyHigh: { zh: '极高关注', en: 'Critical Focus' },
  highFocus: { zh: '高关注', en: 'High Focus' },
  coreQuestion: { zh: '核心问题', en: 'Core Question' },

  // Position section
  positionInferred: { zh: '岗位画像（推断）', en: 'Position Profile (Inferred)' },
  positionProfile: { zh: '岗位画像', en: 'Position Profile' },
  inferredHint: { zh: '当前岗位分析基于面试对话内容推断。补充岗位 JD 和简历可获得更精准的分析结果。', en: 'Position analysis is inferred from the interview. Provide JD and resume for more accurate results.' },
  inferredResponsibilities: { zh: '推断核心职责', en: 'Inferred Responsibilities' },
  jdResponsibilities: { zh: 'JD 核心职责', en: 'JD Responsibilities' },
  actualWork: { zh: '面试官口述实际工作', en: 'Actual Work (from interviewer)' },
  hiddenRequirements: { zh: '隐藏要求', en: 'Hidden Requirements' },
  keyKPIs: { zh: '关键 KPI', en: 'Key KPIs' },
  workIntensity: { zh: '工作强度：', en: 'Work Intensity: ' },
  teamCulture: { zh: '团队文化：', en: 'Team Culture: ' },
  hardRequirements: { zh: '硬性要求', en: 'Hard Requirements' },
  highlights: { zh: '亮点：', en: 'Highlights: ' },
  fitInferred: { zh: '契合度（推断）', en: 'Fit Score (Inferred)' },
  fitScore: { zh: '契合度', en: 'Fit Score' },
  overallFitScore: { zh: '综合契合度评分', en: 'Overall Fit Score' },
  hardSkillMatch: { zh: '硬技能匹配：', en: 'Hard Skills: ' },
  softSkillMatch: { zh: '软技能匹配：', en: 'Soft Skills: ' },
  experienceRelevance: { zh: '经验相关度：', en: 'Experience: ' },
  dimensionCol: { zh: '维度', en: 'Dimension' },
  jdRequirement: { zh: 'JD 要求', en: 'JD Requirement' },
  inferredRequirement: { zh: '推断要求', en: 'Inferred Req.' },
  candidateEvidence: { zh: '候选人证据', en: 'Evidence' },
  scoreCol: { zh: '得分', en: 'Score' },
  commentCol: { zh: '评价', en: 'Comment' },
  strengthMatch: { zh: '优势匹配', en: 'Strengths' },
  gapsToImprove: { zh: '待提升', en: 'Gaps' },

  // Reanalyze
  updateAndReanalyze: { zh: '更新材料并重新分析', en: 'Update & Re-analyze' },
  addMaterialsHint: { zh: '补充 JD / 简历，获得更精准的分析', en: 'Add JD / Resume for better analysis' },
  jdLabel: { zh: '岗位描述（JD）', en: 'Job Description (JD)' },
  jdTextPlaceholder: { zh: '粘贴岗位描述文本...', en: 'Paste job description...' },
  cvLabel: { zh: '简历文件（PDF / DOCX / TXT）', en: 'Resume (PDF / DOCX / TXT)' },
  reanalyze: { zh: '重新分析', en: 'Re-analyze' },
  analyzing: { zh: '分析中...', en: 'Analyzing...' },
  needMaterial: { zh: '请至少提供岗位JD或简历', en: 'Please provide at least a JD or resume' },
  reanalyzeDone: { zh: '分析完成，正在刷新...', en: 'Done, refreshing...' },

  // Transcript chat
  loadingTranscript: { zh: '加载转写中...', en: 'Loading transcript...' },
  noTranscript: { zh: '暂无转写数据', en: 'No transcript data' },
  interviewer: { zh: '面试官', en: 'Interviewer' },
  candidate: { zh: '候选人', en: 'Candidate' },
  interviewerShort: { zh: '官', en: 'I' },
  candidateShort: { zh: '候', en: 'C' },

  // Dialogue chain
  interviewerAsk: { zh: '面试官提问', en: 'Question' },
  interviewerClarify: { zh: '面试官澄清', en: 'Clarification' },
  candidateAnswer: { zh: '候选人回答', en: 'Answer' },
  triggerFollowUp: { zh: '触发追问', en: 'Triggered follow-up' },

  // Navigation (mobile drawer)
  navigation: { zh: '导航', en: 'Navigation' },

  // Footer
  footerAI: { zh: '本报告由 AI 分析层', en: 'Report generated by AI analysis layer' },
  footerProcedure: { zh: '依据高阶分析流程生成', en: 'using advanced analysis pipeline' },
  footerSource: { zh: '原始数据', en: 'Source data' },
  footerDataSource: { zh: '数据来源', en: 'Data source' },

  // Loading
  loading: { zh: 'Loading...', en: 'Loading...' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}

export default translations;
