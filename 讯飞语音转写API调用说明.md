# 讯飞语音转写 API 调用说明

> 整理日期：2026-03-03
> 包含：标准版（v1）+ 大模型版（v2，实际可用版本）

---

## 版本说明

| 版本 | 接口域名 | 试用配额 | 推荐 |
|------|---------|---------|------|
| 标准版 v1 | `raasr.xfyun.cn/api` | **无免费试用** | 否 |
| 大模型版 v2 | `office-api-ist-dx.iflyaisol.com/v2` | **有免费试用** | 推荐 |

> 大模型版文档：https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html

---

## 大模型版 v2（推荐使用）

### 接口地址

- 上传：`POST https://office-api-ist-dx.iflyaisol.com/v2/upload`
- 查询：`POST https://office-api-ist-dx.iflyaisol.com/v2/getResult`

### 签名算法（与 v1 完全不同）

```
1. 取所有请求参数（不含 signature 本身）
2. 按 key 字典序排序
3. 对每对 k=v 分别 URL-encode，用 & 拼接 → baseString
4. signature = Base64(HmacSHA1(baseString, APISecret))
5. signature 放在 HTTP 请求头中，其余参数放 URL query string
```

**Python 实现：**
```python
from urllib.parse import quote
import hashlib, hmac, base64, random, string
from datetime import datetime, timezone, timedelta

def get_datetime():
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).strftime("%Y-%m-%dT%H:%M:%S+0800")

def rand_str(n=16):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=n))

def calc_signature(params: dict, api_secret: str) -> str:
    pairs = sorted(
        [(k, v) for k, v in params.items() if k != "signature" and v],
        key=lambda x: x[0]
    )
    base_string = "&".join(
        f"{quote(str(k), safe='')}={quote(str(v), safe='')}"
        for k, v in pairs
    )
    return base64.b64encode(
        hmac.new(api_secret.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()
```

### 上传参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `appId` | 是 | 应用 ID |
| `accessKeyId` | 是 | APIKey |
| `dateTime` | 是 | `yyyy-MM-ddTHH:mm:ss+0800` |
| `signatureRandom` | 是 | 16位随机字母数字 |
| `fileName` | 是 | 文件名（含后缀） |
| `fileSize` | 是 | 文件字节数（字符串） |
| `duration` | 是 | 音频时长毫秒（字符串，用 ffprobe 获取） |
| `language` | 是 | `autodialect`（自动识别方言）或 `autominor` |
| `roleType` | 否 | `1`=双人说话人分离，`3`=多人，`0`=关闭 |

**请求格式：**
```
Header: Content-Type: application/octet-stream
Header: signature: <calc_signature 计算结果>
Query:  appId=xxx&accessKeyId=xxx&dateTime=...&...
Body:   音频文件二进制内容
```

**上传成功响应：**
```json
{
  "code": "000000",
  "content": {
    "orderId": "DKHJQ20260303...",
    "taskEstimateTime": 259064
  }
}
```

### 查询参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `appId` | 是 | 应用 ID |
| `accessKeyId` | 是 | APIKey |
| `dateTime` | 是 | 同上 |
| `signatureRandom` | 是 | 同上 |
| `orderId` | 是 | 上传返回的订单 ID |
| `resultType` | 否 | `transfer`（转写）/ `translate`（翻译） |

**任务状态码：**

| status | 含义 |
|--------|------|
| 3 | 转写中 |
| **4** | **完成，可取结果** |

### 结果解析

`content.orderResult` 是 JSON 字符串，需二次解析：

```python
import json

def parse_transcript(order_result_str: str) -> list:
    order_result = json.loads(order_result_str)
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
                "speaker": st.get("rl", "0"),   # "1" 或 "2"，字符串
                "start_ms": int(st.get("bg", 0)),
                "end_ms": int(st.get("ed", 0)),
                "text": text,
            })
    return structured
```

**输出格式：**
```json
[
  { "speaker": "1", "start_ms": 0,     "end_ms": 12750, "text": "你好，请问..." },
  { "speaker": "2", "start_ms": 68100, "end_ms": 83200, "text": "嗯，我想问..." }
]
```

### 处理耗时参考

| 音频时长 | 预期耗时 |
|---------|---------|
| < 10 分钟 | < 3 分钟 |
| 10 ~ 30 分钟 | 3 ~ 6 分钟 |
| > 60 分钟 | 10 ~ 20 分钟 |

### 常见错误码（v2）

| 错误码 | 说明 |
|--------|------|
| `000000` | 成功 |
| `100003` | signature is empty（signature 未放在 Header 中） |
| `26601` | 签名验证失败 |
| `26633` | 服务时长不足（需在控制台领取/购买） |
| `26682` | 任务处理中（轮询继续等待） |

---

## 标准版 v1（无免费试用，仅作参考）

> 文档来源：https://www.xfyun.cn/doc/asr/lfasr/API.html

---

## 一、服务概述

