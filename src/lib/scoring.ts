import Anthropic from "@anthropic-ai/sdk";
import { PROFILE } from "@/config/profile";
import type { NormalizedJob } from "@/lib/sources/types";

export type JobForScoring = Pick<NormalizedJob, "title" | "company" | "location" | "remote" | "description" | "salaryMin" | "salaryMax" | "salaryCurrency">;

export function ruleScore(j: JobForScoring) {
  const text = `${j.title} ${j.description}`;
  const matched = Object.entries(PROFILE.skills).filter(([, re]) => re.test(text)).map(([k]) => k);
  const skills = Math.min(30, matched.length * 5);

  // Experience: first "N years" or "N-M years" mention
  const m = text.match(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)/i);
  let experience = 10, yearsText = "not stated";
  if (m) {
    const min = +m[1], max = m[2] ? +m[2] : undefined; yearsText = `${min}${max ? "-" + max : "+"} years`;
    experience = min > 7 ? 0 : min > 5 ? 4 : (max ?? min) >= 3 || min >= 3 ? 15 : 9;
  }

  const loc = `${j.location}`.toLowerCase();
  const location = /bangalore|bengaluru/.test(loc) ? 10 : j.remote && /india|worldwide|anywhere|global|apac|asia/.test(loc + " india") && !/(usa|us only|united states|canada|uk only|europe|eu only)/.test(loc) ? 9
    : /india/.test(loc) ? 7 : j.remote && !/(usa|us only|united states|canada|uk only|europe|eu only)/.test(loc) ? 6 : 1;

  let salary = 2;
  if (j.salaryMax && j.salaryCurrency === "INR") {
    const lo = (j.salaryMin ?? j.salaryMax) / 1e5, hi = j.salaryMax / 1e5;
    salary = hi < 8 ? 0 : lo <= PROFILE.salaryLpaMax && hi >= PROFILE.salaryLpaMin ? 5 : 3;
  }
  return { total: skills + experience + location + salary, skills, experience, location, salary, matched, yearsText };
}

type Judgement = { fit: number; frontend_related: boolean; reason: string; red_flags: string[] };

const buildPrompt = (j: JobForScoring) => `You are screening jobs for a web developer with 3-5 years of experience (HTML, CSS, JavaScript, React, Next.js, WordPress, Elementor, Divi, SEO), targeting frontend/web/WordPress roles, based in Bangalore, open to India and international remote.

Job: ${j.title} at ${j.company} (${j.location})
Description: ${j.description.slice(0, 3500)}

Return ONLY JSON: {"fit": 0-40, "frontend_related": true|false, "reason": "one sentence", "red_flags": ["..."]}
fit = how well seniority, responsibilities and stack match this candidate. Penalize roles needing much more experience, unrelated roles, backend/mobile-only roles, and unpaid work.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free option: Google Gemini API (key from aistudio.google.com, no card needed)
async function callGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 400, temperature: 0.2 } }) });
    if (r.status === 429 || r.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`Gemini responded ${r.status}`);
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  }
  throw new Error("Gemini rate limit reached, try again in a minute");
}

// Paid option: Claude
async function callClaude(prompt: string): Promise<string> {
  const r = await new Anthropic().messages.create({ model: "claude-haiku-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] });
  return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export const aiProvider = () => (process.env.GEMINI_API_KEY ? "gemini" : process.env.ANTHROPIC_API_KEY ? "claude" : "none");

async function judge(j: JobForScoring): Promise<Judgement | null> {
  const provider = aiProvider();
  if (provider === "none") return null;
  const text = provider === "gemini" ? await callGemini(buildPrompt(j)) : await callClaude(buildPrompt(j));
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { fit: Math.max(0, Math.min(40, Number(parsed.fit) || 0)), frontend_related: !!parsed.frontend_related,
    reason: String(parsed.reason ?? ""), red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [] };
}

export async function scoreJob(j: JobForScoring) {
  const rules = ruleScore(j), ai = await judge(j);
  if (!ai) {
    // No AI key: rules only, scaled to 100, and non-frontend titles are already filtered upstream
    return { score: Math.min(100, Math.round((rules.total / 60) * 100)), breakdown: { rules, ai: null, mode: "rules-only" } };
  }
  let score = Math.min(100, rules.total + ai.fit);
  if (!ai.frontend_related) score = Math.min(score, 30);
  return { score, breakdown: { rules, ai } };
}

// Generic helper used by contact discovery (and later email writing)
export async function askLLM(prompt: string): Promise<string | null> {
  const p = aiProvider();
  if (p === "none") return null;
  return p === "gemini" ? callGemini(prompt) : callClaude(prompt);
}
