import type { TranscriptSegment } from "./transcribe.js";
import { getDashscopeClient, ANALYSIS_MODEL, stripCodeFences } from "./lib/ai-client.js";

const BASE_JSON_SCHEMA = `{
  "meta": {
    "position": "岗位名称",
    "date": "分析日期",
    "model": "分析模型名称",
    "source": "数据来源"
  },
  "basicInfo": {
    "roles": [
      { "role": "候选人", "speaker": "Speaker 1", "evidence": "判定依据" },
      { "role": "面试官", "speaker": "Speaker 2", "evidence": "判定依据" }
    ],
    "duration": {
      "totalDuration": "~24分41秒",
      "progressPercent": 85,
      "selfIntroEnd": "~67s",
      "formalQARange": "~68s - 1310s",
      "effectiveQADuration": "~20分钟"
    }
  },
  "questions": [
    { "id": "Q1", "text": "问题文本", "type": "预设", "timestamp": "68.1s" }
  ],
  "questionStats": { "preset": 6, "followUp": 8, "clarification": 1 },
  "dialogueChains": [
    {
      "title": "链条 A：职业转型经历",
      "steps": [
        { "type": "question", "label": "Q1 预设", "content": "问题内容" },
        { "type": "answer", "time": "68s~173s", "content": "回答要点" },
        { "type": "trigger", "content": "触发关键词" },
        { "type": "clarification", "label": "Q3 澄清", "content": "澄清内容" }
      ]
    }
  ],
  "focusMap": {
    "topics": [
      { "topic": "话题名称", "depth": "4层", "questions": "Q2 → Q3 → Q4", "level": "极高关注" }
    ],
    "insights": [
      {
        "level": "极高关注",
        "title": "标题",
        "description": "描述",
        "points": ["要点1", "要点2"],
        "coreQuestion": "核心问题（可选）"
      }
    ]
  },
  "candidateSummary": {
    "background": [
      { "label": "主要实习经历", "content": "内容" }
    ],
    "abilities": [
      { "label": "产品思维", "description": "描述" }
    ],
    "risks": [
      { "label": "技术深度有限", "description": "描述" }
    ]
  }`;

const JD_JSON_SCHEMA = `,
  "positionSummary": {
    "responsibilities": ["核心职责1", "核心职责2"],
    "workIntensity": "工作强度描述",
    "keyKPIs": ["KPI1", "KPI2"],
    "teamCulture": "团队氛围描述",
    "requirements": ["硬性要求1", "硬性要求2"],
    "highlights": "JD中的亮点或特殊要求"
  },
  "fitAnalysis": {
    "overallScore": 75,
    "dimensions": [
      { "dimension": "维度名称", "jdRequirement": "JD要求", "candidateEvidence": "候选人面试证据", "score": 80, "comment": "评价" }
    ],
    "strengths": ["优势匹配点1"],
    "gaps": ["差距1"],
    "recommendation": "综合推荐意见"
  }`;

const BASE_STEPS = `你是一位资深的面试分析专家。你的任务是对面试对话转录文本进行深度结构化分析，直接输出JSON格式。

## 分析步骤

### Step 1：角色识别
判断哪个 Speaker 是面试官、哪个是候选人。
判定依据：谁做自我介绍→候选人；谁在提问引导→面试官；谁描述经历→候选人。

### Step 2：面试官问题提取
从面试官的所有发言中提取独立问题。注意：
- 一次发言可能包含多个子问题，需拆分
- 跨多个片段的同一个问题需合并
- 记录每个问题的大致时间点
- **不要遗漏任何问题，宁多勿少**

### Step 3：问题分类
对每个问题判定类型：
- **预设问题**：与候选人前面的回答无关，面试官主动切换话题
- **追问**：由候选人上一轮回答中的某个具体内容触发
- **澄清**：面试官对候选人回答中某个细节没听清或需要确认

### Step 4：回答→追问标注（对话链分析）
这是最重要的部分。按话题将对话组织为**多条独立的链条**（如链条A、链条B...）。

**对话链关键规则（必须严格遵守）：**
1. **逻辑因果是核心**：链条内每一步都必须存在因果关系。触发关键词必须与下一个追问在语义上直接相关——面试官正是因为听到这个关键词才提出追问
2. **每个问题只出现在一条链中**：同一个问题编号不能在多条链条中重复出现
3. **按时间顺序排列**：链条内的问题必须按面试中的实际时间顺序排列，不能跳跃
4. **无因果则断链**：如果面试官的下一个问题与前一个回答无关（即面试官主动切换了话题），这就是一条新链的起点，不要强行把它接在上一条链中
5. **只在追问前放触发关键词**：触发关键词只出现在候选人回答之后且下一个追问之前，表示"这句话引发了追问"。如果回答后面没有追问（面试官换了话题），则不需要触发关键词

每条链条结构：
- 面试官提问 → 候选人回答要点 → [触发关键词] → 面试官追问 → ...
- 对每个追问，必须标注候选人回答中**具体哪句原话**触发了这个追问
- 要展示候选人回答的**关键内容摘要**（不是一句话概括，而是列出要点）
- 对于无追问的话题，也要标注"面试官：接受，一带而过（无追问）"

### Step 5：面试官关注图谱
分析话题深度热力图和面试官的关注等级。
对每个高关注话题**单独分析**面试官在验证什么能力，给出洞察。

### Step 6：候选人表现摘要
提取候选人的关键背景、展现的能力、以及潜在短板/风险点。`;

