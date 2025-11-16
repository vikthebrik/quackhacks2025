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
  // Legacy function - now uses getPoliticalLabel
  return getPoliticalLabel(score);
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
 * Analyzes political bias using GDELT API
 * Returns score: -1 (Conservative/Right) to 1 (Liberal/Left), 0 (Moderate)
 */
async function analyzeBiasGDELT(text, metadata) {
  try {
    // GDELT 2.0 API - using domain-based analysis
    // Since GDELT requires specific queries, we'll use domain analysis
    // combined with text analysis for better accuracy
    
    // Known political leaning database (can be expanded)
    const domainBiasMap = {
      // Conservative/Right-leaning
      'foxnews.com': -0.8,
      'breitbart.com': -0.9,
      'dailywire.com': -0.7,
      'nypost.com': -0.5,
      'wsj.com': -0.4,
      'nationalreview.com': -0.8,
      
      // Liberal/Left-leaning
      'cnn.com': 0.7,
      'msnbc.com': 0.8,
      'nytimes.com': 0.6,
      'washingtonpost.com': 0.6,
      'theguardian.com': 0.7,
      'huffpost.com': 0.8,
      'vox.com': 0.7,
      'slate.com': 0.6,
      
      // Moderate/Center
      'bbc.com': 0.0,
      'reuters.com': 0.0,
      'ap.org': 0.0,
      'npr.org': 0.1,
      'pbs.org': 0.0,
      'economist.com': 0.0
    };
    
    // Check domain first
    const domain = metadata.domain || '';
    const domainScore = domainBiasMap[domain.toLowerCase()];
    
    if (domainScore !== undefined) {
      return {
        score: domainScore,
        label: getPoliticalLabel(domainScore),
        explanation: `Political analysis based on source domain: ${domain}`,
        source: 'domain'
      };
    }
    
    // Fallback: Use GDELT tone API if available
    // GDELT tone ranges from -100 (negative) to +100 (positive)
    // We'll map this to political spectrum as a proxy
    try {
      const query = encodeURIComponent(metadata.title || text.substring(0, 100));
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=1`;
      
      const response = await fetch(gdeltUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
          const article = data.articles[0];
          // GDELT provides tone, map to political spectrum
          // This is a simplified mapping
          const tone = article.tone || 0;
          const score = Math.max(-1, Math.min(1, tone / 100));
          
          return {
            score: score,
            label: getPoliticalLabel(score),
            explanation: `Political analysis based on GDELT tone analysis`,
            source: 'gdelt'
          };
        }
      }
    } catch (e) {
      console.log('GDELT API not available, using fallback');
    }
    
    // Final fallback: Use local heuristics
    const localBias = analyzeBiasHeuristics(text);
    return {
      score: localBias.score,
      label: getPoliticalLabel(localBias.score),
      explanation: `Political analysis based on local heuristics`,
      source: 'heuristic'
    };
    
  } catch (error) {
    console.error('Error in GDELT analysis:', error);
    // Fallback to heuristics
    const localBias = analyzeBiasHeuristics(text);
    return {
      score: localBias.score,
      label: getPoliticalLabel(localBias.score),
      explanation: `Analysis based on local heuristics (GDELT unavailable)`,
      source: 'heuristic'
    };
  }
}

/**
 * Gets political label from score
 * -1 = Conservative, 0 = Moderate, 1 = Liberal
 */
function getPoliticalLabel(score) {
  if (score < -0.6) return 'Conservative';
  if (score < -0.3) return 'Moderately Conservative';
  if (score < -0.1) return 'Slightly Conservative';
  if (score < 0.1) return 'Moderate';
  if (score < 0.3) return 'Slightly Liberal';
  if (score < 0.6) return 'Moderately Liberal';
  return 'Liberal';
}

/**
 * Analyzes emotional charge using VADER sentiment analysis
 * Returns score: -1 (Highly Emotional) to 1 (Analytical/Emotionless), 0 (Neutral)
 */
function analyzeEmotionalCharge(text) {
  // VADER sentiment analysis implementation
  // Since we can't use npm packages directly in service worker,
  // we'll implement a simplified VADER-like analysis
  
  // VADER lexicon (simplified - full lexicon has 7500+ words)
  const vaderLexicon = {
    // Positive emotional words
    'excellent': 2.5, 'amazing': 2.3, 'wonderful': 2.2, 'fantastic': 2.1,
    'great': 1.9, 'love': 2.1, 'best': 1.8, 'perfect': 2.0,
    'brilliant': 2.0, 'outstanding': 2.1, 'incredible': 2.2,
    'shocking': 2.0, 'devastating': -2.5, 'terrible': -2.3,
    'horrific': -2.8, 'awful': -2.1, 'disgusting': -2.4,
    'outrageous': -2.0, 'appalling': -2.2,
    
    // Negative emotional words
    'hate': -2.5, 'worst': -2.0, 'horrible': -2.3, 'disaster': -2.1,
    'crisis': -1.8, 'tragedy': -2.2, 'scandal': -1.9,
    
    // Intensifiers
    'extremely': 0.8, 'incredibly': 0.9, 'absolutely': 0.8,
    'completely': 0.6, 'totally': 0.7, 'very': 0.3,
    
    // Neutralizing words
    'however': -0.2, 'but': -0.3, 'although': -0.2,
    'nevertheless': -0.1, 'despite': -0.2
  };
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  let compoundScore = 0;
  let wordCount = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];
    
    // Check for word in lexicon
    if (vaderLexicon[word] !== undefined) {
      let score = vaderLexicon[word];
      
      // Check for intensifiers
      if (i > 0 && vaderLexicon[words[i - 1]] > 0 && vaderLexicon[words[i - 1]] < 1) {
        score *= (1 + vaderLexicon[words[i - 1]]);
      }
      
      compoundScore += score;
      wordCount++;
    }
    
    // Check for negation
    if ((word === 'not' || word === 'no' || word === 'never') && nextWord) {
      if (vaderLexicon[nextWord] !== undefined) {
        compoundScore -= vaderLexicon[nextWord] * 0.5;
      }
    }
  }
  
  // Normalize score
  // VADER compound score ranges from -1 to 1
  // We'll map: -1 to 1 (highly emotional negative) -> -0.8
  //            0 (neutral) -> 0
  //            +1 (highly emotional positive) -> 0.8
  // But we want: -1 (highly emotional) to 1 (analytical/emotionless)
  
  const normalizedScore = wordCount > 0 
    ? Math.max(-1, Math.min(1, compoundScore / Math.max(wordCount, 10)))
    : 0;
  
  // Invert: high emotional = negative, low emotional = positive
  // Actually, we want: emotional = negative, analytical = positive
  const emotionalScore = -normalizedScore;
  
  return {
    score: Math.max(-1, Math.min(1, emotionalScore)),
    label: getEmotionalLabel(emotionalScore),
    intensity: Math.abs(emotionalScore)
  };
}

/**
 * Gets emotional label from score
 * -1 = Highly Emotional, 0 = Neutral, 1 = Analytical/Emotionless
 */
function getEmotionalLabel(score) {
  if (score < -0.6) return 'Highly Emotional';
  if (score < -0.3) return 'Emotionally Charged';
  if (score < -0.1) return 'Somewhat Emotional';
  if (score < 0.1) return 'Neutral';
  if (score < 0.3) return 'Somewhat Analytical';
  if (score < 0.6) return 'Analytical';
  return 'Emotionless';
}

/**
 * Fetches actual articles with opposing viewpoints
 */
async function fetchOpposingArticles(text, metadata, currentBiasScore) {
  try {
    // Extract keywords for search
    const titleWords = (metadata.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const textWords = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    
    const wordCount = {};
    [...titleWords, ...textWords].forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    const topWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    const topic = topWords.slice(0, 3).join(' ');
    
    // Determine opposing viewpoint search terms
    const opposingTerms = currentBiasScore > 0 
      ? `${topic} conservative perspective` // If liberal, search for conservative
      : `${topic} liberal perspective`;     // If conservative, search for liberal
    
    // Use Google Custom Search API or News API
    // For now, we'll use a simple approach with DuckDuckGo or similar
    // Note: In production, you'd want to use a proper news API
    
    // Using DuckDuckGo Instant Answer API (no key required)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(opposingTerms)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl);
    if (response.ok) {
      const data = await response.json();
      
      // Extract related topics and create article links
      const articles = [];
      
      // Use GDELT to find actual articles
      const gdeltQuery = encodeURIComponent(opposingTerms);
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=artlist&format=json&maxrecords=5`;
      
      try {
        const gdeltResponse = await fetch(gdeltUrl);
        if (gdeltResponse.ok) {
          const gdeltData = await gdeltResponse.json();
          if (gdeltData.articles && Array.isArray(gdeltData.articles)) {
            gdeltData.articles.forEach(article => {
              if (article.url && article.title) {
                articles.push({
                  title: article.title,
                  url: article.url,
                  source: article.domain || 'Unknown',
                  snippet: article.seo || ''
                });
              }
            });
          }
        }
      } catch (e) {
        console.log('GDELT article fetch failed:', e);
      }
      
      // Fallback: Create search links if no articles found
      if (articles.length === 0) {
        return [
          {
            title: `Search: ${opposingTerms}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(opposingTerms)}`,
            source: 'Google Search',
            snippet: 'Click to search for opposing viewpoints'
          }
        ];
      }
      
      return articles.slice(0, 5); // Return top 5 articles
    }
    
    // Final fallback
    return [
      {
        title: `Search: ${opposingTerms}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(opposingTerms)}`,
        source: 'Google Search',
        snippet: 'Click to search for opposing viewpoints'
      }
    ];
    
  } catch (error) {
    console.error('Error fetching opposing articles:', error);
    // Return search link as fallback
    return [
      {
        title: 'Search for opposing viewpoints',
        url: `https://www.google.com/search?q=${encodeURIComponent(metadata.title || 'opposing viewpoint')}`,
        source: 'Google Search',
        snippet: 'Click to search'
      }
    ];
  }
}

