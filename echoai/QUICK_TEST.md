# Quick Test Guide - 5 Minutes

## 🚀 Quick Steps to Test the Fixes

### 1. Reload Extension (30 seconds)
```
1. Open Chrome
2. Go to: chrome://extensions
3. Find "EchoAI"
4. Click the reload icon ↻
```

### 2. Open Console (15 seconds)
```
1. Press F12 (or right-click → Inspect)
2. Click "Console" tab
3. Keep it open
```

### 3. Test API Key (1 minute)
```
1. Click EchoAI icon in toolbar
2. Scroll to "Settings" section
3. Paste your Gemini API key
4. Click "Save"
5. Watch console for: "API key connected successfully! ✓"
```

**✅ Success:** Alert says "API key saved successfully!"  
**❌ Failed:** See console for error message

### 4. Test Article Analysis (2 minutes)
```
1. Go to any news site:
   - https://www.bbc.com/news (pick any article)
   - https://www.reuters.com
   - https://www.nytimes.com

2. Open article
3. Click EchoAI icon
4. Wait for analysis (should be < 30 seconds)
```

**✅ Success:** You see:
- Article title
- Political leaning indicator
- Emotional charge indicator  
- Neutral summary
- Opposing viewpoint

**❌ Failed:** Error message appears

### 5. Check Console Logs (1 minute)

**What you SHOULD see:**
```
✅ Making Gemini API request to: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
✅ Response status: 200 OK
✅ Successfully extracted text, length: 234
```

**What you SHOULDN'T see:**
```
❌ Gemini API error: received an invalid or empty response structure
❌ Request timed out
❌ API_KEY_INVALID
```

## 🐛 Quick Troubleshooting

### Problem: "API key is not valid"
**Fix:** 
1. Go to https://makersuite.google.com/app/apikey
2. Create/copy a new API key
3. Make sure you copy the ENTIRE key (no spaces)

### Problem: "Model not available"
**Fix:**
1. Open: `/echoai/extension/background.js`
2. Find line 130
3. Change to:
   ```javascript
   const GEMINI_MODEL = 'gemini-pro';  // Try this instead
   ```
4. Reload extension

### Problem: Still getting timeout
**Fix:**
1. Check your internet connection
2. Try a shorter article
3. Check console for exact error

### Problem: Analysis not starting
**Fix:**
1. Refresh the article page
2. Make sure article has text (not just images/video)
3. Try a different article

## 📝 Test Articles (Known to Work)

These articles work well for testing:
- https://www.bbc.com/news/world
- https://www.reuters.com/world
- https://apnews.com

## 🔍 What Changed?

**Old behavior:**
- ❌ "Invalid or empty response structure" error
- ❌ Requests timeout forever
- ❌ No helpful error messages

**New behavior:**
- ✅ Better error messages
- ✅ 30-second timeout with clear message
- ✅ Detailed console logging
- ✅ Model changed to stable version
- ✅ Safety settings to reduce blocking

## 📚 Need More Help?

1. **Read full debugging guide:** `DEBUGGING_GUIDE.md`
2. **See all changes:** `CHANGES_SUMMARY.md`
3. **Check model options:** `extension/MODEL_CONFIG.md`

## ⚡ One-Line Test

If you just want to test the API quickly, run this in the console (replace YOUR_KEY):

```javascript
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_KEY', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({contents: [{parts: [{text: 'Say hello'}]}]})
}).then(r => r.json()).then(console.log)
```

Should return: `{candidates: [{content: {parts: [{text: "Hello! ..."}]}}]}`

---

**Total time:** ~5 minutes  
**Result:** Working extension or clear error message to fix

