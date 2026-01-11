# Device Authentication & Geo-Location System

## Overview
The IPTV service uses a comprehensive multi-layer authentication system combining Device UUID, MAC Address, and Canada geo-location validation.

## Authentication Layers

### 1. Device Identification
Each IPTV box is uniquely identified by:
- **MAC Address**: Hardware network address (can be set during device creation)
- **Device UUID**: Unique identifier (auto-generated or from hardware)
- **Device Name**: Customer-friendly label (e.g., "Living Room Box")

### 2. Activation System
**One-Time Activation Code**
- Generated when admin creates device in dashboard
- QR code created for easy scanning
- Customer scans QR → Opens activation URL → Enters code on TV screen
- Code becomes invalid after first use

### 3. IP Address Tracking
**Dynamic IP Support**
- Current IP address logged on each access
- IP history maintained for monitoring
- Does NOT block on IP change (supports dynamic IPs)
- ISP information captured and displayed

### 4. Geo-Location Validation (Canada Only)
**IPTV Box Restrictions**
- ✅ Must be activated within Canada
- ✅ Must be accessed from Canadian IP addresses
- ❌ Automatically suspended if accessed from outside Canada
- Uses ip-api.com for real-time geo-location checking

**Android App (Future)**
- ✅ Works anywhere in the world
- ✅ No geo-restrictions for mobile app
- Allows customers to watch content while traveling

## Device Status States

### Status Flow
```
pending → active → [suspended | deactivated]
```

### Status Definitions
1. **Pending**: Device created but not activated
2. **Active**: Successfully activated and operating in Canada
3. **Suspended**: Detected accessing from outside Canada (auto-suspended)
4. **Deactivated**: Manually disabled by admin

## API Endpoints

### Device Creation (Admin)
```
POST /api/devices
Headers: Authorization: Bearer <admin_token>
Body: {
  "device_name": "Living Room Box",
  "mac_address": "00:1A:2B:3C:4D:5E"
}
Response: Device object with activation_code and qr_code_path
```

### Device Activation (Customer)
```
POST /api/devices/activate
Body: {
  "activation_code": "<code_from_qr>",
  "device_uuid": "<optional_hardware_uuid>",
  "ip_address": "<optional_ip>"
}
Response: Success or geo-location error
```

### Guide Data Fetch (IPTV Box)
```
GET /api/devices/guide/{device_id}
Response: 
  - Channels and programs data
  - Access info with geo-location
  - Automatic IP tracking and Canada validation
  - Auto-suspend if outside Canada
```

## Geo-Location Validation Logic

### On Activation
1. Extract client IP from request
2. Query ip-api.com for geo-location
3. Check if country_code == 'CA'
4. ✅ Allow if Canada
5. ❌ Block if outside Canada with error message

### On Guide Access
1. Extract client IP from request
2. Check if IP is from Canada
3. If NOT Canada:
   - Suspend device immediately
   - Return 403 error with detected country
4. If Canada:
   - Update IP tracking
   - Log to IP history
   - Return guide data

### Fallback Behavior
If geo-location API fails, system allows access to avoid blocking legitimate users.

## IP Tracking Data Structure

### Current IP
```json
{
  "current_ip": "142.68.123.45"
}
```

### IP History Entry
```json
{
  "ip": "142.68.123.45",
  "timestamp": "2026-01-11T21:15:00Z",
  "country": "Canada",
  "region": "Ontario",
  "city": "Toronto",
  "isp": "Rogers Communications"
}
```

### Last Geo Check
```json
{
  "country": "Canada",
  "country_code": "CA",
  "region": "Ontario",
  "city": "Toronto",
  "zip": "M5H",
  "lat": 43.6532,
  "lon": -79.3832,
  "isp": "Rogers Communications",
  "timezone": "America/Toronto"
}
```

## Admin Dashboard Features

### Device Management Tab
Displays for each device:
- Device name with status icon
- MAC address
- Device UUID (truncated)
- QR code image
- Activation code
- Current IP address
- Last known location (city, region, country)
- ISP information
- Activation timestamp
- Last access timestamp
- IP history count

### Status Icons
- 🟢 Green checkmark: Active
- 🔴 Red X: Deactivated
- 🟠 Orange X: Suspended (geo-violation)
- 🟡 Yellow clock: Pending activation

## Security Features

### Multi-Factor Device Identity
1. MAC Address (hardware identifier)
2. Device UUID (unique system ID)
3. Activation Code (one-time secret)
4. IP Address + Geo-location (access validation)

### Automatic Enforcement
- Real-time Canada validation on every guide request
- Automatic suspension on geo-violation
- IP history logging for auditing
- ISP tracking for fraud detection

### Future Enhancements
- Rate limiting per device
- Suspicious activity detection
- Multiple device limit per account
- Device transfer capability
- Temporary travel passes (future Android app)

## Configuration

### Environment Variables
```bash
# Backend .env
ACTIVATION_DOMAIN=http://localhost:3000  # Base URL for QR codes
```

### Geo-Location Service
- Service: ip-api.com (free tier)
- No API key required
- Rate limit: 45 requests/minute
- Fallback: Allow access on API failure

## Testing

### Test Activation from Canada
```bash
curl -X POST http://localhost:8001/api/devices/activate \
  -H "Content-Type: application/json" \
  -d '{"activation_code": "YOUR_CODE"}'
```

### Test Guide Access
```bash
curl http://localhost:8001/api/devices/guide/DEVICE_ID
```

### Test with Specific IP
```bash
curl -X POST http://localhost:8001/api/devices/activate \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 142.68.123.45" \
  -d '{"activation_code": "YOUR_CODE"}'
```

## Error Messages

### Outside Canada Activation
```json
{
  "detail": "IPTV boxes can only be activated within Canada. Detected location: United States"
}
```

### Outside Canada Access (Auto-Suspend)
```json
{
  "detail": "IPTV boxes can only be used within Canada. Current location: Mexico. Device has been suspended."
}
```

### Invalid Activation Code
```json
{
  "detail": "Invalid activation code"
}
```

### Already Activated
```json
{
  "detail": "Device already activated"
}
```

## Customer Flow

### Initial Setup
1. Customer purchases IPTV box
2. Admin creates device in dashboard
3. Admin provides activation code/QR to customer
4. Customer connects box to internet (Canadian ISP)
5. Customer scans QR code with phone
6. Phone opens activation URL
7. Customer enters code displayed on TV screen
8. System validates Canada location
9. Device activated and ready to use

### Daily Use
1. IPTV box requests guide data
2. System checks IP is from Canada
3. System updates IP tracking
4. Returns channels and programs
5. Customer watches content

### If Traveling
- IPTV box suspended if used outside Canada
- Android app (future) works worldwide
- Customer can re-activate box when back in Canada

## Benefits Over IP-Only Approach

✅ **Supports Dynamic IPs**: Most Canadian ISPs use DHCP
✅ **Multi-Device Households**: Same IP for multiple boxes
✅ **Enhanced Security**: Multiple authentication factors
✅ **Better Monitoring**: Complete IP history and geo-data
✅ **Fraud Detection**: Unusual access patterns visible
✅ **Customer Flexibility**: Works with any Canadian ISP
