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

SYSTEM_PROMPT = """你是一位资深的面试分析专家。你的任务是对面试对话转录文本进行深度结构化分析。

## 分析步骤

### Step 1：角色识别
判断哪个 Speaker 是面试官、哪个是候选人。
判定依据：谁做自我介绍→候选人；谁在提问引导→面试官；谁描述经历→候选人。

### Step 2：面试官问题提取
从面试官的所有发言中提取独立问题。注意：
- 一次发言可能包含多个子问题，需拆分
- 跨多个片段的同一个问题需合并
- 记录每个问题的大致时间点

### Step 3：问题分类
对每个问题判定类型：
- **预设问题**：与候选人前面的回答无关，面试官主动切换话题
- **追问**：由候选人上一轮回答中的某个具体内容触发
- **澄清**：面试官对候选人回答中某个细节没听清或需要确认

### Step 4：回答→追问标注
对候选人每段回答标注：
- 是否触发了面试官的追问
- 具体是回答中的哪句话/哪个关键词引起了追问
- 面试官由此追问了什么

### Step 5：面试官关注图谱
从问题链中提炼：
- 哪些话题被追问了多层（高关注）
- 哪些话题一带而过（低关注/已满意）
- 面试官核心验证的是候选人的什么能力

## 输出格式

请用 Markdown 格式输出，包含以下章节：

# 面试对话分析报告

## 一、基本信息
（角色识别结果、面试时长、岗位信息等）

## 二、面试官问题列表
用表格展示：编号 | 问题文本 | 时间点 | 类型（预设/追问/澄清）

## 三、对话链分析
用缩进和箭头展示每条问题链：
- 预设问题 → 候选人回答[标注触发关键词] → 追问 → 回答[标注] → 追问...
- 对每个追问，标注是回答中哪个关键词/哪句话触发的

## 四、面试官关注图谱
用表格展示：话题 | 追问层数 | 涉及问题编号 | 关注等级
然后对每个高关注话题分析面试官在验证什么能力

## 五、候选人表现摘要
- 关键背景信息
- 主要经历与成果
- 展现的核心能力
- 潜在短板/风险点

## 重要要求
- 用中文输出
- 不要遗漏任何面试官的问题
- 对话链分析要标注具体的触发关键词，不要笼统概括
- 时间点用秒数标注（如 68.1s）
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
