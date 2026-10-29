# FAREEG AI — Computer Vision API Contract

## 1. Overview
FAREEG AI decouples frontend tournament management and camera acquisition from computer vision inference. The backend exposes standard endpoints for video ingestion, progress polling, and detector integration.

## 2. API Endpoints

### Ingestion & Analysis
- `POST /api/analysis`:
  - Upload video (`multipart/form-data`)
  - Parameters: `video` (file), `matchId` (string), `consentConfirmed` (boolean), `mode` (`'demo'` | `'disconnected'`)
  - Returns: `{ success: true, data: { jobId, matchId, status } }`

- `GET /api/analysis/:jobId`:
  - Returns current state: `queued` | `processing` | `review_required` | `completed` | `failed`
  - Returns progress percentage (0-100) and connection status to external vision service.

- `GET /api/analysis/:jobId/events`:
  - Returns array of detected/proposed events awaiting host human review.

### Review & Scoring
- `POST /api/events/:eventId/review`:
  - Body: `{ status: "confirmed" | "rejected", hostNotes?: string, pointsAwarded?: number }`
  - Immediately updates deterministic score in the Rules Engine without double-counting.

- `POST /api/matches/:matchId/finalize`:
  - Body: `{ hostNotes?: string, durationSeconds?: number }`
  - Locks final scores, sets winner or draw, and propagates points to the tournament leaderboard.

- `POST /api/matches/:matchId/host-event`:
  - Body: `{ eventType, eventLabel, teamId, timestampSeconds, pointsAwarded, notes }`
  - Host manually injects an event missed by detector.

### External Vision Service Webhook
- `POST /api/cv-service/webhook`:
  - External Python FastAPI engine sends real OpenCV detections.
  - Body schema:
```json
{
  "match_id": "match-123",
  "game": "al_teela",
  "events": [
    {
      "event_id": "evt-cv-001",
      "event_type": "marble_knockout",
      "timestamp_seconds": 18.4,
      "confidence": 0.94,
      "team_id": "team-falcons",
      "metadata": {
        "detector_name": "detectors/al_teela.py",
        "notes": "Marble displacement 18cm outside ring boundary"
      }
    }
  ]
}
```
