#!/usr/bin/env python3
"""面试对话分析脚本 — 基于阿里云百炼 qwen-plus 模型"""

import json
import sys
import os
from openai import OpenAI
from config import DASHSCOPE_API_KEY

client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

MODEL = "qwen-plus"

REFERENCE_REPORT = open(
    os.path.join(os.path.dirname(__file__) or ".", "reference_analysis.md"),
    "r", encoding="utf-8"
).read()

SYSTEM_PROMPT = f"""你是一位资深的面试分析专家。你的任务是对面试对话转录文本进行深度结构化分析。

## 分析步骤

### Step 1：角色识别
判断哪个 Speaker 是面试官、哪个是候选人。
判定依据：谁做自我介绍→候选人；谁在提问引导→面试官；谁描述经历→候选人。
输出格式：用表格展示角色、Speaker 编号、判定依据。

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
这是最重要的部分。按话题将对话组织为**多条独立的链条**（如链条A、链条B...），每条链条内部用 code block 展示：
- 面试官提问 → 候选人回答要点 → [触发关键词] → 面试官追问 → ...
- 对每个追问，必须标注候选人回答中**具体哪句原话**触发了这个追问
- 要展示候选人回答的**关键内容摘要**（不是一句话概括，而是列出要点）
- 对于无追问的话题，也要标注"面试官：接受，一带而过（无追问）"

### Step 5：面试官关注图谱
用表格展示话题深度热力图：话题 | 追问层数 | 涉及问题编号 | 关注等级
然后对每个高关注话题**单独分析**面试官在验证什么能力，给出洞察。

## 输出格式要求

严格按以下 Markdown 结构输出：

# 面试对话分析报告
（顶部：岗位、分析日期等元信息）

## 一、基本信息
### 角色识别（表格）
### 面试时长（表格：开始、结束、自我介绍结束、有效问答时长等）

## 二、面试官问题列表
（表格：编号 | 问题文本（整合后）| 时间点 | 类型）
底部统计：预设X个、追问X个、澄清X个

## 三、对话链分析
每条链条用 ### 标题 + code block，内部用箭头和缩进展示层级

## 四、面试官关注图谱
### 话题深度热力图（表格）
### 深挖维度分析（对每个关注等级单独分析）

## 五、候选人表现摘要
### 关键背景（表格）
### 主要经历与成果
### 展现能力（表格）
### 潜在短板/风险点（表格）

## 重要要求
- 用中文输出
- 不要遗漏任何面试官的问题
- 对话链中必须标注具体的触发关键词原话，用引号括起来
- 时间点用秒数标注（如 68.1s）
- 候选人回答要展示具体内容，不要笼统概括
- 分析要有洞察性，不要只是复述对话

## 参考示例

以下是一份高质量的分析报告示例，请严格模仿其格式、深度和分析质量：

{REFERENCE_REPORT}
"""


def load_transcript(path: str) -> str:
    """读取 transcript JSON 并格式化为对话文本"""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    lines = []
    for item in data:
        speaker = item.get("speaker", "?")
        start = item["start_ms"] / 1000
        end = item["end_ms"] / 1000
        text = item["text"]
        lines.append(f"[Speaker {speaker}] {start:.1f}s~{end:.1f}s: {text}")

    return "\n".join(lines)


def analyze(transcript_text: str) -> str:
    """调用 LLM 分析面试对话"""
    print(f"发送分析请求（模型: {MODEL}）...")

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"以下是面试对话转录文本，请按要求进行完整分析：\n\n{transcript_text}"},
        ],
        temperature=0.3,
        max_tokens=16000,
    )

    usage = response.usage
    print(f"Token 用量 — 输入: {usage.prompt_tokens}, 输出: {usage.completion_tokens}, 总计: {usage.total_tokens}")

    return response.choices[0].message.content


def main():
    if len(sys.argv) < 2:
        # 默认处理当前目录下所有 _transcript.json
        import glob
        files = glob.glob(os.path.join(os.path.dirname(__file__) or ".", "*_transcript.json"))
        if not files:
            print("用法: python analyze.py <transcript.json>")
            sys.exit(1)
    else:
        files = [sys.argv[1]]

    for transcript_path in files:
        print(f"\n{'='*60}")
        print(f"分析: {os.path.basename(transcript_path)}")
        print(f"{'='*60}")

        transcript_text = load_transcript(transcript_path)
        print(f"对话片段数: {transcript_text.count('[Speaker')}")

        result = analyze(transcript_text)

        # 输出路径：xxx_transcript.json → xxx_analysis.md
        output_path = transcript_path.replace("_transcript.json", "_analysis.md")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(result)

        print(f"分析报告已保存: {output_path}")


if __name__ == "__main__":
    main()
