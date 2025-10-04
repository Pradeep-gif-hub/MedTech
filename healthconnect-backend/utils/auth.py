from fastapi import Request, HTTPException
import jwt
from typing import Optional
import requests
from functools import lru_cache

GOOGLE_CERT_URL = "https://www.googleapis.com/oauth2/v1/certs"

@lru_cache(maxsize=1)
def get_google_public_keys():
    response = requests.get(GOOGLE_CERT_URL)
    return response.json()

async def verify_google_token(request: Request) -> Optional[dict]:
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
            
        token = auth_header.split(" ")[1]
        
        # Get the key ID from the token header
        header = jwt.get_unverified_header(token)
        key_id = header.get("kid")
        
        # Get Google's public keys
        public_keys = get_google_public_keys()
        if key_id not in public_keys:
            raise HTTPException(status_code=401, detail="Invalid token signature")
            
        public_key = public_keys[key_id]
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=["your-client-id.apps.googleusercontent.com"]  # Replace with your client ID
        )
        
        # Verify token is not expired
        if "exp" in payload and payload["exp"] < int(time.time()):
            raise HTTPException(status_code=401, detail="Token expired")
            
        return payload
        
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))