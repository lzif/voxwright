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

| Step                            | Action                                                                                                                                                       | Expected Result                                                                                                                                                                                                                                                                                                        | Verified (✓) |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Cursor**                   | Put one finger on the picture and keep it still (under half a second)                                                                                        | A ring appears about 64 px above the fingertip, joined to it by a dotted line. The cell under the ring is outlined, with a ghost block next to it.                                                                                                                                                                     |      []      |
| **2. Follow**                   | Slide the finger slowly across the build                                                                                                                     | The ring and the outline follow without visible lag. The ring turns teal when it is over a block.                                                                                                                                                                                                                      |      []      |
| **3. Tap places**               | Tap with the finger so that the ring is over a block's face                                                                                                  | One block appears next to the ringed face, not under the fingertip. The line above the toolbar says "place done" and does not mention Ctrl+Z.                                                                                                                                                                          |      []      |
| **4. Undo**                     | Tap **Undo** in the thumb cluster                                                                                                                            | The block goes. Undo is greyed out again.                                                                                                                                                                                                                                                                              |      []      |
| **5. Drag paints**              | Put the finger down and drag it along a flat surface, then lift                                                                                              | A run of blocks is painted along that surface. One tap on **Undo** removes the whole run.                                                                                                                                                                                                                              |      []      |
| **6. Second finger cancels**    | Start a drag, then put a second finger on the picture                                                                                                        | The painted blocks vanish at once and the ring disappears. Moving the two fingers pans the view; pinching zooms. Lifting one finger and moving the other paints nothing (it turns the view, see step 16).                                                                                                              |      []      |
| **7. Drag off cancels**         | Start a drag, then slide the finger down onto the bottom toolbar                                                                                             | The stroke is reverted when the finger reaches the toolbar. Lifting there changes nothing and presses no button.                                                                                                                                                                                                       |      []      |
| **8. Drag off the top**         | Start a drag, then slide the finger up until the ring leaves the top edge                                                                                    | The stroke is reverted when the ring leaves the picture.                                                                                                                                                                                                                                                               |      []      |
| **9. Long press picks**         | Hold the finger still for about half a second                                                                                                                | The block under the ring becomes the current block (the swatch in the toolbar changes) and the line above the toolbar says "Picked …". The tool is still Place.                                                                                                                                                        |      []      |
| **10. After a long press**      | Without lifting, move the finger, then lift                                                                                                                  | Nothing is painted and nothing changes.                                                                                                                                                                                                                                                                                |      []      |
| **11. Replace**                 | Pick **Replace**, choose another block, tap with the ring over a block                                                                                       | That block turns into the chosen one. One **Undo** restores it.                                                                                                                                                                                                                                                        |      []      |
| **12. Erase**                   | Pick **Erase**, tap with the ring over a block                                                                                                               | That block is removed. Drag erases a run. One **Undo** restores it.                                                                                                                                                                                                                                                    |      []      |
| **13. Pick**                    | Pick **Pick**, tap with the ring over a block                                                                                                                | The current block becomes that block and the tool switches to Place. Dragging with Pick only moves the ring and changes nothing.                                                                                                                                                                                       |      []      |
| **14. View turns**              | Pick **View**: drag one finger                                                                                                                               | The view turns, as in section 3. Nothing is edited and no ring appears. (Line, Rectangle, Select and Paste take a finger since MB5: section 3c.)                                                                                                                                                                       |      []      |
| **15. Long press in View**      | In **View**, hold a finger on a block                                                                                                                        | The current block becomes the block directly under the fingertip (no offset in this case). The tool stays View.                                                                                                                                                                                                        |      []      |
| **16. Finger left down orbits** | With **Place** chosen, pan or pinch with two fingers for a second, lift one finger and keep the other down. Hold it still for a second, then slide it slowly | The view does not move while the finger is still, and it does not jump when the finger starts to move: the first few millimetres of movement turn the view by a few degrees, then it follows the finger. No ring appears, nothing is placed, and the block in the toolbar does not change. Lifting the finger ends it. |      []      |
| **17. Again, and again**        | Repeat step 16, but put the second finger down again while the first is still turning the view, then lift either one                                         | Two fingers pan and pinch again; lifting one finger lets the other keep turning the view. Nothing is painted or picked.                                                                                                                                                                                                |      []      |
| **18. Quick two-finger tap**    | In **View**, tap the picture quickly with two fingers at once, without moving                                                                                | Nothing turns or moves (a two-finger tap has no action yet in this version).                                                                                                                                                                                                                                           |      []      |
| **19. Same in View**            | Pick **View** and repeat step 16                                                                                                                             | Same result: the finger left down keeps turning the view smoothly.                                                                                                                                                                                                                                                     |      []      |
| **20. Cursor distance 0**       | Open **Menu**, scroll to **Settings** and find **Cursor distance**. Drag it to 0, close the menu. Pick **Place**, then put a finger on a block's face        | The readout says "0 px". The ring is right under the fingertip (no dotted line). A tap places the block on the face the fingertip is on.                                                                                                                                                                               |      []      |
| **21. Cursor distance 64**      | Set **Cursor distance** to 64 (the middle)                                                                                                                   | The readout says "64 px" and the ring is about 64 px above the fingertip, as in step 1. This is the starting value on a fresh browser.                                                                                                                                                                                 |      []      |
| **22. Cursor distance 128**     | Set **Cursor distance** to 128 (the right end)                                                                                                               | The readout says "128 px". The ring is about 128 px above the fingertip, joined to it by a dotted line. A tap places the block at the ring. The slider is easy to hit with a thumb.                                                                                                                                    |      []      |
| **23. Distance is kept**        | Set a value such as 40, reload the page (or close the tab and open it again), open **Menu**                                                                  | The slider and the readout still say "40 px". After opening a file (or restoring the saved edits when the page offers them), the ring is 40 px above the fingertip.                                                                                                                                                    |      []      |