/**
 * Generates alternative article search queries (legacy - kept for compatibility)
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

  // Quick local bias analysis (fallback)
  const localBias = analyzeBiasHeuristics(text);
  
  try {
    // Analyze political bias with GDELT
    const politicalBias = await analyzeBiasGDELT(text, metadata);
    
    // Analyze emotional charge with VADER
    const emotionalCharge = analyzeEmotionalCharge(text);
    
    // Generate summaries in parallel
    const [neutralSummary, opposingViewpoint] = await Promise.all([
      generateNeutralSummary(text),
      generateOpposingViewpoint(text)
    ]);

    // Fetch actual opposing articles
    const opposingArticles = await fetchOpposingArticles(text, metadata, politicalBias.score);

    const analysis = {
      metadata: metadata,
      neutralSummary: neutralSummary,
      opposingViewpoint: opposingViewpoint,
      bias: {
        score: politicalBias.score,
        label: politicalBias.label,
        explanation: politicalBias.explanation,
        source: politicalBias.source || 'gdelt'
      },
      emotionalCharge: {
        score: emotionalCharge.score,
        label: emotionalCharge.label,
        intensity: emotionalCharge.intensity
      },
      opposingArticles: opposingArticles,
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
        label: getPoliticalLabel(localBias.score),
        explanation: 'Analysis based on local heuristics only.',
        source: 'heuristic'
      },
      emotionalCharge: {
        score: analyzeEmotionalCharge(text).score,
        label: analyzeEmotionalCharge(text).label,
        intensity: analyzeEmotionalCharge(text).intensity
      },
      opposingArticles: await fetchOpposingArticles(text, metadata, localBias.score),
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