- 将长段音频（最长5小时）异步转换为文本
- 基于深度全序列卷积神经网络技术
- 采用**上传 → 等待 → 轮询 → 取结果**的异步模式

### 基本限制

| 项目 | 规格 |
|------|------|
| 协议 | HTTP/HTTPS（强烈推荐 HTTPS） |
| 请求地址 | `raasr.xfyun.cn/api/xxx` |
| 请求方法 | POST |
| 编码 | UTF-8 |
| 支持格式 | wav / flac / opus / m4a / mp3 |
| 采样率 | 16k 或 8k |
| 文件大小 | ≤ 500MB |
| 音频时长 | ≤ 5小时 |
| 结果保存期 | 30天 |
| 查询上限 | 100次 |
| 请求频率 | ≤ 20次/秒 |

---

## 二、签名生成

每次请求都需要携带签名 `signa`，生成步骤如下：

```
1. baseString = app_id + ts（当前 Unix 时间戳，秒级）
2. md5_str   = MD5(baseString)           # 转小写十六进制
3. signa      = Base64(HmacSHA1(md5_str, secret_key))
```

**示例：**
```
app_id     = 595f23df
ts         = 1512041814
baseString = 595f23df1512041814
md5_str    = <MD5结果>
signa      = <Base64(HmacSHA1(...))>
```

**Python 示例代码：**
```python
import hashlib
import hmac
import base64
import time

def get_signa(app_id: str, secret_key: str) -> tuple[str, str]:
    ts = str(int(time.time()))
    base_string = app_id + ts
    md5 = hashlib.md5(base_string.encode()).hexdigest()
    signa = base64.b64encode(
        hmac.new(secret_key.encode(), md5.encode(), hashlib.sha1).digest()
    ).decode()
    return signa, ts
```

---

## 三、调用流程（5步）

```
Step 1: /prepare      预处理，注册任务，获取 task_id
Step 2: /upload       分片上传音频数据
Step 3: /merge        触发合并，开始转写
Step 4: /getProgress  轮询任务状态（等待 status=9）
Step 5: /getResult    获取转写结果
```

---

## 四、各接口详情

### 4.1 预处理接口 `/prepare`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_id` | string | 是 | 应用 ID |
| `signa` | string | 是 | 签名值 |
| `ts` | string | 是 | Unix 时间戳（秒） |
| `file_len` | int | 是 | 文件字节数 |
| `file_name` | string | 是 | 文件名（含后缀，如 audio.mp3） |
| `slice_num` | int | 是 | 分片数量（建议每片10MB） |
| `language` | string | 否 | 语种，默认 `cn`，支持 `en` 等 |
| `has_participle` | bool | 否 | 是否包含分词，默认 false |
| `has_seperate` | bool | 否 | 是否开启说话人分离，默认 false |
| `speaker_number` | int | 否 | 说话人数，0=盲分，1-10=指定，默认 2 |
| `hotWord` | string | 否 | 热词，逗号分隔，最多200个，每个≤16字 |
| `track_mode` | int | 否 | 声道模式，1=不分轨，2=分轨，默认 1 |

**返回：**
```json
{
  "ok": 0,
  "err_no": 0,
  "failed": null,
  "data": "task_id_xxxxxxxx"
}
```

---

### 4.2 分片上传接口 `/upload`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_id` | string | 是 | 应用 ID |
| `signa` | string | 是 | 签名值 |
| `ts` | string | 是 | 时间戳 |
| `task_id` | string | 是 | 预处理返回的任务 ID |
| `slice_id` | string | 是 | 分片序号（从 0 开始） |
| `content` | bytes | 是 | 分片二进制内容 |

> 分片需**按顺序**逐一上传，建议每片大小约 10MB。

---

### 4.3 合并接口 `/merge`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_id` | string | 是 | 应用 ID |
| `signa` | string | 是 | 签名值 |
| `ts` | string | 是 | 时间戳 |
| `task_id` | string | 是 | 任务 ID |

调用成功后服务端开始合并音频并启动转写任务。

---

### 4.4 进度查询接口 `/getProgress`

**请求参数：** 同合并接口。

**任务状态码：**

| 状态码 | 说明 |
|--------|------|
| 0 | 任务创建成功 |
| 1 | 音频上传完成 |
| 2 | 合并完成 |
| 3 | 转写中 |
| 4 | 结果处理中 |
| 5 | 转写完成 |
| **9** | **结果上传完成，可以取结果** |

> 轮询建议间隔：10~30秒，最多查询100次。

---

### 4.5 获取结果接口 `/getResult`

**请求参数：** 同合并接口。

**返回结果结构：**
```json
{
  "ok": 0,
  "data": "[{...}, {...}]"   // JSON 字符串，需再次解析
}
```

**`data` 解析后的结构（句子数组）：**
```json
[
  {
    "bg": 0,
    "ed": 2300,
    "onebest": "你好，请问有什么问题？",
    "speaker": 1,
    "si": 0,
    "wc": 0.98
  },
  {
    "bg": 2500,
    "ed": 5100,
    "onebest": "我想咨询一下退款流程。",
    "speaker": 2,
    "si": 1,
    "wc": 0.95
  }
]
```

