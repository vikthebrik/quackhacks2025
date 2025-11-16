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
 * REVERSED: Score: -1 (Liberal) to 1 (Conservative), 0 (Moderate)
 * Colors: Blue = Liberal (left), Purple = Moderate (center), Red = Conservative (right)
 */
function updateBiasVisualization(bias) {
  // Check if analysis failed
  if (!bias.success && bias.score === null) {
    biasLabelEl.textContent = 'Analysis Failed';
    biasScoreValueEl.textContent = 'N/A';
    biasExplanationEl.textContent = bias.explanation || bias.error || 'Political analysis could not be completed.';
    biasIndicatorEl.style.display = 'none';
    return;
  }
  
  biasIndicatorEl.style.display = 'block';
  const score = bias.score !== null ? bias.score : 0;
  const label = bias.label || 'Moderate';
  const explanation = bias.explanation || '';

  // Update bias indicator position (-1 to 1 maps to 0% to 100%)
  // Score system: -1 = Conservative, 0 = Moderate, 1 = Liberal
  // Visual: Liberal on left (0%), Conservative on right (100%)
  // Invert the position: (1 - score) / 2 * 100
  const position = ((1 - score) / 2) * 100;
  biasIndicatorEl.style.left = `${position}%`;

  // Update label and score
  biasLabelEl.textContent = label;
  if (score !== null) {
    biasScoreValueEl.textContent = score.toFixed(2);
  } else {
    biasScoreValueEl.textContent = 'N/A';
  }

  // Color based on position: Blue (Liberal/left), Purple (Moderate), Red (Conservative/right)
  if (score < -0.3) {
    biasIndicatorEl.className = 'spectrum-indicator liberal';
  } else if (score > 0.3) {
    biasIndicatorEl.className = 'spectrum-indicator conservative';
  } else {
    biasIndicatorEl.className = 'spectrum-indicator moderate';
  }

  // Update explanation
  if (explanation) {
    biasExplanationEl.textContent = explanation;
  } else {
    biasExplanationEl.textContent = `Political leaning: ${score !== null ? score.toFixed(2) : 'N/A'} (${label})`;
  }
}

/**
 * Updates the emotional charge visualization
 * Score: -1 (Highly Emotional) to 1 (Analytical/Emotionless), 0 (Neutral)
 * Colors: Purple = Highly Emotional, Dark Blue = Neutral, Green = Analytical
 */
function updateEmotionalVisualization(emotionalCharge) {
  // Check if analysis failed
  if (!emotionalCharge.success && emotionalCharge.score === null) {
    emotionalLabelEl.textContent = 'Analysis Failed';
    emotionalScoreValueEl.textContent = 'N/A';
    emotionalIndicatorEl.style.display = 'none';
    return;
  }
  
  emotionalIndicatorEl.style.display = 'block';
  const score = emotionalCharge.score !== null ? emotionalCharge.score : 0;
  const label = emotionalCharge.label || 'Neutral';

  // Update emotional indicator position (-1 to 1 maps to 0% to 100%)
  const position = ((score + 1) / 2) * 100;
  emotionalIndicatorEl.style.left = `${position}%`;

  // Update label and score
  emotionalLabelEl.textContent = label;
  if (score !== null) {
    emotionalScoreValueEl.textContent = score.toFixed(2);
  } else {
    emotionalScoreValueEl.textContent = 'N/A';
  }

  // Color based on position: Purple (Emotional), Dark Blue (Neutral), Green (Analytical)
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
  
  // Always update bias visualization (will show error if failed)
  if (analysis.bias) {
    updateBiasVisualization(analysis.bias);
  }
  
  // Always update emotional charge (will show error if failed)
  if (analysis.emotionalCharge) {
    updateEmotionalVisualization(analysis.emotionalCharge);
  }
  
  updateSummaries(analysis);
  
  // Update opposing articles
  if (analysis.opposingArticles) {
    updateOpposingArticles(analysis.opposingArticles);
  } else if (analysis.searchQueries) {
    // Legacy support
    updateOpposingArticles(analysis.searchQueries.map(q => ({
      title: q,
      url: `https.google.com/search?q=${encodeURIComponent(q)}`,
      source: 'Google Search',
      snippet: ''
    })));
  }
  
  // Show errors if any (remove any existing error sections first to prevent duplicates)
  const content = document.getElementById('content');
  const existingErrors = content.querySelectorAll('.analysis-errors');
  existingErrors.forEach(el => el.remove());
  
  // This handles partial errors from the background script
  if (analysis.error) {
    const errorSection = document.createElement('div');
    errorSection.className = 'analysis-errors';
    errorSection.style.cssText = 'padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin: 10px 0;';
    
    let errorMessage = analysis.error;
    if (errorMessage.includes('API key')) {
        errorMessage = 'Analysis failed. Please check your API key configuration.'
    }
    
    errorSection.innerHTML = `<strong>Analysis Warning:</strong> ${errorMessage}`;
    
    // Insert at top of content
    if (content && content.firstChild) {
      content.insertBefore(errorSection, content.firstChild);
    }
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
        let errorMessage = chrome.runtime.lastError.message;
        if (errorMessage.includes('Receiving end does not exist')) {
            errorMessage = 'Could not connect to page. Please refresh the tab and try again.';
        }
        showError(errorMessage);
        return;
      }

      if (response && response.success) {
        // The content script will send the article data to background
        // and background will analyze it. We'll wait for the analysis
        // via the message listener below.
        // Poll for results (with timeout)
        let attempts = 0;
        // THE ONLY CHANGE IS HERE: Increased maxAttempts from 30 to 120
        const maxAttempts = 120; // 60 seconds max wait (was 15)
        
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

  saveApiKeyBtn.textContent = 'Saving...';
  saveApiKeyBtn.disabled = true;

  // Test the key first
  chrome.runtime.sendMessage(
    { type: 'TEST_API_KEY', apiKey: apiKey },
    (testResult) => {
      if (testResult && testResult.success) {
        // If test is successful, then set it
        chrome.runtime.sendMessage(
          { type: 'SET_API_KEY', apiKey: apiKey },
          (response) => {
            saveApiKeyBtn.textContent = 'Save';
            saveApiKeyBtn.disabled = false;
            if (response && response.success) {
              alert('API key saved successfully!');
              // Retry analysis
              requestAnalysis();
            } else {
              alert('Failed to save API key');
            }
          }
        );
      } else {
        saveApiKeyBtn.textContent = 'Save';
        saveApiKeyBtn.disabled = false;
        alert(`API Key Test Failed: ${testResult.error}`);
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
  // Only refresh if the *active* tab is the one that finished loading
  if (changeInfo.status === 'complete' && tab.active) {
    // Small delay to ensure content script is fully injected and page is ready
    setTimeout(requestAnalysis, 1000);
  }
});