# Rencana: shape baru mcbuilder + guide draf dari 15 reel

Diperbarui 2026-11-11, mengikuti brief Luki ("brief buat claude (sonnet)"). Status: **rencana saja,
dan terblokir di Fase A.** Analisis dan kode belum dimulai.

## Data (sudah di disk)

- `minecraft-reels-frames-2026-11-10.zip`: Drive ID `1Ys2NfTtoalVy5v8UpaYwGicXExdhG2yD`, sama
  dengan link di brief. Ukurannya 240,622,980 byte, sha256 `89c6f90c…6a60`, `unzip -t` OK.
- `extracted/minecraft-reels-frames-2026-11-10/` berisi:
  - `frames/<reel>/frames/f_NNN.jpg`: 1513 frame dari 15 reel;
  - `dio-rods-waterfall-quarry/`: 7 foto;
  - `pillar-wall-design/`: 4 gambar.

## Hasil cek brief vs kenyataan (2026-11-11)

| Klaim brief | Kenyataan |
|---|---|
| Guide `lzif/mcbuilder` `docs/build-patterns.md`, T1–T41 | **Tidak ada.** `main` (e6d4657) mengembalikan 404, dan file itu juga tidak ada di branch lain, di disk lokal, maupun di Drive. Versi lamanya (ditambah di 603ade0 tgl 2026-10-14, dihapus di 885dfac tgl 2026-11-01) cuma berisi 10 teknik `### 1.`–`### 10.`, tanpa nomor T, tanpa T42/C2, dan tanpa field recipe/confidence/inference flags. |
| Stage-1 untuk 11 reel sudah ada | **Tidak ditemukan** di mana pun. |
| Kandidat open (skirt roof, triplet slit, ruined mound, pyramid crown, pointed arch) | Hanya muncul di brief. |
| `parts.py` belum ada padanannya | **Kedaluwarsa.** `parts.py` dihapus dari lzif/mcbuilder di 885dfac. Isinya (`stairs_run`, `pillar`, `railing`) sudah ada di `shapes.ts`, dan issue #19 sudah ditutup. |
| HEAD voxwright 7b79ae1 | HEAD sekarang 7941e36 (commit docs dari Luki). Commit itu tidak menyentuh `packages/mcbuilder`, jadi aman. |
| 12 shape | Benar: box, walls, pillar, line, stairs, stairsRun, railing, cylinder, sphere, cone, roofGable, roofHip. `floor` hanya ada sebagai `Build.floor`. |

## Fase (dijalankan setelah blocker beres)

Opus mengorkestrasi dan me-review. Pekerjaannya dikerjakan subagent Sonnet.

- **A. Pre-flight (terblokir).**
  - Dapatkan `build-patterns.md` T1–T41 dan catatan stage-1.
  - Pastikan working copy untuk commit guide (lzif/mcbuilder).
  - Baca guide sampai habis.
- **B. Persiapan frame (mekanis).**
  - Pilih keyframe: buang frame hitam dan yang hampir kembar.
  - Buat contact sheet bernomor dan `work/index.json`.
  - Script disimpan di `tools/`, Python dijalankan dengan `-I`.
- **C. Stage-1 untuk 4 reel yang belum punya:** disruptive-builds, hibouk-winter-mansion,
  dio-rods-waterfall-quarry, omggamer-medieval-tavern.
  - Tiap klaim disertai bukti frame.
  - Diberi tanda "belum di-roast".
- **D. Uji hipotesis shape terhadap frame:** arch (termasuk pointed arch trixyblox sebagai param),
  dome, spiral stairs, crenellation, skirt roof alixxa.
  - Per shape, catat frame bukti, atau tulis "tidak ada di frame" lalu jangan dibuat.
  - Pyramid crown alixxa ditulis apa adanya (provisional, jumlah course dan apex belum ter-resolve).
- **E. `packages/mcbuilder/SHAPE-MAPPING.md`.**
  - Satu baris untuk tiap T1–T41 dan T43+.
  - Label: SHAPE / NEW SHAPE / PARAM / COMPOSITION / BLOCKED.
  - Bukti satu baris per teknik (guide + frame).
  - C2 stepped gable diberi label BLOCKED, dan T42 tidak dipakai.
- **F. Guide draf** di `lzif/mcbuilder` `docs/build-patterns.md`.
  - Mengikuti format yang sudah ada. Teknik baru mulai dari T43, sub-entry ditaruh di bawah induknya.
  - T1–T41 tidak ditulis ulang.
  - Commit terpisah dari kerjaan shape, dan tidak diklaim sudah ke-fold.
- **G. Shape baru**, dikerjakan berurutan karena semuanya menyentuh `shapes.ts`.
  - Satu shape = satu worker = satu commit.
  - Berupa fungsi murni `Geometry` di `shapes.ts` dan diekspor dari `index.ts`. Dipakai lewat
    `BUILD.place(...)`, karena Build API tidak boleh disentuh.
  - Test ditulis di `shapes.test.ts`. Randomness lewat parameter seed, tanpa `Math.random`.
  - Test oracle 12 shape lama harus tetap hijau.
