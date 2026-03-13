# Roku App — StreamVault TV

This document specifies the architecture, screens, and integration requirements
for a future native Roku channel application for the StreamVault TV service.

---

## Overview

The Roku app is a native BrightScript/SceneGraph application that connects to the
StreamVault backend API to deliver Live TV, On-Demand content, and Cloud Recordings
directly on Roku devices.

**Target devices:** Roku Streaming Stick 4K, Roku Ultra, Roku TV (built-in), Roku Express

---

## Authentication Flow

Roku apps use a "rendezvous" / "link code" model because Roku remotes have no keyboard.

```
1. App displays a short alphanumeric Link Code + URL on screen
   e.g. "Visit tv.yourdomain.com/link and enter: AB12CD"

2. Customer opens tv.yourdomain.com/link in a browser
3. Customer logs in with email + Google Authenticator TOTP code
4. Backend links the Roku device_id to their account
5. Roku app polls /api/roku/check-link?code=AB12CD every 3 seconds
6. When linked, app receives user_id + session token and proceeds
```

### Backend Endpoints Required

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/roku/request-link` | Generate a 6-char link code, return `{link_code, expires_in}` |
| `POST` | `/api/roku/confirm-link` | Browser side: verify TOTP, associate link_code → user_id |
| `GET`  | `/api/roku/check-link?code=` | Roku polls: returns `{linked: bool, session_token}` |
| `POST` | `/api/roku/logout` | Invalidate session |

### Re-authentication
After 45 days of inactivity the session expires and the device must re-link using
the same rendezvous flow.

---

## App Structure (SceneGraph / BrightScript)

```
/components
  ├── MainScene.xml          # Root scene — routing between screens
  ├── LinkScreen.xml         # Activation/rendezvous screen
  ├── HomeScreen.xml         # Home: featured content + nav rail
  ├── GuideScreen.xml        # Live TV EPG grid (scrollable, D-pad navigable)
  ├── VODScreen.xml          # On-Demand catalog grid
  ├── PlayerScreen.xml       # Full-screen video player (DASH/HLS)
  ├── RecordingsScreen.xml   # Cloud recordings list
  ├── SettingsScreen.xml     # Account info, logout
  └── components/
      ├── ChannelRow.xml     # Reusable EPG row component
      ├── PosterCard.xml     # VOD poster grid card
      └── LoadingSpinner.xml

/source
  ├── main.brs               # Entry point — creates MainScene
  ├── APIClient.brs          # HTTP helpers for all API calls
  ├── SessionManager.brs     # Stores/retrieves session token (Registry)
  ├── EPGParser.brs          # Parses channel + program data
  └── utils.brs              # Formatting helpers (time, duration)

/images
  ├── splash.png             # 1920×1080 splash screen
  ├── icon-hd.png            # 290×218 channel store icon
  └── icon-sd.png            # 214×144 SD icon

