from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import os

class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce HTTPS connections only
    Redirects HTTP to HTTPS in production
    """
    async def dispatch(self, request: Request, call_next):
        # Get environment mode
        env = os.environ.get('ENVIRONMENT', 'development')
        
        # Skip HTTPS check in development
        if env == 'development':
            return await call_next(request)
        
        # Check if request is HTTPS
        if request.url.scheme != 'https':
            # Check X-Forwarded-Proto header (for reverse proxies)
            forwarded_proto = request.headers.get('X-Forwarded-Proto')
            if forwarded_proto != 'https':
                # Reject non-HTTPS requests in production
                raise HTTPException(
                    status_code=403,
                    detail="HTTPS is required. Please use https:// instead of http://"
                )
        
        return await call_next(request)

class SecureHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Content Security Policy
        env = os.environ.get('ENVIRONMENT', 'development')
        if env == 'production':
            response.headers['Content-Security-Policy'] = (
                "default-src 'self' https:; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
                "style-src 'self' 'unsafe-inline' https:; "
                "img-src 'self' data: https:; "
                "font-src 'self' data: https:; "
                "connect-src 'self' https:;"
            )
        
        return response
