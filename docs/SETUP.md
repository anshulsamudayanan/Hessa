# FAREEG AI — Setup & Execution Guide

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (runs full-stack Express + Vite on port 3000):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

## Environment Variables
The application works immediately out-of-the-box using local persistent JSON storage and browser camera APIs.
Optional configuration in `.env`:
- `PORT`: Server port (defaults to 3000).
- `CV_SERVICE_URL`: URL of the external Python FastAPI service (defaults to `http://localhost:8000`).

## Video Uploads Directory
Uploaded match videos and recording blobs are stored securely in `/uploads` on the server.
- Supported formats: `.mp4`, `.webm`, `.mov`.
- Maximum file size: 100MB per match video.
- All uploads and analysis metadata can be permanently deleted via the in-app "Delete Recording Data" button.
