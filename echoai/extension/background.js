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
 * Vector 1: Domain-based bias analysis
 * Returns score: -1 (Conservative) to 1 (Liberal), 0 (Moderate)
 */
async function analyzeDomainBias(metadata) {
  const domainBiasMap = {
    // Conservative/Right-leaning (negative scores)
    'foxnews.com': -0.8,
    'breitbart.com': -0.9,
    'dailywire.com': -0.7,
    'nypost.com': -0.5,
    'wsj.com': -0.4,
    'nationalreview.com': -0.8,
    'townhall.com': -0.7,
    'washingtonexaminer.com': -0.6,
    'theblaze.com': -0.8,
    'redstate.com': -0.7,
    'thefederalist.com': -0.7,
    
    // Liberal/Left-leaning (positive scores)
    'cnn.com': 0.7,
    'msnbc.com': 0.8,
    'nytimes.com': 0.6,
    'washingtonpost.com': 0.6,
    'theguardian.com': 0.7,
    'huffpost.com': 0.8,
    'vox.com': 0.7,
    'slate.com': 0.6,
    'motherjones.com': 0.8,
    'thedailybeast.com': 0.7,
    'salon.com': 0.7,
    'thinkprogress.org': 0.8,
    
    // Moderate/Center
    'bbc.com': 0.0,
    'reuters.com': 0.0,
    'ap.org': 0.0,
    'npr.org': 0.1,
    'pbs.org': 0.0,
    'economist.com': 0.0,
    'bloomberg.com': 0.0,
    'politico.com': 0.0
  };
  
  const domainPatterns = [
    { pattern: /^fox\d+[a-z]*\.com$/i, score: -0.7, label: 'Fox Affiliate' },
    { pattern: /\.foxnews\.com$/i, score: -0.8, label: 'Fox News' },
    { pattern: /fox[a-z]*\.com$/i, score: -0.7, label: 'Fox Network' },
    { pattern: /^cnn\.com$/i, score: 0.7, label: 'CNN' },
    { pattern: /\.cnn\.com$/i, score: 0.7, label: 'CNN Affiliate' },
    { pattern: /^[a-z]+news\.com$/i, score: 0.0, label: 'Local News' },
    { pattern: /^[a-z]+herald\.com$/i, score: 0.0, label: 'Local Herald' },
    { pattern: /^[a-z]+times\.com$/i, score: 0.0, label: 'Local Times' },
    { pattern: /^[a-z]+tribune\.com$/i, score: 0.0, label: 'Local Tribune' },
    { pattern: /\.edu$/i, score: 0.0, label: 'Educational' },
    { pattern: /\.gov$/i, score: 0.0, label: 'Government' }
  ];
  
  const domain = (metadata.domain || '').toLowerCase().replace(/^www\./, '');
  let domainScore = domainBiasMap[domain];
  let matchedLabel = null;
  
  if (domainScore === undefined) {
    for (const { pattern, score, label } of domainPatterns) {
      if (pattern.test(domain)) {
        domainScore = score;
        matchedLabel = label;
        break;
      }
    }
  }
  
  if (domainScore === undefined) {
    if (domain.includes('fox')) {
      domainScore = -0.7;
      matchedLabel = 'Fox Network Affiliate';
    } else if (domain.includes('cnn') || domain.includes('msnbc')) {
      domainScore = 0.7;
      matchedLabel = 'CNN/MSNBC Affiliate';
    } else if (domain.includes('abc') || domain.includes('cbs') || domain.includes('nbc')) {
      domainScore = 0.0;
      matchedLabel = 'Major Network Affiliate';
    }
  }
  
  if (domainScore !== undefined) {
    return {
      score: domainScore,
      confidence: 0.9,
      source: 'domain',
      explanation: `Domain analysis: ${metadata.domain}${matchedLabel ? ` (${matchedLabel})` : ''}`
    };
  }
  
  throw new Error('Domain not recognized');
}

/**
 * Vector 2: Content keyword analysis
 * Analyzes political keywords and phrases in article text
 */
