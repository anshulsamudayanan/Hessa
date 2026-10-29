# FAREEG AI — AI-Powered Emirati Traditional Games Arena

**FAREEG AI** is an AI-powered tournament platform developed for a student technology competition under the theme **“AI for Family”**. It brings families together to celebrate Emirati cultural heritage games and small-sided football with real camera recording, transparent AI event proposals, host-in-the-loop judicial review, and deterministic tournament scoring.

---

## 🏆 Supported Games

1. **Football (كرة القدم / Kora)**: High-energy neighborhood matches.
2. **Al Teela (التيلة / Marbles)**: Heritage precision marble challenge in a sand circle ring.
3. **Al Dama (الدامة / Emirati Draughts)**: Traditional majlis 64-square strategy board game.
4. **Al Laqaf (اللقف / Stone Tossing)**: Five-stone hand dexterity and airborne coordination.
5. **Qif (قِف / Halt & Freeze Tag)**: Traditional running, dodging, and freeze tag.

---

## 🚀 Key Features

- **Home Dashboard**: Tournament overview, game cards, AI judging explanation, recent matches, and quick tournament launch.
- **Tournament Setup**: Roster creation (names, jersey numbers, Arabic names, team colors), multi-game selection, and persistent storage.
- **Game & Match Setup**: Game-specific camera positioning advice (overhead, wide angle, close up), participating team confirmation, and family recording consent verification.
- **Live Camera & Recording Engine**:
  - Direct browser camera access via `navigator.mediaDevices.getUserMedia()`.
  - Multi-camera device switching (front, back, external USB webcams).
  - Clear permission-denied and device-unavailable diagnostics.
  - Stadium HUD overlay with recording indicator and live duration timer.
  - MediaRecorder chunk capture, immediate video preview, and retake controls.
  - Video file upload fallback with drag-and-drop, format validation (.mp4, .webm, .mov), 100MB limit check, and real progress percentage.
- **AI Analysis Chamber**:
  - Asynchronous background job processing (`queued` ➔ `processing` ➔ `review_required` ➔ `completed`).
  - Strict compliance with competition standards: Disconnected state is clearly displayed; demonstration candidate events are explicitly labelled without fake claims.
- **Judicial Event Review**:
  - Video timestamp jumping for each candidate event.
  - Host "Confirm Event" and "Reject Event" controls.
  - Host manual event injection and score correction.
  - Real-time score recalculation via deterministic Rules Engine (rejects and duplicates never score).
- **Deterministic Tournament Scoring**:
  - Configurable game rules stored in modular config files.
  - Leaderboard calculation: Played, Won, Drawn, Lost, Points For, Against, Difference, and Tournament Points.
- **Privacy & Child Protection**:
  - Family consent confirmation before recording.
  - In-app "Delete Recording Data" button for immediate removal of videos and analysis records.

---

## 🛠️ Setup & Running Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

---

## 🐍 Connecting the External Python FastAPI Computer Vision Service

FAREEG AI includes a complete integration contract in `/vision-service-contract`:

1. **API Contract**: Defined in `vision-service-contract/schema.json`.
2. **FastAPI Template**: `vision-service-contract/main.py`.
3. **5 Dedicated Detectors**:
   - `detectors/football.py` (goalpost homography & ball trajectory)
   - `detectors/al_teela.py` (overhead circle & marble impact displacement)
   - `detectors/al_dama.py` (8x8 perspective warp & piece classification)
   - `detectors/al_laqaf.py` (hand landmarks & projectile flight tracking)
   - `detectors/qif.py` (pose velocity freeze & tag proximity)

To connect the Python vision engine:
```bash
# In your Python environment:
pip install fastapi uvicorn opencv-python pydantic requests
uvicorn vision-service-contract.main:app --port 8000
```
Then navigate to **Vision Engine** in the FAREEG AI navbar and click **"Ping Service"** to verify connection. The app will automatically stream video jobs to your Python service.

---

## ⚠️ Current Scope & Limitations

- Computer vision processing in standalone mode operates with clearly labelled candidate events for demonstration review.
- Browser camera recording requires a secure origin (HTTPS or localhost) and granted camera permissions.
- In-browser file upload is limited to 100MB per match video for optimal memory and bandwidth performance.
