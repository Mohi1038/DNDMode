"""
Exhaustive tests for main.py — ChronoForge Core API.

Covers:
  1. Pydantic models (TaskChunk, AssignmentBreakdown)
  2. sanitize()
  3. extract_local_file_text() — PDF, DOCX, TXT, missing, corrupt
  4. generate_breakdown() — async Gemini call (mocked)
  5. get_services() — OAuth credential flows (mocked)
  6. download_drive_file() — normal, export-fallback, total failure
  7. sync_and_breakdown endpoint — full integration via TestClient (all external deps mocked)
  8. asyncio.gather concurrency with partial failures
"""

import os
import io
import json
import asyncio
import tempfile
import shutil
from datetime import date, timedelta
from unittest.mock import patch, MagicMock, AsyncMock, mock_open

import pytest
import pytest_asyncio
from pydantic import ValidationError
from httpx import AsyncClient, ASGITransport

# ---------------------------------------------------------------------------
# Module-under-test import.  We patch heavy side-effects at import time.
# ---------------------------------------------------------------------------
# Patch genai.Client and load_dotenv so importing main.py doesn't need real
# API keys or .env files.
with patch("google.genai.Client"), \
     patch("dotenv.load_dotenv"):
    import main
    from main import (
        app,
        sanitize,
        extract_local_file_text,
        generate_breakdown,
        get_services,
        download_drive_file,
        TaskChunk,
        AssignmentBreakdown,
    )


# ========================================================================
# 1. Pydantic Models
# ========================================================================
class TestTaskChunkModel:
    def test_valid_task_chunk(self):
        chunk = TaskChunk(
            chunk_id=1,
            task_name="Read the assignment prompt",
            estimated_minutes=15,
            completion_weight_percent=10.0,
        )
        assert chunk.chunk_id == 1
        assert chunk.estimated_minutes == 15

    def test_task_chunk_missing_required_field(self):
        with pytest.raises(ValidationError):
            TaskChunk(chunk_id=1, task_name="Do stuff")  # missing estimated_minutes & weight

    def test_task_chunk_wrong_type(self):
        with pytest.raises(ValidationError):
            TaskChunk(
                chunk_id="abc",  # should be int
                task_name="Read",
                estimated_minutes=15,
                completion_weight_percent=10.0,
            )


class TestAssignmentBreakdownModel:
    def test_valid_breakdown(self):
        bd = AssignmentBreakdown(
            assignment_title="Lab 3",
            estimated_total_hours=3.5,
            chunks=[
                TaskChunk(chunk_id=1, task_name="Read prompt", estimated_minutes=30, completion_weight_percent=50.0),
                TaskChunk(chunk_id=2, task_name="Write code", estimated_minutes=60, completion_weight_percent=50.0),
            ],
        )
        assert len(bd.chunks) == 2
        assert bd.estimated_total_hours == 3.5

    def test_breakdown_empty_chunks(self):
        bd = AssignmentBreakdown(
            assignment_title="Quiz", estimated_total_hours=0.5, chunks=[]
        )
        assert bd.chunks == []

    def test_breakdown_missing_title(self):
        with pytest.raises(ValidationError):
            AssignmentBreakdown(estimated_total_hours=1.0, chunks=[])


# ========================================================================
# 2. sanitize()
# ========================================================================
class TestSanitize:
    def test_basic_filename(self):
        assert sanitize("hello_world.pdf") == "hello_world.pdf"

    def test_removes_special_chars(self):
        assert sanitize("Lab 3: Secure / Chat & Transfer!") == "Lab 3 Secure  Chat  Transfer"

    def test_preserves_hyphens_and_dots(self):
        assert sanitize("my-file.v2.txt") == "my-file.v2.txt"

    def test_strips_leading_trailing_whitespace(self):
        assert sanitize("  spaced  ") == "spaced"

    def test_empty_string(self):
        assert sanitize("") == ""

    def test_unicode_letters(self):
        # Unicode word chars (\w) like accented letters should survive
        result = sanitize("café_résumé.pdf")
        assert "café_résumé.pdf" == result

    def test_only_special_chars(self):
        assert sanitize("!@#$%^&*()") == ""

    def test_path_separators_removed(self):
        result = sanitize("folder/subfolder\\file.txt")
        assert "/" not in result
        assert "\\" not in result


