from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    CEO = "CEO"
    VP = "VP"
    BA = "BA"
    PM = "PM"
    PO = "PO"


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
