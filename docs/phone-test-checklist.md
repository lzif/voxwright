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

## 3d. Manual Test Checklist (MB6: selection actions and block state by touch)

MB6 was built and checked in the VM with emulated touch only; nobody has tried it on a phone. Open `Rafeals_house.nbt` and turn the view so that you can see the roof (stairs) from above. The house has stairs on the roof but no door you can reach from outside; for the door steps, choose an oak door in the palette (type `oak_door` in the search) and place one with **Place**.

| Step                        | Action                                                                                                               | Expected Result                                                                                                                                                                                                                | Verified (✓) |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Tap to inspect**       | In **View**, tap a stairs block (a quick tap, not a drag)                                                            | The block is outlined and an **Edit state ›** button appears at the right end of the line above the toolbar. The picture does not turn and nothing is edited.                                                                  |      []      |
| **2. Drags do not inspect** | Turn the view with one finger, pinch, pan with two fingers, then lift one finger and keep turning with the other     | None of these changes what is outlined or shows the button. A long press (half a second) picks the block ("Picked …") and outlines it.                                                                                         |      []      |
| **3. Empty space**          | Tap the sky beside the build                                                                                         | The outline and the button go.                                                                                                                                                                                                 |      []      |
| **4. Chip**                 | Tap the stairs, then **Edit state ›**                                                                                | The Block state sheet opens and names the block and its position. **facing** and **half** are rows of chips, **shape** wraps onto more lines, **waterlogged** is a switch. Is every chip easy to hit?                          |      []      |
| **5. Chips and switch**     | Tap another **facing** chip; tap the **waterlogged** switch twice                                                    | The block in the picture changes at once each time. The pressed chip follows. The sheet's top line says what was done. One **Undo** (close the sheet first) reverts each change.                                               |      []      |
| **6. Rotate block**         | Tap **Rotate block** four times                                                                                      | facing goes north, east, south, west, north (clockwise seen from above); every press is one **Undo** step.                                                                                                                     |      []      |
| **7. Other…**               | Tap **Other…**                                                                                                       | A text field per property and a row to add a property appear. The on-screen keyboard opens when you tap a field and the sheet stays usable. Type a value, leave the field: it applies.                                         |      []      |
| **8. Door and numbers**     | Place an oak door, tap it in View, open its sheet. Place a sign and look at **rotation**                             | The door's **open** is a switch: one tap opens it. The sign's **rotation** is a stepper with − and +: it stops at 0 and 15.                                                                                                    |      []      |
| **9. Selection sheet**      | Select a box (**Select**, two taps, the check mark). Open **Select** in the toolbar                                  | Fill, Replace, Rotate ↺ ↻, Mirror, Copy, Paste, Select all and Clear are big buttons in two columns. The typed corners and the block-at-coordinates fields are at the bottom. Is anything too small or too crowded?            |      []      |
| **10. Fill and Replace**    | Choose a block, press **Fill**. Tap a block in View, open the sheet, press **Use inspected block**, then **Replace** | The box fills. The field shows the tapped block's full state; Replace swaps exactly that state in the box for the chosen block.                                                                                                |      []      |
| **11. Move pad**            | Press the arrow that points to your right, then the others; turn the view a quarter turn and press "right" again     | The selected blocks move one block the way the arrow points on the screen each time, and one **Undo** reverts one press. Up and Down move one layer. When the view is exactly diagonal, "away" is along z and "right" along x. |      []      |
| **12. ×8 and hold**         | Turn **×8** on and press an arrow. Turn it off and hold an arrow for a second                                        | One press moves eight blocks. Holding moves once at once, waits a moment, then repeats; each repeat is one **Undo** step. Is that too many undo steps for you?                                                                 |      []      |
| **13. Copy and Paste**      | Press **Copy**, then **Paste**                                                                                       | The message says how many blocks were copied. Paste closes the sheet; a tap sets the origin (green ghost), the nudge pad moves it, the check mark pastes. Is it clear that the sheet closed on purpose?                        |      []      |
| **14. Recent blocks**       | Open the palette from the block button; tap three different blocks; tap a chip in the row above the search           | Each block becomes a chip, newest first. A tap on a chip chooses that block and the sheet stays open. Pick a block with **Pick** or a long press: it joins the row.                                                            |      []      |
| **15. Favourites**          | Tap the star on two list rows. Reload the page                                                                       | Starred blocks lead the row with a ★. After the reload they are still there, with the recent ones after them.                                                                                                                  |      []      |
| **16. Quick row**           | Close the palette                                                                                                    | The same chips are in one row above the line over the toolbar, left of the thumb cluster (right of it when left-handed). It scrolls sideways inside itself and does not cover the readout. It hides while a corner is pending. |      []      |
| **17. Export**              | Open **Menu**, press **Export and download**, open the file in Litematica or any viewer                              | The file holds the edited build.                                                                                                                                                                                               |      []      |

