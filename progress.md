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

Update (burn clear + env loader + per-seat avatar Y + betting popup reliability):
- Server hand-end capture reset added:
  - New `resetForNewHandCaptureOnly(room)` in `/server/server.js`.
  - Called in `finishHand(room)` immediately after outcome resolution so burn/capture state clears before next hand begins.
  - Clears: trick/trickHistory/played, burn piles, burn hand history stacks, trickWins/countPoints/points for this hand, and sevens per-hand state.
  - Keeps session-level marks/bankroll/champion tracking intact.
- `resetForNewHand(room)` now reuses `resetForNewHandCaptureOnly(room)` to keep capture reset behavior consistent.

- Environment loader hardened in `/client/main.js`:
  - Added URL normalization (`normalizeAssetUrlPath`) and safer `environmentRootFor(entry)` handling.
  - Added deterministic material map discovery for expected files:
    - `baseColor.(png|jpg|jpeg)`
    - `normal.(png|jpg|jpeg)`
    - `roughness.(png|jpg|jpeg)`
  - Added catalog-aware texture pick + extension fallback and case-insensitive matching.
  - Casino floor logic keeps `materials/carpet` preferred, then `materials/floor`.
  - HDR selection stays optional and non-crashing.

- Per-seat avatar Y tuning (huge range) completed:
  - Added sliders in `/client/index.html`: `tune_seat0_avatar_y..tune_seat3_avatar_y` with `-5.00..5.00`.
  - Added persistence key `texas42_avatar_y_offsets_v1` in `/client/main.js`.
  - Applied offsets at seat transform level only (avatar slot), without modifying table/chair roots.

- Betting popup reliability:
  - Existing betting modal flow retained and validated against snapshot/event paths (`betting:open` / `betting:close`).
  - Modal remains popup-based with drag offsets persisted.

Asset additions for envs (to ensure all 5 room themes load maps immediately):
- Added generated map triplets (`baseColor.png`, `normal.png`, `roughness.png`) for:
  - `casino_lounge/materials/{carpet,walls,trim}`
  - `modern_suite/materials/{floor,walls,trim}`
  - `neon_arcade/materials/{floor,walls,trim}`
  - `rustic_tavern/materials/{floor,walls,trim}`
  - `spooky_parlor/materials/{floor,walls,trim}`

Validation run:
- `node --check client/main.js` ✅
- `node --check server/server.js` ✅
- Local smoke:
  - `/health` returns JSON ✅
  - `/api/environment-files/{modern_suite,neon_arcade,rustic_tavern,spooky_parlor,casino_lounge}` return non-zero file counts ✅
- Playwright skill client unavailable in this environment because `playwright` package is not installed (same blocker as prior pass).

TODO (next pass if needed):
- Run headed browser check for env switching visuals and burn panel instant-clear UX timing in a live hand.

Update (lock-in defaults for View + Scene Tuning):
- Locked `DEFAULT_VIEW_SETTINGS` to Rick-approved values in `/client/main.js`:
  - distance 9.58, height 7.88, forward 5.86, shoulder -0.26, lookAtY -0.26,
  - fov 63, pitchDeg 0, near 0.08,
  - handY 0.49, handZ 0.54,
  - handDominoScale 16.86, handDominoRotDeg 88,
  - tableDominoScale 24.81, tableDominoTiltDeg 16.5.
- Locked `DEFAULT_SCENE_TUNING` to Rick-approved values including per-seat avatar Y offsets:
  - tableScale 2.1, chairScale 1.79, avatarScale 1.76,
  - seatRadius 5.96, avatarBack -0.39, avatarY -0.01,
  - chairY 0.01, tableY 0,
  - seatAvatarYOffset [3.47, 3.46, 3.39, 3.2].

Storage/version behavior:
- Added settings versioning constants:
  - `VIEW_SETTINGS_VERSION = 2`
  - `SCENE_TUNING_VERSION = 2`
- View storage (`texas42_view_settings_v1`):
  - if missing/invalid: apply defaults and write once.
  - if present: preserve saved values, sanitize, and migrate payload to v2 format.
