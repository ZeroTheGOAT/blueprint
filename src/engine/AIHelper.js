// ========================================
// AIHelper.js — Multi-Model AI Integration
// ========================================

// Models:
// - Gemini 3.1 Flash Lite: For structured JSON tasks (branches, plot holes). 15 RPM, 250K TPM, 500 RPD. Native JSON mode.
// - Gemma 3 27B: For free-form chat. 30 RPM, 15K TPM, 14.4K RPD.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_JSON = `${API_BASE}/gemini-3.1-flash-lite-preview`;  // Structured output (500 RPD)
const MODEL_CHAT = `${API_BASE}/gemma-3-27b-it`;                  // Free-form chat (14.4K RPD)

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
}

export function setApiKey(key) {
  localStorage.setItem('gemini_api_key', key);
}

/**
 * Call a model that supports native JSON output mode.
 * Returns a parsed JSON object directly.
 */
async function callJSON(prompt, maxTokens = 2048) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please configure your Gemini API Key.');

  const url = `${MODEL_JSON}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json'
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

  return JSON.parse(text);
}

/**
 * Call a model for free-form text output.
 * Returns raw text string.
 */
async function callText(prompt, maxTokens = 1024) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please configure your Gemini API Key.');

  const url = `${MODEL_CHAT}:generateContent?key=${apiKey}`;

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
 * Generates 3 magic branching options from a target node.
 * Uses Gemini Flash Lite with native JSON mode — guaranteed valid JSON.
 */
export async function generateMagicBranches(graphData, targetNodeId) {
  const nodes = graphData.nodes || [];
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) throw new Error('Target node not found.');

  const context = nodes.map(n => `- ${n.title}: ${n.description || 'No description'}`).join('\n');

  const prompt = `You are an expert game narrative designer.

Story context:
${context}

Current node: "${targetNode.title}" — ${targetNode.description || 'no description'}

Generate exactly 3 creative, narratively diverse story branches that could follow from this node.

Return a JSON object with this structure:
{"branches": [{"title": "Short branch title", "description": "Detailed description of what happens in this branch"}]}`;

  return await callJSON(prompt);
}

/**
 * Analyzes the entire graph for plot holes and narrative inconsistencies.
 * Uses Gemini Flash Lite with native JSON mode.
 */
export async function checkPlotHoles(graphData) {
  const nodes = graphData.nodes || [];
  if (nodes.length < 3) throw new Error('Add at least 3 nodes to analyze plot holes.');

  const simplifiedGraph = nodes.map(n => `[${n.type}] ${n.title}: ${n.description || ''}`).join('\n');

  const prompt = `You are an expert narrative editor. Analyze this game story graph for plot holes, dead ends, or narrative inconsistencies.

STORY GRAPH:
${simplifiedGraph}

Return a JSON object with this structure:
{"issues": [{"severity": "High or Medium or Low", "title": "Issue title", "description": "Explanation of the issue", "suggestion": "How to fix it"}], "overallFeedback": "A short summary of the story's current state"}`;

  return await callJSON(prompt);
}

/**
 * AI Chat — free-form conversation about the project.
 * Uses Gemma 3 27B for natural conversational output.
 */
export async function chatWithAI(userMessage, graphData) {
  const nodes = graphData.nodes || [];
  const simplifiedGraph = nodes.length > 0
    ? nodes.map(n => `[${n.type}] ${n.title}: ${n.description || 'No description'}`).join('\n')
    : '(No nodes created yet)';

  const prompt = `You are a creative game narrative assistant inside "Blueprint Studio", a visual story planning tool. The user is designing a game story using nodes.

Current story graph:
${simplifiedGraph}

Help with story ideas, character development, world-building, plot suggestions, or dialogue writing. Be concise and creative. Use bullet points when listing ideas.

User's question: ${userMessage}`;

  return await callText(prompt);
}
