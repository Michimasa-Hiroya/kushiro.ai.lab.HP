from fastapi.testclient import TestClient
from server import app

client = TestClient(app)


def test_get_root():
    response = client.get("/")
    assert response.status_code == 200


def test_get_news():
    response = client.get("/news")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_html_page():
    response = client.get("/about.html")
    assert response.status_code == 200


def test_get_nonexistent_page():
    response = client.get("/notfound.html")
    assert response.status_code == 404
