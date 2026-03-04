import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import type { TranscriptSegment } from "./transcribe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Parse a transcript file into normalized TranscriptSegment[].
 * Supports: JSON, SRT, VTT, TXT, DOCX (Feishu/DingTalk/Tencent Meeting formats).
 * Falls back to AI parsing if deterministic parsing yields too few segments.
 */
export async function parseTranscriptFile(filePath: string, ext: string): Promise<TranscriptSegment[]> {
  const normalized = ext.toLowerCase().replace(/^\./, "");
  let content: string;
  let segments: TranscriptSegment[];

  if (normalized === "docx") {
    // Binary format: use mammoth to extract raw text, then parse as TXT
    const result = await mammoth.extractRawText({ path: filePath });
    content = result.value;
    segments = parseTXT(content);
  } else {
    content = fs.readFileSync(filePath, "utf-8");

    switch (normalized) {
      case "json":
        segments = parseJSON(content);
        break;
      case "srt":
        segments = parseSRT(content);
        break;
      case "vtt":
        segments = parseVTT(content);
        break;
      case "txt":
        segments = parseTXT(content);
        break;
      default:
        segments = parseTXT(content);
        break;
    }
  }

  // AI fallback: if deterministic parsing yields <3 segments from a substantial file
  if (segments.length < 3 && content.length > 200) {
    console.log(`[parseTranscript] Only ${segments.length} segments from ${content.length} chars, trying AI fallback...`);
    return aiParse(content);
  }

  return segments;
}

// ─── JSON ──────────────────────────────────────────────────────

function parseJSON(content: string): TranscriptSegment[] {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }

  // If already TranscriptSegment[]
  if (Array.isArray(data) && data.length > 0 && isTranscriptSegment(data[0])) {
    return data.map(normalizeSpeaker);
  }

  // If wrapped in an object with an array field
  if (data && typeof data === "object" && !Array.isArray(data)) {
    // Try common wrapper keys
    for (const key of ["segments", "results", "data", "transcript", "content"]) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        if (isTranscriptSegment(data[key][0])) {
          return data[key].map(normalizeSpeaker);
        }
      }
    }

    // Feishu/Lark meeting minutes API format
    if (Array.isArray(data.sentences)) {
      return parseFeishuJSON(data.sentences);
    }
  }

  return [];
}

function isTranscriptSegment(obj: any): boolean {
  return (
    obj &&
    typeof obj === "object" &&
    "speaker" in obj &&
    "start_ms" in obj &&
    "end_ms" in obj &&
    "text" in obj
  );
}

function parseFeishuJSON(sentences: any[]): TranscriptSegment[] {
  const speakerMap = new Map<string, string>();
  let nextId = 1;

  return sentences
    .filter((s: any) => s.text?.trim())
    .map((s: any) => {
      const name = s.speaker || s.speaker_name || s.username || "Unknown";
      if (!speakerMap.has(name)) {
        speakerMap.set(name, String(nextId++));
      }
      return {
        speaker: speakerMap.get(name)!,
        start_ms: s.start_ms ?? s.start_time ?? Math.floor((s.start || 0) * 1000),
        end_ms: s.end_ms ?? s.end_time ?? Math.floor((s.end || 0) * 1000),
        text: s.text.trim(),
      };
    });
}

function normalizeSpeaker(seg: any): TranscriptSegment {
  return {
    speaker: String(seg.speaker),
    start_ms: Number(seg.start_ms),
    end_ms: Number(seg.end_ms),
    text: String(seg.text),
  };
}

// ─── SRT ───────────────────────────────────────────────────────

function parseSRT(content: string): TranscriptSegment[] {
  const blocks = content.trim().split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, string>();
  let nextId = 1;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Line 1: index (skip)
    // Line 2: timecode
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) continue;

    const startMs = parseTimeToMs(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const endMs = parseTimeToMs(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

    // Line 3+: text content, possibly with speaker prefix
    const textLines = lines.slice(2).join(" ").trim();
    const { speaker, text } = extractSpeaker(textLines);

    if (!text) continue;

    if (!speakerMap.has(speaker)) {
      speakerMap.set(speaker, String(nextId++));
    }

    segments.push({
      speaker: speakerMap.get(speaker)!,
      start_ms: startMs,
      end_ms: endMs,
      text,
    });
  }

  return segments;
}

// ─── VTT ───────────────────────────────────────────────────────

