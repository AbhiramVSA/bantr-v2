import bcrypt

from app.core.security import hash_password, verify_password


def test_hash_password_uses_pbkdf2_and_verifies():
    hashed = hash_password("Passw0rd123!")

    assert hashed.startswith("$pbkdf2-sha256$")
    assert verify_password("Passw0rd123!", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_supports_legacy_bcrypt_hashes():
    hashed = bcrypt.hashpw(b"Passw0rd123!", bcrypt.gensalt()).decode("utf-8")

    assert verify_password("Passw0rd123!", hashed) is True
    assert verify_password("wrong-password", hashed) is False