- Scene storage (`texas42_scene_tuning_v1`):
  - now includes `seatAvatarYOffset` in the same payload.
  - if missing/invalid: apply defaults and write once.
  - migration path reads legacy `texas42_avatar_y_offsets_v1` and folds it into scene payload, then removes legacy key.

Reset behavior:
- Reset View now overwrites storage with the locked default view and applies immediately.
- Reset Scene Tuning now overwrites storage with locked default scene tuning (including seat offsets) and applies immediately.
- Both reset paths update slider inputs and value labels immediately.

Apply order / boot order:
- Boot sequence now loads scene tuning before view settings.
- UI sync order updated so scene tuning UI refreshes before view UI.
- Environment model load path still applies scene transforms first, then camera/view pose, matching required dependency order.

Validation:
- `node --check client/main.js` ✅

Update (stability follow-up after parse break + diagnostics lock):
- Fixed client parse/runtime blocker in `currentBettingState()` by correcting `??`/`||` precedence in pot merge expression.
- Added/kept settings source diagnostics line wiring (`Settings Loaded | view source | scene source`) and ensured reset flows force `defaults` source state.
- Added betting diagnostics line updates so UI always shows `enabled/isOpen/handId/phase`.
- Improved betting event resilience:
  - caches pending `betting:open` payload (`pendingBettingOpenEvent`) for event/snapshot ordering races,
  - clears cache on close/disconnect/reset,
  - allows modal open state to derive from either snapshot or open event.
- Updated betting modal position persistence key migration:
  - new key `texas42_bet_modal_pos_v1`
  - reads legacy key once and migrates.
- Server betting lifecycle now broadcasts immediate full snapshots on open/close transitions in addition to socket events.

Validation this pass:
- `node --check client/main.js` pass.
- `node --check server/server.js` pass.
- Asset URL smoke (local server): all floor/walls/trim maps for
  - casino_lounge
  - spooky_parlor
  - rustic_tavern
  - modern_suite
  - neon_arcade
  return HTTP 200.
- Betting lifecycle smoke on isolated server port:
  - host enables betting,
  - seat0 set cpu,
  - start game,
  - `betting:open` emitted and snapshot phase becomes `betting` (`isOpen=true`).

Skill-loop note:
- Attempted Playwright skill client run, but environment lacks `playwright` package (`ERR_MODULE_NOT_FOUND`), so automated screenshot/text-state validation is still blocked in this machine state.
- Environment loader hardening:
  - failed texture/HDR loads are no longer cached forever (failed cache entries are evicted),
  - empty environment file catalog responses are no longer cached forever (evicted for retry),
  - `applyEnvironment` now retries same env when last load state is not `ok` (prevents sticky fallback).

Update (avatar under-floor fix pass):
- Added a single world floor reference constant: `FLOOR_Y = 0`.
- Scene hierarchy normalized:
  - added `seatsRoot` under `tableRoot`,
  - moved `chairsRoot` under `seatsRoot`,
  - moved all `avatarSeatGroups` under `seatsRoot` (avatars no longer parented directly under table root).
- Environment room shell now sits at `FLOOR_Y` (removed `-0.02` room shift).
- Table metrics now keep `floorY` pinned to `FLOOR_Y` instead of table mesh minY.
- Scene tuning now sets `tableRoot.position.y = FLOOR_Y + sceneTuning.tableY`; table model stays at local `y=0`.
- Seat/avatar placement revised:
  - chair seat groups keep `y=0` (XZ placement only),
  - chair visual offset applied to child model `position.y = sceneTuning.chairY`,
  - avatar base Y computed from chair seat height above floor + avatar offsets,
  - removed tabletop-based avatar Y cap logic from base placement.
- Added hard world-space clamp to prevent under-floor avatars:
  - if avatar world Y `< FLOOR_Y + 0.05`, push up by delta,
  - logs once per seat: `[avatar] clamped above floor seat=<i> worldY=<...>`.

Validation:
- `node --check client/main.js` pass.
- Defaults remain unchanged for VIEW + SCENE tuning constants.