function parseVTT(content: string): TranscriptSegment[] {
  // Remove WEBVTT header and NOTE blocks
  const body = content.replace(/^WEBVTT[^\n]*\n/, "").replace(/^NOTE[^\n]*\n(?:[^\n]+\n)*/gm, "");
  const blocks = body.trim().split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, string>();
  let nextId = 1;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // Find the timecode line
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx < 0) continue;

    const timeMatch = lines[timeLineIdx].match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );
    // Also support MM:SS.mmm format
    const timeMatchShort = !timeMatch
      ? lines[timeLineIdx].match(
          /(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2})[.,](\d{3})/
        )
      : null;

    let startMs: number, endMs: number;
    if (timeMatch) {
      startMs = parseTimeToMs(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      endMs = parseTimeToMs(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    } else if (timeMatchShort) {
      startMs = parseTimeToMs("00", timeMatchShort[1], timeMatchShort[2], timeMatchShort[3]);
      endMs = parseTimeToMs("00", timeMatchShort[4], timeMatchShort[5], timeMatchShort[6]);
    } else {
      continue;
    }

    let textLines = lines.slice(timeLineIdx + 1).join(" ").trim();

    // VTT <v name> tag
    let speaker = "Unknown";
    const vMatch = textLines.match(/^<v\s+([^>]+)>/);
    if (vMatch) {
      speaker = vMatch[1].trim();
      textLines = textLines.replace(/<v\s+[^>]+>/, "").replace(/<\/v>/g, "").trim();
    } else {
      const extracted = extractSpeaker(textLines);
      speaker = extracted.speaker;
      textLines = extracted.text;
    }

    if (!textLines) continue;

    if (!speakerMap.has(speaker)) {
      speakerMap.set(speaker, String(nextId++));
    }

    segments.push({
      speaker: speakerMap.get(speaker)!,
      start_ms: startMs,
      end_ms: endMs,
      text: textLines,
    });
  }

  return segments;
}

// ─── TXT (Feishu / DingTalk / Tencent Meeting / DOCX inline) ──

function parseTXT(content: string): TranscriptSegment[] {
  // Try inline format first: "说话人 N HH:MM:SS text_on_same_line"
  const inlineSegments = parseTxtInline(content);
  if (inlineSegments.length >= 3) {
    return inlineSegments;
  }

  // Fall back to Feishu/DingTalk multi-line format
  return parseTxtMultiline(content);
}

/**
 * Inline format: "说话人 N HH:MM:SS text" - speaker name, number, timestamp, and text all on one line.
 * Common in .docx meeting transcripts.
 */
function parseTxtInline(content: string): TranscriptSegment[] {
  const lines = content.split("\n");
  const segments: TranscriptSegment[] = [];

  // Pattern: "说话人 1 00:00:01 好的。听到我声音吗？" or similar
  const inlineRe = /^(.+?)\s+(\d{1,2}):(\d{2}):(\d{2})\s+(.+)$/;

  const speakerMap = new Map<string, string>();
  let nextId = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(inlineRe);
    if (!match) continue;

    const speakerName = match[1].trim();
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3], 10);
    const s = parseInt(match[4], 10);
    const text = match[5].trim();

    if (!text) continue;

    const timeMs = (h * 3600 + m * 60 + s) * 1000;

    if (!speakerMap.has(speakerName)) {
      speakerMap.set(speakerName, String(nextId++));
    }

    segments.push({
      speaker: speakerMap.get(speakerName)!,
      start_ms: timeMs,
      end_ms: timeMs, // will be patched
      text,
    });
  }

  // Patch end_ms
  for (let i = 0; i < segments.length; i++) {
    if (i < segments.length - 1) {
      segments[i].end_ms = segments[i + 1].start_ms;
    } else {
      segments[i].end_ms = segments[i].start_ms + 30000;
    }
  }

  return segments;
}

/**
 * Multi-line format (Feishu/DingTalk/Tencent Meeting):
 * "名字  HH:MM:SS" or "名字  YYYY-MM-DD HH:MM:SS" header, then content on following lines.
 */
