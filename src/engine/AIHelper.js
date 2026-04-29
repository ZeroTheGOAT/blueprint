// ========================================
// AIHelper.js — Gemma 4 31B Integration
// ========================================

// Models
const MODEL_GEMMA4 = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it';
const MODEL_GEMMA3 = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it';

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
}

export function setApiKey(key) {
  localStorage.setItem('gemini_api_key', key);
}

/**
 * Low-level API call — returns raw text from Gemma
 */
async function callGemmaRaw(prompt, maxTokens = 2048, model = MODEL_GEMMA4) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key found. Please configure your Gemini API Key.');
  }

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
  
  if (!text) {
    throw new Error('Empty response from AI model.');
  }

  return text;
}

/**
 * Parse JSON from Gemma's verbose text output.
 * Gemma is a reasoning model and often wraps JSON in chain-of-thought text.
 * This function uses multiple strategies to extract valid JSON.
 */
function extractJSON(rawText) {
  // Strategy 1: Look for <output> XML tags
  const outputMatch = rawText.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    try { return JSON.parse(outputMatch[1].trim()); } catch (e) { /* continue */ }
  }

  // Strategy 2: Look for ```json code blocks
  const codeBlockMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) { /* continue */ }
  }

  // Strategy 3: Find balanced JSON objects by scanning for all { } pairs
  // and testing from the largest to the smallest
  const candidates = [];
  const stack = [];
  for (let i = 0; i < rawText.length; i++) {
    if (rawText[i] === '{') {
      stack.push(i);
    } else if (rawText[i] === '}' && stack.length > 0) {
      const start = stack.pop();
      const candidate = rawText.substring(start, i + 1);
      // Only consider candidates that look like they have the right keys
      if (candidate.includes('"branches"') || candidate.includes('"issues"') || candidate.length > 50) {
        candidates.push(candidate);
      }
    }
  }

  // Sort candidates by length (longest first — most likely to be the complete object)
  candidates.sort((a, b) => b.length - a.length);
  
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch (e) { /* try next */ }
  }

  // Strategy 4: Last resort — try the whole text
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

  const simplifiedGraph = nodes.map(n => `[${n.type}] ${n.title}: ${n.description || 'No description'}`).join('\n');

  const prompt = `You are an expert game narrative designer. I am building a story using a node-based editor.

Current story nodes:
${simplifiedGraph}

Generate 3 branching options from this node:
TITLE: "${targetNode.title}"
DESCRIPTION: "${targetNode.description || 'Empty'}"
TYPE: "${targetNode.type}"

Respond with ONLY a JSON object wrapped in <output> tags. No other text outside the tags.

<output>
{"branches":[{"title":"Branch Title","description":"What happens in this branch."},{"title":"Branch Title 2","description":"What happens."},{"title":"Branch Title 3","description":"What happens."}]}
</output>

Now generate your 3 unique, creative branches:`;

  const rawText = await callGemmaRaw(prompt);
  return extractJSON(rawText);
}

/**
 * Analyzes the entire graph for plot holes and narrative inconsistencies.
 */
export async function checkPlotHoles(graphData) {
  const nodes = graphData.nodes || [];
  
  if (nodes.length < 3) throw new Error('Add at least 3 nodes to analyze plot holes.');

  const simplifiedGraph = nodes.map(n => `[${n.type}] ${n.title}: ${n.description || ''}`).join('\n');

  const prompt = `You are an expert narrative editor. Analyze this game story graph for plot holes and inconsistencies.

STORY GRAPH:
${simplifiedGraph}

Respond with ONLY a JSON object wrapped in <output> tags. No other text outside the tags.

<output>
{"issues":[{"severity":"High","title":"Issue title","description":"Explanation","suggestion":"How to fix"}],"overallFeedback":"Summary of the story state."}
</output>

Now analyze the story above:`;

  const rawText = await callGemmaRaw(prompt);
  return extractJSON(rawText);
}

/**
 * AI Chat — free-form conversation about the project.
 * Returns plain text, not JSON.
 */
export async function chatWithAI(userMessage, graphData) {
  const nodes = graphData.nodes || [];
  const simplifiedGraph = nodes.length > 0
    ? nodes.map(n => `[${n.type}] ${n.title}: ${n.description || 'No description'}`).join('\n')
    : '(No nodes created yet)';

  const prompt = `You are a creative game narrative assistant embedded inside "Blueprint Studio", a visual story planning tool. The user is designing a game story using nodes.

Here is the current state of the user's story graph:
${simplifiedGraph}

The user is asking you a question about their project. Help them with story ideas, character development, world-building, plot suggestions, dialogue writing, or any narrative design question.

Be concise, creative, and helpful. Use bullet points when listing ideas. Do NOT output JSON.

User's question: ${userMessage}`;

  return await callGemmaRaw(prompt, 1024, MODEL_GEMMA3);
}
