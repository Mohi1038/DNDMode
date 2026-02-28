from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

print("Sending request to /api/v1/assignments/breakdown...")

response = client.post(
    "/api/v1/assignments/breakdown",
    data={
        "title": "Data Structures Assignment",
        "description": "Implement a balanced binary search tree (AVL Tree) in Python. Include methods for insertion, deletion, and searching. Also write a brief report explaining the time complexity of your operations.",
        "subject": "Computer Science",
        "deadline": "2023-12-05"
    }
)

print(f"Status Code: {response.status_code}")
print("Response JSON:")
print(json.dumps(response.json(), indent=2))
