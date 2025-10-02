import uvicorn
from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import json
from datetime import datetime
import os

app = FastAPI()

# セッション管理のためのミドルウェアを追加
# secret_keyはセキュアなランダムな文字列にすることが推奨されます
app.add_middleware(SessionMiddleware, secret_key="your-secret-key")

# パスワードファイルのパス
PASSWORD_FILE = "C:\\Users\\User\\Desktop\\生成AI　HP\\password.json"

# パスワードの読み込み
def load_password():
    if not os.path.exists(PASSWORD_FILE):
        save_password("admin") # 初期パスワード
    with open(PASSWORD_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data["password"]

# パスワードの保存
def save_password(password):
    with open(PASSWORD_FILE, "w", encoding="utf-8") as f:
        json.dump({"password": password}, f, ensure_ascii=False, indent=4)

# ログインしているか確認するための依存関係
async def get_current_user(request: Request):
    if not request.session.get("logged_in"):
        return RedirectResponse(url="/login.html")
    return True

# 静的ファイルの配信
app.mount("/static", StaticFiles(directory="C:\\Users\\User\\Desktop\\生成AI　HP"), name="static")

# ニュースデータの読み込み
def load_news():
    with open("C:\\Users\\User\\Desktop\\生成AI　HP\\news.json", "r", encoding="utf-8") as f:
        return json.load(f)

# ニュースデータの保存
def save_news(news):
    with open("C:\\Users\\User\\Desktop\\生成AI　HP\\news.json", "w", encoding="utf-8") as f:
        json.dump(news, f, ensure_ascii=False, indent=4)

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return FileResponse("C:\\Users\\User\\Desktop\\生成AI　HP\\index.html")

@app.get("/news")
async def get_news():
    return load_news()

@app.post("/add_news", dependencies=[Depends(get_current_user)])
async def add_news(request: Request):
    data = await request.json()
    news = load_news()
    new_article = {
        "title": data["title"],
        "date": datetime.now().strftime("%Y-%m-%d"),
        "content": data["content"]
    }
    news.insert(0, new_article)
    save_news(news)
    return {"message": "News added successfully"}

@app.post("/login")
async def login(request: Request):
    data = await request.json()
    password = load_password()
    if data["password"] == password:
        request.session["logged_in"] = True
        return {"message": "Login successful"}
    else:
        raise HTTPException(status_code=401, detail="Incorrect password")

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login.html")

@app.post("/change_password", dependencies=[Depends(get_current_user)])
async def change_password(request: Request):
    data = await request.json()
    new_password = data.get("new_password")
    if not new_password:
        raise HTTPException(status_code=400, detail="New password not provided")
    save_password(new_password)
    return {"message": "Password changed successfully"}

@app.get("/admin.html", response_class=HTMLResponse, dependencies=[Depends(get_current_user)])
async def read_admin_page():
    return FileResponse("C:\\Users\\User\\Desktop\\生成AI　HP\\admin.html")

@app.get("/{page_name}.html", response_class=HTMLResponse)
async def read_page(page_name: str):
    # admin.htmlは保護されたルートで処理されるため、ここでは除外
    if page_name == "admin":
        # 依存関係がリダイレクトを処理するので、ここは呼ばれないはず
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(f"C:\\Users\\User\\Desktop\\生成AI　HP\\{page_name}.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
