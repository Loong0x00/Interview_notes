#!/usr/bin/env python3
"""面试分析完整 Pipeline：音频 → 转写 → AI 分析 → Markdown 报告"""

import hashlib
import hmac
import base64
import time
import random
import string
import math
import os
import sys
import json
import subprocess
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
from openai import OpenAI
from config import XFYUN_APP_ID, XFYUN_API_KEY, XFYUN_API_SECRET, DASHSCOPE_API_KEY

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

UPLOAD_URL = "https://office-api-ist-dx.iflyaisol.com/v2/upload"
RESULT_URL = "https://office-api-ist-dx.iflyaisol.com/v2/getResult"

ANALYSIS_MODEL = "qwen-plus"
ANALYSIS_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

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


# ═══════════════════════════════════════════════════════════════
# Step 1: 讯飞 ASR v2 转写
# ═══════════════════════════════════════════════════════════════

import requests


def xfyun_datetime():
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S+0800")


def xfyun_rand(n=16):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=n))


def xfyun_signature(params: dict) -> str:
    pairs = sorted(
        [(k, v) for k, v in params.items() if k != "signature" and v],
        key=lambda x: x[0]
    )
    base_string = "&".join(
        f"{quote(str(k), safe='')}={quote(str(v), safe='')}"
        for k, v in pairs
    )
    return base64.b64encode(
        hmac.new(XFYUN_API_SECRET.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()


def xfyun_params(extra: dict) -> tuple[dict, str]:
    params = {
        "appId": XFYUN_APP_ID,
        "accessKeyId": XFYUN_API_KEY,
        "dateTime": xfyun_datetime(),
        "signatureRandom": xfyun_rand(),
    }
    params.update(extra)
    sig = xfyun_signature(params)
    return params, sig


def get_duration_ms(path: str) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return int(float(data["format"]["duration"]) * 1000)


def transcribe(audio_path: str) -> list:
    """完整转写流程：上传 → 轮询 → 解析"""
    file_name = os.path.basename(audio_path)
    file_size = os.path.getsize(audio_path)
    duration_ms = get_duration_ms(audio_path)
    print(f"  文件: {file_name}  大小: {file_size/1024/1024:.1f}MB  时长: {duration_ms/1000:.0f}s")

    # 上传
    params, sig = xfyun_params({
        "fileName": file_name,
        "fileSize": str(file_size),
        "duration": str(duration_ms),
        "language": "autodialect",
        "roleType": "1",
    })

    print("  上传音频...")
    with open(audio_path, "rb") as f:
        resp = requests.post(
            UPLOAD_URL, params=params, data=f,
            headers={"Content-Type": "application/octet-stream", "signature": sig},
        )

    upload_result = resp.json()
    if upload_result.get("code") != "000000":
        raise RuntimeError(f"上传失败: {upload_result}")

    order_id = upload_result["content"]["orderId"]
    estimate = upload_result["content"].get("taskEstimateTime", 0) / 1000
    print(f"  orderId: {order_id}  预计: {estimate:.0f}s")

    # 轮询
    print("  等待转写...", end="", flush=True)
    for attempt in range(100):
        time.sleep(15)
        params, sig = xfyun_params({"orderId": order_id, "resultType": "transfer"})
        resp = requests.post(RESULT_URL, params=params, headers={"signature": sig})
        result = resp.json()
        code = result.get("code")
        status = result.get("content", {}).get("orderInfo", {}).get("status")
        print(".", end="", flush=True)

        if code == "000000" and status == 4:
            print(" 完成!")
            break
        if code not in ("000000", "26682"):
            raise RuntimeError(f"转写异常: {result}")
    else:
        raise RuntimeError("转写超时（超过100次轮询）")

    # 解析
    order_result_raw = result["content"]["orderResult"]
    if isinstance(order_result_raw, str):
        order_result = json.loads(order_result_raw)
    else:
        order_result = order_result_raw

    structured = []
    for item in order_result.get("lattice", []):
        seg = json.loads(item.get("json_1best", "{}"))
        st = seg.get("st", {})
        text = "".join(
            cw.get("w", "")
            for rt in st.get("rt", [])
            for ws in rt.get("ws", [])
            for cw in ws.get("cw", [])
        )
        if text.strip():
            structured.append({
                "speaker": st.get("rl", "0"),
                "start_ms": int(st.get("bg", 0)),
                "end_ms": int(st.get("ed", 0)),
                "text": text,
            })

    print(f"  转写片段数: {len(structured)}")
    return structured


# ═══════════════════════════════════════════════════════════════
# Step 2: AI 分析
# ═══════════════════════════════════════════════════════════════

def format_transcript(data: list) -> str:
    lines = []
    for item in data:
        s = item["start_ms"] / 1000
        e = item["end_ms"] / 1000
        lines.append(f"[Speaker {item['speaker']}] {s:.1f}s~{e:.1f}s: {item['text']}")
    return "\n".join(lines)


def analyze(transcript_text: str) -> str:
    client = OpenAI(api_key=DASHSCOPE_API_KEY, base_url=ANALYSIS_BASE_URL)
    print(f"  调用 {ANALYSIS_MODEL} 分析中...")
    response = client.chat.completions.create(
        model=ANALYSIS_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"以下是面试对话转录文本，请按要求进行完整分析：\n\n{transcript_text}"},
        ],
        temperature=0.3,
        max_tokens=16000,
    )
    usage = response.usage
    print(f"  Token: 输入 {usage.prompt_tokens} + 输出 {usage.completion_tokens} = {usage.total_tokens}")
    return response.choices[0].message.content


# ═══════════════════════════════════════════════════════════════
# Pipeline
# ═══════════════════════════════════════════════════════════════

def run(audio_path: str):
    base_name = os.path.splitext(audio_path)[0]
    transcript_path = f"{base_name}_transcript.json"
    analysis_path = f"{base_name}_analysis.md"

    print(f"\n{'='*60}")
    print(f"Pipeline: {os.path.basename(audio_path)}")
    print(f"{'='*60}")

    # Step 1: 转写（如果已有 transcript 则跳过）
    if os.path.exists(transcript_path):
        print(f"\n[1/2] 转写 — 已存在，跳过: {os.path.basename(transcript_path)}")
        with open(transcript_path, "r", encoding="utf-8") as f:
            transcript_data = json.load(f)
    else:
        print(f"\n[1/2] 转写 — 开始")
        transcript_data = transcribe(audio_path)
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, ensure_ascii=False, indent=2)
        print(f"  已保存: {os.path.basename(transcript_path)}")

    # Step 2: 分析
    print(f"\n[2/2] AI 分析")
    transcript_text = format_transcript(transcript_data)
    report = analyze(transcript_text)
    with open(analysis_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"  已保存: {os.path.basename(analysis_path)}")

    print(f"\n{'='*60}")
    print(f"完成! 输出文件:")
    print(f"  转写: {transcript_path}")
    print(f"  分析: {analysis_path}")
    print(f"{'='*60}\n")


def main():
    if len(sys.argv) < 2:
        # 默认扫描当前目录下所有音频文件
        import glob
        audio_exts = ("*.m4a", "*.mp3", "*.wav", "*.flac", "*.mp4", "*.aac")
        files = []
        for ext in audio_exts:
            files.extend(glob.glob(os.path.join(os.path.dirname(__file__) or ".", ext)))
        if not files:
            print("用法: python pipeline.py <音频文件>")
            print("  或将音频文件放在当前目录，直接运行 python pipeline.py")
            sys.exit(1)
    else:
        files = sys.argv[1:]

    for audio_path in files:
        run(audio_path)


if __name__ == "__main__":
    main()
