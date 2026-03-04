import type { TranscriptSegment } from "./transcribe.js";
import { getDashscopeClient, ANALYSIS_MODEL, stripCodeFences } from "./lib/ai-client.js";

// ═══════════════════════════════════════════════════════════════
// JSON Schema — 基础字段（始终输出）
// ═══════════════════════════════════════════════════════════════

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
        { "type": "answer", "time": "68s~173s", "content": "回答要点（用bullet points列出关键信息）" },
        { "type": "trigger", "content": "候选人原话中的触发关键词", "triggerLogic": "专业边界探测" },
        { "type": "question", "label": "Q2 追问", "content": "追问内容" },
        { "type": "answer", "time": "173s~240s", "content": "回答要点" }
      ]
    }
  ],
  "focusMap": {
    "topics": [
      { "topic": "话题名称", "depth": "4层", "questions": "Q2 → Q3 → Q4", "level": "高关注" }
    ],
    "insights": [
      {
        "level": "高关注",
        "title": "标题",
        "description": "描述",
        "points": ["考察要点1", "考察要点2"],
        "coreQuestion": "核心问题",
        "intention": "面试官真实意图：为什么在这个话题上死磕，背后在验证什么",
        "candidateHighlights": ["候选人在第N层追问中有效防守的具体表现"],
        "candidateWeaknesses": ["候选人在第N层开始逻辑散乱或触及认知盲区的具体表现"],
        "suggestions": ["下次面试的具体可操作改进建议"]
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

// ═══════════════════════════════════════════════════════════════
// JSON Schema — JD 模块（有 JD 时追加）
// ═══════════════════════════════════════════════════════════════

const JD_JSON_SCHEMA = `,
  "positionSummary": {
    "responsibilities": ["JD中列出的核心职责1", "核心职责2"],
    "interviewActualWork": ["面试官口述的实际日常工作1", "实际工作2"],
    "conflictsHighlighted": ["JD要求A，但面试官强调主要做B"],
    "hiddenRequirements": ["JD没写但面试中暴露的隐藏要求（加班文化、特定工具等）"],
    "workIntensity": "工作强度描述",
    "keyKPIs": ["KPI1", "KPI2"],
    "teamCulture": "团队氛围描述",
    "requirements": ["硬性要求1", "硬性要求2"],
    "highlights": "JD中的亮点或特殊要求"
  },
  "fitAnalysis": {
    "overallScore": 75,
    "dimensions": [
      {
        "dimension": "维度名称",
        "jdRequirement": "JD要求",
        "candidateEvidence": "候选人面试证据",
        "score": 80,
        "comment": "一句话评价"
      }
    ],
    "hardSkillMatch": "硬技能匹配分析（专业技能、工具使用）",
    "softSkillMatch": "软技能匹配分析（沟通表达、抗压、协作）",
    "experienceRelevance": "过往经验相关度（行业、项目规模匹配）",
    "strengths": ["优势匹配点1"],
    "gaps": ["差距1"],
    "recommendation": "强烈推荐/推荐/待定/不推荐"
  }`;

// ═══════════════════════════════════════════════════════════════
// Prompt Module A — 基础分析（始终激活）
// ═══════════════════════════════════════════════════════════════

const BASE_STEPS = `你是一位资深的面试行为学专家与数据分析师，精通"对话流（Conversation Flow）"拆解与面试官意图反推。你的任务是对面试对话转录文本进行深度结构化分析，直接输出JSON格式。

## 预处理规则

- 忽略转录文本中的口语化语气词（如"嗯"、"那个"、"就是"）及轻微的语音识别错误，提取核心语义
- 面试官的寒暄（如"好的"、"对对"）和纯陈述性话语不计为提问
- 如果提问过于口语化或冗长，在不改变原意的前提下精简提炼核心问题

## 分析步骤

### Step 1：角色识别
判断哪个 Speaker 是面试官、哪个是候选人。
判定依据：
- 谁在进行自我介绍、详细描述过往经历与项目细节 → **候选人**
- 谁在主导面试流程、抛出新话题、提问引导及深挖细节 → **面试官**

### Step 2：面试官问题提取与分类
从面试官所有发言中提取**实质性问题**（剔除寒暄、语气词和纯陈述），并判定类型：
- **预设**：面试官主动发起的新话题，与候选人前一个回答无关；或脱离简历的假设性情境题（"如果..."、"假设..."）。通常出现在面试开场、一个大话题结束后
- **追问**：紧跟候选人回答，针对回答中的数据、细节、决策原因进行垂直挖掘。问题紧咬上一段话中的某个词或事件
- **澄清**：不带评价色彩的短促提问，仅为消除歧义或确认客观事实（确认时间、名词解释、汇报关系等）

注意：
- 一次发言可能包含多个子问题，需拆分
- 跨多个片段的同一个问题需合并
- 记录每个问题的大致时间点
- 分类时**必须结合候选人的上一段回答**来判定（区分是顺着话头的追问，还是另起炉灶的预设）
- **不要遗漏任何实质性问题**

### Step 3：对话链分析
这是最重要的部分。按话题将对话组织为**多条独立的链条**（链条A、链条B...）。

**链条边界判定：**
- **链条开启**：面试官使用转折词（如"那我们换个话题"）、发起全新的结构化问题、或考查维度发生大跨度切换
- **链条结束**：面试官收回话语权（如"好的"、"了解了"），停止对当前细节下钻，或提出下一个无关联的新问题

**链条内部关键规则（必须严格遵守）：**
1. **逻辑因果是核心**：链条内每一步都必须存在因果关系。触发关键词必须与下一个追问在语义上直接相关——面试官正是因为听到这个关键词才提出追问
2. **每个问题只出现在一条链中**：同一个问题编号不能在多条链条中重复出现
3. **按时间顺序排列**：链条内的问题必须按面试中的实际时间顺序排列
4. **无因果则断链**：如果面试官的下一个问题与前一个回答无关（面试官主动切换话题），这就是新链的起点，不要强行接在上一条链中
5. **只在追问前放触发**：触发关键词只出现在候选人回答之后且有追问的情况下。如果回答后面试官换了话题，则不需要触发关键词

**触发逻辑分类（triggerLogic字段）：**
每个trigger必须标注属于以下哪种追问动机：
- **结果真实性校验**：候选人提到具体数据/业绩，面试官核实是否有水分
- **逻辑断层补全**：候选人叙述跳跃/因果不明，面试官还原思考路径
- **专业边界探测**：候选人抛出专业术语/方法论，面试官测试其专业天花板
- **冲突与人性挖掘**：候选人提到人际摩擦/高压环境，面试官考察情商与性格
- **模糊信息澄清**：候选人使用模糊代词/时间，面试官对齐背景信息

**链条内容要求：**
- 候选人回答要展示**关键内容摘要**（用bullet points列出要点，不是一句话概括）
- 对于无追问的话题，标注"面试官：接受，一带而过（无追问）"

### Step 4：面试官关注图谱
跨链条聚合——不同链条中本质上探讨同一"母题"的追问要合并计算。

**热力等级判定**（按同一话题的累计追问层数）：
- 🔴 **高关注**：累计追问 ≥ 4 层
- 🟡 **中关注**：累计追问 2-3 层
- 🟢 **低关注**：累计追问 0-1 层

对每个高关注和中关注话题，必须输出深度洞察：
- **面试官真实意图**：结合追问层数和触发逻辑，分析该岗位的隐性痛点或候选人暴露的短板，解释为什么面试官在这里死磕
- **候选人高光点**：在哪几层追问中有效防守，用什么素材（数据/框架/案例）赢得了认可
- **候选人失分点**：在第几层开始逻辑散乱、避重就轻或触及认知盲区
- **改进建议**：具体、可操作的下次面试建议（如"需准备一个XX场景下的具体案例"）

### Step 5：候选人表现摘要
提取候选人的关键背景、展现的能力、以及潜在短板/风险点。`;

// ═══════════════════════════════════════════════════════════════
// Prompt Module B — JD 岗位画像（有 JD 时激活）
// ═══════════════════════════════════════════════════════════════

const STEP_JD = `

### Step 6：岗位画像分析（基于JD）
从提供的岗位描述（JD）中提取以下信息：
- **JD核心职责**：JD文本中列出的主要工作内容
- **面试官口述的实际工作**：面试官在对话中描述的真实日常工作（可能与JD不同）
- **冲突高亮**：如果JD描述与面试官口述存在冲突或侧重点不同（如JD写了A，面试官强调主要做B），必须明确指出
- **隐藏要求**：JD中没写，但面试对话中暴露出的隐含要求（加班文化、特定工具、汇报线、团队现状等）
- 工作强度：从JD和面试对话中推断的工作节奏
- 主要KPI：该岗位的核心考核维度
- 团队氛围：从JD语言风格和面试对话推断的团队文化
- 硬性要求：学历、技能、经验等门槛
- JD亮点：特殊福利、发展机会等`;

// ═══════════════════════════════════════════════════════════════
// Prompt Module C — 契合度分析（有 JD 或 CV 时激活）
// ═══════════════════════════════════════════════════════════════

const STEP_FIT = `

### Step 7：契合度分析
基于JD要求和候选人在面试中的实际表现，进行多维度人岗匹配分析：
- **维度拆分**：对JD中每个核心要求，在面试对话中找到候选人展现的对应证据，给出0-100的匹配分数
- **硬技能匹配**：专业技能、工具使用等的匹配度（一句话总结）
- **软技能匹配**：沟通表达、抗压能力、团队协作等的匹配度（一句话总结）
- **经验相关度**：过往行业经验、项目规模的匹配度（一句话总结）
- **优势与差距**：总结优势匹配点和明显差距
- **综合推荐**："强烈推荐"/"推荐"/"待定"/"不推荐"之一
- **overallScore**：所有维度分数的加权平均（能力权重高于背景）

注意：fitAnalysis模块总字数控制精炼，一针见血，不要啰嗦。`;

// ═══════════════════════════════════════════════════════════════
// Prompt 组装器
// ═══════════════════════════════════════════════════════════════

function buildSystemPrompt(options?: { hasJD?: boolean; hasCV?: boolean }): string {
  // 拼接分析步骤
  let steps = BASE_STEPS;
  if (options?.hasJD) {
    steps += STEP_JD;
    steps += STEP_FIT;
  }

  // 拼接 JSON schema
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
  - question类型: 需要label（如"Q1 预设"）和content
  - answer类型: 需要time（如"68s~173s"）和content（回答要点，用bullet points）
  - trigger类型: 需要content（候选人原话）和triggerLogic（追问动机分类）
  - clarification类型: 需要label和content
  - **trigger必须紧跟在answer后面，且与下一个question/clarification存在因果关系**
  - triggerLogic只能是："结果真实性校验"、"逻辑断层补全"、"专业边界探测"、"冲突与人性挖掘"、"模糊信息澄清"之一
  - 每个问题编号只能出现在一条链中，不能跨链重复
  - 如果存在逻辑跳跃，应将无关部分拆分为新链条
- focusMap.topics: 话题深度热力图，level按累计追问层数判定：≥4层="高关注"，2-3层="中关注"，0-1层="低关注"
- focusMap.insights: 对高关注和中关注话题的深度洞察
  - intention: 面试官在该话题上死磕的真实意图
  - candidateHighlights: 候选人有效防守的具体表现（数组）
  - candidateWeaknesses: 候选人失分的具体表现（数组）
  - suggestions: 下次面试的具体改进建议（数组）
  - points: 关键考察要点
  - coreQuestion: 核心问题总结
- candidateSummary: 候选人背景、能力、风险点${options?.hasJD ? `
- positionSummary: 岗位画像
  - interviewActualWork: 面试官口述的实际工作内容（可能与JD不同）
  - conflictsHighlighted: JD与面试实际的冲突点（若无冲突填["无明显冲突"]）
  - hiddenRequirements: JD未写但面试暴露的隐藏要求（若无则填空数组）
- fitAnalysis: 人岗契合度
  - hardSkillMatch/softSkillMatch/experienceRelevance: 各一句话精炼总结
  - dimensions: 各维度评分
  - overallScore: 加权平均分` : ""}

## 重要要求

- 只输出JSON，不要输出任何其他内容（不要markdown代码块标记）
- 确保JSON格式正确，可以被JSON.parse解析
- 所有文本内容保持中文
- 不要遗漏任何面试官的实质性问题（剔除寒暄后）
- 对话链中触发关键词必须是候选人原话，并标注triggerLogic
- 时间点用秒数标注（如 68.1s）
- 候选人回答要展示具体内容要点，不要笼统概括
- 分析要有洞察性，不要只是复述对话
- dialogueChains中每条链的steps要完整保留所有问答交互
- focusMap.insights必须包含intention、candidateHighlights、candidateWeaknesses、suggestions`;
}

// ═══════════════════════════════════════════════════════════════
// 导出函数
// ═══════════════════════════════════════════════════════════════

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
  onProgress?: (detail: string, percent?: number) => void
): Promise<object> {
  const client = getDashscopeClient();

  onProgress?.(`调用 ${ANALYSIS_MODEL} 分析中...`, 15);

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

  // Use a simulated progress timer during LLM call (typical ~60-120s)
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let currentPercent = 15;
  progressTimer = setInterval(() => {
    // Slowly increase from 15% to 85%, decelerating as it gets higher
    if (currentPercent < 85) {
      const increment = Math.max(1, Math.floor((90 - currentPercent) / 15));
      currentPercent = Math.min(85, currentPercent + increment);
      onProgress?.(`${ANALYSIS_MODEL} 生成中...`, currentPercent);
    }
  }, 5000);

  try {
    const response = await client.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 20000,
    });

    if (progressTimer) clearInterval(progressTimer);
    onProgress?.("解析结果中...", 90);

    const usage = response.usage;
    if (usage) {
      console.log(
        `  Token: 输入 ${usage.prompt_tokens} + 输出 ${usage.completion_tokens} = ${usage.total_tokens}`
      );
    }

    const raw = stripCodeFences(response.choices[0].message.content?.trim() || "");
    onProgress?.("分析完成", 100);
    return JSON.parse(raw);
  } catch (err) {
    if (progressTimer) clearInterval(progressTimer);
    throw err;
  }
}
