import json
import os
import pytest
from fastapi.testclient import TestClient
from server import app, FEEDBACK_FILE


@pytest.fixture(autouse=True)
def cleanup_feedback_file():
    """各テスト後にフィードバックファイルを削除する"""
    yield
    if os.path.exists(FEEDBACK_FILE):
        os.remove(FEEDBACK_FILE)


client = TestClient(app)


def test_post_feedback_success():
    response = client.post("/feedback", json={"name": "テスト太郎", "message": "とても良いサイトです！"})
    assert response.status_code == 201
    assert response.json() == {"status": "ok"}


def test_post_feedback_saved_to_file():
    client.post("/feedback", json={"name": "山田花子", "message": "勉強会に参加したいです。"})
    assert os.path.exists(FEEDBACK_FILE)
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["name"] == "山田花子"
    assert data[0]["message"] == "勉強会に参加したいです。"


def test_post_multiple_feedbacks():
    client.post("/feedback", json={"name": "ユーザーA", "message": "メッセージ1"})
    client.post("/feedback", json={"name": "ユーザーB", "message": "メッセージ2"})
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 2


def test_post_feedback_missing_name():
    response = client.post("/feedback", json={"message": "名前なし"})
    assert response.status_code == 422


def test_post_feedback_missing_message():
    response = client.post("/feedback", json={"name": "名前あり"})
    assert response.status_code == 422


def test_get_root():
    response = client.get("/")
    assert response.status_code == 200


def test_get_news():
    response = client.get("/news")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
