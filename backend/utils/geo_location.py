import requests
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

def get_geo_location(ip_address: str) -> Optional[Dict]:
    """
    Get geo-location information for an IP address
    Returns dict with country, region, city, etc.
    Uses ip-api.com (free, no API key needed)
    """
    try:
        # Use ip-api.com free service
        response = requests.get(
            f"http://ip-api.com/json/{ip_address}",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'success':
                return {
                    'country': data.get('country'),
                    'country_code': data.get('countryCode'),
                    'region': data.get('regionName'),
                    'city': data.get('city'),
                    'zip': data.get('zip'),
                    'lat': data.get('lat'),
                    'lon': data.get('lon'),
                    'isp': data.get('isp'),
                    'timezone': data.get('timezone')
                }
            else:
                logger.warning(f"Geo-location lookup failed for {ip_address}: {data.get('message')}")
                return None
        else:
            logger.error(f"Geo-location API returned status {response.status_code}")
            return None
            
    except requests.RequestException as e:
        logger.error(f"Error fetching geo-location for {ip_address}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in geo-location lookup: {e}")
        return None

def is_canada_ip(ip_address: str) -> bool:
    """
    Check if an IP address is from Canada
    Returns True if IP is from Canada, False otherwise
    """
    geo_data = get_geo_location(ip_address)
    
    if geo_data:
        country_code = geo_data.get('country_code', '')
        return country_code == 'CA'
    
    # If geo lookup fails, return True to avoid blocking legitimate users
    logger.warning(f"Geo-location check failed for {ip_address}, allowing access")
    return True

def get_client_ip(request) -> str:
    """
    Extract client IP from request, considering proxies
    """
    # Check for X-Forwarded-For header (proxy/load balancer)
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        # Take the first IP in the list
        return forwarded.split(',')[0].strip()
    
    # Check for X-Real-IP header
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip
    
    # Fallback to direct client
    return request.client.host
