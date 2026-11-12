# Implementation Plan: AETHER-3D (Blueprint → Ship)

## Goal

Deliver AETHER-3D per the blueprint (`AETHER-3D Application Blueprint & Build Plan.pdf`): a cross-platform Electron desktop app with a Python CV backend, Three.js sci-fi HUD, depth-based 3D point-cloud reconstruction, and working mesh/point-cloud export.

The existing `sci_fi_hud_3d_scanner_desktop.html` is treated as the **Phase 3 UI reference** (to be ported into Electron's renderer), not production code.

---

## 0. Decisions to lock before coding

- **OS target:** cross-platform (Windows/macOS/Linux). (Adjust if Windows-only is preferred.)
- **Depth model:** Depth Anything v2 (smaller, faster) over MiDaS.
- **Detector:** YOLOv8n primary, MediaPipe as optional secondary.
- **Python packaging:** embedded sidecar via PyInstaller (no user Python install).
- **Export priority:** PLY (point cloud) first, then OBJ/STL mesh.

---

## Phase 0 — Repository scaffolding (Week 0)

**Goal:** replace loose files with a real project layout.

Tasks:
- Create monorepo layout:
  ```
  aether-3d/
  ├── app/                 # Electron (main + preload + renderer)
  │   ├── main/            # main process, windowing, sidecar lifecycle
  │   ├── preload/         # contextBridge IPC
  │   └── renderer/        # ported HTML/CSS/Three.js (Vite + TS)
  ├── backend/             # Python sidecar
  │   ├── cv/              # capture, detection, tracking
  │   ├── depth/           # depth + point cloud
  │   ├── recon/           # multi-side alignment, meshing
  │   └── server.py        # WebSocket/gRPC entry
  ├── shared/              # IPC schema (JSON/protobuf), types
  ├── assets/, scripts/, tests/
  ├── package.json, pyproject.toml
  ```
- Add tooling: ESLint/Prettier, Python ruff/black, pytest, Vite.
- Pin versions: Electron (latest LTS), Three.js (r160+), Python 3.14.x, OpenCV 4.x, Open3D 0.18+, onnxruntime (CPU; GPU optional).
- CI: lint + unit tests on push; build matrix for target OSes.

**Deliverable:** `npm run dev` opens an empty Electron window; `python backend/server.py` starts and prints "ready".

---

## Phase 1 — CV & Tracking Pipeline (Weeks 1–2)

**Goal:** Python backend emits smooth X,Y,W,H + confidence over WebSocket.

Tasks:
1. Video capture abstraction: webcam (`cv2.VideoCapture`), file, and "simulated" source (for dev/CI). Frame queue with backpressure.
2. Detector: YOLOv8 (ultralytics) on a background thread @ 30 FPS; configurable model size (n/s/m). MediaPipe as optional secondary.
3. Tracker: ByteTrack or simple IoU tracker to maintain target ID across frames (single-target lock + re-acquire).
4. Publish telemetry over WebSocket (`ws://127.0.0.1:8765`): `{ts, frame_id, bbox:{x,y,w,h}, conf, cls, fps}` at ≤12 ms latency.
5. Health endpoint + heartbeat; auto-restart sidecar from Electron main if it dies.
6. Structured JSON logging; crash dumps.

**Validation gate:**
- 30 FPS sustained on 1080p with YOLOv8n on CPU.
- Latency p95 < 12 ms (round-trip ping).
- Unit tests: bbox smoothing, tracker ID stability on synthetic video.

---

## Phase 2 — Interpolation & Smoothing (Weeks 2–3)

**Goal:** zero visual stutter / snapping.

Tasks:
1. Implement EMA Lerp on every render frame (blueprint formula) in the **renderer** (JS), not Python — keeps 60 FPS independent of 30 FPS CV:
   `rendered = prev + α·(target − prev)`, α from slider (0.01–1.0).
2. Add Kalman filter (constant-velocity) as optional "precision" mode; compare vs Lerp on a test clip.
3. Handle target loss: freeze last good position for N frames, then fade reticle; re-acquire with hysteresis.
4. Outlier rejection: ignore detections whose center jumps > threshold in one frame (prevents OpenCV spikes).
5. Expose α + mode via IPC settings; persist to user prefs.

**Validation gate:**
- Side-by-side video test: raw vs smoothed; no visible snap on direction change.
- Quantitative: jitter (std of frame-to-frame delta) reduced ≥60% vs raw.

---

## Phase 3 — Electron Shell & Three.js HUD (Weeks 3–5)

**Goal:** port the HTML prototype into the Electron renderer with real data.

Tasks:
1. Port HTML → TS modules under `app/renderer`: layout, components, icon hydration (Lucide or inline SVG to avoid runtime CDN).
2. Three.js scene: keep torus-knot hologram + point cloud + grid, but:
   - Use r160+, `WebGLRenderer` with antialias, proper resize via `ResizeObserver`.
   - Dispose geometries/materials on density change (fix leak).
   - Camera controls (OrbitControls) in hologram mode.
3. WebSocket client in renderer (or main forwarding) → drives reticle position, telemetry panel, real FPS counter (`THREE.Clock`/rAF delta).
4. View modes: Tracking HUD (overlay on video) vs Hologram Mesh (isolated 3D). Video element as texture/background in feed mode.
5. Reticle modes: HUD brackets / wireframe cube / 2D box — fix CSS (`solid`, not `stroke`).
6. Density slider rebuilds point cloud geometry with N points; update poly count.
7. Scan trigger: wire to backend reconstruction job; progress via IPC events.
8. Toasts, theming, keyboard shortcuts, settings persistence.

**Validation gate:**
- 60 FPS viewport with CV running; memory stable over 10 min.
- No console errors; icons render after dynamic swaps.

---

## Phase 4 — 3D Mesh & Export Pipeline (Weeks 5–8)

**Goal:** multi-side capture carousel + working exporters.

Tasks:
1. Depth: run Depth Anything v2 (ONNX) per captured frame → depth map.
2. Back-project to 3D using intrinsics (fx,fy,cx,cy): `Z=d/scale`, `X=(u-cx)Z/fx`, `Y=(v-cy)Z/fy`. Apply object mask to keep only target pixels.
3. Multi-side capture: trigger at 0°/45°/90°/180° (+ point cloud). Store keyframes + depth + pose.
4. Alignment: Open3D ICP / multiway registration across views → fused point cloud.
5. Meshing: Poisson reconstruction or ball-pivoting → mesh; decimate to target poly count.
6. Exporters: PLY (point cloud), OBJ, STL (mesh) via Open3D + Electron `dialog.showSaveDialog`.
7. Progress streaming: `{stage, percent, message}` over IPC → progress bar + toast.
8. Caching: save intermediate point clouds to avoid recompute.

**Validation gate:**
- End-to-end: capture 5 views → exported `.PLY` opens in MeshLab/Blender with correct geometry.
- `.OBJ`/`.STL` export produces valid, non-degenerate meshes.
- RAM ≤ 2.2 GB during reconstruction (profile; downsample if needed).

---

## Cross-cutting concerns

- **IPC contract:** versioned schema in `shared/` (TS + Python pydantic). Types: `Telemetry`, `Settings`, `CaptureRequest`, `ProgressEvent`, `ExportRequest`. WebSocket for high-frequency telemetry; Electron `ipcMain`/`ipcRenderer` for commands.
- **Security:** `contextIsolation` on, no `nodeIntegration` in renderer, preload bridge only; validate all IPC payloads; CSP in renderer.
- **Performance instrumentation:** FPS overlay, IPC latency histogram, memory sampler; expose in a "Diagnostics" panel.
- **Error handling:** sidecar crash → auto-restart with backoff + user-visible status; GPU OOM → fall back to CPU depth model.
- **Testing:** pytest for backend (capture, detection smoke, depth projection math, export round-trip); Vitest + Playwright for renderer/E2E.
- **Packaging:** electron-builder; bundle Python sidecar via PyInstaller; sign/notarize for macOS; installer for Windows. Target size budget (aim < 800 MB with models, or download models on first run).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Python sidecar latency > 12 ms | Keep CV at 30 FPS; render interpolation in JS at 60 FPS; use binary WebSocket frames |
| Depth model too heavy for CPU | Ship small ONNX variant; allow GPU opt-in; tile large frames |
| Open3D memory blowup | Downsample point clouds; stream chunks; cap resolution |
| Three.js perf on iGPU | Upgrade to r160+; use instancing for point cloud |
| Cross-platform GPU/CUDA | Default to CPU ONNX; optional CUDA build flag |

## Milestones / gates

- M0 (wk0): scaffold + dev runs
- M1 (wk2): Phase 1 CV backend emits telemetry, latency validated
- M2 (wk3): Phase 2 smoothing validated quantitatively
- M3 (wk5): Phase 3 Electron app at 60 FPS with real feed
- M4 (wk8): Phase 4 end-to-end export validated in external viewer
- M5 (wk9–10): packaging, signing, docs, release candidate

## Reuse from existing HTML

- Keep: layout structure, color tokens, animation keyframes, Three.js scene composition (torus knot, point cloud, grid, fog), telemetry panel, carousel markup, toast helper.
- Discard/replace: CDN script tags (bundle locally), hardcoded telemetry, decorative camera select, toast-only export/save, invalid `stroke` border, static progress.

## Defects already identified in the HTML prototype

1. Invalid CSS in `setBoxMode('wire')` — `border = '1px stroke #0066ff'` is invalid; use `solid`.
2. Point-cloud density slider is cosmetic — geometry built once at 1024 points, never rebuilt/disposed.
3. `lucide.createIcons()` only at startup — icons injected via `innerHTML` may not hydrate.
4. Progress bar initial state hardcoded at 75%.
5. No guards in `animate()` — `renderer.render()` runs unconditionally.
6. Reticle transform overrides Tailwind centering classes — functional but fragile.
7. `container.clientWidth` can be 0 in some embed contexts on init.
8. `scan-trigger-btn` loses `onclick` after innerHTML swap until the 3s reset.
9. No CSP/SRI on CDN scripts.
10. Three.js r128 is outdated (2020).

## Missing vs. blueprint spec

- Smoothing: only EMA Lerp exists; Kalman filter absent. Lerp runs on simulated data only.
- Depth→point cloud projection math not implemented.
- Multi-side capture carousel is static markup; no capture/keyframe storage.
- Frame-rate/latency/memory verification: no instrumentation.
- Export suite is a toast.

---

## What's needed to proceed

1. Confirm decisions in §0 (OS, depth model, detector, Python packaging, export priority).
2. Confirm whether to start with Phase 0 scaffolding (switch out of Plan mode to write files) or refine the plan first.
3. Any hard deadlines / target hardware (GPU model) that change model choices.
