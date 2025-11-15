# EchoAI Setup Guide

## Quick Start

1. **Install Dependencies**
   
   **Important:** You must be in the `echoai` directory to run `npm install`!
   
   ```bash
   cd echoai
   npm install
   ```
   
   If you get an error about `package.json` not found, make sure you're in the `echoai` directory, not the root `quackhacks2025` directory.

2. **Configure API Key**
   - Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Open the extension sidebar after loading it
   - Go to Settings section
   - Enter your API key and click Save

3. **Load Extension in Chrome**
   
   **Step-by-step:**
   
   1. Open Google Chrome browser
   
   2. Navigate to the extensions page:
      - Type `chrome://extensions` in the address bar and press Enter
      - OR go to Menu (three dots) → Extensions → Manage Extensions
   
   3. Enable Developer Mode:
      - Look for the "Developer mode" toggle in the top-right corner
      - Toggle it ON (it should turn blue/highlighted)
   
   4. Load the extension:
      - Click the "Load unpacked" button (appears after enabling Developer mode)
      - Navigate to your project folder: `quackhacks2025/echoai/extension`
      - Select the `extension` folder and click "Select Folder" (or "Open" on Mac)
   
   5. Verify installation:
      - You should see "EchoAI" appear in your extensions list
      - The extension icon should appear in your Chrome toolbar
      - If you see any errors, check the console for details
   
   **Important:** Make sure you select the `extension` folder (the one containing `manifest.json`), not the `echoai` folder!

4. **Use the Extension**
   - Navigate to any article on the web
   - Click the EchoAI extension icon in the toolbar
   - The sidebar will open showing the analysis

## Features

- **Bias Detection**: Visual bias spectrum showing political leanings
- **Neutral Summary**: AI-generated factual summary
- **Opposing Viewpoints**: Counterarguments and alternative perspectives
- **Alternative Articles**: Search queries to find different viewpoints
- **Caching**: Analyses are cached for 7 days to save API costs

## Troubleshooting

### "Could not read package.json: Error: ENOENT"
- **Solution:** Make sure you're in the `echoai` directory before running `npm install`
- Run: `cd echoai` then `npm install`
- The `package.json` file is located at `echoai/package.json`, not in the root directory

### "Gemini API key not configured"
- Make sure you've entered your API key in the Settings section of the sidebar
- Verify the API key is correct

### "Could not connect to page"
- Refresh the page you're trying to analyze
- Make sure the extension has permission to access the page

### Analysis not appearing
- Check the browser console for errors (F12)
- Verify your API key is valid
- Some pages may not have enough text content to analyze

## Development

The extension uses:
- Manifest V3
- Chrome Side Panel API
- Google Gemini API for AI analysis
- Chrome Storage API for caching

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── background.js         # Service worker (API calls)
├── contentScript.js      # Content extraction
├── sidebar/              # Side panel UI
│   ├── index.html
│   ├── sidebar.js
│   └── sidebar.css
└── utils/                # Utility functions
    ├── extractText.js
    ├── cache.js
    └── biasHeuristics.js
```

## Notes

- Icon files are referenced in manifest.json but not included. You can add icon files (16x16, 48x48, 128x128 PNG) to an `icons/` folder if desired.
- The extension works best on news articles and blog posts with substantial text content.

