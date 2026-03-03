# Interview Notes - 面试对话分析系统

## 项目目标

**逆向还原面试的对话决策树** — 面试不是线性问答，面试官有预设问题线，但会根据候选人回答随时分叉追问。本项目的核心价值在于还原这个对话博弈结构。

### Pipeline

```
录音 (.m4a)
  → 讯飞 ASR v2 转写 + 说话人分离
    → 结构化 JSON（speaker / time / text）
      → AI 分析层：角色识别 → 问题提取 → 对话链分析 → 标注报告
```

---

## 技术栈

- **语音转写**：讯飞录音文件转写大模型版（raasr v2）
- **AI 分析**：Claude API（Anthropic）
- **语言**：Python 3

---

## 凭证管理

所有 API 凭证统一存放在 `config.py`（已 gitignore），代码通过 `from config import ...` 引用。

```python
# config.py 中包含：
XFYUN_APP_ID      # 讯飞 APPID
XFYUN_API_KEY      # 讯飞 APIKey（accessKeyId）
XFYUN_API_SECRET   # 讯飞 APISecret（签名密钥）
ZHIPU_API_KEY      # 智谱 GLM-4.7 API Key（余额不足，暂不可用）
DASHSCOPE_API_KEY  # 阿里云百炼 API Key（qwen 系列，有免费额度）
```

---

## 讯飞 ASR v2 接口（大模型版）

- **上传**：`POST https://office-api-ist-dx.iflyaisol.com/v2/upload`
- **查询**：`POST https://office-api-ist-dx.iflyaisol.com/v2/getResult`

### 签名规则

```
1. 所有请求参数（不含 signature）按 key 字典序排序
2. URL-encode 每对 k=v，用 & 拼接成 baseString
3. signature = Base64(HmacSHA1(baseString, APISecret))
4. signature 放在 HTTP 请求头中，其他参数放 query string
```

### 上传关键参数

```
appId, accessKeyId, dateTime（yyyy-MM-ddTHH:mm:ss+0800）,
signatureRandom（16位随机字母数字）, fileName, fileSize,
duration（毫秒）, language=autodialect, roleType=1（说话人分离）
```

### 上传请求格式

```
Header: Content-Type: application/octet-stream
Header: signature: <计算值>
Body: 音频文件二进制内容
```

### 状态码

| status | 含义 |
|--------|------|
| 3 | 转写中 |
| 4 | 完成，可取结果 |

### 结果结构

```json
content.orderResult → JSON字符串 → 解析后取 lattice[]
lattice[].json_1best → JSON字符串 → st.bg/ed/rl/rt
rt[].ws[].cw[].w → 拼接得到文本
st.rl → 说话人编号（"1" 或 "2"）
```

### 最终输出格式

```json
[
  { "speaker": "1", "start_ms": 0, "end_ms": 12750, "text": "..." },
  { "speaker": "2", "start_ms": 68100, "end_ms": 83200, "text": "..." }
]
```

---

## 项目文件

| 文件 | 说明 |
|------|------|
| `transcribe.py` | 讯飞 ASR v2 转写脚本（上传→轮询→解析→保存 JSON） |
| `讯飞语音转写API调用说明.md` | 完整 API 文档（含两个版本） |
| `小米创新AI产品经理.m4a` | 示例面试录音（约25分钟，双人对话） |
| `小米创新AI产品经理_transcript.json` | 对应转写结果（结构化 JSON） |
| `analyze.py` | AI 分析脚本（阿里云百炼 qwen-plus） |
| `*_analysis.md` | 分析输出 Markdown 报告 |
| `config.py` | 敏感凭证（gitignore，不入库） |
| `.gitignore` | Git 忽略规则 |

---

## AI 分析层（待实现）

### 输入 / 输出

- **输入**：`_transcript.json`（带 speaker 标注的对话 JSON）
- **输出**：结构化分析报告（JSON + Markdown）

### 分析步骤

#### Step 1：角色识别（Interviewer vs Interviewee）

ASR 只给 `"1"` / `"2"`，需要 AI 判断谁是面试官、谁是候选人。
判定依据：
- 谁先做自我介绍 → 候选人
- 谁在提问 → 面试官
- 谁在描述经历 → 候选人
- 语气模式：面试官多用"想问一下"、"讲一下"等引导句

