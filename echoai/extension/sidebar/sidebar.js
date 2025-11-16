/**
 * Sidebar JavaScript for EchoAI
 * Handles UI updates and user interactions
 */

// DOM elements
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

// Article elements
const articleTitleEl = document.getElementById('article-title');
const articleAuthorEl = document.getElementById('article-author');
const articleDomainEl = document.getElementById('article-domain');

// Political bias elements
const biasIndicatorEl = document.getElementById('bias-indicator');
const biasLabelEl = document.getElementById('bias-label');
const biasScoreValueEl = document.getElementById('bias-score-value');
const biasExplanationEl = document.getElementById('bias-explanation');

// Emotional charge elements
const emotionalIndicatorEl = document.getElementById('emotional-indicator');
const emotionalLabelEl = document.getElementById('emotional-label');
const emotionalScoreValueEl = document.getElementById('emotional-score-value');

// Summary elements
const neutralSummaryEl = document.getElementById('neutral-summary');
const opposingViewpointEl = document.getElementById('opposing-viewpoint');

// Opposing articles elements
const opposingArticlesEl = document.getElementById('opposing-articles');

// Settings elements
const apiKeyInputEl = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const clearCacheBtn = document.getElementById('clear-cache');

let currentAnalysis = null;

/**
 * Updates the political leaning visualization
 * Score: -1 (Conservative) to 1 (Liberal), 0 (Moderate)
 * Colors: Red = Conservative, Purple = Moderate, Blue = Liberal
 */
function updateBiasVisualization(bias) {
  const score = bias.score || 0;
  const label = bias.label || 'Moderate';
  const explanation = bias.explanation || '';

  // Update bias indicator position (-1 to 1 maps to 0% to 100%)
  const position = ((score + 1) / 2) * 100;
  biasIndicatorEl.style.left = `${position}%`;

  // Update label and score
  biasLabelEl.textContent = label;
  biasScoreValueEl.textContent = score.toFixed(2);

  // Color based on position: Red (Conservative), Purple (Moderate), Blue (Liberal)
  if (score < -0.3) {
    biasIndicatorEl.className = 'spectrum-indicator conservative';
  } else if (score > 0.3) {
    biasIndicatorEl.className = 'spectrum-indicator liberal';
  } else {
    biasIndicatorEl.className = 'spectrum-indicator moderate';
  }

  // Update explanation
  if (explanation) {
    biasExplanationEl.textContent = explanation;
  } else {
    biasExplanationEl.textContent = `Political leaning: ${score.toFixed(2)} (${label})`;
  }
}

/**
 * Updates the emotional charge visualization
 * Score: -1 (Highly Emotional) to 1 (Analytical/Emotionless), 0 (Neutral)
 * Colors: Magenta = Highly Emotional, Dark Blue = Neutral, Cyan = Analytical
 */
function updateEmotionalVisualization(emotionalCharge) {
  const score = emotionalCharge.score || 0;
  const label = emotionalCharge.label || 'Neutral';

  // Update emotional indicator position (-1 to 1 maps to 0% to 100%)
  const position = ((score + 1) / 2) * 100;
  emotionalIndicatorEl.style.left = `${position}%`;

  // Update label and score
  emotionalLabelEl.textContent = label;
  emotionalScoreValueEl.textContent = score.toFixed(2);

  // Color based on position: Magenta (Emotional), Dark Blue (Neutral), Cyan (Analytical)
  if (score < -0.3) {
    emotionalIndicatorEl.className = 'spectrum-indicator emotional';
  } else if (score > 0.3) {
    emotionalIndicatorEl.className = 'spectrum-indicator analytical';
  } else {
    emotionalIndicatorEl.className = 'spectrum-indicator neutral-emotional';
  }
}

/**
 * Updates the article metadata display
 */
function updateMetadata(metadata) {
  articleTitleEl.textContent = metadata.title || 'Untitled Article';
  
  if (metadata.author) {
    articleAuthorEl.textContent = `By ${metadata.author}`;
    articleAuthorEl.style.display = 'inline';
  } else {
    articleAuthorEl.style.display = 'none';
  }
  
  articleDomainEl.textContent = metadata.domain || '';
}

/**
 * Updates the summaries
 */
function updateSummaries(analysis) {
  neutralSummaryEl.textContent = analysis.neutralSummary || 'No summary available.';
  opposingViewpointEl.textContent = analysis.opposingViewpoint || 'No opposing viewpoint available.';
}

/**
 * Updates the opposing articles display
 */
