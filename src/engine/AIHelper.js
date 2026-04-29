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
async function callModel(prompt, model, maxTokens = null) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please configure your Gemini API Key.');

  const url = `${model}:generateContent?key=${apiKey}`;

  const config = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95
  };
  if (maxTokens) {
    config.maxOutputTokens = maxTokens;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: config
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
 * Analyzes the graph for plot holes.
 */
export async function checkPlotHoles(graphData) {
  const nodes = graphData.nodes || [];
  if (nodes.length < 3) throw new Error('Add at least 3 nodes to analyze plot holes.');

  const graph = nodes.map(n => `- [${n.type}] ${n.title}: ${n.description || ''}`).join('\n');

  const prompt = `Story graph:
${graph}

Analyze the story graph and write a detailed paragraph or two identifying any plot holes, inconsistencies, or narrative dead ends. Provide suggestions on how to fix them. Do NOT use JSON. Write it as a natural, readable response.`;

  return await callModel(prompt, MODEL_STRUCTURED, null);
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
