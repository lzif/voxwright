<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Voxwright Mobile: Real-Phone Test Checklist & Baseline Guide

This document defines the manual testing workflow for verifying Voxwright on physical mobile devices (specifically Chrome on Android with WebGL2) and logging hardware baseline telemetry to resolve **Decision 4** from the Mobile Editor Plan (`docs/mobile-editor-plan.md`).

---

## 1. Environment Setup

Testing can be conducted via two primary methods:
- **Method A (Recommended for Phone-Only / On-the-go):** Running the Vite development server directly inside **Termux** on the Android device.
- **Method B (Recommended for Dev Machine / USB Tether):** Running the dev server on a local machine and accessing it via LAN Wi-Fi or USB reverse tethering.

---

### Method A: Running Dev Server in Termux (On-Device)

#### 1. Termux Installation & Toolchain

> **Note:** Install Termux from **F-Droid** or GitHub releases. The Google Play Store version of Termux is deprecated and unmaintained.

Open Termux and run:
```sh
# Update package repositories and install Node.js and Git
pkg update -y
pkg install -y nodejs git

# Enable pnpm (Node 20+ includes corepack, or install pnpm globally)
corepack enable || npm install -g pnpm@12.16.1
```

#### 2. Prevent Android Sleep (Wake Lock)

Android aggressively suspends background processes when switching apps. Enable Termux's wake lock so the dev server does not freeze when you switch to Chrome:
```sh
termux-wake-lock
```
_(A persistent notification "Termux: wake lock held" will appear)._

#### 3. Clone / Open Repository

```sh
git clone https://github.com/lzif/voxwright.git ~/voxwright
cd ~/voxwright
pnpm install --frozen-lockfile
```

#### 4. Shared Storage & Fixture Preparation

Android's file picker in Chrome cannot directly access Termux's private sandbox (`/data/data/com.termux/files/home/`). Grant Termux storage access and copy test fixtures to your Android `Download` folder:
```sh
# Request storage permission (tap 'Allow' on Android popup)
termux-setup-storage

# Copy Rafeals_house fixture to Android Downloads
cp fixtures/real/rafeals-house/Rafeals_house.nbt ~/storage/shared/Download/
cp fixtures/real/rafeals-house/Rafeals_house.litematic ~/storage/shared/Download/
```

#### 5. Launch the Development Server

```sh
pnpm --filter @voxwright/web dev --host
```
Vite will bind to `0.0.0.0:5173`.
_(Note: `apps/web/vite.config.ts` includes `server.fs.allow: [searchForWorkspaceRoot(process.cwd())]`, ensuring workspace packages and workers load without 403 errors)._

#### 6. Open in Chrome on Android

Open Google Chrome on your phone and navigate to:
```text
http://localhost:5173/?perf=1
```
_(or `http://127.0.0.1:5173/?perf=1`)_

---

### Method B: Dev Machine on Local Wi-Fi (LAN Host)

#### 1. Start Dev Server on Host Computer

Ensure your computer and Android phone are connected to the same Wi-Fi network.
On your development machine:
```sh
cd /path/to/voxwright
pnpm --filter @voxwright/web dev --host
```

#### 2. Obtain Host Local IP Address

