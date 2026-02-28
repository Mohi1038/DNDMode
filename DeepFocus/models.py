"""
Pydantic request / response models for the DeepFocus API.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotificationIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packageName: str = Field(..., min_length=1, max_length=256)
    appName: str = Field(..., min_length=1, max_length=128)
    title: str = Field(default="", max_length=512)
    text: str = Field(default="", max_length=4000)
    time: int = Field(..., description="Unix epoch time in milliseconds")
    notificationId: str = Field(..., min_length=1, max_length=256)
    isOngoing: bool = Field(default=False)

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("time must be a positive Unix epoch in milliseconds")
        return value


class AgentQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, max_length=2000)
    topK: int | None = Field(default=None, ge=1, le=20)


class AgentQueryResponse(BaseModel):
    response: str
    matchedNotifications: int
