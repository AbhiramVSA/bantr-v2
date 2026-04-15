class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class AuthError(AppError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, status_code=401, details=details)


class ForbiddenError(AppError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, status_code=403, details=details)


class NotFoundError(AppError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, status_code=404, details=details)


class ConflictError(AppError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(code, message, status_code=409, details=details)
