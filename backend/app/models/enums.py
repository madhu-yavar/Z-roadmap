from enum import StrEnum


class UserRole(StrEnum):
    CEO = "CEO"
    VP = "VP"
    BA = "BA"
    PM = "PM"


class ProjectType(StrEnum):
    CLIENT = "client"
    INHOUSE = "inhouse"
    RD = "rnd"
    PIPELINE = "pipeline"


class ProjectStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    DELAYED = "delayed"
    DONE = "done"