manifest                     # Roku channel manifest
```

---

## Screen Specifications

### 1. Link Screen (`LinkScreen.xml`)
- Large centered link code (e.g. `AB12CD`) in monospace font
- URL to visit: `tv.yourdomain.com/link`
- Animated spinner while polling
- "Cancel" button (Back key)

### 2. Home Screen (`HomeScreen.xml`)
- Top: Service logo + current time
- Left rail navigation: Guide / On Demand / Recordings / What's New / Settings
- Main area: Featured content card (current program on featured channel)
- D-pad focus management between rail and main area

### 3. Guide Screen (`GuideScreen.xml`)
- Standard EPG grid layout: channels on Y axis, time on X axis
- Time slots: 30-minute blocks, scrollable left/right
- Channel logos on left column
- Current program highlighted with blue border
- OK key → opens PlayerScreen for live stream
- Colour buttons:
  - Red: Record (creates CVR recording)
  - Green: Info overlay
  - Yellow: Go to "Now"

### 4. VOD Screen (`VODScreen.xml`)
- Category filter row (Movie / TV Show / Mini Series / etc.)
- Poster grid — 5 columns on FHD, 4 on HD
- OK → opens detail overlay with description, year, rating, Play button
- Play → opens PlayerScreen

### 5. Player Screen (`PlayerScreen.xml`)
- Full-screen `Video` node
- Stream URL from `/api/channels/{id}` (live) or `/api/media/{id}` (VOD)
- Custom transport controls (Roku native controls as fallback)
- Trick-play for VOD (rewind/fast-forward)
- Back key → returns to previous screen

### 6. Recordings Screen (`RecordingsScreen.xml`)
- List view: title, channel, date, duration, status badge
- OK → plays recording
- Options key → delete recording
- Fetched from `/api/recordings/user/{user_id}`

---

## API Integration

All requests use the same backend as the web guide-app.

```brightscript
' APIClient.brs — example GET request
Function APIGet(path as String) as Object
    url = CreateObject("roUrlTransfer")
    url.SetUrl(m.baseURL + path)
    url.AddHeader("Authorization", "Bearer " + m.sessionToken)
    url.AddHeader("Content-Type", "application/json")
    result = url.GetToString()
    Return ParseJSON(result)
End Function
```

### Key endpoints used by Roku app

| Endpoint | Used by screen |
|----------|---------------|
| `GET /api/channels?channel_type=live` | Guide, Home |
| `GET /api/programs/channel/{id}` | Guide |
| `GET /api/vod` | VOD |
| `GET /api/recordings/user/{user_id}` | Recordings |
| `GET /api/notifications` | What's New |
| `POST /api/roku/request-link` | Link Screen |
| `GET /api/roku/check-link?code=` | Link Screen (polling) |

---

## Manifest File

```
title=StreamVault TV
major_version=1
minor_version=0
build_version=1
mm_icon_focus_hd=pkg:/images/icon-hd.png
mm_icon_focus_sd=pkg:/images/icon-sd.png
splash_screen_hd=pkg:/images/splash.png
splash_color=#0a0a0a
ui_resolutions=hd,fhd
```

---

## Development Setup

### Prerequisites
- Roku device in **Developer Mode** (Home×3, Up×2, Right, Left, Right, Left, Right)
- Roku SDK: https://developer.roku.com/docs/developer-program/getting-started/roku-dev-prog.md
- VS Code + BrightScript Language extension

### Deploy to device
```bash
# Package and sideload
zip -r streamvault.zip . -x "*.git*"
curl -s --user rokudev:PASSWORD --digest \
  -F "mysubmit=Install" \
  -F "archive=@streamvault.zip" \
  http://ROKU_IP/plugin_install
```

### Useful tools
- **Roku Remote Console**: `telnet ROKU_IP 8085`
- **BrightScript Debugger**: built into VS Code extension
- **ECP API** (for automated testing): `http://ROKU_IP:8060`

---

## Publishing to Roku Channel Store

1. Create a Roku developer account at https://developer.roku.com
2. Create a **Private Channel** first for beta testing
3. Generate a signed package using the Roku packaging utility
4. Submit for certification — key requirements:
   - Closed Captions support (FCC requirement for US channels)
   - Deep-link support (`roInput` for `contentID` parameter)
   - No hard-coded IPs or URLs (use manifest or registry)
   - Splash screen must be exactly 1920×1080

---

## Future Enhancements

- **Live Pause / Time-shift**: Buffer live stream locally for ±30-minute rewind
- **Downloads**: Cache VOD content for offline playback (Roku OS 10+)
- **Voice Search**: Integrate with Roku Search (`roSearchScreen`)
- **Alexa / Google Home**: Via Roku's smart home integrations
- **4K HDR support**: Advertise `4k-hdr` capability in manifest

---

*Status: Specification complete — implementation pending*
*Prerequisite: guide-app separation and Roku link-code backend endpoints*