Questions to answer while testing (write the answers into the log):

- Is the **Edit state ›** button easy to find and to hit with a thumb, or does it get in the way of the readout? It makes the line above the toolbar taller while it shows.
- Do the chips, switches and steppers feel right, or would you want other controls (for example a stepper instead of chips for some property)?
- Is **Rotate block** useful, and does it turn the right way?
- Is the quick row of recent blocks within reach and at a good height? Is it ever in the way, or do you want it somewhere else?
- Does the move pad feel right, in particular hold-to-repeat and ×8? Should a held button make one undo step instead of many?
- Would you want block pictures on the chips (not part of MB6)?

---

## 3e. Manual Test Checklist (camera conveniences: double tap, Zoom in here, twist)

These three were built and checked in the VM with emulated touch only; nobody has tried them on a phone. Open `Rafeals_house.nbt` with the **View** tool.

| Step                        | Action                                                                                                                                  | Expected Result                                                                                                                                                                                                                                                                                | Verified (✓) |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Double tap**           | Double tap a block of the roof, as fast as is comfortable                                                                               | The block is outlined (the first tap) and the camera moves so that block is in the middle of the picture and about twice as close. Nothing is edited.                                                                                                                                          |      []      |
| **2. Again, and the floor** | Double tap the same block again, three or four times                                                                                    | Each double tap halves the distance again. It stops at 4 blocks: further double taps move nothing but the centre.                                                                                                                                                                              |      []      |
| **3. Slow second tap**      | Tap a block, wait about half a second, tap it again                                                                                     | Two single taps: the block is outlined, the camera does not move.                                                                                                                                                                                                                              |      []      |
| **4. Empty space**          | Double tap the sky beside the build                                                                                                     | Nothing happens; the outline goes (a tap on empty space clears it).                                                                                                                                                                                                                            |      []      |
| **5. A tool**               | Choose **Select** and double tap the picture                                                                                            | Corners A and B are set (the tool's taps) and the camera does not move. Cancel with the cross.                                                                                                                                                                                                 |      []      |
| **6. Zoom in here**         | Choose **Select**, tap a block to set corner A. Press **Zoom** in the bottom-left corner of the nudge pad                               | The view centres on corner A and comes half as close. The corner and the pad stay. Press the **Up** arrow once, then **Zoom** again: the view follows the corner up a block. Is the button easy to hit with the thumb?                                                                         |      []      |
| **7. Both corners**         | Set corner B too, press **Zoom**, switch to corner A with the **A B** button and press **Zoom** again                                   | The view goes to B first, then to A.                                                                                                                                                                                                                                                           |      []      |
| **8. Twist**                | Put two fingers on the picture and turn them like a dial by a quarter turn, clockwise                                                   | Nothing moves for the first few degrees (about 10). Then the build turns with your fingers, clockwise as you look at it, one degree for one degree, staying about 10 degrees behind them (about 80 degrees for a quarter turn, no more) and never jumping. Does it track your fingers closely? |      []      |
| **9. Twist and pinch**      | Twist while spreading the fingers apart, then pan with two fingers while twisting                                                       | The view turns and zooms (or pans) in the same gesture.                                                                                                                                                                                                                                        |      []      |
| **10. No accidental turn**  | Pinch, then pan with two fingers, without trying to turn                                                                                | The view zooms and pans but does not turn. A small wobble of the fingers (under 10 degrees) never turns it.                                                                                                                                                                                    |      []      |
| **11. Vertical drag**       | Drag two fingers up and down                                                                                                            | The build pans. It does not tilt (use the **Tilt** slider in **Menu**).                                                                                                                                                                                                                        |      []      |
| **12. Setting**             | **Menu**, **Settings**: turn **Twist with two fingers to turn** off, close the menu, twist; reload the page and twist again; turn it on | With it off a twist does not turn the view (pinch and pan still work). The choice survives the reload. With it on, the twist turns the view again.                                                                                                                                             |      []      |

Questions to answer while testing (write the answers into the log):

- Is the double-tap timing (0.3 seconds) right for you, or do you tap slower or faster? Does a double tap ever miss, or fire when you meant two single taps?
- Is halving the distance each time right, or should one double tap zoom more or less?
- Does the twist's dead zone (10 degrees) feel right? When it opens, does the view start smoothly? Is the permanent lag of about 10 degrees behind the fingers noticeable or annoying? Does turning about the middle of the picture (not about the point between your fingers) feel wrong?
- Do you turn the view by accident while pinching, or while panning? Would you rather have it off by default?
- Is **Zoom** where your thumb expects it on the nudge pad, and does it need to be bigger or somewhere else?

---

## 3f. Manual Test Checklist (MB7: the performance pass, and the numbers it needs)

MB7 was built and checked in the VM only (software WebGL), where it cannot show whether it helps. **Nothing in MB7 is proven until these numbers come back from a real phone.** Please open every page below with `?perf=1` added to the address, so the overlay shows FPS, JS heap, DPR, Ratio, Quality, Workers and History cap.

**The 256-wide build.** Make the file on the dev machine, from the repository's `apps/web` folder (it takes a few seconds and writes `synthetic-256.schem`, 118 KB; the file is not part of the repository, so delete it afterwards), then copy it to the phone as for the fixture:

```sh
node --input-type=module -e "import {writeSchem} from '@voxwright/core'; import {generateTerrain} from './scripts/synthetic.ts'; import {writeFileSync} from 'node:fs'; const v=generateTerrain({size:256,height:64}); const {bytes}=await writeSchem(v,{dataVersion:4903,version:3}); writeFileSync('synthetic-256.schem',bytes)"
```

**Quick checks**

| Step           | Action                                                                             | Expected Result                                                                                                                                                        | Verified (✓) |
| :------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **1. Overlay** | Open `Rafeals_house.nbt` with `?perf=1`                                            | **Workers** reads 2 and **History cap** 16 MB. **DPR** is the phone's ratio (for example 2.63 or 3.00) and **Ratio** is the same, but never above 2.00 (Auto, idle).   |      []      |
| **2. Auto**    | Turn the build with one finger, pinch, pan and twist with two, and watch **Ratio** | **Ratio** drops to 1.00 while the picture moves and is back at its idle value a moment after you stop, even with a finger still down. The picture is sharp when still. |      []      |
| **3. High**    | **Menu**, **Settings**, **Quality**: High. Turn, pinch and pan                     | **Ratio** stays at its idle value (never 1.00 while moving). No note about anti-aliasing (Auto to High changes nothing there).                                         |      []      |
| **4. Low**     | Choose Low                                                                         | **Ratio** is 1.00 at once and the picture is softer. A note says anti-aliasing changes the next time the page loads. Reload: Low is on from the first frame, no note.  |      []      |
| **5. Back**    | Choose Auto or High after Low                                                      | The resolution is back at once. The note shows until you reload (anti-aliasing was off when the page loaded).                                                          |      []      |
| **6. Looks**   | Compare edges of the roof and the fence in Auto (still), High and Low              | Auto still equals High. Low is visibly rougher (jagged edges, lower resolution). Is Low still acceptable for editing a block?                                          |      []      |

**The numbers.** For each row, open the file, wait for the picture to settle, and read the overlay. Write a number in every cell (or "n/a" with the reason).

- **Idle FPS:** the FPS value while nothing moves and nothing is meshing. The overlay counts the browser's animation frames, so it shows the display rate while the page is free and falls when drawing or meshing keeps the page busy.
- **Orbit FPS (avg, min):** turn the build with one finger in big circles for about ten seconds, watching the FPS value; note the lowest value you see and a typical one.
- **JS heap:** the heap value after opening the file, and after ten Place strokes and ten Undos.
- **Stroke latency (finger move to block shown):** the time from moving the finger to the new block being visible while painting with Place. Choose the way that works for you: (a) record the screen at 60 fps and count the frames between the finger moving and the block appearing (frames x 16.7 ms); or (b) with the phone on USB debugging (`chrome://inspect` on the dev machine), open the page with `?e2e&perf=1` and in the console run `await __voxwright.edit(x, y, z, "minecraft:glowstone")` for a surface block, which prints `{ appliedMs, visibleMs }`; `visibleMs` is the time until the block is on screen, without the finger. Say which you used.

| File                                 | Quality | Idle FPS | Orbit FPS (avg / min) | JS heap (open / after edits) | Stroke latency | Notes |
| :----------------------------------- | :-----: | :------: | :-------------------: | :--------------------------: | :------------: | :---- |
| **Rafeals_house.nbt**                |  Auto   |          |                       |                              |                |       |
| **Rafeals_house.nbt**                |  High   |          |                       |                              |                |       |
| **Rafeals_house.nbt**                |   Low   |          |                       |                              |                |       |
| **synthetic-256.schem** (256x64x256) |  Auto   |          |                       |                              |                |       |
| **synthetic-256.schem** (256x64x256) |  High   |          |                       |                              |                |       |
| **synthetic-256.schem** (256x64x256) |   Low   |          |                       |                              |                |       |

**Targets (proposed in the plan, MB7):** Rafeals_house orbits at the display's refresh rate or at least 30 fps; the 256-wide build stays at 30 fps; stroke latency under 100 ms. If the phone cannot reach them with any Quality, say which build size does (this sets decision 4, the largest smooth build). Also note: how long the page is frozen while the 256-wide file is read (a freeze over about 1 s would justify moving parsing into a worker, which MB7 deliberately did not do), whether Auto's drop in resolution is noticeable, and whether two workers and a 16 MB undo history ever get in the way (for example, a very large Fill that cannot be undone more than once).

---

## 3g. Manual Test Checklist (MB8: polish, accessibility and the first minute)

MB8 was built and checked in the VM with emulated touch and axe-core only; nobody has tried it on a phone. Use a fresh browser profile, or clear this site's data first, so the quick start card shows. Open `Rafeals_house.nbt`.

**The timed run (the exit criterion).** Start a stopwatch when the file is on the screen and stop it when the exported file is in your downloads. Do only what the quick start card says: choose **Place**, tap the picture, tap **Undo**, open **Menu** and press **Export and download**. It should take under a minute, and the card should tick each step by itself and close when the third is done. Write the time down: ______ s. If it took longer, say where you hesitated.

| Step                        | Action                                                                                                         | Expected Result                                                                                                                                          |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. The card**             | Open the file in a fresh profile                                                                               | A small card under the top bar lists three steps, none ticked. It does not dim the picture, and the Menu button, the toolbar and Undo are uncovered.     |
| **2. Place**                | Choose **Place**, tap the picture                                                                              | A block appears, the first step ticks, a bar under the top bar says "Placed 1 block" with an **Undo** button, and the phone buzzes briefly.              |
| **3. Undo**                 | Tap **Undo** (the round button by the picture)                                                                 | The block goes, the second step ticks, the bar disappears.                                                                                               |
| **4. Export**               | **Menu**, **Export and download**                                                                              | The third step ticks, the card closes after a moment, and it is gone after you reload the page.                                                          |
| **5. Show tips**            | **Menu**, scroll to **Help**, tap **Show tips**                                                                | The menu closes and the card is back with every step unticked. The **✕** closes it and it stays closed after a reload.                                   |
| **6. The toast**            | Place two blocks one after the other, then tap the bar's **Undo**                                              | The bar shows the newest edit. Its **Undo** removes only the second block. Wait: the bar goes by itself after about four seconds.                        |
| **7. A stroke and a line**  | Drag with **Place** along a wall; draw a **Line** and confirm it                                               | The bar says how many blocks ("Placed 5 blocks", "Drew a line of 7 blocks") and the number is right. One press of its **Undo** takes the whole step.     |
| **8. Where the bar sits**   | Make an edit while the nudge pad is up                                                                         | The bar is under the top bar. It covers neither the thumb cluster, the pad, the line above the toolbar nor the toolbar.                                  |
| **9. Vibration**            | **Menu**, **Settings**: **Vibrate on edits** is on. Place a block, then cancel a line with the cross           | A short buzz for the edit, a slightly longer one for the cross. Turn the setting off: no buzz. Chrome may refuse to buzz until you have tapped the page. |
| **10. Two-finger tap**      | Place a block. Tap the picture lightly with two fingers at once                                                | Nothing happens (the shortcut is off at the start). Turn **Two-finger tap undoes** on, place a block, tap with two fingers: it is undone.                |
| **11. Three-finger tap**    | Turn **Three-finger tap redoes** on, undo a block, tap with three fingers                                      | The block comes back. A tap with two fingers that moves is a pan and undoes nothing.                                                                     |
| **12. During a tool**       | With **Place** chosen and the shortcut on, put one finger on the picture, then a second, and lift both quickly | The last block is undone and no block is placed at the cursor.                                                                                           |
| **13. Left-handed**         | **Menu**, **Settings**, **Left-handed controls**. Place a block, begin a line                                  | The thumb cluster, the nudge pad, the quick row of blocks and the bar are all on the left side, each the mirror image of before.                         |
| **14. Zoom button**         | In **View**, tap a block, then press **Zoom** beside the block's name                                          | The view centres on the block and comes half as close, as a double tap does. It works with other tools too.                                              |
| **15. Centre on the build** | Move the picture away with two fingers, then the **View** button (top bar), **Centre on the build**              | The picture is back on the middle of the build; the turn and the tilt stay.                                                                              |
| **16. Sheet handle**        | Open the **Menu**; tap the handle at the top of the sheet                                                      | The sheet switches between half and full height. Dragging it still works.                                                                                |
| **17. Help**                | **Menu**, **Help**                                                                                             | The text speaks of fingers and taps, never of clicks or keys.                                                                                            |
| **18. Screen reader**       | Turn on TalkBack. Walk through the toolbar, the thumb cluster, a sheet and the menu by swiping                 | Every button has a name; the sheet's title is read on opening; the toast text is read out after an edit without losing your place.                       |
| **19. Reduced motion**      | Android settings, **Remove animations**; make an edit                                                          | The bar appears without sliding.                                                                                                                         |

Questions to answer while testing (write the answers into the log):

- Is the bar's four seconds right? Is it in the way at the top, or would you rather have it somewhere else?
- Do you want the vibration stronger, weaker or not at all? Does your browser buzz at all?
- Do you use the two- and three-finger taps? Do they fire when you did not mean them (a palm, two fingers resting on the picture)?
- Does the quick start card tell you enough to be done in a minute? Is it in the way where it is?
- Does anything still need a gesture you cannot find a button for?

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
