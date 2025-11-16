TODO:
use vader lexicon to put a new bar from neutral to extreme in terms of how emotionally charged the article is
flip local heuristics (if more left words are used, the article is likely right and vice versa)
not recommending actual articles
    - do not want to recommend searches. instead want to link to articles that display these similar/neutral/opposing viewpoints.
not running real ai analysis
    - no summaries
long wait time even though ai is not being used

extractText.js
- defining functions (library) for contentScript.js
- creating our own containers for the article to search through
- extracting article content by looking for blocks of text over 500 characters
    - help to standardize logic across all site structures
    - if no match: looks outside our predefined buckets to look through website containers
    - last resort: document.body
- clean up article text to only look at article body
    - decrease token cost
- split text into chunks for efficient API processing
- extract keywords : most used words

cache.js
- structure for cache data
- each article gets a cache key
- can hold multiple articles simultaneously
- summary, viewpoint, bias score, explanation, queries, timestamp

biasHeuristics.js
- Use vader lexicon to assess how emotionally charged the article is
    - detecting bias from the keywords and phrases
    - quick indicator of emotional bias
- use GDELT lexicon to asses the political opinion of the article

index.html
- sidebar and layout

sidebar.css
- design

contentScript.js
- chrome extension script
- implementing functions in chrome extension

sidebar.js
- loading data and visualizations into the sidebar
- linking api so that users can insert personal api key
- load and save api key
- handle user actions
- update display sections
- auto refreshes when tabs change

manifest.json
- description of chrome extension
- info that chrome extension developer mode needs

background.js
- main body of code
- generate cache key
- stores analysis in cache
- generating summaries with api
- generates search queries
- analyze bias providing bias score
- main function to analyze article
