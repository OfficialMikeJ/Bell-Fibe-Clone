# Bell Canada TV Guide Clone - System Architecture

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Storage**: Local Filesystem (/app/backend/uploads/)
- **Additional Libraries**: qrcode, pillow (for QR generation)

## Database Models

### 1. Channel
```json
{
  "_id": "ObjectId",
  "name": "string",
  "number": "string",
  "logo_path": "string",
  "description": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 2. Program
```json
{
  "_id": "ObjectId",
  "channel_id": "ObjectId",
  "title": "string",
  "description": "string",
  "start_time": "datetime",
  "duration_minutes": "integer",
  "date": "string (YYYY-MM-DD)",
  "created_at": "datetime"
}
```

### 3. Device
```json
{
  "_id": "ObjectId",
  "device_name": "string",
  "mac_address": "string (unique)",
  "activation_code": "string (unique)",
  "qr_code_path": "string",
  "status": "pending | active | deactivated",
  "activated_at": "datetime",
  "created_at": "datetime"
}
```

### 4. Admin
```json
{
  "_id": "ObjectId",
  "username": "string (unique)",
  "password_hash": "string",
  "created_at": "datetime"
}
```

## API Endpoints

### Channel Management
- `POST /api/channels` - Create channel (with logo upload)
- `GET /api/channels` - Get all channels
- `GET /api/channels/{id}` - Get single channel
- `PUT /api/channels/{id}` - Update channel
- `DELETE /api/channels/{id}` - Delete channel

### EPG Management
- `POST /api/programs` - Add program to channel/timeslot
- `GET /api/programs` - Get programs (filter by channel, date range)
- `GET /api/programs/channel/{channel_id}` - Get all programs for channel
- `DELETE /api/programs/{id}` - Delete program

### Device Activation
- `POST /api/devices` - Generate activation code & QR
- `GET /api/devices` - Get all devices
- `POST /api/devices/activate` - Activate device with code
- `GET /api/devices/guide/{device_id}` - Get guide data for device (public API)

### Admin Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/verify` - Verify token

### File Upload
- `POST /api/upload/logo` - Upload channel logo
- `GET /uploads/{filename}` - Serve uploaded files

## Frontend Pages

### 1. Login Page (Admin)
- Username/Password form
- Test credentials: admin/admin123

### 2. Admin Dashboard
- Channel management section
- EPG management section
- Device activation section
- Statistics overview

### 3. TV Guide (Public)
- Hidden "Add Channel" button
- Smaller, compact UI
- 7-day EPG view with 30-min intervals
- Grayed out sidebar items (PVR, DVR, CVR, etc.)

### 4. Device Activation Portal
- Enter activation code
- Display activation status

## Frontend-Backend Integration

### Remove Mock Data
- Replace `mockChannels` with API call to `/api/channels`
- Replace `mockPrograms` with API call to `/api/programs`

### State Management
- Use React Context for auth state
- Use localStorage for JWT token

## Security Features
1. JWT-based authentication for admin
2. Unique activation codes per device
3. QR codes expire after first use
4. Password hashing with bcrypt
5. CORS configuration for allowed domains

## Environment Variables (.env)
```
MONGO_URL=mongodb://localhost:27017/
DB_NAME=iptv_service
JWT_SECRET=your-secret-key-here
ACTIVATION_DOMAIN=http://localhost:8001
UPLOAD_DIR=/app/backend/uploads
```

## Future Development List
1. Android App for IPTV service
2. Multiple activation domain endpoints
3. Cloud Video Recorder (CVR) - 265 hours per customer
4. Additional recording hours (paid feature)
5. Customer registration website (separate service)
6. PVR/DVR features for Android app
7. Admin mobile app for on-the-go management
8. Real-time streaming integration
9. Payment gateway for subscriptions
10. Multi-language support

## File Structure Changes
```
/app/backend/
├── uploads/
│   ├── logos/
│   └── qr_codes/
├── models/
│   ├── channel.py
│   ├── program.py
│   ├── device.py
│   └── admin.py
├── routes/
│   ├── channels.py
│   ├── programs.py
│   ├── devices.py
│   └── auth.py
├── utils/
│   ├── security.py
│   └── qr_generator.py
└── server.py
```

## UI/UX Changes
- Reduce font sizes by 20%
- Compact channel cards (smaller featured section)
- Tighter spacing in EPG grid
- Smaller sidebar icons
- Gray out unused features with tooltip "Coming Soon"
