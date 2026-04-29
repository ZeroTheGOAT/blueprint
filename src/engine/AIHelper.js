// ========================================
// AIHelper.js — Multi-Model AI Integration
// ========================================

// Models (Gemma only — Gemini models are overloaded on free tier):
// - Gemma 4 31B: For structured tasks (branches, plot holes). 15 RPM, Unlimited TPM, 1.5K RPD.
// - Gemma 3 27B: For free-form chat. 30 RPM, 15K TPM, 14.4K RPD.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_STRUCTURED = `${API_BASE}/gemma-4-31b-it`;  // JSON tasks (1.5K RPD, unlimited TPM)
const MODEL_CHAT = `${API_BASE}/gemma-3-27b-it`;         // Chat (14.4K RPD)

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
}

export function setApiKey(key) {
  localStorage.setItem('gemini_api_key', key);
}

/**
 * Core API call — returns raw text.
 */
async function callModel(prompt, model, maxTokens = 4096) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please configure your Gemini API Key.');

  const url = `${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI model.');

  return text;
}

/**
 * Extract JSON from Gemma's output.
 * Gemma 4 is a reasoning model — it thinks out loud before answering.
 * This parser handles all of its quirks.
 */
function extractJSON(rawText) {
  // Strategy 1: Look for ```json code blocks
  const codeBlockMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) { /* continue */ }
  }

  // Strategy 2: Look for <output> XML tags
  const outputMatch = rawText.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    try { return JSON.parse(outputMatch[1].trim()); } catch (e) { /* continue */ }
  }

  // Strategy 3: Find ALL balanced JSON objects, test each one
  const candidates = [];
  const stack = [];
  for (let i = 0; i < rawText.length; i++) {
    if (rawText[i] === '{') {
      stack.push(i);
    } else if (rawText[i] === '}' && stack.length > 0) {
      const start = stack.pop();
      const candidate = rawText.substring(start, i + 1);
      if (candidate.includes('"branches"') || candidate.includes('"issues"') || candidate.includes('"title"')) {
        candidates.push(candidate);
      }
    }
  }

  // Try longest candidates first (most likely to be the complete object)
  candidates.sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      // Validate it has the expected structure
      if (parsed.branches || parsed.issues) return parsed;
    } catch (e) { /* try next */ }
  }

  // Strategy 4: Try the raw text directly
  try { return JSON.parse(rawText.trim()); } catch (e) { /* fail */ }

  throw new Error('Failed to parse AI JSON response: ' + rawText.substring(0, 300));
}

/**
 * Generates 3 magic branching options from a target node.
 */
export async function generateMagicBranches(graphData, targetNodeId) {
  const nodes = graphData.nodes || [];
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) throw new Error('Target node not found.');

  const context = nodes.map(n => `- ${n.title}: ${n.description || ''}`).join('\n');

  // Ultra-minimal prompt to reduce reasoning overhead
  const prompt = `Story nodes:
${context}

Branch from: "${targetNode.title}" (${targetNode.description || ''})

Reply with ONLY a JSON object. No explanation. No thinking. Just JSON:
{"branches":[{"title":"...","description":"..."},{"title":"...","description":"..."},{"title":"...","description":"..."}]}`;

  const rawText = await callModel(prompt, MODEL_STRUCTURED, 8192);
  return extractJSON(rawText);
}

/**
 * Analyzes the graph for plot holes.
 */
export async function checkPlotHoles(graphData) {
  const nodes = graphData.nodes || [];
  if (nodes.length < 3) throw new Error('Add at least 3 nodes to analyze plot holes.');

  const graph = nodes.map(n => `- [${n.type}] ${n.title}: ${n.description || ''}`).join('\n');

  const prompt = `Story graph:
${graph}

Find plot holes. Reply with ONLY a JSON object. No explanation. No thinking. Just JSON:
{"issues":[{"severity":"High","title":"...","description":"...","suggestion":"..."}],"overallFeedback":"..."}`;

  const rawText = await callModel(prompt, MODEL_STRUCTURED, 8192);
  return extractJSON(rawText);
}

/**
 * AI Chat — free-form conversation.
 */
export async function chatWithAI(userMessage, graphData) {
  const nodes = graphData.nodes || [];
  const graph = nodes.length > 0
    ? nodes.map(n => `[${n.type}] ${n.title}: ${n.description || ''}`).join('\n')
    : '(No nodes yet)';

  const prompt = `You are a game narrative assistant. The user is designing a story with these nodes:
${graph}

Be concise and creative. Help with story ideas, characters, world-building, dialogue.

User: ${userMessage}`;

  return await callModel(prompt, MODEL_CHAT, 1024);
}