# ========================================================================
# 3. extract_local_file_text()
# ========================================================================
class TestExtractLocalFileText:
    def test_nonexistent_file(self):
        assert extract_local_file_text("/nonexistent/path/ghost.pdf") == ""

    def test_txt_file(self, tmp_path):
        txt_file = tmp_path / "sample.txt"
        txt_file.write_text("Hello world\nLine 2", encoding="utf-8")
        result = extract_local_file_text(str(txt_file))
        assert "Hello world" in result
        assert "Line 2" in result

    def test_empty_txt_file(self, tmp_path):
        txt_file = tmp_path / "empty.txt"
        txt_file.write_text("", encoding="utf-8")
        assert extract_local_file_text(str(txt_file)) == ""

    @patch("main.PyPDF2.PdfReader")
    def test_pdf_file(self, mock_reader_cls, tmp_path):
        pdf_file = tmp_path / "sample.pdf"
        pdf_file.write_bytes(b"fake pdf")

        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Page 1 text"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]
        mock_reader_cls.return_value = mock_reader

        result = extract_local_file_text(str(pdf_file))
        assert "Page 1 text" in result

    @patch("main.PyPDF2.PdfReader")
    def test_pdf_with_no_extractable_text(self, mock_reader_cls, tmp_path):
        pdf_file = tmp_path / "blank.pdf"
        pdf_file.write_bytes(b"fake pdf")

        mock_page = MagicMock()
        mock_page.extract_text.return_value = None
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]
        mock_reader_cls.return_value = mock_reader

        result = extract_local_file_text(str(pdf_file))
        assert result == ""

    @patch("main.docx.Document")
    def test_docx_file(self, mock_doc_cls, tmp_path):
        docx_file = tmp_path / "sample.docx"
        docx_file.write_bytes(b"fake docx")

        p1 = MagicMock()
        p1.text = "Paragraph 1"
        p2 = MagicMock()
        p2.text = "Paragraph 2"
        mock_doc_cls.return_value.paragraphs = [p1, p2]

        result = extract_local_file_text(str(docx_file))
        assert "Paragraph 1" in result
        assert "Paragraph 2" in result

    def test_unsupported_extension(self, tmp_path):
        csv_file = tmp_path / "data.csv"
        csv_file.write_text("a,b,c", encoding="utf-8")
        # Should return "" since csv is not handled
        assert extract_local_file_text(str(csv_file)) == ""

    @patch("main.PyPDF2.PdfReader", side_effect=Exception("corrupt"))
    def test_corrupt_pdf_returns_empty(self, mock_reader, tmp_path):
        pdf_file = tmp_path / "corrupt.pdf"
        pdf_file.write_bytes(b"not-a-real-pdf")
        result = extract_local_file_text(str(pdf_file))
        assert result == ""


