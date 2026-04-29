// ========================================
// AIHelper.js — Gemini AI Integration
// ========================================

function getApiKey() {
  return localStorage.getItem('gemini_api_key');
}

export function setApiKey(key) {
  localStorage.setItem('gemini_api_key', key);
}

/**
 * Call Gemini 3.1 Flash Lite API directly from the browser
 */
async function callGemini(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key found. Please configure your Gemini API Key.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b:generateContent?key=${apiKey}`;

  // Removed responseMimeType because Gemma 4 doesn't support the JSON schema flag directly over the REST API in all configurations,
  // but it will still output JSON based on our strict prompt.

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error('Invalid response format from Gemma');
  }

  // Sanitize the response (Gemma sometimes adds markdown code blocks even if told not to)
  textResponse = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(textResponse);
  } catch (e) {
    throw new Error('Failed to parse AI JSON response: ' + textResponse);
  }
}

/**
 * Analyzes a given node and the overall story graph to generate 3 magical branching dialogue options.
 */
export async function generateMagicBranches(graphData, targetNodeId) {
  // Extract context from the graph
  const nodes = graphData.nodes || [];
  const targetNode = nodes.find(n => n.id === targetNodeId);
  
  if (!targetNode) {
    throw new Error('Target node not found.');
  }

  // Create a simplified graph string to feed to the AI
  const simplifiedGraph = nodes.map(n => `[${n.type}] ${n.title}: ${n.description || 'No description'}`).join('\n');

  const prompt = `
    You are an expert game narrative designer and writer. 
    I am building a visual novel / RPG using a node-based editor.

    Here is a summary of the current story nodes:
    ${simplifiedGraph}

    The user wants to generate 3 branching options branching OUT from the following specific node:
    TITLE: "${targetNode.title}"
    DESCRIPTION: "${targetNode.description || 'Empty'}"
    TYPE: "${targetNode.type}"

    Generate exactly 3 logical, interesting, and narratively diverse branching dialogue options or story events that could happen next.
    
    You MUST respond with ONLY a valid JSON object matching this schema, with no markdown formatting or backticks:
    {
      "branches": [
        {
          "title": "Short Title of Branch 1",
          "description": "Detailed description of what happens or what the character says."
        },
        {
          "title": "Short Title of Branch 2",
          "description": "Detailed description of what happens or what the character says."
        },
        {
          "title": "Short Title of Branch 3",
          "description": "Detailed description of what happens or what the character says."
        }
      ]
    }
  `;

  return await callGemini(prompt);
}

/**
 * Analyzes the entire graph to find plot holes or narrative inconsistencies.
 */
export async function checkPlotHoles(graphData) {
  const nodes = graphData.nodes || [];
  
  if (nodes.length < 3) {
    throw new Error('Not enough nodes to analyze plot holes. Build your story more!');
  }

  // Simplified context
  const simplifiedGraph = nodes.map(n => `ID: ${n.id} | Type: ${n.type} | Title: ${n.title} | Desc: ${n.description || ''}`).join('\n');

  const prompt = `
    You are an expert narrative editor and game designer.
    Analyze the following game story graph for plot holes, dead ends, or narrative inconsistencies.

    STORY GRAPH:
    ${simplifiedGraph}

    Identify any missing context, illogical character actions, or structural issues.
    
    You MUST respond with ONLY a valid JSON object matching this schema, with no markdown formatting or backticks:
    {
      "issues": [
        {
          "severity": "High" | "Medium" | "Low",
          "title": "Short title of the issue",
          "description": "Detailed explanation of the plot hole or inconsistency",
          "suggestion": "How the writer can fix it"
        }
      ],
      "overallFeedback": "A short summary of the story's current state."
    }
  `;

  return await callGemini(prompt);
}
