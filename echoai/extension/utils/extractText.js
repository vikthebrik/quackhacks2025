/**
 * Text extraction utilities for extracting article content from web pages
 */

/**
 * Extracts main article text from the DOM
 * Uses heuristics to find the main content area
 */
function extractArticleText() {
  // Common selectors for article content
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.content',
    'main',
    '[class*="article"]',
    '[class*="post"]',
    '[class*="story"]',
    '[id*="article"]',
    '[id*="content"]'
  ];

  let articleElement = null;

  // Try to find article element
  for (const selector of articleSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      // Check if element has substantial text content
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > 500) {
        articleElement = el;
        break;
      }
    }
    if (articleElement) break;
  }

  // Fallback: find largest text container
  if (!articleElement) {
    const allElements = document.querySelectorAll('div, section, main, article');
    let maxLength = 0;
    for (const el of allElements) {
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > maxLength && text.trim().length > 500) {
        maxLength = text.trim().length;
        articleElement = el;
      }
    }
  }

  if (!articleElement) {
    // Last resort: use body
    articleElement = document.body;
  }

  // Remove unwanted elements
  const clone = articleElement.cloneNode(true);
  const unwantedSelectors = [
    'nav', 'header', 'footer', 'aside',
    '.nav', '.navigation', '.menu',
    '.sidebar', '.ad', '.advertisement',
    '.social', '.share', '.comments',
    'script', 'style', 'noscript',
    '[class*="ad"]', '[class*="advertisement"]',
    '[id*="ad"]', '[id*="advertisement"]'
  ];

  unwantedSelectors.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Extract text
  let text = clone.innerText || clone.textContent || '';
  
  // Clean up text
  text = text
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\n\s*\n/g, '\n')  // Multiple newlines to single
    .trim();

  return text;
}

/**
 * Extracts article metadata (title, author, date, etc.)
 */
function extractArticleMetadata() {
  const metadata = {
    title: '',
    author: '',
    date: '',
    url: window.location.href,
    domain: window.location.hostname
  };

  // Extract title
  metadata.title = document.title || 
    (document.querySelector('h1')?.innerText || '') ||
    (document.querySelector('[property="og:title"]')?.content || '') ||
    (document.querySelector('meta[name="title"]')?.content || '');

  // Extract author
  const authorSelectors = [
    '[property="article:author"]',
    '[name="author"]',
    '.author',
    '[class*="author"]',
    '[rel="author"]'
  ];
  for (const selector of authorSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      metadata.author = el.content || el.innerText || el.textContent || '';
      if (metadata.author) break;
    }
  }

  // Extract date
  const dateSelectors = [
    '[property="article:published_time"]',
    '[name="publish-date"]',
    '[class*="date"]',
    'time[datetime]'
  ];
  for (const selector of dateSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      metadata.date = el.content || el.getAttribute('datetime') || el.innerText || '';
      if (metadata.date) break;
    }
  }

  return metadata;
}

/**
 * Chunks text into smaller pieces for token-efficient processing
 */
function chunkText(text, maxChunkSize = 3000) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Extracts keywords from text for search queries
 */
function extractKeywords(text, maxKeywords = 10) {
  // Simple keyword extraction (can be enhanced with NLP)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4); // Filter short words

  // Count word frequency
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Get top keywords
  const keywords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return keywords;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractArticleText,
    extractArticleMetadata,
    chunkText,
    extractKeywords
  };
}