- **Linux:** `hostname -I | awk '{print $1}'` or `ip addr show`
- **macOS:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig` (IPv4 Address of Wi-Fi adapter)

_(Example IP: `192.168.1.150`)_

#### 3. Allow Firewall Port

Ensure inbound TCP port `5173` is permitted through your host firewall (e.g. `sudo ufw allow 5173/tcp` on Ubuntu).

#### 4. Transfer Fixture to Phone

Download or transfer `fixtures/real/rafeals-house/Rafeals_house.nbt` to your phone's `Download` folder via Google Drive, USB, or local sharing.

#### 5. Open in Chrome on Android

In Chrome on your Android phone, navigate to:
```text
http://<YOUR_DEV_HOST_IP>:5173/?perf=1
```

---

## 2. Browser & WebGL2 Verification

1. **Browser Requirement:**
   - Chrome on Android (Version 115+ recommended).
   - Ensure the browser is not running in battery saver / power throttle mode.
2. **WebGL2 Verification:**
   - On initial page load, inspect the header status badge:
     - **PASS:** `<p class="engine" data-testid="renderer" data-kind="webgl">GPU renderer</p>`
     - **FAIL:** `software renderer (no WebGL2)`.
   - If WebGL2 fails:
     - Open `chrome://gpu` in Chrome.
     - Confirm **WebGL2** indicates `Hardware accelerated`.
     - If disabled or blocklisted, check `chrome://flags` -> search `#ignore-gpu-blocklist` and enable it, then restart Chrome.
3. **Display Refresh Rate:**
   - Check phone display settings (Settings > Display > Smooth Display / Screen refresh rate). Note if running at 60 Hz, 90 Hz, or 120 Hz.

---

## 3. Manual Test Checklist (MB1)

Follow these sequential steps on the phone to verify the baseline:

| Step                          | Action                                                        | Expected Result                                                                                                      | Verified (✓) |
| :---------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Page Load**              | Navigate to `http://localhost:5173/?perf=1` (or LAN IP)       | Page loads without uncaught JS errors. Header displays `GPU renderer`. Status says `"open a schematic to begin..."`. |      []      |
| **2. Perf Overlay Visible**   | Verify HUD in top corner                                      | High-contrast monospace overlay is visible showing live FPS, Triangles, JS Heap, and DPR.                            |      []      |
| **3. Open Fixture**           | Tap **"Open a schematic"** button                             | System file picker opens.                                                                                            |      []      |
| **4. Select Rafeals_house**   | Select `Rafeals_house.nbt` from Downloads                     | Status updates: `"reading Rafeals_house.nbt…"` then `"Rafeals_house.nbt: 14 by 8 by 14 blocks, 762 blocks in all."`  |      []      |
| **5. Scene Render**           | Observe canvas                                                | 3D house mesh renders in center of viewport with correct geometry and flat/atlas shading.                            |      []      |
| **6. One-Finger Orbit**       | Touch canvas with 1 finger and drag horizontally & vertically | Camera smoothly rotates around the structure. No reverse axes, stuttering, or jumping.                               |      []      |
| **7. Two-Finger Pinch Zoom**  | Place 2 fingers on canvas and pinch in / out                  | Camera zooms in and out continuously without disorientation or snapping.                                             |      []      |
| **8. Multi-Touch Release**    | Lift fingers from canvas                                      | Camera motion ceases immediately without drift.                                                                      |      []      |
| **9. Edge Gesture Rejection** | Drag finger starting within 20px of screen edges              | 3D orbit occurs without inadvertently triggering Android system back gesture or browser pull-to-refresh.             |      []      |
| **10. Metrics Capture**       | Observe `?perf=1` overlay during sustained orbit              | FPS stays steady; Triangle count reflects scene (~1,000–3,000 quads/triangles); Heap memory remains stable.          |      []      |
| **11. Clean Exit / Reload**   | Refresh page                                                  | Overlay restores cleanly; no memory leaks or WebGL context loss errors in console.                                   |      []      |

---

## 3b. Manual Test Checklist (MB4: touch placement)

MB4 was built and checked in the VM with emulated touch only. Nobody has tried it on a phone yet, so this is the first real test: a fingertip, the real offset, and the real frame rate. Open `Rafeals_house.nbt` as in section 3, then:

1. Pick **Place** in the bottom toolbar. Tap the block swatch and choose any block (for example `stone`).
2. Zoom in until one cell is a comfortable size, and turn the view so that you can see the roof or a wall face.

