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

Update (played-trick row + pip spacing + burn live capture + opacity tuning pass):
- Played domino trick layout now renders in local POV as a portrait row, strictly left-to-right in trick play order (`trick[0]` leftmost).
- Expanded played domino clamp in client view settings to support larger table scale (`tableDominoScale` max 25.0), with live re-render.
- Updated domino pip layout to modern wider 2x3 half-grid spacing (less crowded) and adjusted pip radius/shading to keep realism.
- Burn panels now include immediate live trick captures from `roomState.burnPiles` (split into vertical live trick rows) while keeping completed-hand history stacks.
- Burn panel stats now include both live captured tiles and completed hand-history totals.
- Added burn panel opacity control wiring:
  - New storage key `texas42_burn_panel_opacity_v1`
  - CSS variable `--burnPanelBgAlpha` updated live
  - slider persistence + restore on boot.

Validation:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- Local API/socket smoke:
  - `curl http://localhost:3000/health` => JSON ok
  - `curl /socket.io polling` => Engine.IO handshake payload
  - node socket client `debug:ping` ack => pass
- Playwright automation client attempted per skill workflow but blocked because `playwright` package is not installed in this environment.

Remaining caution:
- Visual tuning still depends on in-browser review for final subjective spacing/anchor tweaks.

Update (burn scoring + action popup + played tilt pass):
- Server scoring model updated to track per-hand trick wins and count points separately:
  - `trickWinsThisHand` and `countPointsThisHand` added to room state/snapshots.
  - On each completed trick, winner team now gets `+1` trick win and `+count points` from trick tiles.
  - `pointsThisHand` is now computed as `trickWinsThisHand + countPointsThisHand` and used for target checks/hand end.
- Shared simulation scoring aligned with new model by adding +1 trick win value in Monte Carlo trick resolution updates.
- Burn panel header/labels cleaned:
  - Titles changed to `TEAM 1 CAPTURED` / `TEAM 2 CAPTURED`.
  - Stats now `Tiles | Count | Wins | Score`.
  - Footer contributor block removed from DOM rendering (removes dark bottom rectangle clutter).
- Added new VIEW slider for played domino tilt:
  - `table_domino_tilt_deg` (0..35, step 0.5, default 10)
  - persisted in localStorage and applied live.
- Played trick domino rendering updated:
  - row remains left-to-right in trick order
  - each tile rotated 90° in-plane and tilted toward user based on new slider.
- Added focused action popup for bidding/mode/trump selection (`#actionModal`):
  - active local player sees controls
  - others see waiting text
  - modal auto-closes after selection.
- Side panel auto-open behavior changed:
  - no forced auto-open in bidding/chooseMode/chooseTrump
  - panel auto-closes on entering these phases (manual reopen still possible via hamburger).

Validation:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- `node --check shared/fortyTwo.js` pass
- local smoke: `/health` OK, `/socket.io` polling handshake OK.

Update (stability + rules + UI + sound + betting + environment pass):
- Added server-authoritative betting flow in `/server/server.js`:
  - New host actions: `host:bettingEnable`, `host:setBetAmount`.
  - New player action: `betting:respond` (`called` / `folded`) gated to controllable seat.
  - CPU support during betting phase: pending CPU seats auto respond with level-weighted call/fold and bankroll checks.
  - Betting lifecycle integrated with phase machine:
    - `enterPlayingPhase` -> `PHASES.BETTING` (if enabled) -> `beginPlayingTricks`.
    - Timeout auto-fold for unresolved betting seats remains via round close timer.
  - Snapshot already includes betting state (`bettingEnabled`, `baseBetAmount`, `sessionBankroll`, `pendingBets`).

- Added Human/CPU transform stability protections in `/client/main.js`:
  - Removed automatic `claimForSelf` on seat type toggle.
  - Added seat-type regression guard with before/after transform capture and restore.
  - Guard logs before/after values (tableRoot/environmentRoot/chairs/seat/avatar slot transforms).
  - Avoids lobby view reset on local seat changes (`resetViewForLocalSeat` now skipped in lobby).
  - Avatar rerendering now only occurs when avatar ids actually change (prevents unnecessary model reload/shift on metadata changes).

- Added draggable + scalable center BID/TRUMP HUD:
  - New drag handle `#tableHudDragHandle`.
  - New slider `#table_hud_scale` (0.50..3.50).
  - Persisted in localStorage (`texas42_table_hud_v1`) with offsetX/offsetY/scale.
  - CSS transform now applies translate+scale via CSS vars.

- Nameplate / crown updates:
  - Nameplate content order now strictly: TEAM, NAME, BID.
  - Crown now uses `roomState.lastSevenMarksWinnerTeam` only (not lifetime gameMarks).

- Betting UI added:
  - New right-panel section `BETTING` (host toggle + base bet + bankroll totals).
  - New centered betting modal (`#bettingModal`) during `PHASES.BETTING`:
    - active local seat gets CALL/FOLD buttons
    - others see waiting/status text.

- Sound system added in `/client/main.js`:
  - WebAudio-based `playDominoThud()` on `game:dominoPlayed`.
  - `playPartyBlower()` when `lastSevenMarksWinnerTeam` changes.
  - Mute toggle in menu (`#muteToggle`) persisted in localStorage (`texas42_mute_v1`).

