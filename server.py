import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import json
import os
from mangum import Mangum

# The directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI()

# File paths
NEWS_FILE = os.path.join(BASE_DIR, "news.json")

# Serve static files from the same directory
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

# Load news data
def load_news():
    # Check if news file exists
    if not os.path.exists(NEWS_FILE):
        return [] # Return empty list if no news
    with open(NEWS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/news")
async def get_news():
    return load_news()

@app.get("/{page_name}.html", response_class=HTMLResponse)
async def read_page(page_name: str):
    file_path = os.path.join(BASE_DIR, f"{page_name}.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Handler for Netlify/AWS Lambda
handler = Mangum(app)