Questions to answer while testing (write the answers into the log):

- Is 64 px the right distance for your thumb and for your index finger? Too close (the finger still hides the cell) or too far (hard to aim)? Which value on the **Cursor distance** slider do you end up using, for the thumb and for the index finger? Is the step of 8 px fine enough?
- When you lift one finger of a two-finger gesture, does the finger left down feel natural when it starts to turn the view, or do you sometimes want it to stay still? Does a slight shift of that finger as the other lifts turn the view when you did not mean it?
- Does the ring keep up with the finger during a drag on this phone, or does it lag behind?
- Does a drag that ends near the bottom of the picture get in the way of the thumb cluster or the toolbar, or of Android's own back gesture at the screen edge?
- Does a long press ever fire when you meant to tap or drag (a slow tap)? Does the half second feel right?
- Is a stroke that starts on empty sky, and so paints nothing, confusing?

## 3c. Manual Test Checklist (MB5: armed cell, nudge pad and two-corner tools)

MB5 was built and checked in the VM with emulated touch only; nobody has tried it on a phone. Open `Rafeals_house.nbt`, pick a block (for example `stone`), turn the view so that you can see the roof from above, and zoom so that one cell is a comfortable size.

| Step                           | Action                                                                                                                                 | Expected Result                                                                                                                                                                                                                           | Verified (✓) |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Nothing pending**         | Look at the thumb cluster                                                                                                              | The check mark and the cross are greyed out. The cluster sits above the line over the toolbar, not on it.                                                                                                                                 |      []      |
| **2. Corner A**                | Pick **Line**. Tap a block with the ring over it                                                                                       | A yellow outline appears on the cell next to the face, the nudge pad appears next to the thumb cluster, the check mark and the cross turn on, and the line above the toolbar says `▸A x,y,z B —`. Nothing was placed.                     |      []      |
| **3. Corner B**                | Tap another block                                                                                                                      | A green box joins the two corners, B is the highlighted letter on the pad, and the line above the toolbar shows both corners and the size.                                                                                                |      []      |
| **4. Confirm**                 | Tap the check mark                                                                                                                     | The line is drawn, the message says "line: N blocks changed", the pad disappears. One **Undo** removes the whole line.                                                                                                                    |      []      |
| **5. Nudge**                   | Make a line again. Tap the arrow that points right on the screen                                                                       | Corner B moves one block to the right on the screen, and the size in the line above the toolbar changes by one. Then try the other arrows, **Up** and **Down**. Confirm: the line has exactly one more block than before.                 |      []      |
| **6. Turn the view**           | With a line pending, turn the view a quarter turn with two fingers, then press "right" again                                           | The pending line is still there. "Right" still moves B the way the screen's right points. (When the view is exactly diagonal, "away" is along z and "right" along x: check which way the arrows go.)                                      |      []      |
| **7. A / B**                   | Tap the **A B** button, then an arrow                                                                                                  | A is the highlighted letter and the arrow moves corner A; B stays.                                                                                                                                                                        |      []      |
| **8. Hold to repeat**          | Hold an arrow down for a second                                                                                                        | It moves once at once, waits a moment, then keeps moving about ten times a second until you lift the finger. Holding it against the edge of the visible layers stops with a message.                                                      |      []      |
| **9. Drag a corner**           | With a line pending, put a finger down and drag                                                                                        | The active corner follows the ring live, the view does not turn, and lifting leaves it there.                                                                                                                                             |      []      |
| **10. Second finger**          | Start that drag, then put a second finger down                                                                                         | The corner jumps back to where it was before the drag. The line, the pad and the check mark stay. Two fingers pan and zoom.                                                                                                               |      []      |
| **11. Camera gestures**        | With a line pending, pinch, pan with two fingers, and turn with the finger left down                                                   | The pending line is not lost by any of them.                                                                                                                                                                                              |      []      |
| **12. Long press**             | With a line pending, hold a finger on a block for half a second                                                                        | The block becomes the current block ("Picked …") and the line stays pending.                                                                                                                                                              |      []      |
| **13. Cross**                  | Make a line and tap the cross                                                                                                          | Everything is dropped and nothing is drawn. Choosing another tool, **Undo** or **Redo** does the same.                                                                                                                                    |      []      |
| **14. Rectangle**              | Pick **Rectangle**, tap a block, tap the **Hollow** button on the pad, then tap a point on the same plane (it can be over empty space) | A flat green rectangle between the corners. Confirm: only the frame is drawn. **Up** on the pad moves the whole rectangle one layer; a sideways arrow moves one corner. Turn **Hollow** off for a filled one. One **Undo** removes it.    |      []      |
| **15. Select**                 | Pick **Select**, tap two blocks, tap the check mark                                                                                    | The blue selection box is drawn while you set the corners and the message says "Selected W × H × L". The cross before the check mark puts back the selection you had.                                                                     |      []      |
| **16. Face steppers**          | Tap **Select** in the bottom toolbar to open the sheet. Press **West +1**, **East +1** and **Top +1**                                  | The selection grows one block on that side each time, and the size under "Selection" follows. **−1** takes a layer off. A face cannot go past the opposite one. They are not undo steps. Reaching 3 × 3 × 3 takes a few presses.          |      []      |
| **17. Layers limit**           | Use the layer sliders in **Menu** to hide the top layers, then nudge a corner up                                                       | The step is refused with "Layer N is outside the visible layers …" and nothing moves.                                                                                                                                                     |      []      |
| **18. Confirm each placement** | **Menu**, **Settings**: turn on **Confirm each placement**. Pick **Place**, tap a block                                                | Nothing is placed: the cell is armed (yellow) and the pad appears. A drag only moves the ring; lifting arms the cell. The check mark places exactly one block (one **Undo**). The cross places none. Replace and Erase wait the same way. |      []      |
| **19. Setting is kept**        | Close the tab and open the page again                                                                                                  | The checkbox is still on. Turn it off: a tap places at once, as in section 3b.                                                                                                                                                            |      []      |
| **20. Paste**                  | Select a box, **Copy** and **Paste** in the Selection sheet, close the sheet, tap where it should go                                   | The copied box is drawn as a green ghost at the tapped cell. The pad moves it. The check mark pastes (one **Undo**), the cross does not.                                                                                                  |      []      |
| **21. Left-handed**            | **Menu**, **Settings**: turn on **Left-handed controls**, make a line                                                                  | The thumb cluster and the pad are on the left, the pad still next to the cluster. Is the pad within reach of your thumb?                                                                                                                  |      []      |
| **22. Buttons**                | Look at the pad and the face steppers                                                                                                  | Every button is at least 48 px and easy to hit with a thumb. Do you ever press the wrong arrow?                                                                                                                                           |      []      |

Questions to answer while testing (write the answers into the log):

- Does the pad cover too much of the picture, or sit where your thumb can reach it? It takes the lower middle of the screen while something is pending: do you need to pan the view to tap there?
- Are the arrows' meanings right when you turn the view? Is "away" and "toward" clear, or would you want other icons?
- Is hold-to-repeat too fast or too slow (400 ms, then every 100 ms)?
- Is it clear which corner is active (the yellow outline and the letter on the pad)? Is the **A B** button easy to find?
- Does the line above the toolbar fit the corners and the size on your phone, or is it cut off?
- Is **+1** and **−1** on the faces clear ("one more layer on that side" and "one less")? Are the names West, East, Bottom, Top, North and South easy to follow?
- Do you turn on **Confirm each placement**, and does it feel safer or slower?

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
