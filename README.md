# quackhacks2025
Repo for the Fall 2025 QuackHacks Project at the University of Oregon - Collaborators Listed in README
# EchoAI --- Chrome Extension for Counterpoints & Media Balance

EchoAI helps readers escape echo chambers by analyzing any article they
are viewing and instantly generating **neutral summaries**, **opposing
viewpoints**, **bias scores**, and **alternative article
recommendations**, all from a clean sidebar interface.

------------------------------------------------------------------------

## What Does EchoAI Do?

EchoAI promotes media literacy by providing: - Bias spectrum
visualization
- Article summary
- Neutral/factual summary
- Counter/opposing viewpoint summary
- Recommended readings with alternative perspectives
- Token‑efficient AI processing via Gemini

The extension lives in a **Chrome side panel**, ensuring consistent UI
across all sites.

------------------------------------------------------------------------

## Core Features

### Sidebar UI

A collapsible Chrome side panel showing: - Political/bias score bar
- Summary sections
- Alternative article recommendations

### AI-Powered Analysis

Using Google Gemini: - Summarization
- Bias detection
- Opposing viewpoint generation

### Token Cost Optimization

-   Local preprocessing
-   Chunking
-   Caching
-   Keyword filtering

### Alternative Articles

Fetched using Google Search queries such as:
`<topic> opposing viewpoint`

------------------------------------------------------------------------

## System Architecture

    User Page  → contentScript.js → background.js → Gemini API
          ↓                                 ↓
       Extracted text                 Summaries & Views
          ↓                                 ↓
           ------------→ Chrome Sidebar ←------------

------------------------------------------------------------------------

## Directory Structure

    echoai/
    │
    ├── extension/
    │   ├── manifest.json
    │   ├── background.js
    │   ├── contentScript.js
    │   ├── sidebar/
    │   │   ├── index.html
    │   │   ├── sidebar.js
    │   │   └── sidebar.css
    │   └── utils/
    │       ├── extractText.js
    │       ├── cache.js
    │       └── biasHeuristics.js
    │
    ├── docs/
    │   ├── meeting_notes.md
    │   └── roadmap.md
    │
    └── package.json

------------------------------------------------------------------------

## Getting Started

### 1. Clone the Repository

``` bash
git clone https://github.com/<your-org>/EchoAI.git
cd EchoAI
```

### 2. Install Dependencies

``` bash
npm install
```

### 3. Load the Chrome Extension

1.  Go to chrome://extensions
2.  Enable Developer Mode
3.  Load `extension/` as an unpacked extension

------------------------------------------------------------------------

## Configuration

Create a `.env` file:

    GEMINI_API_KEY=your_api_key_here

Or configure directly in the extension sidebar Settings section.

------------------------------------------------------------------------

## Troubleshooting

### Gemini API Issues Fixed! 🎉

Recent updates fixed common issues:
- ✅ "Invalid or empty response structure" errors
- ✅ Request timeout issues
- ✅ Better error messages

**Quick test:**
1. Reload extension in `chrome://extensions`
2. Open extension sidebar
3. Enter API key in Settings → Save
4. Test on any news article

**For detailed debugging:** See `echoai/QUICK_TEST.md` or `echoai/DEBUGGING_GUIDE.md`

### Common Issues

**"API key is not valid"**
- Get a new key from https://makersuite.google.com/app/apikey
- Ensure Gemini API is enabled

**"Model not available"**
- See `echoai/extension/MODEL_CONFIG.md` for alternative models
- Default is `gemini-1.5-flash`

**Timeout errors**
- Check internet connection
- Try shorter articles
- Check console (F12) for detailed errors

------------------------------------------------------------------------

## Roadmap

### Phase 1 --- Core

-   DOM text extraction
-   UI layout
-   Messaging pipeline

### Phase 2 --- AI Integration

-   Summaries
-   Counter viewpoints
-   Bias scoring

### Phase 3 --- Optimization

-   Local preprocessing
-   Token minimization
-   Caching

### Phase 4 --- UX Polish

-   Visualization
-   Article suggestions
-   Settings panel

------------------------------------------------------------------------

## Collaborators

-   **Madeline Luu**
-   **Rayna Patel**
-   **Vikram Thirumaran**

------------------------------------------------------------------------