Update (avatar-under-floor hard fix pass):
- Added global avatar nudge constant `AVATAR_GLOBAL_NUDGE_Y = 0.08` and apply during seat transform placement.
- Strengthened floor clamp by computing world-space mesh bounds per avatar mesh (not only group origin), then correcting Y if mesh bottom is below `FLOOR_Y + 0.05`.
- Added periodic runtime clamp pass in `animate()` (every ~350ms) to catch late async model swaps/environment updates.
- Reduced seated pose sink amount and added local-ground realignment helper after static pose is applied.
- Validation: `node --check client/main.js` pass; local server boot pass.

Update (bottom trays + props visibility + avatar floor safety pass):
- Added bottom bidding and chip betting tray UI wiring in client runtime flow (no side panel auto-open for bidding/betting).
- Tightened bottom tray sizing/spacing in `/client/styles.css` to reduce hand obstruction risk.
- Kept chip totals widget draggable with persisted offsets (`texas42_chip_widget_pos_v1`) and live bankroll/pot updates.
- Decor/props pass in `/client/main.js`:
  - Added one-time startup logging of shared prop catalog (`[decor] folder -> modelUrl`).
  - Added missing-folder warning and retained graceful proxy fallback if no model file exists.
  - Fixed authored decor coordinate conversion so +Z authored "back wall" maps to scene back wall.
  - Added adaptive prop auto-scale and floor grounding for floor-level props.
- Avatar seating/floor safety pass:
  - Reduced `AVATAR_GLOBAL_NUDGE_Y` to `0.015`.
  - Strengthened floor clamp to keep avatar mesh bottoms above floor and ensure at least a visible top section above floor (`minVisibleTopY`) so avatars cannot disappear below floor plane.

Validation:
- `node --check client/main.js` pass.
- `node --check server/server.js` pass.
- Runtime endpoint checks on live server:
  - `/health` OK
  - socket.io polling handshake OK
  - `/api/environment-files/<env>` returns expected files
  - texture URLs for spooky/rustic/modern/neon floor/walls/trim return 200
  - casino uses `materials/carpet` for floor (expected `materials/floor` 404)
- `/api/shared-props` reports 18 folders but 0 model files currently present; client decor pipeline falls back to visible proxy props and logs details.

Update (EXR + props manifest + bottom trays + dollar betting pass):
- Copied shared lighting and decor assets into repo:
  - `client/assets/environments/_shared/hdri/*.exr` (10 required EXRs)
  - `client/assets/environments/_shared/props/<18 folders>/...`
- Installed Blender locally and batch-exported GLBs from source `.blend` files into each shared prop folder.
- Generated `client/assets/environments/_shared/props/props.json` mapping each prop folder to its GLB.
- Confirmed static asset serving for `/assets` endpoints (health + EXR + GLB + props.json all return HTTP 200).

Client (`/client/main.js`) changes:
- Added EXR-first HDRI flow:
  - `loadEnvironmentHdri()` now supports `.exr` via `EXRLoader` and PMREM.
  - Environment HDRI selection now uses `_shared/hdri` EXR assignments (primary/alt per environment).
  - Added per-environment HDRI variant persistence (`primary|alt`) and wired `#hdriVariantSelect`.
  - Removed hardcoded `.hdr` boot candidates; init fallback now uses shared EXRs then RoomEnvironment fallback.
- Replaced decor catalog loading from `/api/shared-props` with static manifest:
  - fetch `/assets/environments/_shared/props/props.json`
  - resolve each model URL as `/assets/environments/_shared/props/<folder>/<file>.glb`
- Decor loading/diagnostics hardening:
  - no more silent cube proxy fallback when model is missing/fails
  - explicit failure entries in decor debug list
  - status now reports `decorLoaded=<loaded>/<requested>`
  - improved auto-fit scaling by prop class (lamp/table/shelf/frame targets)
- Bottom trays:
  - mode/trump selection now rendered in `#modeTray` and `#trumpTray`
  - non-active players see `#chooserWaitBanner`
  - action modal is forcibly closed for these phases