function parseTxtMultiline(content: string): TranscriptSegment[] {
  const lines = content.split("\n");
  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, string>();
  let nextId = 1;

  // Pattern: "名字  HH:MM:SS" or "名字  YYYY-MM-DD HH:MM:SS"
  const headerRe = /^(.+?)\s{2,}(?:\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}):(\d{2}):(\d{2})\s*$/;

  let currentSpeaker: string | null = null;
  let currentTimeMs = 0;
  let contentLines: string[] = [];

  function flush() {
    if (currentSpeaker && contentLines.length > 0) {
      const text = contentLines.join(" ").trim();
      if (text) {
        if (!speakerMap.has(currentSpeaker)) {
          speakerMap.set(currentSpeaker, String(nextId++));
        }
        segments.push({
          speaker: speakerMap.get(currentSpeaker)!,
          start_ms: currentTimeMs,
          end_ms: currentTimeMs, // no end time in TXT format, will be patched
          text,
        });
      }
    }
    contentLines = [];
  }

  for (const line of lines) {
    const match = line.match(headerRe);
    if (match) {
      flush();
      currentSpeaker = match[1].trim();
      const h = parseInt(match[2], 10);
      const m = parseInt(match[3], 10);
      const s = parseInt(match[4], 10);
      currentTimeMs = (h * 3600 + m * 60 + s) * 1000;
    } else {
      const trimmed = line.trim();
      if (trimmed) {
        contentLines.push(trimmed);
      }
    }
  }
  flush();

  // Patch end_ms: set each segment's end to next segment's start, last to start + 30s
  for (let i = 0; i < segments.length; i++) {
    if (i < segments.length - 1) {
      segments[i].end_ms = segments[i + 1].start_ms;
    } else {
      segments[i].end_ms = segments[i].start_ms + 30000;
    }
  }

  return segments;
}

// ─── AI Fallback ───────────────────────────────────────────────

async function aiParse(content: string): Promise<TranscriptSegment[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.log("[parseTranscript] No DASHSCOPE_API_KEY, skipping AI fallback");
    return [];
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  // Truncate to avoid token limits
  const truncated = content.length > 15000 ? content.slice(0, 15000) : content;

  const response = await client.chat.completions.create({
    model: "qwen-turbo",
    messages: [
      {
        role: "system",
        content: `你是一个对话转录文本解析器。将输入的对话文本解析为JSON数组。

输出格式（只输出JSON数组，不要代码块标记）：
[
  {"speaker": "1", "start_ms": 0, "end_ms": 30000, "text": "说话内容"},
  ...
]

规则：
- speaker: 按出场顺序编号为 "1", "2", "3" 等
- start_ms/end_ms: 如果有时间信息就提取，没有就按顺序估算（每段约15-30秒）
- text: 保留原文
- 合并同一人连续的短句`,
      },
      {
        role: "user",
        content: truncated,
      },
    ],
    temperature: 0.1,
    max_tokens: 8000,
  });

  let raw = response.choices[0].message.content?.trim() || "";
  // Strip code fences
  if (raw.startsWith("```")) {
    const firstNewline = raw.indexOf("\n");
    raw = raw.slice(firstNewline + 1);
    if (raw.endsWith("```")) {
      raw = raw.slice(0, -3).trim();
    }
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: any) => s.text?.trim())
        .map((s: any) => ({
          speaker: String(s.speaker || "1"),
          start_ms: Number(s.start_ms || 0),
          end_ms: Number(s.end_ms || 0),
          text: String(s.text).trim(),
        }));
    }
  } catch (e) {
    console.error("[parseTranscript] AI fallback parse error:", e);
  }

  return [];
}

// ─── Helpers ───────────────────────────────────────────────────

function parseTimeToMs(h: string, m: string, s: string, ms: string): number {
  return (
    parseInt(h, 10) * 3600000 +
    parseInt(m, 10) * 60000 +
    parseInt(s, 10) * 1000 +
    parseInt(ms, 10)
  );
}

/**
 * Extract speaker name from text prefix.
 * Supports: "名字：text", "名字: text", "[名字] text", "(名字) text"
 */
function extractSpeaker(text: string): { speaker: string; text: string } {
  // [名字] text
  const bracketMatch = text.match(/^\[([^\]]+)\]\s*(.*)/s);
  if (bracketMatch) {
    return { speaker: bracketMatch[1].trim(), text: bracketMatch[2].trim() };
  }

  // (名字) text
  const parenMatch = text.match(/^\(([^)]+)\)\s*(.*)/s);
  if (parenMatch) {
    return { speaker: parenMatch[1].trim(), text: parenMatch[2].trim() };
  }

  // 名字：text or 名字: text (but name should be short, <20 chars)
  const colonMatch = text.match(/^(.{1,20}?)[：:]\s*(.*)/s);
  if (colonMatch && colonMatch[2].trim()) {
    return { speaker: colonMatch[1].trim(), text: colonMatch[2].trim() };
  }

  return { speaker: "Unknown", text: text.trim() };
}
