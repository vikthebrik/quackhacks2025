/**
 * Caching utilities for storing article analyses
 * Uses Chrome storage API for persistence
 */

const CACHE_PREFIX = 'echoai_cache_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates a cache key from URL
 */
function getCacheKey(url) {
  // Normalize URL (remove query params, fragments, etc.)
  try {
    const urlObj = new URL(url);
    return CACHE_PREFIX + urlObj.origin + urlObj.pathname;
  } catch (e) {
    return CACHE_PREFIX + url;
  }
}

/**
 * Checks if cached data exists and is still valid
 */
async function getCachedAnalysis(url) {
  try {
    const key = getCacheKey(url);
    const result = await chrome.storage.local.get([key]);
    
    if (!result[key]) {
      return null;
    }

    const cached = result[key];
    const now = Date.now();

    // Check if cache is expired
    if (cached.timestamp && (now - cached.timestamp) > CACHE_EXPIRY_MS) {
      // Remove expired cache
      await chrome.storage.local.remove([key]);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Error getting cached analysis:', error);
    return null;
  }
}

/**
 * Stores analysis data in cache
 */
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

/**
 * Clears all cached analyses
 */
async function clearCache() {
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Gets cache statistics
 */
async function getCacheStats() {
  try {
    const allData = await chrome.storage.local.get(null);
    const cacheEntries = Object.keys(allData).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    return {
      count: cacheEntries.length,
      entries: cacheEntries.map(key => ({
        key: key.replace(CACHE_PREFIX, ''),
        timestamp: allData[key].timestamp
      }))
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { count: 0, entries: [] };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCachedAnalysis,
    setCachedAnalysis,
    clearCache,
    getCacheStats
  };
}

