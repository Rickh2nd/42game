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

Update (camera/view + hand layout pass):
- Expanded VIEW slider ranges to requested wider bounds in /client/index.html.
- Added new view sliders and persistence fields:
  - hand_y (Hand Vertical Offset)
  - hand_z (Hand Distance Offset)
- Updated /client/main.js view settings pipeline:
  - new fields in DEFAULT_VIEW_SETTINGS, load/persist/copy JSON, sanitize clamps, UI labels.
  - near clip value label now shows 3 decimals.
- Replaced local hand placement with dedicated layoutPlayerHandDominos(seatId, dominos, settings):
  - seat-local basis (forward/right/up)
  - centered row with gentle arc + readable tilt
  - z-fighting lift above tabletop
  - iterative visibility nudges + spacing reduction if hand projects off-screen.
- Added local hand screen bounds tracking and upgraded nameplate avoidance so local nameplate is pushed above hand overlap region.
- Relaxed seated camera safety clamps to allow wider slider tuning range.

Validation for this pass:
- node --check client/main.js (pass)
- local smoke:
  - GET /health OK
  - Engine.IO handshake at /socket.io polling OK

Outstanding:
- Playwright visual loop still blocked in this environment because `playwright` package is missing.

Update (domino scale + burn stack + scene tuning pass):
- Reduced in-world domino dimensions globally:
  - Added DOMINO_LONG/DOMINO_SHORT/DOMINO_THICKNESS constants
  - Updated RoundedBoxGeometry to realistic slimmer proportions
  - Unified DOMINO_SCALE usage across hand/opponent/in-play placement paths.
- Improved modern domino material pipeline:
  - Added `getDominoBaseMaterial` + `getDominoPipMaterial`
  - Updated createDominoMesh to use warmer resin/ivory palette and realistic roughness values.
- Reworked burn pile UI from horizontal scroll row to vertical stacked hand rows:
  - HTML now uses `burn-hands-team1` / `burn-hands-team2` stack containers
  - CSS adds `.burnHandsStack`, `.burnHandRow`, `.burnHandHeader`, `.burnHandTilesRow`, `.burnOverflowBadge`
  - JS render now consumes authoritative hand records and draws newest hand at top with up to 4 tiles + overflow badge.
- Added authoritative server burn-hand history tracking:
  - New room fields: `burnHandsTeamA`, `burnHandsTeamB`
  - Snapshot includes both arrays
  - On hand finish: server records winning team’s captured tiles into a new unshifted hand record
  - Reset-mark game restart clears burn-hand histories.
- Added SCENE TUNING menu section + live local sliders:
  - tableScale, chairScale, avatarScale, seatRadius, avatarBack, avatarY, chairY, tableY
  - Reset + Copy JSON buttons
  - localStorage key `texas42_scene_tuning_v1`
  - live apply pipeline updates table transform, metrics, seat transforms, camera, hand rendering.
- Updated seat transform code to apply scene tuning offsets/scales/radius.
- Updated local hand basis to use live seat groups (works with tuning) and preserves in-view arc layout.
- Nameplate anchor now follows avatar head world position (instead of static seat anchor), so tuning changes remain aligned.

Validation for this pass:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- Local server smoke on alternate port confirms snapshot now includes `burnHandsTeamA` and `burnHandsTeamB` arrays.