- Environment system cleaned for requested room set:
  - `client/assets/environments/environments.json` now only lists:
    - `casino_lounge`, `spooky_parlor`, `rustic_tavern`, `modern_suite`, `neon_arcade`.
  - Client environment loader now builds room-shell for selected environment (floor + 3 walls + ceiling + trim) even with missing assets.
  - Texture/HDR detection generalized via file catalog scan; casino prefers `anniversary_lounge_4k.hdr`.
  - Carpet/floor selection supports casino `materials/carpet` first, then `materials/floor` fallback.
  - Missing files now degrade gracefully with status text (`Environment fallback: ...`) and no crash.

Validation (this pass):
- Syntax:
  - `node --check server/server.js` pass
  - `node --check client/main.js` pass
  - `node --check shared/fortyTwo.js` pass
- Local smoke on `PORT=3011`:
  - `GET /health` returns ok JSON
  - `/socket.io` polling handshake returns Engine.IO payload
  - socket client create room + `host:bettingEnable` updates snapshot (`bettingEnabled=true`, `baseBetAmount=15`)
  - socket `debug:ping` ack pass
  - CPU-only flow reaches phases including `betting` and `playing`.
- Playwright skill client attempt still blocked here due missing dependency:
  - `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` from `$WEB_GAME_CLIENT`.

Remaining follow-up suggestion:
- Do one manual visual pass in browser for final HUD drag ergonomics and betting modal sizing on mobile.

Update (critical bugfix pass: betting modal + environments + slider ranges + sound + independent HUD drag):
- Betting lifecycle hardened (server + client):
  - Server state now includes `bettingEnabledNextHand`, `bettingHandId`, and snapshot `betting` object:
    `{ enabled, activeThisHand, handId, isOpen, betAmount, betPot, betState }`.
  - `host:bettingEnable` now supports ON-mid-hand semantics:
    - enabling mid-hand applies next hand via `bettingEnabledNextHand`
    - pre-hand phases can apply immediately.
  - Added explicit betting open/close broadcasts at hand betting phase boundaries:
    - packet events: `type: "betting:open"` / `type: "betting:close"`
    - direct socket events: `betting:open` / `betting:close`.
  - Added ack-based socket handler `betting:respond` on server.
  - Client betting modal now uses ack flow for CALL/FOLD (`emitWithAckTimeout("betting:respond", ...)`) and opens from either snapshot `betting.isOpen` or open events.

- Betting modal UX:
  - Added draggable handle `#bettingModalDragHandle`.
  - Added persistent modal offsets in localStorage key `texas42_betting_modal_v1`.
  - Modal auto-closes on close event/state and no longer depends on side panel state.

- BID/TRUMP HUD drag split:
  - Replaced single combined HUD drag with independent drags:
    - `#hudBidDragHandle` controls BID block offset
    - `#hudTrumpDragHandle` controls TRUMP block offset.
  - Persisted with existing HUD storage key (`texas42_table_hud_v1`) using:
    `bidOffsetX/Y`, `trumpOffsetX/Y`, `scale`.
  - Backward-compatible read of legacy `offsetX/offsetY` -> BID offsets.

- Slider range expansion (~300% pass):
  - Updated HTML slider ranges and JS clamps for all view/scene sliders, plus:
    - `burn_panel_opacity` now `0.01..1.00`
    - `table_hud_scale` now `0.15..10.50`
    - `bet_amount` now `1..300`
    - `table_domino_scale` now `0.01..75`
    - `table_domino_tilt_deg` now `0..105`
    - view and scene tuning ranges expanded similarly.

- Sound system fix:
  - Added actual files:
    - `/client/assets/sounds/thud.wav`
    - `/client/assets/sounds/party.wav`
  - Client AudioManager now file-backed with autoplay-safe unlock:
    - `unlockAudio()` runs on first pointer gesture
    - one-time diagnostics:
      - `[audio] not unlocked yet`
      - `[audio] file missing` / playback failure.
  - Existing triggers preserved:
    - domino played -> thud
    - new 7-mark winner -> party.

- Environment robustness:
  - Existing 5-room manifest retained (`casino_lounge`, `spooky_parlor`, `rustic_tavern`, `modern_suite`, `neon_arcade`).
  - Loader keeps room-shell fallback behavior and status line (`Environment loaded: OK` / `Environment fallback: ...`) with missing-asset tolerance.

Validation in this pass:
- Syntax checks:
  - `node --check server/server.js` pass
  - `node --check client/main.js` pass
  - `node --check shared/fortyTwo.js` pass
  - `node --check client/src/net/socket.js` pass
- Local transport/assets smoke:
  - `/health` OK
  - `/socket.io` handshake OK
  - `/assets/sounds/thud.wav` and `/assets/sounds/party.wav` return 200
- Betting flow smoke:
  - reached betting phase after bid/mode/trump progression
  - observed `betting:open` event
  - `betting:respond` ack path returns `{ ok: true, seatIndex, decision }`.

Outstanding visual/manual TODO:
- Manual browser verification for drag ergonomics (BID/TRUMP blocks and betting modal placement) on both desktop and mobile widths.
- Playwright step attempted per develop-web-game skill:
  - `node "$WEB_GAME_CLIENT" ...`
  - blocked with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` in this environment.