- Dollar betting tray:
  - removed dead numeric-input references
  - fixed increment buttons `$1/$5/$10/$20`
  - live `Your Bet: $X` draft amount
  - actions: Bet, Raise (+$5), Call, Fold
  - totals and pot now display with `$` formatting

Markup/CSS:
- `client/index.html` already contains new tray nodes and dollar increment controls.
- `client/styles.css` includes tray/wait-banner styles used by the updated logic.

Validation:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- Local static route smoke:
  - `/health` -> 200
  - `/assets/environments/_shared/hdri/anniversary_lounge_4k.exr` -> 200
  - `/assets/environments/_shared/props/side_table_01_4k/side_table_01_4k.glb` -> 200
  - `/assets/environments/_shared/props/props.json` -> 200
- Attempted skill Playwright loop failed due missing dependency in environment:
  - `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright'`

TODO (next pass if needed):
- Run full browser visual verification for each environment to confirm decor placement aesthetics.
- Optionally remove legacy `/api/shared-props` route now that client uses static `props.json`.

Update (prop scale + environment PBR depth pass):
- Implemented deterministic prop auto-scale by measured bounding-box height in `/client/main.js`:
  - Added category-based target heights per folder name:
    - shelves 2.0, bookshelf 2.1, tables 0.75, tall side table 1.0,
      wall lamp 0.45, lamps 1.4, frames 0.7, book set 0.25, lightbulb 0.15, default 1.2.
  - Applied scale factor with required clamp:
    - `THREE.MathUtils.clamp(targetHeight / h, 0.05, 50)`.
  - Added floor clamp after scaling for all props:
    - pushes model up when below `FLOOR_Y + 0.01`.
  - Added one-time dev log per prop folder:
    - `[decor] scaled <folder> { beforeH, target, scale }`.
  - Added `PROP_SCALE_OVERRIDES` table support for manual edge-case tuning.

- Improved floor/wall/trim material depth so environments look less flat:
  - Added AO map candidate resolution in `resolveMaterialPaths` for floor/walls/trim.
  - Loaded/applied AO maps in `buildRoomEnvironment` with `aoMapIntensity` tuning.
  - Added `normalScale` tuning:
    - floor `(0.8,0.8)`, walls `(0.6,0.6)`, trim `(0.6,0.6)`.
  - Set stronger roughness baselines:
    - floor casino `0.75` else `0.55`, walls `0.85`, trim `0.45`.
  - Increased tiling repeats for detail readability:
    - floor casino `[10,12]`, others `[14,14]`, walls `[5,4]`, trim `[10,3]`.
  - Ensured UV2 exists on room geometries/trim for AO usage via `ensureUv2()` helper.
  - Kept texture encoding correct:
    - baseColor sRGB, normal/roughness/ao linear.
  - Capped anisotropy to `min(8, maxSupported)` for stable quality/perf.

- Lighting contrast tuned to reduce flat look under HDRI:
  - key/fill/rim/ambient weighting adjusted in `applyLightingState` to produce clearer depth while preserving slider control.

Validation:
- `node --check client/main.js` pass
- `node --check server/server.js` pass

Update (decor scale/placement + material depth pass):
- Added new lighting/decor controls in UI (`/client/index.html`):
  - `decor_global_scale` (0.10–10.00, default 1.50)
  - `floor_repeat`, `wall_repeat`, `trim_repeat` (1–24)
  - `decorTestSpawnBtn` in decor debug section.
- Wired new controls in `/client/main.js`:
  - per-environment persistence for decor scale:
    - key format `texas42_decor_scale_<envId>_v1`
  - per-environment persistence for repeats:
    - key format `texas42_material_repeat_<envId>_v1`
  - slider changes force environment re-apply immediately.

- Implemented scene-relative prop scaling:
  - computes decor reference metrics from table/chair/avatar (`getDecorReferenceMetrics`) with fallback chain.
  - category-based target heights now derived from `ref` fractions (as requested).
  - auto-scale formula and clamp:
    - `s = THREE.MathUtils.clamp(targetHeight / h, 0.05, 50)`
  - applies env-level global decor scale after category scaling.
  - added one-time per-prop scaling log:
    - `[decor] scaled <folder> { beforeH, target, scale, decorScale }`
  - logs environment reference metrics per apply:
    - `[decor] ref { tableDiameter, chairHeight, avatarHeight, ref }`

