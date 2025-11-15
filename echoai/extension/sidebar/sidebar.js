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

// Bias elements
const biasIndicatorEl = document.getElementById('bias-indicator');
const biasLabelEl = document.getElementById('bias-label');
const biasScoreValueEl = document.getElementById('bias-score-value');
const biasExplanationEl = document.getElementById('bias-explanation');

// Summary elements
const neutralSummaryEl = document.getElementById('neutral-summary');
const opposingViewpointEl = document.getElementById('opposing-viewpoint');

// Alternatives elements
const searchQueriesEl = document.getElementById('search-queries');

// Settings elements
const apiKeyInputEl = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const clearCacheBtn = document.getElementById('clear-cache');

let currentAnalysis = null;

/**
 * Updates the bias visualization
 */
function updateBiasVisualization(bias) {
  const score = bias.score || 0;
  const label = bias.label || 'Neutral';
  const explanation = bias.explanation || '';

  // Update bias indicator position (-1 to 1 maps to 0% to 100%)
  const position = ((score + 1) / 2) * 100;
  biasIndicatorEl.style.left = `${position}%`;

  // Update label and score
  biasLabelEl.textContent = label;
  biasScoreValueEl.textContent = score.toFixed(2);

  // Color based on position
  if (score < -0.3) {
    biasIndicatorEl.className = 'spectrum-indicator left';
  } else if (score > 0.3) {
    biasIndicatorEl.className = 'spectrum-indicator right';
  } else {
    biasIndicatorEl.className = 'spectrum-indicator neutral';
  }

  // Update explanation
  if (explanation) {
    biasExplanationEl.textContent = explanation;
  } else {
    biasExplanationEl.textContent = `Bias score: ${score.toFixed(2)} (${label})`;
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
 * Updates the alternative search queries
 */
function updateSearchQueries(queries) {
  searchQueriesEl.innerHTML = '';
  
  if (!queries || queries.length === 0) {
    searchQueriesEl.innerHTML = '<p>No search queries available.</p>';
    return;
  }

  queries.forEach(query => {
    const queryEl = document.createElement('div');
    queryEl.className = 'search-query-item';
    
    const linkEl = document.createElement('a');
    linkEl.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    linkEl.target = '_blank';
    linkEl.textContent = query;
    linkEl.className = 'search-link';
    
    queryEl.appendChild(linkEl);
    searchQueriesEl.appendChild(queryEl);
  });
}

/**
 * Displays the analysis in the UI
 */
function displayAnalysis(analysis) {
  currentAnalysis = analysis;
  
  updateMetadata(analysis.metadata);
  updateBiasVisualization(analysis.bias);
  updateSummaries(analysis);
  updateSearchQueries(analysis.searchQueries);
  
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

