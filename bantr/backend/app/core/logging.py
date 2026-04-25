import json
import logging
import sys
from typing import Any, cast


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        extra_data = getattr(record, "extra_data", None)
        if isinstance(extra_data, dict):
            log_entry.update(cast(dict[str, Any], extra_data))
        return json.dumps(log_entry)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("authlib").setLevel(logging.WARNING)
