import os
import sys
import time
from datetime import datetime, timezone

import httpx


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def assert_status(response: httpx.Response, expected: int, label: str) -> None:
    if response.status_code != expected:
        fail(f"{label} returned {response.status_code}: {response.text}")


def csrf_headers(client: httpx.Client) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    if not token:
        fail("csrf_token cookie missing")
    return {"X-CSRF-Token": token}


def ensure_authenticated(client: httpx.Client, base_url: str) -> None:
    email = os.getenv("DEMO_USER_EMAIL", "bantr-demo@example.com")
    password = os.getenv("DEMO_USER_PASSWORD", "Passw0rd123!")
    username = os.getenv("DEMO_USER_USERNAME", "bantrdemo")

    register_res = client.post(
        f"{base_url}/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    if register_res.status_code not in (200, 409):
        fail(f"register failed: {register_res.status_code} {register_res.text}")

    if register_res.status_code == 409:
        login_res = client.post(
            f"{base_url}/auth/login",
            json={"email": email, "password": password},
        )
        assert_status(login_res, 200, "login")

    me_res = client.get(f"{base_url}/auth/me")
    assert_status(me_res, 200, "auth/me")


def poll_transcript(
    client: httpx.Client, base_url: str, debate_id: str, timeout_seconds: int = 60
) -> dict:
    start = time.time()
    while time.time() - start < timeout_seconds:
        transcript_res = client.get(f"{base_url}/debates/{debate_id}/transcript")
        if transcript_res.status_code == 200:
            return transcript_res.json()
        if transcript_res.status_code not in (404,):
            fail(
                f"transcript poll failed: {transcript_res.status_code} "
                f"{transcript_res.text}"
            )
        time.sleep(2)
    fail("transcript was not available before timeout")


def main() -> None:
    api_root = os.getenv("DEMO_API_ROOT", "http://localhost:8000")
    base_url = f"{api_root.rstrip('/')}/api/v1"

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        ensure_authenticated(client, base_url)
        headers = csrf_headers(client)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        create_res = client.post(
            f"{base_url}/debates",
            json={
                "title": f"POC Debate {timestamp}",
                "topic": "Should AI tutors replace human teachers?",
                "agent_prompt": (
                    "You are debating in favor of replacing teachers with AI tutors. "
                    "Be concise and evidence-driven."
                ),
                "agent_voice_id": os.getenv("DEMO_AGENT_VOICE_ID", "aria"),
            },
            headers=headers,
        )
        assert_status(create_res, 201, "create debate")
        debate = create_res.json()
        debate_id = debate["id"]
        print(f"Created debate {debate_id}")

        list_res = client.get(f"{base_url}/debates")
        assert_status(list_res, 200, "list debates")

        get_res = client.get(f"{base_url}/debates/{debate_id}")
        assert_status(get_res, 200, "get debate")

        start_res = client.post(
            f"{base_url}/debates/{debate_id}/start", headers=headers
        )
        assert_status(start_res, 200, "start debate")
        start_payload = start_res.json()
        if not start_payload.get("livekit_token"):
            fail("start debate did not return livekit_token")

        end_res = client.post(f"{base_url}/debates/{debate_id}/end", headers=headers)
        assert_status(end_res, 200, "end debate")

        transcript = poll_transcript(client, base_url, debate_id)
        if not transcript.get("full_text"):
            fail("transcript missing full_text")

        analyze_res = client.post(
            f"{base_url}/debates/{debate_id}/analyze",
            headers=headers,
        )
        assert_status(analyze_res, 201, "analyze debate")

        analysis_get_res = client.get(f"{base_url}/debates/{debate_id}/analysis")
        assert_status(analysis_get_res, 200, "get analysis")

        chat_res = client.post(
            f"{base_url}/chat",
            json={"message": "What was my strongest argument in that debate?"},
            headers=headers,
        )
        assert_status(chat_res, 200, "chat")

        history_res = client.get(f"{base_url}/chat/history")
        assert_status(history_res, 200, "chat history")
        if not isinstance(history_res.json(), list):
            fail("chat history payload is not a list")

    print("PASS: demo smoke test completed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