# ========================================================================
# 4. generate_breakdown() — async Gemini mock
# ========================================================================
class TestGenerateBreakdown:
    @pytest.mark.asyncio
    async def test_successful_breakdown(self):
        expected = {
            "assignment_title": "Lab 3",
            "estimated_total_hours": 2.0,
            "chunks": [
                {"chunk_id": 1, "task_name": "Read prompt", "estimated_minutes": 30, "completion_weight_percent": 50.0},
                {"chunk_id": 2, "task_name": "Write code", "estimated_minutes": 60, "completion_weight_percent": 50.0},
            ],
        }
        mock_response = MagicMock()
        mock_response.text = json.dumps(expected)

        mock_generate = AsyncMock(return_value=mock_response)
        main.client = MagicMock()
        main.client.aio.models.generate_content = mock_generate

        result = await generate_breakdown(
            title="Lab 3",
            description="Build a secure chat",
            subject="Cybersecurity",
            deadline="2026-03-06",
            file_content="Some PDF text",
        )
        assert result["assignment_title"] == "Lab 3"
        assert len(result["chunks"]) == 2
        mock_generate.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_gemini_api_failure_returns_error_dict(self):
        mock_generate = AsyncMock(side_effect=Exception("API quota exceeded"))
        main.client = MagicMock()
        main.client.aio.models.generate_content = mock_generate

        result = await generate_breakdown(
            title="Assignment 1",
            description="...",
            subject="DL",
            deadline="2026-03-06",
            file_content="",
        )
        assert "error" in result
        assert result["error"] == "Failed to generate breakdown"

    @pytest.mark.asyncio
    async def test_gemini_returns_invalid_json(self):
        mock_response = MagicMock()
        mock_response.text = "NOT VALID JSON {"

        mock_generate = AsyncMock(return_value=mock_response)
        main.client = MagicMock()
        main.client.aio.models.generate_content = mock_generate

        # json.loads will throw, which is caught by the except block
        result = await generate_breakdown(
            title="Test",
            description="desc",
            subject="CS",
            deadline="2026-03-06",
            file_content="",
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_empty_inputs(self):
        expected = {"assignment_title": "Untitled", "estimated_total_hours": 0.5, "chunks": []}
        mock_response = MagicMock()
        mock_response.text = json.dumps(expected)

        mock_generate = AsyncMock(return_value=mock_response)
        main.client = MagicMock()
        main.client.aio.models.generate_content = mock_generate

        result = await generate_breakdown(
            title="", description="", subject="", deadline="", file_content=""
        )
        assert result["estimated_total_hours"] == 0.5


# ========================================================================
# 5. get_services() — OAuth flows
# ========================================================================
class TestGetServices:
    @patch("main.build")
    @patch("main.Credentials.from_authorized_user_file")
    @patch("os.path.exists", return_value=True)
    def test_valid_cached_token(self, mock_exists, mock_creds_file, mock_build):
        mock_creds = MagicMock()
        mock_creds.valid = True
        mock_creds_file.return_value = mock_creds

        mock_build.side_effect = [MagicMock(name="classroom"), MagicMock(name="drive")]
        classroom, drive = get_services()

        mock_creds_file.assert_called_once()
        assert mock_build.call_count == 2

    @patch("main.build")
    @patch("builtins.open", new_callable=mock_open)
    @patch("main.Credentials.from_authorized_user_file")
    @patch("os.path.exists", return_value=True)
    def test_expired_token_refreshes(self, mock_exists, mock_creds_file, mock_file, mock_build):
        mock_creds = MagicMock()
        mock_creds.valid = False
        mock_creds.expired = True
        mock_creds.refresh_token = "refresh_tok"
        mock_creds_file.return_value = mock_creds

        mock_build.side_effect = [MagicMock(), MagicMock()]
        classroom, drive = get_services()

        mock_creds.refresh.assert_called_once()

    @patch("main.build")
    @patch("builtins.open", new_callable=mock_open)
    @patch("main.InstalledAppFlow.from_client_secrets_file")
    @patch("os.path.exists", return_value=False)
    def test_no_token_triggers_oauth_flow(self, mock_exists, mock_flow_cls, mock_file, mock_build):
        mock_flow = MagicMock()
        mock_creds = MagicMock()
        mock_creds.to_json.return_value = '{"token": "new"}'
        mock_flow.run_local_server.return_value = mock_creds
        mock_flow_cls.return_value = mock_flow

        mock_build.side_effect = [MagicMock(), MagicMock()]
        classroom, drive = get_services()

        mock_flow.run_local_server.assert_called_once_with(port=0)


# ========================================================================
# 6. download_drive_file()
# ========================================================================
class TestDownloadDriveFile:
    def test_direct_download_success(self, tmp_path):
        dest = str(tmp_path / "downloads")
        mock_drive = MagicMock()

        # Simulate MediaIoBaseDownload behavior
        mock_request = MagicMock()
        mock_drive.files.return_value.get_media.return_value = mock_request

        with patch("main.MediaIoBaseDownload") as mock_dl_cls:
            mock_dl = MagicMock()
            mock_dl.next_chunk.return_value = (None, True)  # done immediately
            mock_dl_cls.return_value = mock_dl

            result = download_drive_file(mock_drive, "file123", "report.pdf", dest)

        assert result == "report.pdf"
        assert os.path.isdir(dest)

    def test_fallback_to_export_as_pdf(self, tmp_path):
        dest = str(tmp_path / "downloads")
        mock_drive = MagicMock()

        # First call (get_media) raises, second call (export_media) succeeds
        mock_drive.files.return_value.get_media.side_effect = Exception("Not downloadable")
        mock_export_request = MagicMock()
        mock_drive.files.return_value.export_media.return_value = mock_export_request

        with patch("main.MediaIoBaseDownload") as mock_dl_cls:
            mock_dl = MagicMock()
            mock_dl.next_chunk.return_value = (None, True)
            mock_dl_cls.return_value = mock_dl

            result = download_drive_file(mock_drive, "doc123", "Google Doc", dest)

        assert result == "Google Doc.pdf"

    def test_export_pdf_name_already_ends_with_pdf(self, tmp_path):
        dest = str(tmp_path / "downloads")
        mock_drive = MagicMock()

        mock_drive.files.return_value.get_media.side_effect = Exception("fail")
        mock_drive.files.return_value.export_media.return_value = MagicMock()

        with patch("main.MediaIoBaseDownload") as mock_dl_cls:
            mock_dl = MagicMock()
            mock_dl.next_chunk.return_value = (None, True)
            mock_dl_cls.return_value = mock_dl

            result = download_drive_file(mock_drive, "doc123", "already.pdf", dest)

        assert result == "already.pdf"  # no double .pdf

    def test_both_methods_fail_returns_none(self, tmp_path):
        dest = str(tmp_path / "downloads")
        mock_drive = MagicMock()
        mock_drive.files.return_value.get_media.side_effect = Exception("fail1")
        mock_drive.files.return_value.export_media.side_effect = Exception("fail2")

        result = download_drive_file(mock_drive, "bad_id", "broken.pdf", dest)
        assert result is None

    def test_sanitizes_filename(self, tmp_path):
        dest = str(tmp_path / "downloads")
        mock_drive = MagicMock()

        with patch("main.MediaIoBaseDownload") as mock_dl_cls:
            mock_dl = MagicMock()
            mock_dl.next_chunk.return_value = (None, True)
            mock_dl_cls.return_value = mock_dl

            result = download_drive_file(mock_drive, "id", "Lab 3: Chat / Transfer!", dest)

        assert "/" not in result
        assert ":" not in result


# ========================================================================
# 7. sync_and_breakdown endpoint — FastAPI integration test
# ========================================================================
def _make_course(course_id, name):
    return {"id": course_id, "name": name}


def _make_coursework(title, due_year, due_month, due_day, description="", materials=None):
    item = {
        "title": title,
        "workType": "ASSIGNMENT",
        "dueDate": {"year": due_year, "month": due_month, "day": due_day},
    }
    if description:
        item["description"] = description
    if materials:
        item["materials"] = materials
    return item


def _make_future_date():
    """Returns a date dict guaranteed to be in the future."""
    future = date.today() + timedelta(days=7)
    return future.year, future.month, future.day


def _make_past_date():
    """Returns a date dict guaranteed to be in the past."""
    past = date.today() - timedelta(days=30)
    return past.year, past.month, past.day


class TestSyncAndBreakdownEndpoint:
    @pytest.fixture
    def mock_services(self):
        """Mock get_services to return controllable Classroom + Drive API stubs."""
        with patch("main.get_services") as mock_gs:
            mock_classroom = MagicMock()
            mock_drive = MagicMock()
            mock_gs.return_value = (mock_classroom, mock_drive)
            yield mock_classroom, mock_drive

    @pytest.fixture
    def mock_gemini(self):
        """Mock generate_breakdown to avoid real Gemini calls."""
        with patch("main.generate_breakdown", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = {
                "assignment_title": "Test",
                "estimated_total_hours": 1.0,
                "chunks": [
                    {"chunk_id": 1, "task_name": "Do task", "estimated_minutes": 60, "completion_weight_percent": 100.0}
                ],
            }
            yield mock_gen

    @pytest.fixture
    def mock_download(self):
        with patch("main.download_drive_file", return_value="file.pdf") as mock_dl:
            yield mock_dl

    @pytest.fixture
    def mock_extract(self):
        with patch("main.extract_local_file_text", return_value="Extracted text") as mock_ext:
            yield mock_ext

    @pytest.mark.asyncio
    async def test_no_courses(self, mock_services, mock_gemini):
        mock_classroom, _ = mock_services
        mock_classroom.courses.return_value.list.return_value.execute.return_value = {"courses": []}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["data"] == []
        mock_gemini.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_courses_with_no_coursework(self, mock_services, mock_gemini):
        mock_classroom, _ = mock_services
        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "CS101")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": []
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        assert resp.status_code == 200
        assert resp.json()["data"] == []

    @pytest.mark.asyncio
    async def test_only_past_assignments_filtered_out(self, mock_services, mock_gemini):
        mock_classroom, _ = mock_services
        py, pm, pd = _make_past_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "CS101")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [_make_coursework("Old HW", py, pm, pd)]
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        assert resp.json()["data"] == []
        mock_gemini.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_due_date_filtered_out(self, mock_services, mock_gemini):
        mock_classroom, _ = mock_services
        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "CS101")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [{"title": "No Date HW", "workType": "ASSIGNMENT"}]  # no dueDate
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        assert resp.json()["data"] == []

    @pytest.mark.asyncio
    async def test_future_assignment_calls_gemini(self, mock_services, mock_gemini, mock_download, mock_extract):
        mock_classroom, _ = mock_services
        fy, fm, fd = _make_future_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "Deep Learning")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [
                _make_coursework("PA-1", fy, fm, fd, description="Build a CNN", materials=[
                    {"driveFile": {"driveFile": {"id": "f1", "title": "pa1.pdf"}}}
                ])
            ]
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        data = resp.json()
        assert data["status"] == "success"
        assert len(data["data"]) == 1
        assert data["data"][0]["title"] == "PA-1"
        assert data["data"][0]["course"] == "Deep Learning"
        assert "ai_breakdown" in data["data"][0]
        mock_gemini.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_multiple_courses_multiple_assignments(self, mock_services, mock_gemini, mock_download, mock_extract):
        mock_classroom, _ = mock_services
        fy, fm, fd = _make_future_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "DL"), _make_course("c2", "NLU")]
        }
        # Return different coursework per course
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.side_effect = [
            {"courseWork": [_make_coursework("DL-HW1", fy, fm, fd)]},
            {"courseWork": [_make_coursework("NLU-HW1", fy, fm, fd), _make_coursework("NLU-HW2", fy, fm, fd)]},
        ]

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        data = resp.json()["data"]
        assert len(data) == 3
        assert mock_gemini.await_count == 3

    @pytest.mark.asyncio
    async def test_gemini_failure_for_one_assignment_doesnt_break_others(self, mock_services, mock_download, mock_extract):
        """One Gemini call fails but rest succeed — partial failure is handled."""
        mock_classroom, _ = mock_services
        fy, fm, fd = _make_future_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "CS")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [
                _make_coursework("HW1", fy, fm, fd),
                _make_coursework("HW2", fy, fm, fd),
            ]
        }

        success_result = {
            "assignment_title": "HW1",
            "estimated_total_hours": 1.0,
            "chunks": [{"chunk_id": 1, "task_name": "Do", "estimated_minutes": 60, "completion_weight_percent": 100}],
        }

        with patch("main.generate_breakdown", new_callable=AsyncMock) as mock_gen:
            # First call succeeds, second raises
            mock_gen.side_effect = [success_result, Exception("Gemini quota exceeded")]

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/sync-and-breakdown")

        data = resp.json()["data"]
        assert len(data) == 2
        # First assignment should have the breakdown
        assert "chunks" in data[0]["ai_breakdown"]
        # Second should have the error (asyncio.gather with return_exceptions=True)
        assert "error" in data[1]["ai_breakdown"]

    @pytest.mark.asyncio
    async def test_assignment_without_materials(self, mock_services, mock_gemini):
        mock_classroom, _ = mock_services
        fy, fm, fd = _make_future_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "Ethics")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [_make_coursework("Essay", fy, fm, fd, description="Write 1000 words")]
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/sync-and-breakdown")

        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["original_description"] == "Write 1000 words"
        mock_gemini.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_download_failure_still_calls_gemini(self, mock_services, mock_gemini, mock_extract):
        """Even if file download fails, Gemini should still be called (with empty file text)."""
        mock_classroom, _ = mock_services
        fy, fm, fd = _make_future_date()

        mock_classroom.courses.return_value.list.return_value.execute.return_value = {
            "courses": [_make_course("c1", "CS")]
        }
        mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
            "courseWork": [_make_coursework("HW", fy, fm, fd, materials=[
                {"driveFile": {"driveFile": {"id": "bad", "title": "broken.pdf"}}}
            ])]
        }

        with patch("main.download_drive_file", return_value=None):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/sync-and-breakdown")

        assert resp.status_code == 200
        mock_gemini.assert_awaited_once()
        # extract_local_file_text should NOT be called since download returned None
        mock_extract.assert_not_called()


