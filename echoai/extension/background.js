/**
 * Background service worker for EchoAI
 * Handles API calls to Gemini and manages article analysis
 */

// Cache utilities (inline for service worker)
const CACHE_PREFIX = 'echoai_cache_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCacheKey(url) {
  try {
    const urlObj = new URL(url);
    return CACHE_PREFIX + urlObj.origin + urlObj.pathname;
  } catch (e) {
    return CACHE_PREFIX + url;
  }
}

async function getCachedAnalysis(url) {
  try {
    const key = getCacheKey(url);
    const result = await chrome.storage.local.get([key]);
    
    if (!result[key]) {
      return null;
    }

    const cached = result[key];
    const now = Date.now();

    if (cached.timestamp && (now - cached.timestamp) > CACHE_EXPIRY_MS) {
      await chrome.storage.local.remove([key]);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Error getting cached analysis:', error);
    return null;
  }
}

async function setCachedAnalysis(url, data) {
  try {
    const key = getCacheKey(url);
    const cacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({ [key]: cacheEntry });
  } catch (error) {
    console.error('Error setting cached analysis:', error);
  }
}

async function clearCache() {
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

// Bias heuristics (inline for service worker)
const LEFT_BIAS_INDICATORS = [
  'progressive', 'liberal', 'democratic', 'left-wing',
  'socialist', 'equity', 'systemic', 'privilege',
  'climate change', 'social justice', 'diversity'
];

const RIGHT_BIAS_INDICATORS = [
  'conservative', 'republican', 'right-wing', 'traditional',
  'free market', 'individual', 'heritage', 'patriotism',
  'constitutional', 'liberty', 'freedom'
];

function analyzeBiasHeuristics(text) {
  if (!text || text.length < 100) {
    return { score: 0, confidence: 0, indicators: [] };
  }

  const lowerText = text.toLowerCase();
  let leftScore = 0;
  let rightScore = 0;

  LEFT_BIAS_INDICATORS.forEach(indicator => {
    const matches = (lowerText.match(new RegExp(indicator, 'gi')) || []).length;
    if (matches > 0) {
      leftScore += matches;
    }
  });

  RIGHT_BIAS_INDICATORS.forEach(indicator => {
    const matches = (lowerText.match(new RegExp(indicator, 'gi')) || []).length;
    if (matches > 0) {
      rightScore += matches;
    }
  });

  const totalIndicators = leftScore + rightScore;
  let score = 0;
  if (totalIndicators > 0) {
    score = (rightScore - leftScore) / totalIndicators;
  }

  const confidence = Math.min(totalIndicators / 10, 1);

  return {
    score: Math.max(-1, Math.min(1, score)),
    confidence: confidence
  };
}

function getBiasLabel(score) {
  if (score < -0.6) return 'Strongly Left';
  if (score < -0.3) return 'Moderately Left';
  if (score < -0.1) return 'Slightly Left';
  if (score < 0.1) return 'Neutral';
  if (score < 0.3) return 'Slightly Right';
  if (score < 0.6) return 'Moderately Right';
  return 'Strongly Right';
}

// Note: In a real implementation, you'd load the Gemini SDK
// For now, we'll use fetch API to call Gemini REST API
// You'll need to configure the API key via storage or environment

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

let geminiApiKey = null;

// Load API key from storage
chrome.storage.local.get(['geminiApiKey'], (result) => {
  geminiApiKey = result.geminiApiKey;
});

// Listen for API key updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.geminiApiKey) {
    geminiApiKey = changes.geminiApiKey.newValue;
  }
});

/**
 * Calls Gemini API to generate content
 */