| Step                         | Action                                                                    | Expected Result                                                                                                                                                          | Verified (✓) |
| :--------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Cursor**                | Put one finger on the picture and keep it still (under half a second)     | A ring appears about 64 px above the fingertip, joined to it by a dotted line. The cell under the ring is outlined, with a ghost block next to it.                       |      []      |
| **2. Follow**                | Slide the finger slowly across the build                                  | The ring and the outline follow without visible lag. The ring turns teal when it is over a block.                                                                        |      []      |
| **3. Tap places**            | Tap with the finger so that the ring is over a block's face               | One block appears next to the ringed face, not under the fingertip. The line above the toolbar says "place done" and does not mention Ctrl+Z.                            |      []      |
| **4. Undo**                  | Tap **Undo** in the thumb cluster                                         | The block goes. Undo is greyed out again.                                                                                                                                |      []      |
| **5. Drag paints**           | Put the finger down and drag it along a flat surface, then lift           | A run of blocks is painted along that surface. One tap on **Undo** removes the whole run.                                                                                |      []      |
| **6. Second finger cancels** | Start a drag, then put a second finger on the picture                     | The painted blocks vanish at once and the ring disappears. Moving the two fingers pans the view; pinching zooms. Lifting one finger and moving the other paints nothing. |      []      |
| **7. Drag off cancels**      | Start a drag, then slide the finger down onto the bottom toolbar          | The stroke is reverted when the finger reaches the toolbar. Lifting there changes nothing and presses no button.                                                         |      []      |
| **8. Drag off the top**      | Start a drag, then slide the finger up until the ring leaves the top edge | The stroke is reverted when the ring leaves the picture.                                                                                                                 |      []      |
| **9. Long press picks**      | Hold the finger still for about half a second                             | The block under the ring becomes the current block (the swatch in the toolbar changes) and the line above the toolbar says "Picked …". The tool is still Place.          |      []      |
| **10. After a long press**   | Without lifting, move the finger, then lift                               | Nothing is painted and nothing changes.                                                                                                                                  |      []      |
| **11. Replace**              | Pick **Replace**, choose another block, tap with the ring over a block    | That block turns into the chosen one. One **Undo** restores it.                                                                                                          |      []      |
| **12. Erase**                | Pick **Erase**, tap with the ring over a block                            | That block is removed. Drag erases a run. One **Undo** restores it.                                                                                                      |      []      |
| **13. Pick**                 | Pick **Pick**, tap with the ring over a block                             | The current block becomes that block and the tool switches to Place. Dragging with Pick only moves the ring and changes nothing.                                         |      []      |
| **14. Other tools**          | Pick **View**, then **Line**: drag one finger                             | The view turns, as in section 3. Nothing is edited and no ring appears. (Line, Rectangle and Select get their touch version in MB5.)                                     |      []      |
| **15. Long press in View**   | In **View**, hold a finger on a block                                     | The current block becomes the block directly under the fingertip (no offset in this case). The tool stays View.                                                          |      []      |

Questions to answer while testing (write the answers into the log):

- Is 64 px the right distance for your thumb and for your index finger? Too close (the finger still hides the cell) or too far (hard to aim)? The offset is a constant for now; a setting comes later.
- Does the ring keep up with the finger during a drag on this phone, or does it lag behind?
- Does a drag that ends near the bottom of the picture get in the way of the thumb cluster or the toolbar, or of Android's own back gesture at the screen edge?
- Does a long press ever fire when you meant to tap or drag (a slow tap)? Does the half second feel right?
- Is a stroke that starts on empty sky, and so paints nothing, confusing?

---

## 4. Baseline Telemetry Log & Decision 4 Template (FEAT-MB1-04)

### Background & Objective (Decision 4)

According to `docs/mobile-editor-plan.md` (§5, Decision 4):
> _"Largest smooth build on a phone: Open by design: set from MB1's real-phone measurement, then written into MB7."_
> *"Exit criterion: on Luki's phone the Rafeals_house fixture orbits at the display refresh rate (or at least 30 fps), and a 256-wide synthetic build stays at 30 fps while idle-edit stroke latency is under 100 ms."*

