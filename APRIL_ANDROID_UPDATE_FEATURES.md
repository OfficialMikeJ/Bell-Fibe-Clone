# StreamVault — April Android Update Features
**Version:** 0.94.0.1.A (Alpha build)
**Target Release:** April 2026
**Document Purpose:** Hand this file to Gemini or any AI assistant to get up-to-date release notes,
feature summaries, and bug fix descriptions for each new build of the StreamVault Android app.

---

## How to Use This File
1. Paste this file to Gemini (or any AI) and say:
   > "Update the 'App Refinements', 'New Features', and 'Bug Fixes' sections based on the following changes: [describe changes here]"
2. Commit the updated file back to the project.
3. Paste the new sections into the StreamVault Admin → Home Feed or App Info tab.

---

## Current Version: 0.94.0.1.A (Alpha build)

### App Refinements
- Updated the EPG Guide UI: each channel time-slot card now uses a deep purple card layout for a premium look.
- Enlarged channel info panel uses a purple-tinted background to match the new guide aesthetic.
- Improved visual hierarchy in the EPG — program titles are bolder and descriptors are subtler.

### New Features
- **Media Catalog (IMDB System)**: A fully custom media catalog is now built into the admin dashboard. Admins can add movies, TV series, documentaries, and more with full metadata including director, cast members (with photos), genres, release date, runtime, rating, studio, country, and a description/bio. Supports poster upload, backdrop upload, additional gallery images, and per-cast-member photo uploads.
- **User Settings Tab**: Customers can now configure their personal preferences — including default preview volume (slider), auto-play preview toggle (on/off), and preferred streaming quality hint (Auto / High / Low).
- **Auto Volume Adjustment**: The HLS channel preview player no longer starts muted at full blast. It now defaults to 30% volume for a comfortable experience. Hover over the player to reveal a volume slider with a real-time percentage readout.
- **App Info Tab**: A new "App Info" section in the sidebar displays the current version ID and release notes. A popup automatically appears the first time you open a new version — shows what's new and what was fixed, formatted in clean bullet-point sections.
- **VOD On-Demand Channel**: A dedicated "On Demand" channel in the EPG grid links directly to the VOD movie library, making it easy to browse content from the guide.
- **Home Feed**: Admins can now post App Update and Upcoming Feature announcements visible on the customer-facing Home page.

### Bug Fixes
- *(To be filled in as bugs are resolved)*

---

## Upcoming / In Development
- Live TV Tuner integration (Free-to-Air channel streaming)
- VOD file upload system for movies and TV shows
- Volume slider in the EPG mini-player
- Credential rotation (admin can regenerate device passwords)
- CVR automated recording scheduler

---

## Version History
| Version | Date | Notes |
|---------|------|-------|
| 0.94.0.1.A | April 2026 | Alpha build — UI overhaul, Media Catalog, User Settings, Auto Volume |
| 0.93.x | Feb 2026 | Home Feed, Docker production setup, Username/Password activation |
| 0.92.x | Jan 2026 | HLS preview player, Coming Soon channels, VOD section |

---

*Last updated: February 2026*
