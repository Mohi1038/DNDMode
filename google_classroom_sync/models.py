"""
Pydantic schemas for the Google Classroom Sync API.
"""

from pydantic import BaseModel, Field


class TaskChunk(BaseModel):
    chunk_id: int = Field(description="Sequential ID of the chunk (1, 2, 3...)")
    task_name: str = Field(description="Actionable name of the task, starting with a verb")
    estimated_minutes: int = Field(description="Estimated time in minutes. MUST be strictly <= 60.")
    completion_weight_percent: float = Field(
        description="Percentage this chunk contributes to the total assignment"
    )


class AssignmentBreakdown(BaseModel):
    assignment_title: str
    estimated_total_hours: float = Field(
        description="Total estimated hours to complete the assignment from scratch"
    )
    chunks: list[TaskChunk] = Field(
        description="List of sub-tasks broken down into 1-hour maximum chunks"
    )
