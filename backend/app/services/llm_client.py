import json
import re

import requests

from app.core.config import settings


class LLMClientError(RuntimeError):
    pass


def _extract_json(text: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```[a-zA-Z]*", "", stripped).strip()
        stripped = stripped.removesuffix("```").strip()
    return json.loads(stripped)


def _safe_text(value: object) -> str:
    try:
        return str(value)
    except Exception:
        return ""


def _format_http_error(exc: requests.HTTPError) -> str:
    response = exc.response
    if response is None:
        return _safe_text(exc)
    status = response.status_code
    detail = ""
    try:
        body = response.json()
        if isinstance(body, dict):
            if isinstance(body.get("error"), dict):
                detail = _safe_text(body["error"].get("message") or body["error"])
            else:
                detail = _safe_text(body.get("error") or body.get("message") or body)
        else:
            detail = _safe_text(body)
    except Exception:
        detail = (response.text or "").strip()
    detail = detail[:500] if detail else "No response body"
    return f"HTTP {status}: {detail}"


def _resolve_vertex_bearer(api_key: str) -> str:
    # If token provided from UI, use it directly.
    if api_key.strip():
        return api_key.strip()

    # Otherwise, try backend-bound service account credentials.
    cred_path = (settings.GOOGLE_APPLICATION_CREDENTIALS or "").strip()
    if not cred_path:
        raise LLMClientError(
            "Vertex token missing. Provide Access Token in settings or set GOOGLE_APPLICATION_CREDENTIALS on backend."
        )
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
    except Exception as exc:
        raise LLMClientError("google-auth is required for service-account Vertex auth.") from exc

    creds = service_account.Credentials.from_service_account_file(
        cred_path,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    creds.refresh(Request())
    if not creds.token:
        raise LLMClientError("Failed to obtain Vertex access token from service account.")
    return creds.token


def call_llm_json(provider: str, model: str, prompt: str, api_key: str = "", base_url: str = "") -> dict:
    provider_key = provider.lower().strip()
    try:
        if provider_key == "vertex_gemini":
            url_prefix = (base_url or "").rstrip("/")
            if not url_prefix:
                raise LLMClientError(
                    "Base URL is required for vertex_gemini. Example: "
                    "https://us-central1-aiplatform.googleapis.com/v1/projects/<PROJECT>/locations/<LOCATION>/publishers/google/models"
                )
            bearer = _resolve_vertex_bearer(api_key)
            url = f"{url_prefix}/{model}:generateContent"
            headers = {
                "Authorization": f"Bearer {bearer}",
                "content-type": "application/json",
            }
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            }
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json(text)

        if provider_key == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            params = {"key": api_key}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            }
            response = requests.post(url, params=params, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json(text)

        if provider_key == "claude":
            url = base_url or "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            payload = {
                "model": model,
                "max_tokens": 1200,
                "messages": [{"role": "user", "content": prompt}],
            }
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            text = response.json()["content"][0]["text"]
            return _extract_json(text)

        url = (base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        headers = {"content-type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        }
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]
        return _extract_json(text)
    except requests.HTTPError as exc:
        raise LLMClientError(_format_http_error(exc)) from exc
    except requests.RequestException as exc:
        raise LLMClientError(f"Network error: {_safe_text(exc)}") from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMClientError(f"Unexpected provider response format: {_safe_text(exc)}") from exc


def test_llm_connection(provider: str, model: str, api_key: str = "", base_url: str = "") -> tuple[bool, str]:
    if not provider.strip():
        return False, "Provider is required."
    if not model.strip():
        return False, "Model is required."
    provider_key = provider.strip().lower()
    if provider_key not in {"ollama", "vertex_gemini"} and not api_key.strip():
        return False, "API key is required for this provider."

    prompt = """
Return strict JSON:
{"ok": true}
""".strip()
    try:
        data = call_llm_json(
            provider=provider,
            model=model,
            prompt=prompt,
            api_key=api_key,
            base_url=base_url,
        )
        if data.get("ok") is True:
            return True, "Connection successful."
        return False, "Model responded, but not in expected JSON format."
    except LLMClientError as exc:
        return False, str(exc)