function analyzeContentKeywords(text) {
  if (!text || text.length < 100) {
    throw new Error('Text too short for content analysis');
  }
  
  const conservativeKeywords = {
    'free market': 0.8, 'deregulation': 0.7, 'tax cuts': 0.6, 'small government': 0.8,
    'constitutional rights': 0.7, 'second amendment': 0.9, 'pro-life': 0.8,
    'traditional values': 0.7, 'family values': 0.6, 'religious freedom': 0.7,
    'border security': 0.8, 'illegal immigration': 0.7, 'law and order': 0.7,
    'fiscal responsibility': 0.6, 'deficit reduction': 0.6, 'deregulate': 0.7,
    'big government': 0.7, 'government overreach': 0.8, 'welfare state': 0.6,
    'entitlement programs': 0.5, 'socialism': 0.9, 'communism': 0.9,
    'mainstream media': 0.6, 'fake news': 0.7, 'deep state': 0.8,
    'republican party': 0.5, 'gop': 0.5, 'conservative': 0.6,
    'trump': 0.4, 'reagan': 0.3, 'mcconnell': 0.3
  };
  
  const liberalKeywords = {
    'social justice': 0.8, 'climate action': 0.7, 'renewable energy': 0.6,
    'universal healthcare': 0.8, 'medicare for all': 0.9, 'single payer': 0.8,
    'gun control': 0.7, 'gun reform': 0.7, 'assault weapons ban': 0.8,
    'pro-choice': 0.8, 'reproductive rights': 0.8, 'lgbtq rights': 0.7,
    'immigration reform': 0.6, 'pathway to citizenship': 0.7, 'daca': 0.6,
    'minimum wage': 0.6, 'workers rights': 0.6, 'union': 0.5,
    'affordable housing': 0.6, 'income inequality': 0.7, 'wealth tax': 0.7,
    'systemic racism': 0.8, 'white privilege': 0.8, 'systemic oppression': 0.8,
    'patriarchy': 0.7, 'diversity and inclusion': 0.6, 'equity': 0.7,
    'progressive': 0.6, 'democratic party': 0.4, 'democrats': 0.4,
    'biden': 0.3, 'sanders': 0.5, 'aoc': 0.5, 'warren': 0.4
  };
  
  const lowerText = text.toLowerCase();
  let conservativeScore = 0;
  let liberalScore = 0;
  const foundKeywords = [];
  
  Object.entries(conservativeKeywords).forEach(([keyword, weight]) => {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    if (matches > 0) {
      conservativeScore += matches * weight;
      foundKeywords.push({ keyword, weight, matches, type: 'conservative' });
    }
  });
  
  Object.entries(liberalKeywords).forEach(([keyword, weight]) => {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    if (matches > 0) {
      liberalScore += matches * weight;
      foundKeywords.push({ keyword, weight, matches, type: 'liberal' });
    }
  });
  
  const totalScore = conservativeScore + liberalScore;
  
  // Return neutral score if no keywords found instead of throwing error
  if (totalScore === 0) {
    return {
      score: 0.0,
      confidence: 0.1,
      source: 'content',
      explanation: 'Content analysis: No political keywords found (neutral score)',
      details: []
    };
  }
  
  // Score: negative = conservative, positive = liberal
  const rawScore = (liberalScore - conservativeScore) / totalScore;
  const normalizedScore = Math.max(-1, Math.min(1, rawScore));
  const confidence = Math.min(totalScore / 20, 0.8);
  
  return {
    score: normalizedScore,
    confidence: confidence,
    source: 'content',
    explanation: `Content analysis: Found ${foundKeywords.length} political indicators`,
    details: foundKeywords.slice(0, 5)
  };
}

/**
 * Vector 3: GDELT tone analysis
 */