- Implemented robust placement helpers and usage:
  - `snapPropToFloor(model, FLOOR_Y, pad)`
  - `alignPropToBackWall(model, backWallZ, pad, faceIntoRoom)`
  - `clampToRoom(model, leftX, rightX, nearZ, farZ)`
  - tables/shelves quantized to 90-degree rotation increments.

- Improved room material depth (less flat):
  - added AO candidate loading for floor/walls/trim in `resolveMaterialPaths`.
  - ensured UV2 for AO on room planes/trim via `ensureUv2` helper.
  - set PBR tuning:
    - floor normalScale `(0.9,0.9)`
    - walls normalScale `(0.6,0.6)`
    - trim normalScale `(0.7,0.7)`
    - floor roughness `0.75` (casino) / `0.55` (others)
    - walls `0.85`, trim `0.45`
    - AO intensity around `0.7–0.8` when AO map exists.
  - repeat tiling now per-env slider driven; defaults:
    - casino floor 10
    - other floors 14
    - walls 4.5 (applied as x with y-1)
    - trim 10
  - anisotropy remains capped to `min(8, hardware max)`.

- Added decor test spawn action:
  - spawns `side_table_01_4k` in scene, scales relative to reference, snaps to floor, logs bbox.

Validation:
- `node --check client/main.js` pass
- `node --check server/server.js` pass
- local smoke: `/health` and shared assets endpoints return 200.

Update (avatar-meter decor scaling + texture detail control pass):
- Reworked decor scaling to use avatar height as the real-world anchor:
  - `getDecorReferenceMetrics()` now computes `worldUnitsPerMeter` from seat 0 avatar height with 1.778m baseline.
  - prop target sizing now uses meter-based category defaults (shelves/bookshelves, side/coffee/tall tables, wall/desk/oil lamps, frames, books, bulbs).
- Added robust decor placement helpers:
  - room-bounds clamp with floor/ceiling and x/z limits (`clampPropInsideRoom`)
  - back-wall snapping (`alignPropToBackWall`)
  - tabletop/surface placement and footprint fitting (`fitPropToSupportSurface`)
  - bottom snap helper (`snapPropBottomToY`).
- Updated environment decor layout entries with `onTopOf` support links so tabletop props (lamps/standing frames/book sets) sit on supports correctly.
- Added bookshelf multi-level book population:
  - clones of `decorative_book_set_01_4k` are distributed across 3–5 shelf levels with multiple placements per level.
- Frame orientation fix:
  - wall and standing frames are oriented toward table center and yaw-corrected.
- Added per-environment texture detail controls and persistence:
  - new slider ids: `floor_texture_scale`, `wall_texture_scale`, `trim_texture_scale`
  - range: 0.25..8.0, default 1.0
  - per-env storage keys: `tex_detail_<envId>_floor`, `tex_detail_<envId>_walls`, `tex_detail_<envId>_trim`
  - added `Reset Texture Detail` button.
- Updated repeat application to `baseRepeat * textureScale` for base/normal/roughness/AO maps.
- Decor global scale tuned to requested defaults/range:
  - range 0.25..3.0, default 1.0.
- Material depth tuning updates:
  - floor normalScale -> (0.9, 0.9)
  - trim normalScale -> (0.7, 0.7)
  - anisotropy remains clamped to 8.

Validation this pass:
- `node --check client/main.js` (pass)
- `node --check server/server.js` (pass)
- local runtime smoke:
  - `GET /health` on :3100 returns OK
  - `/assets/environments/_shared/props/props.json` returns 200
  - `/assets/environments/_shared/hdri/anniversary_lounge_4k.exr` returns 200
- Playwright skill client run attempted, but failed due missing `playwright` package in this environment.

TODO / follow-up:
- Run headed visual check once `playwright` is installed to verify shelf-book density and frame-facing final polish in-browser.
