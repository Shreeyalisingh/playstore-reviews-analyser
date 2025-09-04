import os
import subprocess
from pathlib import Path
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

def run_scraper(force=False):
    args = ["node", "scraper/scrape_reviews.js"]
    if force:
        args.append("--force")
    print(">>", " ".join(args))
    subprocess.run(args, check=True)

def run_classifier():
    from backend.classify_reviews import run
    summary = run()
    print("Classification summary:", summary)

app = Flask(__name__, template_folder="web/templates", static_folder="web/static")
CORS(app)

@app.route("/")
def index():
    return send_from_directory("web/templates", "index.html")

@app.route("/classified-reviews")
def classified_reviews():
    p = Path("reviews/classified_reviews.json")
    if not p.exists():
        return jsonify({"error": "No classified_reviews.json yet"}), 404
    return send_from_directory("reviews", "classified_reviews.json")

if __name__ == "__main__":
    force = "--force" in os.sys.argv
    run_scraper(force=force)
    run_classifier()
    print("Starting Flask on http://localhost:5000 ...")
    app.run(host="127.0.0.1", port=5000, debug=True)