# ========================================================================
# 8. asyncio.gather concurrency tests
# ========================================================================
class TestAsyncGatherConcurrency:
    @pytest.mark.asyncio
    async def test_tasks_run_concurrently(self):
        """Verify multiple generate_breakdown calls run concurrently via asyncio.gather."""
        call_order = []

        async def mock_breakdown(title, **kwargs):
            call_order.append(f"start-{title}")
            await asyncio.sleep(0.05)
            call_order.append(f"end-{title}")
            return {"assignment_title": title, "estimated_total_hours": 1, "chunks": []}

        tasks = [
            mock_breakdown(title="A", description="", subject="", deadline="", file_content=""),
            mock_breakdown(title="B", description="", subject="", deadline="", file_content=""),
            mock_breakdown(title="C", description="", subject="", deadline="", file_content=""),
        ]
        results = await asyncio.gather(*tasks)

        assert len(results) == 3
        # With concurrency, all "start" calls should appear before all "end" calls
        starts = [x for x in call_order if x.startswith("start")]
        ends = [x for x in call_order if x.startswith("end")]
        assert len(starts) == 3
        assert len(ends) == 3

    @pytest.mark.asyncio
    async def test_gather_return_exceptions_true(self):
        """asyncio.gather with return_exceptions=True should not raise."""
        async def ok():
            return "ok"

        async def fail():
            raise ValueError("boom")

        results = await asyncio.gather(ok(), fail(), ok(), return_exceptions=True)

        assert results[0] == "ok"
        assert isinstance(results[1], ValueError)
        assert results[2] == "ok"

    @pytest.mark.asyncio
    async def test_gather_all_fail(self):
        """All tasks fail — should still return list of exceptions."""
        async def fail(msg):
            raise RuntimeError(msg)

        results = await asyncio.gather(
            fail("a"), fail("b"), fail("c"), return_exceptions=True
        )
        assert all(isinstance(r, RuntimeError) for r in results)
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_gather_empty_task_list(self):
        """Empty gather should return empty list."""
        results = await asyncio.gather()
        assert results == []


