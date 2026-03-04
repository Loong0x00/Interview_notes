import OpenAI from "openai";

export const ANALYSIS_MODEL = "qwen-plus";
export const FAST_MODEL = "qwen-turbo";

const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

let client: OpenAI | null = null;

export function getDashscopeClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: BASE_URL,
    });
  }
  return client;
}

/**
 * Strip markdown code fences (```json ... ```) from AI response text.
 */
export function stripCodeFences(text: string): string {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    const firstNewline = raw.indexOf("\n");
    raw = raw.slice(firstNewline + 1);
    if (raw.endsWith("```")) {
      raw = raw.slice(0, -3).trim();
    }
  }
  return raw;
}
