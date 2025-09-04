import json
import os
import re
from collections import Counter

import nltk
from nltk.sentiment import SentimentIntensityAnalyzer

REVIEWS_DIR = os.path.join(os.path.dirname(__file__), '..', 'reviews')
FETCH = os.path.join(REVIEWS_DIR, 'fetch.json')
OUT = os.path.join(REVIEWS_DIR, 'classified_reviews.json')

CATEGORY_PATTERNS = {
    "Crashes": r"\b(crash|crashing|crashed|freeze[sd]?|hangs?|force\s*close|stuck)\b",
    "Bugs": r"\b(bug|glitch|issue|error|fail(ed|ure)?|problem|broken|fix)\b",
    "Complaints": r"\b(slow|lag|ads?|ad-?heavy|paywall|bad|hate|worst|disappoint|annoy|expensive)\b",
    "Praises": r"\b(love|great|amazing|awesome|nice|excellent|useful|best|fantastic|smooth)\b",
    "UI/Design": r"\b(interface|UI|design|layout|look|feel|theme)\b",
    "Complaints": r"\b(slow|lag|ads?|ad-?heavy|paywall|bad|hate|worst|disappoint|annoy|expensive|confusing)\b",


}
DEFAULT_CATEGORY = "Other"

def ensure_vader():
    try:
        nltk.data.find('sentiment/vader_lexicon.zip')
    except LookupError:
        nltk.download('vader_lexicon')

def classify_category(text):
    lower = text.lower()
    for cat, pat in CATEGORY_PATTERNS.items():
        if re.search(pat, lower):
            return cat
    return DEFAULT_CATEGORY

def sentiment_label(compound):
    if compound >= 0.05:
        return "positive"
    elif compound <= -0.05:
        return "negative"
    return "neutral"

def run():
    if not os.path.exists(FETCH):
        raise FileNotFoundError("reviews/fetch.json not found. Run the scraper first.")

    ensure_vader()
    sia = SentimentIntensityAnalyzer()

    with open(FETCH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    results = []
    cat_counts = Counter()
    sent_counts = Counter()

    for r in data.get("reviews", []):
        txt = (r.get("snippet") or "").strip()
        if not txt:
            continue
        cat = classify_category(txt)
        score = sia.polarity_scores(txt)
        if score is None:
            continue
        compound = score.get("compound", 0.0)
        if compound is None:
            compound = 0.0
        if compound >= 0.05:
            sent = "positive"
        elif compound <= -0.05:
            sent = "negative"
        else:
            sent = "neutral"

        cat_counts[cat] += 1
        sent_counts[sent] += 1

        results.append({
            "id": r.get("id"),
            "rating": r.get("rating"),
            "text": txt,
            "date": r.get("date"),
            "category": cat,
            "sentiment": sent,
            "vader": score
        })

    summary = {
        "by_category": dict(cat_counts),
        "by_sentiment": dict(sent_counts),
        "total": len(results),
        "product_id": data.get("product_id"),
        "fetched_at": data.get("fetched_at")
    }

    os.makedirs(REVIEWS_DIR, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({"summary": summary, "data": results}, f, indent=2, ensure_ascii=False)

    return summary

if __name__ == "__main__":
    print(run())