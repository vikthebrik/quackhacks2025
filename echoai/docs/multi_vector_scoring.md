# Multi-Vector Political Leaning Analysis

## Overview

The current GDELT analysis uses a single-vector approach (domain matching → GDELT tone). A **multi-vector system** combines multiple independent indicators for more accurate and robust political leaning detection.

## Current System Limitations

1. **Single Point of Failure**: If domain matching fails, relies solely on GDELT tone (which is unreliable)
2. **No Content Analysis**: Doesn't analyze the actual article text for political indicators
3. **Limited Context**: Only considers source reputation, not article-specific content
4. **Tone Mapping Issues**: GDELT tone (sentiment) doesn't directly map to political leaning

## Proposed Multi-Vector System

### Vector 1: Domain Reputation (Weight: 35%)
**Current Implementation**: Already exists
- **Reliability**: High (0.9 confidence)
- **Method**: Exact domain matching → Pattern matching → Keyword matching
- **Pros**: Fast, reliable for known sources
- **Cons**: Doesn't account for article-specific content

### Vector 2: Content Keyword Analysis (Weight: 25%)
**New Implementation**: Analyze article text for political keywords
- **Reliability**: Medium-High (0.6-0.8 confidence)
- **Method**: 
  - Scan text for conservative keywords (e.g., "free market", "second amendment", "border security")
  - Scan text for liberal keywords (e.g., "social justice", "climate action", "gun control")
  - Calculate weighted score based on keyword frequency and importance
- **Pros**: Article-specific, captures actual content
- **Cons**: Can be gamed, keywords may have context-dependent meanings

**Example Keywords:**
```javascript
Conservative: "free market" (0.8), "second amendment" (0.9), "border security" (0.8)
Liberal: "social justice" (0.8), "climate action" (0.7), "gun control" (0.7)
```

### Vector 3: GDELT Tone Analysis (Weight: 20%)
**Current Implementation**: Already exists (as fallback)
- **Reliability**: Medium (0.6 confidence)
- **Method**: Query GDELT API, get tone scores, reverse map to political spectrum
- **Pros**: External validation, independent source
- **Cons**: Tone ≠ political leaning, unreliable mapping

### Vector 4: Language Pattern Analysis (Weight: 12%)
**New Implementation**: Detect linguistic patterns that indicate framing
- **Reliability**: Low-Medium (0.4-0.5 confidence)
- **Method**:
  - Conservative patterns: "clearly", "obviously", "personal responsibility", "traditional"
  - Liberal patterns: "systemic", "privilege", "marginalized", "collective"
- **Pros**: Catches subtle framing techniques
- **Cons**: Low confidence, can be misleading

**Example Patterns:**
```javascript
Conservative: "clearly" (0.3), "personal responsibility" (0.6), "traditional" (0.4)
Liberal: "systemic" (0.5), "privilege" (0.5), "marginalized" (0.5)
```

### Vector 5: Framing Technique Analysis (Weight: 8%)
**New Implementation**: Detect bias through framing techniques
- **Reliability**: Low (0.3 confidence)
- **Method**:
  - Emotional appeals (outrage, scandal) → slightly conservative
  - Victim framing → slightly liberal
  - Us vs Them language → varies
- **Pros**: Catches subtle bias indicators
- **Cons**: Very low confidence, context-dependent

## Implementation Strategy

### Weighted Combination Formula

```javascript
finalScore = Σ(vectorScore × weight × confidence) / Σ(weight × confidence)
```

**Example Calculation:**
```
Domain: score=0.7, weight=0.35, confidence=0.9 → contribution = 0.7 × 0.35 × 0.9 = 0.2205
Content: score=0.5, weight=0.25, confidence=0.7 → contribution = 0.5 × 0.25 × 0.7 = 0.0875
GDELT: score=0.3, weight=0.20, confidence=0.6 → contribution = 0.3 × 0.20 × 0.6 = 0.036
Language: score=0.2, weight=0.12, confidence=0.4 → contribution = 0.2 × 0.12 × 0.4 = 0.0096
Framing: score=0.1, weight=0.08, confidence=0.3 → contribution = 0.1 × 0.08 × 0.3 = 0.0024

Total weight = (0.35×0.9) + (0.25×0.7) + (0.20×0.6) + (0.12×0.4) + (0.08×0.3) = 0.315 + 0.175 + 0.12 + 0.048 + 0.024 = 0.682
Total contribution = 0.2205 + 0.0875 + 0.036 + 0.0096 + 0.0024 = 0.356

Final Score = 0.356 / 0.682 = 0.522 (Moderately Conservative)
```

### Confidence Adjustment

Each vector's contribution is weighted by its confidence:
- High confidence vectors (domain) have more influence
- Low confidence vectors (framing) have less influence
- Missing vectors don't break the system

### Fallback Strategy

1. If all vectors fail → throw error (current behavior)
2. If some vectors fail → use available vectors, adjust weights proportionally
3. Minimum 2 vectors required for analysis

## Benefits

1. **Robustness**: Multiple independent indicators reduce single-point-of-failure
2. **Accuracy**: Combining multiple signals improves overall accuracy
3. **Transparency**: Can show which vectors contributed to the score
4. **Adaptability**: Can adjust weights based on performance
5. **Article-Specific**: Content analysis captures article-level bias, not just source bias

## Implementation Code Structure

```javascript
async function analyzeBiasMultiVector(text, metadata) {
  // 1. Run all vector analyses in parallel (where possible)
  // 2. Combine results with weighted averaging
  // 3. Return comprehensive result with vector breakdown
}
```

## Next Steps

1. Implement Vector 2 (Content Keywords) - most impactful addition
2. Implement Vector 4 (Language Patterns) - moderate impact
3. Implement Vector 5 (Framing) - low impact but adds nuance
4. Test and tune weights based on real articles
5. Add confidence thresholds and fallback logic

