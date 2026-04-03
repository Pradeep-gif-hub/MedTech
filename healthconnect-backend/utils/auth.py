from fastapi import Request, HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests
from google.auth.exceptions import GoogleAuthError
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_GOOGLE_CLIENT_ID = "693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com"
LEGACY_GOOGLE_CLIENT_ID = "354042134567-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6.apps.googleusercontent.com"


def _get_allowed_google_client_ids() -> list[str]:
    """
    Build ordered list of accepted Google OAuth client IDs.
    Supports:
    - GOOGLE_CLIENT_ID (single)
    - GOOGLE_CLIENT_IDS (comma-separated)
    - built-in fallback and legacy compatibility IDs
    """
    ids: list[str] = []

    primary = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    if primary:
        ids.append(primary)

    raw_multi = os.getenv("GOOGLE_CLIENT_IDS") or ""
    for value in raw_multi.split(","):
        candidate = value.strip()
        if candidate:
            ids.append(candidate)

    ids.extend([DEFAULT_GOOGLE_CLIENT_ID, LEGACY_GOOGLE_CLIENT_ID])

    # De-duplicate while preserving order.
    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in ids:
        if candidate not in seen:
            deduped.append(candidate)
            seen.add(candidate)

    return deduped

async def verify_google_token(request: Request) -> Optional[dict]:
    """
    Async function to verify Google OAuth token from Authorization header.
    Required for proper async/await handling in FastAPI.
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
        
        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing Google token")
        
        allowed_client_ids = _get_allowed_google_client_ids()
        if not allowed_client_ids:
            raise HTTPException(status_code=500, detail="Google Client ID not configured")
        
        # Verify token using Google's official library.
        idinfo = None
        verify_errors: list[str] = []
        for client_id in allowed_client_ids:
            try:
                idinfo = id_token.verify_oauth2_token(
                    token,
                    requests.Request(),
                    client_id,
                )
                break
            except ValueError as exc:
                verify_errors.append(f"{client_id}: {exc}")
            except GoogleAuthError as exc:
                verify_errors.append(f"{client_id}: {exc}")

        if not idinfo:
            if verify_errors:
                # Keep the error concise but actionable for debugging client-id mismatches.
                raise HTTPException(status_code=401, detail="Invalid or expired Google token")
            raise HTTPException(status_code=401, detail="Google token verification failed")
        
        # Verify issuer is Google
        if idinfo.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        if not idinfo.get("email"):
            raise HTTPException(status_code=401, detail="Google account email is unavailable")
        
        # Return structured user data
        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "email_verified": idinfo.get("email_verified")
        }
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired Google token")
    except GoogleAuthError as exc:
        raise HTTPException(status_code=401, detail=f"Google token verification error: {exc}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}")