- **H. Contoh** `examples/<nama>/` yang memakai semua shape baru.
  - Harus lolos `mcbuild check` dan `mcbuild run`, plus `--preview` untuk dicek secara visual.
- **I. Verifikasi.**
  - `pnpm --filter @voxwright/mcbuilder test` dan `typecheck`.
  - Hasil export contoh dicek.
  - Cek konsistensi lewat script: nomor teknik tidak tabrakan, T42 absen, dan setiap T43+ di guide
    punya baris di mapping.
  - Laporan memuat perintah dan output yang benar-benar dijalankan.

Commit dibuat atas nama Luki tanpa atribusi, dan tidak di-push. File di luar task tidak di-stage,
termasuk `examples/tavern/` dan `examples/arc_de_triomphe/` yang untracked dan bukan dari task ini.

## Jawaban Luki (2026-11-11)

1. Guide T1–T41, stage-1 dan antrean kandidat ada di mesin hatch (`/home/hatch/workspace/`) dan
   belum di-push.
   - Lokal vs remote diverged: lokal ahead 2 (teknik 14–39), behind 11 (PR #5 mcbuilder-clean).
   - Luki sedang membereskan merge-nya dan akan mengabari kalau sudah ter-push.
   - Sementara itu, mapping dimulai dari brief + frame.
2. Guide draf di-commit di `/data/workspace/mcbuilder`, bukan clone baru. Pull dulu setelah push
   Luki landing.
3. `parts.py` sudah beres, tidak ada pekerjaan parts di task ini.

## Dimensi wajib: block dipakai di luar fungsi aslinya (Luki, 2026-11-11)

Guide = guide + pattern + taste. Builder sering memakai block tidak sesuai fungsi aslinya, misalnya:

- trapdoor sebagai shutter;
- stairs/slab terbalik sebagai lis atau kanopi;
- fence/wall sebagai tiang;
- cauldron sebagai pot;
- campfire sebagai asap cerobong.

Konsekuensinya:

- Setiap pembaca frame mengisi tabel repurpose: block + state | dipakai sebagai | cara pasang
  (facing/half/open/posisi relatif) | konteks | frame.
- Semua tabel digabung ke `work/block-repurposing.md`, yang menjadi bahan entri guide dan
  bernomor setelah guide landing.
- Di mapping, repurpose umumnya berlabel PARAM (material per peran di shape) atau COMPOSITION.
  Shape baru harus menerima material per peran, bukan satu block.

## Update 2026-11-12: guide landed

- `lzif/mcbuilder` `main` is at `b0b2462` and holds:
  - `docs/build-patterns.md`: T1–T41, 1997 lines;
  - `docs/candidates.md`: the queue and gates;
  - `docs/reels/*/stage1/`.
- `/data/workspace/mcbuilder` was pulled with `--ff-only` (e6d4657 → b0b2462). It was clean before.
- Corrections from `candidates.md`:
  - **disruptive-builds:** stage-1 transcripts exist for 13 of the 14 builds (build 12 missing).
    Fold is waiting for Luki to pick which builds enter. Reader C's stage-1 is therefore only a
    comparison and is not drafted into the guide before the pick.
  - **TrixyBlox:** no stage-1. Its 4 candidates stay map-only. Pointed arch goes into the `arch`
    shape.
  - **Truly unanalysed:** hibouk, dio rods and tavern, covered by reader D.
  - **Other open candidates** in `candidates.md` (niitty ×7, French Mansion ×2) are outside the
    brief's queue.
- T15 "Stair-block masonry arches" already exists, so the `arch` shape implements T15 and is not a
  new technique.

## Update 2026-11-13: "Do it, then migrate to voxwright" (Luki)

- First finish the brief:
  1. the guide drafts and the three stage-1 notes, committed in `/data/workspace/mcbuilder`;
  2. the `arch`, `parapet` and `skirtRoof` shapes, plus `SHAPE-MAPPING.md` and an example,
     committed in voxwright.
- Then migrate `docs/build-patterns.md`, `docs/candidates.md` and `docs/reels/` from
  lzif/mcbuilder into voxwright `packages/mcbuilder/docs/`, as a separate commit.
- Path references in the guide and mapping are updated to match.
- Nothing is deleted from lzif/mcbuilder, and nothing is pushed.

## Status

- **Fase B (persiapan frame):** berjalan.
- **Fase C dan D (bukti frame):** menyusul setelah Fase B.
- **Draf mapping:** ditulis di `work/mapping-draft.md`, per teknik, tanpa nomor T. Nomor T dan
  `packages/mcbuilder/SHAPE-MAPPING.md` dibuat setelah guide landing.
- **Implementasi shape (Fase G):** belum diizinkan. Tunggu Luki.