Fill out this template with data measured on real hardware.

---

### Hardware & Environment Profile

| Attribute                    | Device Under Test                                             |
| :--------------------------- | :------------------------------------------------------------ |
| **Device Model**             | _(e.g. Google Pixel 8 / Samsung Galaxy S23 / Motorola Edge)_  |
| **SoC / Chipset**            | _(e.g. Qualcomm Snapdragon 8 Gen 2 / Google Tensor G3)_       |
| **CPU Architecture**         | _(e.g. 1x Cortex-X3 + 4x Cortex-A715 + 3x Cortex-A510)_       |
| **Total RAM**                | _(e.g. 8 GB / 12 GB)_                                         |
| **OS & Android Version**     | _(e.g. Android 14 / GrapheneOS / One UI 6)_                   |
| **Browser & Version**        | _(e.g. Chrome 124.0.6367.82 Mobile)_                          |
| **GPU Renderer String**      | _(from chrome://gpu or overlay, e.g. Adreno 740 / Mali-G715)_ |
| **Screen Resolution**        | _(e.g. 1080 x 2340)_                                          |
| **Native Refresh Rate**      | _(e.g. 60 Hz / 90 Hz / 120 Hz)_                               |
| **Device Pixel Ratio (DPR)** | _(from overlay / window.devicePixelRatio, e.g. 2.625 / 3.0)_  |

---

### Performance Benchmark Measurements

Capture readings using the `?perf=1` overlay HUD:

| Scenario / Fixture                                   | Triangles | Draw Calls | Idle FPS | Orbit FPS (Avg) | Orbit FPS (Min) | JS Heap Used | Frame Time (ms) | Time to First Frame |
| :--------------------------------------------------- | :-------: | :--------: | :------: | :-------------: | :-------------: | :----------: | :-------------: | :-----------------: |
| **Rafeals_house.nbt**<br>_(14 x 8 x 14, 762 blocks)_ |           |            |          |                 |                 |              |                 |                     |
| **Synthetic Small**<br>_(64 x 64 x 64)_              |           |            |          |                 |                 |              |                 |                     |
| **Synthetic Medium**<br>_(128 x 64 x 128)_           |           |            |          |                 |                 |              |                 |                     |
| **Synthetic Large**<br>_(256 x 64 x 256)_            |           |            |          |                 |                 |              |                 |                     |

_Note: Synthetic schematics can be generated via `apps/web/scripts/synthetic.ts` or `apps/web/scripts/measure.ts`._

---

### Decision 4 Evaluation & Analysis

1. **Rafeals_house Assessment:**
   - Did `Rafeals_house` achieve display refresh rate (or >= 30 FPS)?
     `[ ] YES (FPS: _____ )` / `[ ] NO (FPS: _____ )`
   - Smoothness subjective rating (1-5): `_____`
2. **Maximum Smooth Build Size Recommendation:**
   - Based on measured frame rates, what is the largest build volume that maintains >= 30 FPS sustained orbit on this device?
     - `[ ] Full 256 x 64 x 256 (~2M cells)`
     - `[ ] 128 x 64 x 128 (~500k cells)`
     - `[ ] 64 x 64 x 64 (~150k cells)`
     - `[ ] Custom threshold:` `____________________`
3. **Implications for MB7 (Phone Performance Pass):**
   - **Dynamic Resolution Scaling:** Should canvas resolution scale down during camera gestures?
     _(Recommendation: If DPR >= 2.5 and Orbit FPS drops below 45, clamp DPR to 1.0–1.5 during camera motion)._
   - **Mobile Memory Budget Clamp:** Recommended `maxBytes` for History on mobile coarse pointers:
     _(Recommendation: Clamp to 16 MiB or 32 MiB if JS Heap exceeds 100 MB)._
   - **Worker Pool Clamp:** Number of mesh workers recommended:
     _(Recommendation: 2 workers for big.LITTLE phone architectures to avoid thermal throttling)._