function updateOpposingArticles(articles) {
  opposingArticlesEl.innerHTML = '';
  
  if (!articles || articles.length === 0) {
    opposingArticlesEl.innerHTML = '<p>No opposing articles found.</p>';
    return;
  }

  articles.forEach(article => {
    const articleEl = document.createElement('div');
    articleEl.className = 'opposing-article-item';
    
    const linkEl = document.createElement('a');
    linkEl.href = article.url;
    linkEl.target = '_blank';
    linkEl.className = 'opposing-article-link';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'opposing-article-title';
    titleEl.textContent = article.title || 'Untitled Article';
    
    const sourceEl = document.createElement('div');
    sourceEl.className = 'opposing-article-source';
    sourceEl.textContent = article.source || 'Unknown Source';
    
    if (article.snippet) {
      const snippetEl = document.createElement('div');
      snippetEl.className = 'opposing-article-snippet';
      snippetEl.textContent = article.snippet;
      linkEl.appendChild(snippetEl);
    }
    
    linkEl.appendChild(titleEl);
    linkEl.appendChild(sourceEl);
    articleEl.appendChild(linkEl);
    opposingArticlesEl.appendChild(articleEl);
  });
}

/**
 * Displays the analysis in the UI
 */
function displayAnalysis(analysis) {
  currentAnalysis = analysis;
  
  updateMetadata(analysis.metadata);
  updateBiasVisualization(analysis.bias);
  
  // Update emotional charge if available
  if (analysis.emotionalCharge) {
    updateEmotionalVisualization(analysis.emotionalCharge);
  }
  
  updateSummaries(analysis);
  
  // Update opposing articles (new) or search queries (legacy)
  if (analysis.opposingArticles) {
    updateOpposingArticles(analysis.opposingArticles);
  } else if (analysis.searchQueries) {
    // Legacy support
    updateOpposingArticles(analysis.searchQueries.map(q => ({
      title: q,
      url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      source: 'Google Search',
      snippet: ''
    })));
  }
  
  loadingEl.style.display = 'none';
  errorEl.style.display = 'none';
  contentEl.style.display = 'block';
}

/**
 * Shows loading state
 */
function showLoading() {
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  errorEl.style.display = 'none';
}

/**
 * Shows error state
 */
function showError(message) {
  errorMessageEl.textContent = message || 'An error occurred while analyzing the article.';
  loadingEl.style.display = 'none';
  contentEl.style.display = 'none';
  errorEl.style.display = 'block';
}

/**
 * Requests article analysis from the current tab
 */
async function requestAnalysis() {
  showLoading();
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }

    // Send message to content script to extract article
    chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' }, (response) => {
      if (chrome.runtime.lastError) {
        showError('Could not connect to page. Please refresh and try again.');
        return;
      }

      if (response && response.success) {
        // The content script will send the article data to background
        // and background will analyze it. We'll wait for the analysis
        // via the message listener below.
        // Poll for results (with timeout)
        let attempts = 0;
        const maxAttempts = 30; // 15 seconds max wait
        
        const checkForAnalysis = setInterval(() => {
          attempts++;
          
          // Try to get cached analysis for this URL
          chrome.runtime.sendMessage(
            { type: 'GET_ANALYSIS', url: tab.url },
            (response) => {
              if (response && response.success && response.analysis) {
                clearInterval(checkForAnalysis);
                displayAnalysis(response.analysis);
              }
            }
          );
          
          if (attempts >= maxAttempts) {
            clearInterval(checkForAnalysis);
            showError('Analysis is taking longer than expected. Please try again.');
          }
        }, 500);
      } else {
        showError(response?.error || 'Failed to extract article content');
      }
    });
  } catch (error) {
    showError(error.message);
  }
}

/**
 * Loads saved API key
 */
async function loadApiKey() {
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInputEl.value = result.geminiApiKey;
    }
  });
}

/**
 * Saves API key
 */
async function saveApiKey() {
  const apiKey = apiKeyInputEl.value.trim();
  
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'SET_API_KEY', apiKey: apiKey },
    (response) => {
      if (response && response.success) {
        alert('API key saved successfully!');
        // Retry analysis if we have one
        if (currentAnalysis) {
          requestAnalysis();
        }
      } else {
        alert('Failed to save API key');
      }
    }
  );
}

/**
 * Clears cache
 */
async function clearCache() {
  if (confirm('Are you sure you want to clear the cache? This will remove all cached analyses.')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, (response) => {
      if (response && response.success) {
        alert('Cache cleared successfully!');
        // Refresh analysis
        requestAnalysis();
      } else {
        alert('Failed to clear cache');
      }
    });
  }
}

// Event listeners
saveApiKeyBtn.addEventListener('click', saveApiKey);
clearCacheBtn.addEventListener('click', clearCache);
retryBtn.addEventListener('click', requestAnalysis);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_SIDEBAR') {
    if (message.data) {
      displayAnalysis(message.data);
    }
  }
});

// Initialize
loadApiKey();
requestAnalysis();

// Auto-refresh when tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Small delay to ensure content script has run
    setTimeout(requestAnalysis, 1000);
  }
});