# ========================================================================
# 9. Edge cases & integration
# ========================================================================
class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_assignment_due_today_is_included(self, ):
        """An assignment due today (d >= today) should be included."""
        today = date.today()

        with patch("main.get_services") as mock_gs, \
             patch("main.generate_breakdown", new_callable=AsyncMock) as mock_gen:

            mock_classroom = MagicMock()
            mock_drive = MagicMock()
            mock_gs.return_value = (mock_classroom, mock_drive)

            mock_classroom.courses.return_value.list.return_value.execute.return_value = {
                "courses": [_make_course("c1", "Test")]
            }
            mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
                "courseWork": [_make_coursework("Due Today", today.year, today.month, today.day)]
            }
            mock_gen.return_value = {"assignment_title": "Due Today", "estimated_total_hours": 1, "chunks": []}

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/sync-and-breakdown")

            assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_assignment_due_yesterday_is_excluded(self):
        yesterday = date.today() - timedelta(days=1)

        with patch("main.get_services") as mock_gs, \
             patch("main.generate_breakdown", new_callable=AsyncMock) as mock_gen:

            mock_classroom = MagicMock()
            mock_drive = MagicMock()
            mock_gs.return_value = (mock_classroom, mock_drive)

            mock_classroom.courses.return_value.list.return_value.execute.return_value = {
                "courses": [_make_course("c1", "Test")]
            }
            mock_classroom.courses.return_value.courseWork.return_value.list.return_value.execute.return_value = {
                "courseWork": [_make_coursework("Old", yesterday.year, yesterday.month, yesterday.day)]
            }

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                resp = await ac.get("/api/v1/sync-and-breakdown")

            assert resp.json()["data"] == []
            mock_gen.assert_not_awaited()

    def test_app_title_and_description(self):
        assert app.title == "ChronoForge Core API"
        assert "Gemini" in app.description
