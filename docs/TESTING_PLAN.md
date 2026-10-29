# FAREEG AI — Quality & Testing Plan

## Test Vectors

### 1. Camera Acquisition & Device Permissions
- **Permitted Feed**: Browser prompts user for camera permission upon entering arena. Live feed renders with low latency.
- **Permission Denied**: Displays prominent guidance instructions with "Switch to Video Upload" fallback button.
- **Camera Device Switch**: When multiple webcams are connected, selector switches streams cleanly.
- **Stream Teardown**: Exiting the camera screen stops all `MediaStreamTrack`s immediately.

### 2. MediaRecorder & Video Upload
- **Capture**: User records 10-30 seconds of play. Timer increments in HUD.
- **Stop & Preview**: MediaRecorder generates valid Blob; preview player renders controls.
- **Upload Progress**: XHR upload dispatches progress events from 0% to 100%.
- **Validation**: Rejects non-video files or files exceeding 100MB with user-friendly error banners.

### 3. Asynchronous Analysis Job Queue
- **State Progression**: `queued` -> `processing` (progress percent 20%, 55%, 85%) -> `review_required`.
- **Anti-Slop Compliance**: Disconnected external CV engine is clearly displayed. Demonstration mode candidate events are explicitly labelled.

### 4. Event Review & Deterministic Scoring Engine
- **Video Seeking**: Clicking an event timestamp seeks the video element directly to that timestamp.
- **Confirm / Reject**: Clicking "Confirm" updates match scores immediately; "Reject" leaves score unchanged.
- **Host Manual Event**: Host can manually add missing events (e.g. goal scored outside camera field).
- **Match Finalization**: Locks official scores and propagates results to the tournament leaderboard.