const STEP_7_JD = `
### Step 7：岗位摘要（从JD中提取）
从提供的岗位描述（JD）中提取以下信息：
- 核心职责：该岗位的主要工作内容
- 工作强度：从JD暗示的工作节奏（如加班、弹性等线索）
- 主要KPI：该岗位的核心考核维度
- 团队氛围：从JD语言风格推断的团队文化
- 硬性要求：学历、技能、经验等门槛
- JD亮点：特殊福利、发展机会等`;

const STEP_8_FIT = `
### Step 8：契合度分析
基于JD要求和候选人在面试中的实际表现，进行多维度人岗匹配分析：
- 对JD中每个核心要求，在面试对话中找到候选人展现的对应证据
- 给出0-100的维度匹配分数和简短评价
- 总结优势匹配点和明显差距
- 给出综合推荐意见（如"强烈推荐"/"推荐"/"待定"/"不推荐"）
- overallScore 是所有维度分数的加权平均（能力权重高于背景）`;

function buildSystemPrompt(options?: { hasJD?: boolean; hasCV?: boolean }): string {
  let steps = BASE_STEPS;
  if (options?.hasJD) {
    steps += STEP_7_JD;
    steps += STEP_8_FIT;
  }

  let jsonSchema = BASE_JSON_SCHEMA;
  if (options?.hasJD) {
    jsonSchema += JD_JSON_SCHEMA;
  }
  jsonSchema += "\n}";

  return `${steps}

## 输出JSON格式

严格按照以下JSON schema输出，不要添加或删除任何字段：

${jsonSchema}

## 字段说明

- meta: 从对话内容推断岗位等元信息，date填当天日期，model填"${ANALYSIS_MODEL}"，source填"转录文本"
- basicInfo.roles: 角色识别结果，含判定依据
- basicInfo.duration: 面试时长统计（从时间戳推算）
- questions: 所有面试官问题列表，type只能是"预设"、"追问"、"澄清"之一
- questionStats: 按类型统计问题数量
- dialogueChains: 对话链分析，每条链条包含多个step
  - step.type只能是: "question", "answer", "trigger", "clarification"
  - question类型的step需要label（如"Q1 预设"）和content
  - answer类型的step需要time（如"68s~173s"）和content（回答要点列表）
  - trigger类型的step只需content（候选人原话中的触发关键词）
  - clarification类型的step需要label和content
  - **trigger必须紧跟在answer后面，且与下一个question/clarification存在因果关系**
  - 每个问题编号只能出现在一条链中，不能跨链重复
  - 如果存在逻辑跳跃（trigger与下一个问题无关），应将无关部分拆分为新链条
- focusMap.topics: 话题深度热力图
- focusMap.insights: 深挖维度分析，一般有2条（极高关注和高关注）
  - points是关键考察点列表
  - coreQuestion是核心问题总结（如果有的话）
- candidateSummary: 候选人背景、能力、风险点${options?.hasJD ? `
- positionSummary: 岗位JD摘要信息
- fitAnalysis: 人岗契合度分析，dimensions为各维度评分，overallScore为加权平均分` : ""}

## 重要要求

- 只输出JSON，不要输出任何其他内容（不要markdown代码块标记）
- 确保JSON格式正确，可以被JSON.parse解析
- 所有文本内容保持中文
- 不要遗漏任何面试官的问题
- 对话链中必须标注具体的触发关键词原话
- 时间点用秒数标注（如 68.1s）
- 候选人回答要展示具体内容，不要笼统概括
- 分析要有洞察性，不要只是复述对话
- dialogueChains中每条链的steps要完整保留所有问答交互`;
}

export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((item) => {
      const s = (item.start_ms / 1000).toFixed(1);
      const e = (item.end_ms / 1000).toFixed(1);
      return `[Speaker ${item.speaker}] ${s}s~${e}s: ${item.text}`;
    })
    .join("\n");
}

export async function analyze(
  transcriptText: string,
  context?: { jdText?: string; cvText?: string },
  onProgress?: (detail: string) => void
): Promise<object> {
  const client = getDashscopeClient();

  onProgress?.(`调用 ${ANALYSIS_MODEL} 分析中...`);

  const hasJD = !!context?.jdText;
  const hasCV = !!context?.cvText;
  const systemPrompt = buildSystemPrompt({ hasJD, hasCV });

  let userMessage = `以下是面试对话转录文本，请按要求进行完整分析并直接输出JSON：\n\n${transcriptText}`;

  if (context?.jdText) {
    userMessage += `\n\n---\n\n## 岗位描述（JD）\n\n${context.jdText}`;
  }
  if (context?.cvText) {
    userMessage += `\n\n---\n\n## 候选人简历（CV）\n\n${context.cvText}`;
  }

  const response = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 20000,
  });

  const usage = response.usage;
  if (usage) {
    console.log(
      `  Token: 输入 ${usage.prompt_tokens} + 输出 ${usage.completion_tokens} = ${usage.total_tokens}`
    );
  }

  const raw = stripCodeFences(response.choices[0].message.content?.trim() || "");
  return JSON.parse(raw);
}
