/**
 * Local bias detection heuristics
 * Provides quick bias indicators before AI analysis
 */

// Political bias indicators (simplified)
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

// Emotional language indicators
const EMOTIONAL_WORDS = [
  'shocking', 'outrageous', 'devastating', 'amazing',
  'incredible', 'terrible', 'horrific', 'wonderful',
  'disgusting', 'brilliant', 'stupid', 'genius'
];

// Loaded language patterns
const LOADED_PATTERNS = [
  /clearly/i,
  /obviously/i,
  /undoubtedly/i,
  /everyone knows/i,
  /it's clear that/i,
  /no one can deny/i
];

/**
 * Analyzes text for bias indicators
 * Returns a preliminary bias score (-1 to 1, where -1 is left, 1 is right, 0 is neutral)
 */
function analyzeBiasHeuristics(text) {
  if (!text || text.length < 100) {
    return { score: 0, confidence: 0, indicators: [] };
  }

  const lowerText = text.toLowerCase();
  let leftScore = 0;
  let rightScore = 0;
  const indicators = [];

  // Count left bias indicators
  LEFT_BIAS_INDICATORS.forEach(indicator => {
    const matches = (lowerText.match(new RegExp(indicator, 'gi')) || []).length;
    if (matches > 0) {
      leftScore += matches;
      indicators.push({ type: 'left', term: indicator, count: matches });
    }
  });

  // Count right bias indicators
  RIGHT_BIAS_INDICATORS.forEach(indicator => {
    const matches = (lowerText.match(new RegExp(indicator, 'gi')) || []).length;
    if (matches > 0) {
      rightScore += matches;
      indicators.push({ type: 'right', term: indicator, count: matches });
    }
  });

  // Check for emotional language
  let emotionalCount = 0;
  EMOTIONAL_WORDS.forEach(word => {
    const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
    emotionalCount += matches;
  });

  // Check for loaded language
  let loadedCount = 0;
  LOADED_PATTERNS.forEach(pattern => {
    const matches = (lowerText.match(pattern) || []).length;
    loadedCount += matches;
  });

  // Calculate normalized score (-1 to 1)
  const totalIndicators = leftScore + rightScore;
  let score = 0;
  if (totalIndicators > 0) {
    score = (rightScore - leftScore) / totalIndicators;
  }

  // Confidence based on number of indicators
  const confidence = Math.min(totalIndicators / 10, 1);

  return {
    score: Math.max(-1, Math.min(1, score)), // Clamp to [-1, 1]
    confidence: confidence,
    indicators: indicators,
    emotionalLanguage: emotionalCount,
    loadedLanguage: loadedCount
  };
}

/**
 * Detects if text contains opinion vs fact
 */
function detectOpinionVsFact(text) {
  const opinionIndicators = [
    'i think', 'i believe', 'in my opinion', 'i feel',
    'should', 'must', 'ought to', 'better', 'worse',
    'good', 'bad', 'right', 'wrong'
  ];

  const factIndicators = [
    'according to', 'research shows', 'study found',
    'data indicates', 'statistics show', 'percent',
    'according to data'
  ];

  const lowerText = text.toLowerCase();
  let opinionCount = 0;
  let factCount = 0;

  opinionIndicators.forEach(phrase => {
    opinionCount += (lowerText.match(new RegExp(phrase, 'gi')) || []).length;
  });

  factIndicators.forEach(phrase => {
    factCount += (lowerText.match(new RegExp(phrase, 'gi')) || []).length;
  });

  const total = opinionCount + factCount;
  if (total === 0) return { type: 'unknown', ratio: 0.5 };

  const opinionRatio = opinionCount / total;
  
  return {
    type: opinionRatio > 0.6 ? 'opinion' : opinionRatio < 0.4 ? 'fact' : 'mixed',
    ratio: opinionRatio,
    opinionCount,
    factCount
  };
}

/**
 * Gets a bias label from score
 */
function getBiasLabel(score) {
  if (score < -0.6) return 'Strongly Left';
  if (score < -0.3) return 'Moderately Left';
  if (score < -0.1) return 'Slightly Left';
  if (score < 0.1) return 'Neutral';
  if (score < 0.3) return 'Slightly Right';
  if (score < 0.6) return 'Moderately Right';
  return 'Strongly Right';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyzeBiasHeuristics,
    detectOpinionVsFact,
    getBiasLabel
  };
}