**结果字段说明：**

| 字段 | 说明 |
|------|------|
| `bg` | 句子起始时间（毫秒） |
| `ed` | 句子终止时间（毫秒） |
| `onebest` | 转写文本内容 |
| `speaker` | 说话人编号（从1开始，未开启时全为0） |
| `si` | 句子标识符（序号） |
| `wc` | 置信度，范围 [0, 1] |

---

## 五、多人说话人分离

### 开启方式

在 `/prepare` 接口中传入：
```json
{
  "has_seperate": "true",
  "speaker_number": "2"
}
```

### 按说话人整理结果（Python）

```python
import json
from collections import defaultdict

def parse_result(raw_data: str) -> dict:
    sentences = json.loads(raw_data)
    speakers = defaultdict(list)
    for item in sentences:
        speaker_id = item.get("speaker", 0)
        speakers[speaker_id].append({
            "start_ms": item["bg"],
            "end_ms": item["ed"],
            "text": item["onebest"],
            "confidence": item.get("wc", 0)
        })
    return dict(speakers)

# 输出示例：
# {
#   1: [{"start_ms": 0, "end_ms": 2300, "text": "你好，请问有什么问题？", ...}],
#   2: [{"start_ms": 2500, "end_ms": 5100, "text": "我想咨询一下退款流程。", ...}]
# }
```

### 注意事项

- 官方声明：**"说话人分离目前还是测试效果，达不到商用标准"**
- 2人对话（如客服录音）效果相对较好
- 3人以上会议场景准确率明显下降
- `speaker_number=0`（盲分）更不稳定，不推荐生产使用

---

## 六、处理耗时参考

| 音频时长 | 预期返回时间 |
|---------|------------|
| < 10 分钟 | < 3 分钟 |
| 10 ~ 30 分钟 | 3 ~ 6 分钟 |
| 30 ~ 60 分钟 | 6 ~ 10 分钟 |
| > 60 分钟 | 10 ~ 20 分钟 |

---

## 七、常见错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 26601 | 非法应用信息 | 检查 app_id / signa 是否正确 |
| 26602 | 任务 ID 不存在 | 确认 task_id 是否有效 |
| 26603 | 访问频率超限（20次/秒） | 降低请求频率 |
| 26604 | 查询次数超过100次上限 | 减少轮询频率 |
| 26625 | 服务时长不足 | 充值账户 |
| 26640 | 文件上传失败 | 检查网络或重新上传 |

---

## 八、完整调用流程示例（Python 伪代码）

```python
import time
import math
import requests

APP_ID = "your_app_id"
SECRET_KEY = "your_secret_key"
BASE_URL = "https://raasr.xfyun.cn/api"
SLICE_SIZE = 10 * 1024 * 1024  # 10MB

def transcribe(file_path: str) -> list:
    signa, ts = get_signa(APP_ID, SECRET_KEY)

    with open(file_path, "rb") as f:
        audio_data = f.read()

    file_len = len(audio_data)
    slice_num = math.ceil(file_len / SLICE_SIZE)
    file_name = file_path.split("/")[-1]

    # Step 1: 预处理
    resp = requests.post(f"{BASE_URL}/prepare", data={
        "app_id": APP_ID, "signa": signa, "ts": ts,
        "file_len": file_len, "file_name": file_name,
        "slice_num": slice_num,
        "has_seperate": "true", "speaker_number": "2"
    })
    task_id = resp.json()["data"]

    # Step 2: 分片上传
    for i in range(slice_num):
        chunk = audio_data[i * SLICE_SIZE: (i + 1) * SLICE_SIZE]
        signa, ts = get_signa(APP_ID, SECRET_KEY)
        requests.post(f"{BASE_URL}/upload", data={
            "app_id": APP_ID, "signa": signa, "ts": ts,
            "task_id": task_id, "slice_id": str(i), "content": chunk
        })

    # Step 3: 合并
    signa, ts = get_signa(APP_ID, SECRET_KEY)
    requests.post(f"{BASE_URL}/merge", data={
        "app_id": APP_ID, "signa": signa, "ts": ts, "task_id": task_id
    })

    # Step 4: 轮询进度
    for _ in range(100):
        time.sleep(15)
        signa, ts = get_signa(APP_ID, SECRET_KEY)
        resp = requests.post(f"{BASE_URL}/getProgress", data={
            "app_id": APP_ID, "signa": signa, "ts": ts, "task_id": task_id
        }).json()
        if resp.get("data", {}).get("status") == 9:
            break

    # Step 5: 获取结果
    signa, ts = get_signa(APP_ID, SECRET_KEY)
    resp = requests.post(f"{BASE_URL}/getResult", data={
        "app_id": APP_ID, "signa": signa, "ts": ts, "task_id": task_id
    })
    return json.loads(resp.json()["data"])
```
