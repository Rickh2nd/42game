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

Update (urgent gameplay/UI fixes pass):
- Local hand domino layout updated:
  - portrait orientation lock for hand dominos (long axis vertical to player view)
  - overlap prevention uses domino-width-based spacing floor
  - selection lift reduced to subtle y offset (~0.016) to avoid jumpy visuals.
- Burn panel wiring fixed and strengthened:
  - left/right burn panel stack ids are wired (`burn-row-team1`, `burn-row-team2`)
  - immediate current-hand row now renders captured tiles as tricks are won
  - completed hand history rows still render newest-first with overflow badge.
- Added chairs visibility toggle (local persistent):
  - checkbox `chairsVisibleToggle`
  - localStorage key `texas42_chairs_visible_v1`
  - toggles `chairsRoot.visible` live without affecting seating logic.
- Played-domino render pipeline fixed:
  - new dedicated `tablePlayRoot` group
  - new `renderTableTrick(trick)` always renders active trick dominos at table center with anti-z-fight y.
  - `renderHandsAndTrick` now calls `renderTableTrick` every state render.
  - client listens to `game:dominoPlayed` and renders trick immediately.
  - server now emits `game:dominoPlayed` on every legal play.
- Added debug section:
  - `DEBUG: TABLE DOMINOS` panel
  - show bounds toggle
  - spawn test domino button
  - readout with trick length, rendered children, tabletopY.
- Syntax checks pass for client and server.
- Local smoke passed on alternate port:
  - /health OK
  - socket.io handshake OK
  - room:create ack OK.

Update (casino lounge + flat domino tile pass):
- Added `casino_lounge` environment entry to `/client/assets/environments/environments.json` with root + preview.
- Added folder scaffold:
  - `/client/assets/environments/casino_lounge/hdri/`
  - `/client/assets/environments/casino_lounge/materials/floor/`
  - `/client/assets/environments/casino_lounge/materials/walls/`
  - `/client/assets/environments/casino_lounge/materials/trim/`
  - `/client/assets/environments/casino_lounge/props/`
  - `/client/assets/environments/casino_lounge/README.md`
  - `/client/assets/environments/casino_lounge/preview.svg`
- Server additions:
  - Added `/api/environment-files/:envId` route in `/server/server.js` to recursively list environment files (ignores `._*` and `.gitkeep`).
  - Added `casino_lounge` to fallback environment ids.
- Client environment system updates in `/client/main.js`:
  - Added runtime file-catalog fetch + texture/HDR caches for environment assets.
  - Added casino lounge room-shell builder (floor, 3 walls, ceiling, baseboards/trim).
  - Added warm casino lighting preset and optional prop loading from `/props` when assets exist.
  - Added graceful procedural fallback materials (carpet/wallpaper/trim) when files are missing.
  - `applyEnvironment('casino_lounge')` now builds an indoor room instead of skybox-only backdrop.
- Domino render updates in `/client/main.js`:
  - Global realistic domino size reduced from oversized values:
    - `DOMINO_LONG=0.056`, `DOMINO_SHORT=0.029`, `DOMINO_THICKNESS=0.011`.
  - Added near-2D hand tile path:
    - `createDominoTile(...)` uses flat plane geometry + portrait CanvasTexture.
    - Hand layout now uses `createDominoTile` (flat look) and keeps click/raycast behavior.
  - Kept in-play trick tiles on 3D path via `createDomino3D(...)`.
  - Unified canvas face renderer (`drawDominoFaceCanvas`) used for consistent ivory realism.
  - Fixed burn tile partial/half-render bug by removing incorrect burn-canvas scaling and redrawing full-size canvases.
- View slider updates:
  - Expanded ranges in `/client/index.html` and in JS clamps to the new wide bounds.
  - Added new sliders + persistence:
    - `hand_domino_scale`
    - `hand_domino_rot_deg`
    - `table_domino_scale`
  - Included these fields in localStorage payload and Copy View Settings JSON output.
  - Live updates trigger immediate hand/trick re-render.

Validation performed:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- Local server smoke on `PORT=18103`:
  - `/health` returns JSON ok
  - `/socket.io` polling handshake returns engine payload
  - `/api/environment-files/casino_lounge` returns file list JSON
- Playwright skill script attempted per workflow but blocked:
  - fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`.

Remaining TODOs:
- Visual pass in browser to fine-tune hand arc/spacing defaults if needed after flat-tile switch.
- If real casino textures/HDRI are available locally, place them in the new folder and verify auto-detection mapping picks them.

Update (reference-style domino + casino fallback + larger slider ranges):
- Increased domino tuning ranges in `/client/index.html` + JS clamps:
  - `hand_domino_scale`: 0.05..12.00 (step 0.05)
  - `table_domino_scale`: 0.05..12.00 (step 0.05)
- Added larger slider usability tweaks in `/client/styles.css`:
  - wider side panel
  - larger range track and min-width for sliders.
- Burn pile stack container IDs now match vertical hand-stack contract:
  - `burn-hands-team1`, `burn-hands-team2`
- Burn panel render now emphasizes completed hand-history stacks only (newest on top), removing in-progress horizontal-like behavior.
- Domino visual renderer upgraded to better match provided reference image:
  - stronger ivory/yellow tone
  - rounded corners via clipping path
  - darker/thicker divider
  - glossy black pip treatment + inset/shadow feel
  - applied consistently to hand, burn, and played textures.
- Played dominos switched to flat tile render path for visual consistency with hand/burn style target.
- Hand layout now includes soft large-scale handling:
  - when hand tile scale is huge, hand anchor shifts to keep visibility
  - adaptive effective scale reduction only when overflow persists.
- Casino lounge environment load robustness:
  - added UI load status line (`environmentLoadText`) with exact states:
    - `Environment loaded: OK`
    - `Environment fallback: ...`
  - room shell always renders for casino lounge (floor/walls/baseboards) regardless of missing assets.
  - missing texture/HDR detection logs warnings and sets fallback status.

Validation this pass:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- local smoke on `PORT=18103`:
  - `/health` OK
  - `/api/environment-files/casino_lounge` OK
  - socket.io polling handshake OK