async function analyzeGDELTTone(text, metadata) {
  const queries = [
    metadata.title,
    metadata.url ? new URL(metadata.url).pathname.split('/').filter(p => p.length > 5).join(' ') : null,
    text.substring(0, 150).replace(/[^\w\s]/g, ' ').trim()
  ].filter(q => q && q.length > 10);
  
  console.log('GDELT: Starting analysis with queries:', queries);
  
  for (let i = 0; i < queries.length; i++) {
    const queryText = queries[i];
    
    // Add small delay between queries to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    try {
      const query = encodeURIComponent(queryText);
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=3`;
      
      console.log('GDELT: Fetching URL:', gdeltUrl);
      const response = await fetch(gdeltUrl);
      
      console.log('GDELT: Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error('GDELT: Error response:', errorText);
        continue;
      }
      
      const data = await response.json();
      console.log('GDELT: Response data structure:', Object.keys(data));
      
      // Handle different possible response structures
      const articles = data.articles || data.results || data.data || [];
      
      if (Array.isArray(articles) && articles.length > 0) {
        console.log('GDELT: Found', articles.length, 'articles');
        
        let totalTone = 0;
        let count = 0;
        
        articles.forEach((article, idx) => {
          console.log(`GDELT: Article ${idx + 1} structure:`, Object.keys(article));
          
          // GDELT tone can be in different fields
          const tone = article.tone || article.avgtone || article.tone_score || null;
          
          if (tone !== undefined && tone !== null && !isNaN(tone)) {
            console.log(`GDELT: Article ${idx + 1} tone:`, tone);
            totalTone += parseFloat(tone);
            count++;
          }
        });
        
        if (count > 0) {
          const avgTone = totalTone / count;
          console.log('GDELT: Average tone:', avgTone);
          
          // GDELT tone: -100 to +100, map to -1 to +1
          const score = Math.max(-1, Math.min(1, avgTone / 100));
          
          return {
            score: score,
            confidence: 0.6,
            source: 'gdelt',
            explanation: `GDELT tone analysis (${count} article${count > 1 ? 's' : ''} analyzed)`
          };
        } else {
          console.log('GDELT: No valid tone data found in articles');
        }
      } else {
        console.log('GDELT: No articles found in response');
      }
    } catch (error) {
      console.error('GDELT: Fetch error:', error);
      continue;
    }
  }
  
  // Return neutral score instead of throwing error
  console.log('GDELT: All queries failed, returning neutral score');
  return {
    score: 0.0,
    confidence: 0.1,
    source: 'gdelt',
    explanation: 'GDELT API returned no results (neutral score)'
  };
}

/**
 * Vector 4: Language pattern analysis
 * Analyzes linguistic patterns that indicate political framing
 */
function analyzeLanguagePatterns(text) {
  if (!text || text.length < 100) {
    throw new Error('Text too short for language analysis');
  }
  
  const lowerText = text.toLowerCase();
  
  const conservativePatterns = {
    'clearly': 0.3, 'obviously': 0.3, 'undoubtedly': 0.4, 'certainly': 0.2,
    'everyone knows': 0.4, 'no one can deny': 0.5,
    'personal responsibility': 0.6, 'pull yourself up': 0.5, 'self-reliance': 0.5,
    'time-tested': 0.4, 'proven': 0.3, 'traditional': 0.4
  };
  
  const liberalPatterns = {
    'systemic': 0.5, 'institutional': 0.4, 'structural': 0.4,
    'privilege': 0.5, 'marginalized': 0.5, 'oppressed': 0.5,
    'community': 0.3, 'solidarity': 0.5, 'collective': 0.4,
    'together we': 0.4, 'we must': 0.3,
    'forward-thinking': 0.4, 'innovative': 0.3, 'progressive': 0.5
  };
  
  let conservativeCount = 0;
  let liberalCount = 0;
  
  Object.entries(conservativePatterns).forEach(([pattern, weight]) => {
    const regex = new RegExp(`\\b${pattern.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    conservativeCount += matches * weight;
  });
  
  Object.entries(liberalPatterns).forEach(([pattern, weight]) => {
    const regex = new RegExp(`\\b${pattern.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = (lowerText.match(regex) || []).length;
    liberalCount += matches * weight;
  });
  
  const total = conservativeCount + liberalCount;
  
  // Return neutral score if no patterns found instead of throwing error
  if (total === 0) {
    return {
      score: 0.0,
      confidence: 0.1,
      source: 'language',
      explanation: 'Language pattern analysis: No patterns detected (neutral score)'
    };
  }
  
  const score = (liberalCount - conservativeCount) / total;
  const normalizedScore = Math.max(-1, Math.min(1, score));
  const confidence = Math.min(total / 10, 0.5);
  
  return {
    score: normalizedScore,
    confidence: confidence,
    source: 'language',
    explanation: `Language pattern analysis: ${total.toFixed(1)} pattern matches`
  };
}

/**
 * Vector 5: Framing technique analysis
 * Detects bias through framing techniques
 */
function analyzeFramingTechniques(text) {
  if (!text || text.length < 100) {
    throw new Error('Text too short for framing analysis');
  }
  
  const lowerText = text.toLowerCase();
  
  const hasEmotionalFraming = /(outrage|scandal|crisis|disaster)/i.test(lowerText);
  const hasVictimFraming = /(victim|vulnerable|at risk)/i.test(lowerText);
  const hasUsVsThem = /(they want|they are|the left|the right)/i.test(lowerText);
  const hasQuestionFraming = /(why would|how could)/i.test(lowerText);
  
  let framingScore = 0;
  let totalFraming = 0;
  
  // Emotional + Us vs Them = slightly conservative
  if (hasEmotionalFraming && hasUsVsThem) {
    framingScore = -0.3;
    totalFraming = 1;
  } 
  // Victim framing = slightly liberal
  else if (hasVictimFraming) {
    framingScore = 0.2;
    totalFraming = 1;
  }
  // Question framing = neutral but indicates opinion
  else if (hasQuestionFraming) {
    framingScore = 0.0;
    totalFraming = 0.5;
  }
  
  // Return neutral score if no framing detected instead of throwing error
  if (totalFraming === 0) {
    return {
      score: 0.0,
      confidence: 0.1,
      source: 'framing',
      explanation: 'Framing technique analysis: No clear framing detected (neutral score)'
    };
  }
  
  return {
    score: framingScore,
    confidence: 0.3,
    source: 'framing',
    explanation: 'Framing technique analysis'
  };
}

/**
 * Combines multiple vectors with weighted averaging
 */
function combineVectors(vectors, weights) {
  let weightedSum = 0;
  let totalWeight = 0;
  const activeVectors = [];
  const explanations = [];
  
  Object.entries(vectors).forEach(([vectorName, vectorData]) => {
    if (vectorData && vectorData.score !== null && vectorData.score !== undefined) {
      const weight = weights[vectorName] || 0;
      const confidence = vectorData.confidence || 0.5;
      
      const adjustedWeight = weight * confidence;
      weightedSum += vectorData.score * adjustedWeight;
      totalWeight += adjustedWeight;
      
      activeVectors.push(vectorName);
      if (vectorData.explanation) {
        explanations.push(`${vectorName}: ${vectorData.explanation}`);
      }
    }
  });
  
  if (totalWeight === 0) {
    throw new Error('No vectors available for analysis');
  }
  
  const finalScore = weightedSum / totalWeight;
  const normalizedScore = Math.max(-1, Math.min(1, finalScore));
  
  const vectorCount = activeVectors.length;
  const baseConfidence = Math.min(vectorCount / 5, 0.9);
  
  return {
    score: normalizedScore,
    label: getPoliticalLabel(normalizedScore),
    confidence: baseConfidence,
    source: 'multi-vector',
    explanation: `Multi-vector analysis using ${vectorCount} indicator${vectorCount > 1 ? 's' : ''}: ${activeVectors.join(', ')}`,
    details: {
      vectors: activeVectors,
      explanations: explanations,
      individualScores: Object.fromEntries(
        activeVectors.map(v => [v, vectors[v].score])
      )
    },
    success: true
  };
}

/**
 * Multi-vector political leaning analysis
 * Combines multiple indicators for more accurate scoring
 */
async function analyzeBiasMultiVector(text, metadata) {
  const vectors = {
    domain: null,
    content: null,
    gdelt: null,
    language: null,
    framing: null
  };
  
  const weights = {
    domain: 0.35,
    content: 0.25,
    gdelt: 0.20,
    language: 0.12,
    framing: 0.08
  };
  
  // Run all vector analyses (domain and GDELT are async)
  try {
    vectors.domain = await analyzeDomainBias(metadata);
  } catch (error) {
    console.log('Domain analysis failed:', error);
  }
  
  try {
    vectors.content = analyzeContentKeywords(text);
  } catch (error) {
    console.log('Content analysis failed:', error);
  }
  
  try {
    vectors.gdelt = await analyzeGDELTTone(text, metadata);
  } catch (error) {
    console.error('GDELT analysis failed:', error);
    // GDELT now returns neutral score instead of throwing, but keep catch for safety
    vectors.gdelt = {
      score: 0.0,
      confidence: 0.1,
      source: 'gdelt',
      explanation: `GDELT analysis error: ${error.message}`
    };
  }
  
  try {
    vectors.language = analyzeLanguagePatterns(text);
  } catch (error) {
    console.log('Language analysis failed:', error);
  }
  
  try {
    vectors.framing = analyzeFramingTechniques(text);
  } catch (error) {
    console.log('Framing analysis failed:', error);
  }
  
  // Combine vectors with weighted average
  return combineVectors(vectors, weights);
}

/**
 * Analyzes political bias using GDELT API (now uses multi-vector approach)
 * Returns score: -1 (Conservative/Right) to 1 (Liberal/Left), 0 (Moderate)
 */
async function analyzeBiasGDELT(text, metadata) {
  try {
    // Use multi-vector analysis for more accurate results
    return await analyzeBiasMultiVector(text, metadata);
  } catch (error) {
    console.error('Error in multi-vector analysis:', error);
    // If multi-vector fails completely, try domain-only as last resort
    try {
      const domainResult = await analyzeDomainBias(metadata);
      return {
        score: domainResult.score,
        label: getPoliticalLabel(domainResult.score),
        explanation: domainResult.explanation,
        source: domainResult.source,
        success: true
      };
    } catch (domainError) {
      // Final fallback: throw error (no heuristics)
      throw new Error(`Political analysis failed: ${error.message}`);
    }
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

  // Initialize analysis result
  const analysis = {
    metadata: metadata,
    timestamp: Date.now(),
    errors: []
  };

  // Run GDELT and VADER analyses INDEPENDENTLY
  // They should not block each other
  
  // 1. GDELT Political Analysis (independent)
  let politicalBias = null;
  try {
    politicalBias = await analyzeBiasGDELT(text, metadata);
    analysis.bias = {
      score: politicalBias.score,
      label: politicalBias.label,
      explanation: politicalBias.explanation,
      source: politicalBias.source || 'multi-vector',
      success: true
    };
  } catch (error) {
    console.error('GDELT analysis failed:', error);
    analysis.bias = {
      score: null,
      label: 'Analysis Failed',
      explanation: `Political analysis could not be completed: ${error.message}`,
      source: 'error',
      success: false,
      error: error.message
    };
    analysis.errors.push(`Political Analysis: ${error.message}`);
  }

  // 2. VADER Emotional Analysis (independent)
  let emotionalCharge = null;
  try {
    emotionalCharge = analyzeEmotionalCharge(text);
    analysis.emotionalCharge = {
      score: emotionalCharge.score,
      label: emotionalCharge.label,
      intensity: emotionalCharge.intensity,
      success: true
    };
  } catch (error) {
    console.error('VADER analysis failed:', error);
    analysis.emotionalCharge = {
      score: null,
      label: 'Analysis Failed',
      intensity: null,
      success: false,
      error: error.message
    };
    analysis.errors.push(`Emotional Analysis: ${error.message}`);
  }

  // 3. Generate summaries (these can fail independently too)
  try {
    const [neutralSummary, opposingViewpoint] = await Promise.all([
      generateNeutralSummary(text),
      generateOpposingViewpoint(text)
    ]);
    analysis.neutralSummary = neutralSummary;
    analysis.opposingViewpoint = opposingViewpoint;
  } catch (error) {
    console.error('Summary generation failed:', error);
    analysis.neutralSummary = 'Unable to generate summary. Please check your API key configuration.';
    analysis.opposingViewpoint = 'Unable to generate opposing viewpoint. Please check your API key configuration.';
    analysis.errors.push(`Summary Generation: ${error.message}`);
  }

  // 4. Fetch opposing articles (use political bias score if available)
  try {
    const biasScore = politicalBias ? politicalBias.score : 0;
    analysis.opposingArticles = await fetchOpposingArticles(text, metadata, biasScore);
  } catch (error) {
    console.error('Opposing articles fetch failed:', error);
    analysis.opposingArticles = [];
    analysis.errors.push(`Opposing Articles: ${error.message}`);
  }

  // Cache the analysis (even if it has errors)
  await setCachedAnalysis(metadata.url, analysis);

  return analysis;
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

