import { getDashscopeClient, ANALYSIS_MODEL, stripCodeFences } from "./lib/ai-client.js";

const JSON_SCHEMA = `{
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
  }
}`;

const SYSTEM_PROMPT = `你是一个数据转换专家。你的任务是将面试分析报告（Markdown格式）转换为结构化JSON。

## 输出JSON格式

严格按照以下JSON schema输出，不要添加或删除任何字段：

${JSON_SCHEMA}

## 字段说明

- meta: 从报告头部提取岗位、日期等元信息
- basicInfo.roles: 从"角色识别"表格提取
- basicInfo.duration: 从"面试时长"部分提取
- questions: 从"面试官问题列表"表格提取所有问题，type只能是"预设"、"追问"、"澄清"之一
- questionStats: 问题统计
- dialogueChains: 从"对话链分析"提取，每条链条包含多个step
  - step.type只能是: "question", "answer", "trigger", "clarification"
  - question类型的step需要label（如"Q1 预设"）
  - answer类型的step需要time（如"68s~173s"）
  - trigger类型的step只需content
- focusMap.topics: 从"话题深度热力图"表格提取
- focusMap.insights: 从深挖维度分析中提取，每个分析段落一条。一般有2条（极高关注和高关注）
  - insights的level对应"极高关注"或"高关注"
  - points是关键考察点列表
  - coreQuestion是核心问题总结（如果有的话）
- candidateSummary: 从"候选人表现摘要"提取

## 重要要求
- 只输出JSON，不要输出任何其他内容（不要markdown代码块标记）
- 确保JSON格式正确，可以被JSON.parse解析
- 所有文本内容保持中文
- 不要遗漏任何信息
- dialogueChains中每条链的steps要完整保留所有问答交互
`;

export async function convertMdToJson(mdContent: string): Promise<object> {
  const client = getDashscopeClient();
  console.log(`  调用 ${ANALYSIS_MODEL} 转换为结构化JSON...`);

  const response = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请将以下面试分析报告转换为JSON：\n\n${mdContent}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 16000,
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

