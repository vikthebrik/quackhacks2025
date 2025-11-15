/**
 * Content script that extracts article content from web pages
 * Sends extracted data to background script for processing
 */

// Import utilities (injected via manifest or loaded separately)
// Note: In Chrome extensions, we need to inject these scripts or use importScripts
// For now, we'll include the functions directly or load them dynamically

let isProcessing = false;

/**
 * Extracts article text from the page
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

  let text = clone.innerText || clone.textContent || '';
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return text;
}

/**
 * Extracts article metadata
 */
function extractArticleMetadata() {
  const metadata = {
    title: document.title || 
      (document.querySelector('h1')?.innerText || '') ||
      (document.querySelector('[property="og:title"]')?.content || '') ||
      (document.querySelector('meta[name="title"]')?.content || ''),
    author: '',
    date: '',
    url: window.location.href,
    domain: window.location.hostname
  };

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
 * Main function to extract and send article data
 */
async function processArticle() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const text = extractArticleText();
    const metadata = extractArticleMetadata();

    if (!text || text.length < 100) {
      console.log('EchoAI: Not enough text content found');
      isProcessing = false;
      return;
    }

    // Send to background script for analysis
    chrome.runtime.sendMessage({
      type: 'ANALYZE_ARTICLE',
      data: {
        text: text,
        metadata: metadata
      }
    }, (response) => {
      if (response && response.success) {
        // Notify sidebar of new analysis
        chrome.runtime.sendMessage({
          type: 'UPDATE_SIDEBAR',
          data: response.analysis
        });
      }
    });

  } catch (error) {
    console.error('EchoAI: Error processing article:', error);
  } finally {
    isProcessing = false;
  }
}

// Listen for messages from background or sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_ARTICLE') {
    processArticle().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
});

// Auto-process when page loads (with delay to ensure DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(processArticle, 1000);
  });
} else {
  setTimeout(processArticle, 1000);
}

// Re-process when URL changes (for SPAs)
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(processArticle, 1000);
  }
}, 1000);

