import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import io
import json

from main import app, AssignmentBreakdown

client = TestClient(app)

class MockGenAIResponse:
    """Mock for Google GenAI response object."""
    def __init__(self, text):
        self.text = text

@pytest.fixture
def mock_genai_client(monkeypatch):
    """Fixture to mock the Google GenAI client in main.py"""
    mock_client = MagicMock()
    
    # Default successful response
    default_response = {
        "assignment_title": "Test Assignment",
        "estimated_total_hours": 2.0,
        "chunks": [
            {
                "chunk_id": 1,
                "task_name": "Read chapter 1",
                "estimated_minutes": 60,
                "completion_weight_percent": 50.0
            },
            {
                "chunk_id": 2,
                "task_name": "Write summary",
                "estimated_minutes": 60,
                "completion_weight_percent": 50.0
            }
        ]
    }
    mock_client.models.generate_content.return_value = MockGenAIResponse(text=json.dumps(default_response))
    
    monkeypatch.setattr("main.client", mock_client)
    return mock_client

def test_breakdown_assignment_success_no_file(mock_genai_client):
    """Test successful assignment breakdown with no file attached."""
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "Math Homework",
            "description": "Complete exercises 1-10",
            "subject": "Math",
            "deadline": "2023-11-20"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["assignment_title"] == "Test Assignment"
    assert len(data["chunks"]) == 2
    assert data["estimated_total_hours"] == 2.0
    
    # Verify the genai client was called with expected arguments
    mock_genai_client.models.generate_content.assert_called_once()
    call_kwargs = mock_genai_client.models.generate_content.call_args.kwargs
    assert "Math Homework" in call_kwargs["contents"]
    assert "Complete exercises 1-10" in call_kwargs["contents"]

def test_breakdown_assignment_with_txt_file(mock_genai_client, monkeypatch):
    """Test successful assignment breakdown with a .txt file attached."""
    
    # We don't need to mock text extraction for .txt, but we can verify it was read
    file_content = b"This is a test document content."
    test_file = io.BytesIO(file_content)
    test_file.name = "test.txt"
    
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "History Essay",
            "description": "Write an essay about WW2",
            "subject": "History",
            "deadline": "2023-12-01"
        },
        files={"file": ("test.txt", test_file, "text/plain")}
    )
    
    assert response.status_code == 200
    mock_genai_client.models.generate_content.assert_called_once()
    call_kwargs = mock_genai_client.models.generate_content.call_args.kwargs
    assert "This is a test document content." in call_kwargs["contents"]

@patch("main.PyPDF2.PdfReader")
def test_breakdown_assignment_with_pdf_file(mock_pdf_reader, mock_genai_client):
    """Test successful assignment breakdown with a .pdf file attached."""
    
    # Mock PDF extraction
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Extracted PDF content."
    mock_pdf_instance = MagicMock()
    mock_pdf_instance.pages = [mock_page]
    mock_pdf_reader.return_value = mock_pdf_instance
    
    # Dummy PDF content (invalid PDF format but extraction is mocked)
    file_content = b"%PDF-1.4 dummy content"
    test_file = io.BytesIO(file_content)
    test_file.name = "test.pdf"
    
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "Science Project",
            "description": "Read the attached PDF and summarize",
            "subject": "Science",
            "deadline": "2023-11-25"
        },
        files={"file": ("test.pdf", test_file, "application/pdf")}
    )
    
    assert response.status_code == 200
    mock_pdf_reader.assert_called_once()
    mock_genai_client.models.generate_content.assert_called_once()
    call_kwargs = mock_genai_client.models.generate_content.call_args.kwargs
    assert "Extracted PDF content." in call_kwargs["contents"]

@patch("main.docx.Document")
def test_breakdown_assignment_with_docx_file(mock_docx_document, mock_genai_client):
    """Test successful assignment breakdown with a .docx file attached."""
    
    # Mock DOCX extraction
    mock_paragraph = MagicMock()
    mock_paragraph.text = "Extracted DOCX content."
    mock_docx_instance = MagicMock()
    mock_docx_instance.paragraphs = [mock_paragraph]
    mock_docx_document.return_value = mock_docx_instance
    
    # Dummy DOCX content
    file_content = b"PK dummy content format"
    test_file = io.BytesIO(file_content)
    test_file.name = "test.docx"
    
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "Literature Review",
            "description": "Read the attached Word document",
            "subject": "Literature",
            "deadline": "2023-12-10"
        },
        files={"file": ("test.docx", test_file, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    
    assert response.status_code == 200
    mock_docx_document.assert_called_once()
    mock_genai_client.models.generate_content.assert_called_once()
    call_kwargs = mock_genai_client.models.generate_content.call_args.kwargs
    assert "Extracted DOCX content." in call_kwargs["contents"]

def test_breakdown_assignment_unsupported_file_type(mock_genai_client):
    """Test assignment breakdown with an unsupported file type."""
    
    file_content = b"dummy image content"
    test_file = io.BytesIO(file_content)
    test_file.name = "test.png"
    
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "Art Project",
            "description": "Analyze the image",
            "subject": "Art",
            "deadline": "2023-12-15"
        },
        files={"file": ("test.png", test_file, "image/png")}
    )
    
    # The API still returns 200 but file content read will be empty
    assert response.status_code == 200
    mock_genai_client.models.generate_content.assert_called_once()

def test_breakdown_assignment_missing_required_fields():
    """Test that missing form fields raise a 422 Unprocessable Entity error."""
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "description": "Missing title, subject, and deadline",
        }
    )
    
    assert response.status_code == 422

def test_breakdown_assignment_genai_error(mock_genai_client):
    """Test error handling when GenAI client throws an exception."""
    mock_genai_client.models.generate_content.side_effect = Exception("API Error")
    
    response = client.post(
        "/api/v1/assignments/breakdown",
        data={
            "title": "Math Homework",
            "description": "Complete exercises 1-10",
            "subject": "Math",
            "deadline": "2023-11-20"
        }
    )
    
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to generate assignment breakdown."}
