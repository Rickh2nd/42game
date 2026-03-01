Original prompt: YOU ARE CODEX. FIX CRASHING BOOT + KEEP UI WORKING. DO NOT ASK QUESTIONS.

- Fixed boot crash in /client/main.js by replacing undeclared temp vectors in computeSeatedCameraPose (tempV3A/tempV3B) with defined reusable vectors (tmpV3A/tmpV3B).
- Added view hardening:
  - setDefaultSeatedCamera()
  - safeApplyViewSettings()
  - resetViewForLocalSeat() now uses safe wrapper
  - slider updates, reset button flow, and resize now route through safe wrapper.
- Added boot-step guard helper runBootStep() and switched startup sequencing to initialize UI/socket bindings before risky scene-view operations.
- Added safe HDR setup:
  - async loadHdrTexture() with HEAD check + loadAsync catch
  - initHdrEnvironment() now tries known paths and falls back cleanly to RoomEnvironment if HDR is missing.
- Warmup/model Promise catch now logs warning and keeps runtime alive.

Validation:
- node --check client/main.js (pass)
- node --check server/server.js (pass)
- local server smoke:
  - GET /health returns ok JSON
  - /socket.io polling handshake returns Engine.IO payload
  - socket debug ping ack works from node socket.io-client snippet.
- Playwright smoke script could not run because package `playwright` is not installed in this environment.

TODO (if needed next pass):
- Run browser-side manual check for create/join UI with devtools open to confirm no runtime console errors.
- If desired, add toast text for HDR fallback state (currently console warning only).
