from pydantic import BaseModel


class BulkIdsIn(BaseModel):
    ids: list[int]


class BulkDeleteOut(BaseModel):
    deleted: int