#### Step 2：面试官问题提取

从面试官的所有发言中提取**独立问题**，合并跨片段的问题。
一次发言可能包含多个子问题或铺垫，需要归纳为清晰的问题描述。

#### Step 3：问题分类 — 对话链分析

对每个面试官问题判定来源类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| **预设问题** | 与前文回答无关，面试官主动切换话题 | "最近有没有看到有意思的AI应用？" |
| **追问** | 由候选人上一轮回答中的某个点触发 | 候选人提到评测工作 → "详细讲讲评测标准的制定思路" |
| **澄清** | 面试官没听清或需要确认 | "这个真的有用户会这么问问题吗？" |

#### Step 4：回答 → 追问 标注

对候选人每段回答标注：
- 是否触发了面试官的追问
- 具体是回答中的哪句话 / 哪个关键词引起了追问
- 面试官追问了什么

```
示例标注：
[候选人回答] "...我主导了用户访谈..."
  ↳ 触发追问 → 面试官："一分率是怎么得出来的？是评测团队评的还是用户反馈？"
  ↳ 触发关键词："一分率比较低"

[候选人回答] "...有做一个个人网页...最近在做另一个东西..."
  ↳ 触发追问 → 面试官："最近做的是什么类型的产品？"
  ↳ 触发关键词："最近在做另一个东西"
```

#### Step 5：面试官关注图谱

从问题链中提炼面试官的关注维度和深入程度：
- 哪些话题被追问了多层（高关注）
- 哪些话题一带而过（低关注 / 已满意）
- 面试官的提问节奏变化

### 输出结构（规划）

```json
{
  "roles": {
    "interviewer": "Speaker 2",
    "interviewee": "Speaker 1"
  },
  "questions": [
    {
      "id": 1,
      "type": "预设",
      "text": "转型到AI产品有遇到什么困难吗？",
      "time_range": "68.1s ~ 98.6s",
      "triggered_by": null
    },
    {
      "id": 2,
      "type": "追问",
      "text": "详细讲讲评测标准的制定思路",
      "time_range": "173.6s ~ 198.4s",
      "triggered_by": {
        "answer_id": 1,
        "trigger_text": "我主要做了评测相关的工作",
        "trigger_keyword": "评测"
      }
    }
  ],
  "answer_annotations": [
    {
      "answer_id": 1,
      "speaker": "interviewee",
      "time_range": "100.3s ~ 173.6s",
      "triggers_question": 2,
      "trigger_excerpt": "我主要做了评测相关的工作"
    }
  ],
  "interviewer_focus": [
    { "topic": "产品评测能力", "depth": 3, "questions": [2, 5, 7] },
    { "topic": "AI应用认知", "depth": 1, "questions": [9] }
  ]
}
```

### 技术方案

- **分析模型**：阿里云百炼 qwen-plus（OpenAI SDK 兼容）
- 对话文本（~25分钟 ≈ 8000 token 输入），qwen-plus 完全够用
- Prompt 策略：system prompt 定义 5 步分析框架 + 输出格式，一次调用完成全部分析
- 支持批量处理：`python analyze.py` 自动扫描所有 `*_transcript.json`
- 实测 token 用量：输入 ~8600 + 输出 ~3400 = ~12000 总计

### 阿里云百炼调用方式

通过 OpenAI SDK 兼容接口：

```python
from openai import OpenAI
from config import DASHSCOPE_API_KEY

client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

response = client.chat.completions.create(
    model="qwen-plus",
    messages=[{"role": "user", "content": "..."}],
    temperature=0.3,
    max_tokens=16000,
)
```

可用模型：`qwen-plus`（推荐）、`qwen-turbo`（快速）、`qwen-max`（最强）
安装依赖：`pip install openai`

---

## 注意事项

- 讯飞大模型版服务时长从**试用配额**中扣除，注意余量
- 音频必须提供准确的 `duration`（毫秒），用 ffprobe 获取
- `roleType=1` 为双人说话人分离；`roleType=3` 为多人
- 结果 JSON 中 speaker 字段为字符串 `"1"` / `"2"`，不是整数
