import hashlib
import hmac
import base64
import time
import random
import string
import requests
import json
import os
import subprocess
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

from config import XFYUN_APP_ID, XFYUN_API_KEY, XFYUN_API_SECRET

APP_ID            = XFYUN_APP_ID
ACCESS_KEY_ID     = XFYUN_API_KEY
ACCESS_KEY_SECRET = XFYUN_API_SECRET

UPLOAD_URL = "https://office-api-ist-dx.iflyaisol.com/v2/upload"
RESULT_URL = "https://office-api-ist-dx.iflyaisol.com/v2/getResult"
AUDIO_FILE = "/home/user/Interview_notes/小米创新AI产品经理.m4a"


def get_datetime():
    """返回 yyyy-MM-ddTHH:mm:ss+0800 格式的时间"""
    tz_cst = timezone(timedelta(hours=8))
    return datetime.now(tz_cst).strftime("%Y-%m-%dT%H:%M:%S+0800")


def rand_str(n=16):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=n))


def calc_signature(params: dict) -> str:
    """
    签名算法：
    1. 排除 signature 字段，其余参数按 key 自然排序
    2. 对每个 k=v URL编码后用 & 拼接
    3. HMAC-SHA1(baseString, ACCESS_KEY_SECRET) → Base64
    """
    sorted_pairs = sorted(
        [(k, v) for k, v in params.items() if k != "signature" and v is not None and v != ""],
        key=lambda x: x[0]
    )
    base_string = "&".join(
        f"{quote(str(k), safe='')}={quote(str(v), safe='')}"
        for k, v in sorted_pairs
    )
    sig = base64.b64encode(
        hmac.new(
            ACCESS_KEY_SECRET.encode("utf-8"),
            base_string.encode("utf-8"),
            hashlib.sha1
        ).digest()
    ).decode()
    return sig


def build_params(extra: dict) -> tuple[dict, str]:
    """返回 (query_params, signature)，signature 放请求头"""
    params = {
        "appId": APP_ID,
        "accessKeyId": ACCESS_KEY_ID,
        "dateTime": get_datetime(),
        "signatureRandom": rand_str(16),
    }
    params.update(extra)
    signature = calc_signature(params)
    return params, signature


def get_duration_ms(path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return int(float(data["format"]["duration"]) * 1000)


def main():
    file_name    = os.path.basename(AUDIO_FILE)
    file_size    = os.path.getsize(AUDIO_FILE)
    duration_ms  = get_duration_ms(AUDIO_FILE)
    print(f"文件: {file_name}  大小: {file_size/1024/1024:.1f}MB  时长: {duration_ms/1000:.1f}s")

    # ── Step 1: 上传 ─────────────────────────────────────────────
    params, sig = build_params({
        "fileName": file_name,
        "fileSize": str(file_size),
        "duration": str(duration_ms),
        "language": "autodialect",
        "roleType": "1",          # 开启说话人分离（2人）
    })

    print("上传中...")
    with open(AUDIO_FILE, "rb") as f:
        resp = requests.post(
            UPLOAD_URL,
            params=params,
            data=f,
            headers={"Content-Type": "application/octet-stream", "signature": sig},
        )

    print(f"HTTP {resp.status_code}")
    upload_result = resp.json()
    print(f"[upload] {json.dumps(upload_result, ensure_ascii=False)}")

    if upload_result.get("code") != "000000":
        print("上传失败，退出")
        return

    order_id     = upload_result["content"]["orderId"]
    estimate_ms  = upload_result["content"].get("taskEstimateTime", 0)
    print(f"orderId: {order_id}  预计: {estimate_ms/1000:.0f}s")

    # ── Step 2: 轮询结果 ─────────────────────────────────────────
    print("\n等待转写（每15秒查询一次）...")
    for attempt in range(100):
        time.sleep(15)
        params, sig = build_params({"orderId": order_id, "resultType": "transfer"})
        resp = requests.post(RESULT_URL, params=params, headers={"signature": sig})
        result = resp.json()
        code = result.get("code")
        order_info = result.get("content", {}).get("orderInfo", {})
        status = order_info.get("status")
        print(f"  [{attempt+1}] code={code} status={status}")

        if code == "000000" and status == 4:
            print("转写完成！")
            break
        if code not in ("000000", "26682"):
            print(f"异常: {json.dumps(result, ensure_ascii=False)}")
            return
    else:
        print("超时退出")
        return

    # ── Step 3: 解析结果 ─────────────────────────────────────────
    order_result_raw = result.get("content", {}).get("orderResult", "{}")
    if isinstance(order_result_raw, str):
        order_result = json.loads(order_result_raw)
    else:
        order_result = order_result_raw

    lattice = order_result.get("lattice", [])

    structured = []
    for item in lattice:
        json_1best = item.get("json_1best", "{}")
        if isinstance(json_1best, str):
            seg = json.loads(json_1best)
        else:
            seg = json_1best

        st = seg.get("st", {})
        bg = int(st.get("bg", 0))
        ed = int(st.get("ed", 0))
        speaker = st.get("rl", 0)

        text = ""
        for rt in st.get("rt", []):
            for ws in rt.get("ws", []):
                for cw in ws.get("cw", []):
                    text += cw.get("w", "")

        if text.strip():
            structured.append({
                "speaker": speaker,
                "start_ms": bg,
                "end_ms": ed,
                "text": text,
            })

    output_path = AUDIO_FILE.replace(".m4a", "_transcript.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存: {output_path}")

    print("\n===== 转写结果 =====")
    for item in structured:
        t_s = item["start_ms"] / 1000
        t_e = item["end_ms"] / 1000
        print(f"[Speaker {item['speaker']}] {t_s:.1f}s~{t_e:.1f}s: {item['text']}")


if __name__ == "__main__":
    main()