async function callGeminiAPI(prompt, maxTokens = 1000) {
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const url = `${GEMINI_API_URL}?key=${geminiApiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Generates a neutral summary of the article
 */
async function generateNeutralSummary(text) {
  const prompt = `Please provide a neutral, factual summary of the following article. Focus on key facts and avoid opinionated language. Keep it concise (3-4 sentences):

${text.substring(0, 4000)}`;
  
  return await callGeminiAPI(prompt, 200);
}

/**
 * Generates an opposing viewpoint summary
 */
async function generateOpposingViewpoint(text) {
  const prompt = `Based on the following article, provide a summary of potential opposing viewpoints or counterarguments. Be respectful and balanced. Keep it concise (3-4 sentences):

${text.substring(0, 4000)}`;
  
  return await callGeminiAPI(prompt, 200);
}

/**
 * Analyzes bias in the article
 */
async function analyzeBias(text) {
  const prompt = `Analyze the political bias of the following article. Provide:
1. A bias score from -1 (strongly left) to 1 (strongly right), where 0 is neutral
2. A brief explanation (1-2 sentences)
3. Key indicators of bias

Article:
${text.substring(0, 4000)}`;
  
  const response = await callGeminiAPI(prompt, 300);
  
  // Parse the response to extract bias score
  // This is a simplified parser - in production, you'd want more robust parsing
  const scoreMatch = response.match(/[-+]?[0-9]*\.?[0-9]+/);
  const score = scoreMatch ? parseFloat(scoreMatch[0]) : 0;
  const clampedScore = Math.max(-1, Math.min(1, score));
  
  return {
    score: clampedScore,
    explanation: response,
    label: getBiasLabel(clampedScore)
  };
}

/**
 * Generates alternative article search queries
 */
function generateSearchQueries(text, metadata) {
  // Extract keywords from title and text
  const titleWords = (metadata.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const textWords = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  
  // Get most common words
  const wordCount = {};
  [...titleWords, ...textWords].forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  const topWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  const topic = topWords.slice(0, 3).join(' ');
  
  return [
    `${topic} opposing viewpoint`,
    `${topic} alternative perspective`,
    `${topic} counterargument`,
    `${topic} different opinion`
  ];
}

/**
 * Main function to analyze an article
 */
async function analyzeArticle(articleData) {
  const { text, metadata } = articleData;
  
  // Check cache first
  const cached = await getCachedAnalysis(metadata.url);
  if (cached) {
    console.log('EchoAI: Using cached analysis');
    return cached;
  }

  // Quick local bias analysis
  const localBias = analyzeBiasHeuristics(text);
  
  try {
    // Generate summaries and bias analysis in parallel
    const [neutralSummary, opposingViewpoint, aiBias] = await Promise.all([
      generateNeutralSummary(text),
      generateOpposingViewpoint(text),
      analyzeBias(text)
    ]);

    // Generate search queries
    const searchQueries = generateSearchQueries(text, metadata);

    const analysis = {
      metadata: metadata,
      neutralSummary: neutralSummary,
      opposingViewpoint: opposingViewpoint,
      bias: {
        score: aiBias.score,
        label: aiBias.label,
        explanation: aiBias.explanation,
        localScore: localBias.score,
        localConfidence: localBias.confidence
      },
      searchQueries: searchQueries,
      timestamp: Date.now()
    };

    // Cache the analysis
    await setCachedAnalysis(metadata.url, analysis);

    return analysis;
  } catch (error) {
    console.error('EchoAI: Error analyzing article:', error);
    
    // Return partial analysis with local bias if API fails
    return {
      metadata: metadata,
      neutralSummary: 'Unable to generate summary. Please check your API key configuration.',
      opposingViewpoint: 'Unable to generate opposing viewpoint. Please check your API key configuration.',
      bias: {
        score: localBias.score,
        label: getBiasLabel(localBias.score),
        explanation: 'Analysis based on local heuristics only.',
        localScore: localBias.score,
        localConfidence: localBias.confidence
      },
      searchQueries: generateSearchQueries(text, metadata),
      timestamp: Date.now(),
      error: error.message
    };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_ARTICLE') {
    analyzeArticle(message.data)
      .then(analysis => {
        sendResponse({ success: true, analysis: analysis });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SET_API_KEY') {
    geminiApiKey = message.apiKey;
    chrome.storage.local.set({ geminiApiKey: message.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_API_KEY') {
    sendResponse({ apiKey: geminiApiKey });
    return false;
  }
  
  if (message.type === 'CLEAR_CACHE') {
    clearCache()
      .then(success => {
        sendResponse({ success: success });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.type === 'GET_ANALYSIS') {
    getCachedAnalysis(message.url)
      .then(analysis => {
        sendResponse({ success: true, analysis: analysis });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

