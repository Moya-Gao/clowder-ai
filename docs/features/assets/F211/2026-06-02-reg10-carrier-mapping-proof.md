---
doc_kind: recon
feature_ids: [F211, F210]
topics: [reg10, antigravity, sqlite, carrier-mapping, pollForSteps]
created: 2026-06-02
author: opus48
---

# F211 REG10 Carrier Mapping Proof (2026-06-02)

> PR2A. Corrects the "IDE/CLI shared SQLite active store" claim made in PR1 / the REG10 反转.
> All probes are read-only against the live IDE LS (pid 83579 @ `https://127.0.0.1:57303`).

## Question

REG10's goal is to replace `pollForSteps`' full-trajectory fetch with an O(delta) SQLite read.
That only works if the SQLite conversation store reader reads = the cascade `pollForSteps` reads.
Does the reader serve the **current IDE Desktop carrier's active cascade**, or only **AGY CLI**?

## Evidence

### 1. Two disjoint id sets
- IDE LS in-memory cascades (`GetAllCascadeTrajectories`): `15eb29f0 / 6ecf5a02 / 8a5dd199 / 92f39fa5`.
- SQLite conversation dbs (`~/.gemini/antigravity-cli/conversations/*.db`): `1990a7d3 / 1cf6dc43 / 8675a740 / 8c0d2c16`.
- **Completely disjoint.**

### 2. IDE LS active cascade is in-memory only, NOT persisted
- `GetConversationMetadata(8a5dd199)` → 200 (LS knows it); `GetCascadeTrajectory(8a5dd199)` → 200, 453KB.
- `ls conversations/8a5dd199*` → **no .db, no .pb at all**. The active cascade lives in LS memory; nothing on disk.

### 3. On-disk SQLite conversations are NOT in IDE LS memory
- `GetConversationMetadata` AND `GetCascadeTrajectorySteps` for `1990a7d3 / 1cf6dc43 / 8675a740 / 8c0d2c16` → **all 500 "trajectory not found"**.
- They are persisted / evicted / CLI conversations, not in IDE LS.

### 4. IDE LS open files
- Holds 71 `.pb` (older persisted format) + 2 `.db` (`1990a7d3`, `1cf6dc43`, with `-shm/-wal`).
- But those `.db` are NOT its active cascades (step 3 → not found) — read/historical handles, not the live cascade.

## Conclusion (proven)

- **The reader reads ALREADY-PERSISTED conversations, NOT the IDE LS active cascade.**
- **IDE Desktop carrier (current Bengal / F061)**: active cascade is in-memory, never hits SQLite →
  reader **cannot** serve REG10 active progress there, **cannot replace `pollForSteps`**. ❌
- **AGY CLI carrier (F210)**: agy CLI writes SQLite live (`1cf6dc43.db` is WAL-active + PR1 dogfood read its
  increments) → reader **can** serve REG10 for AGY CLI. ✅
- This is a **carrier dependency, not a reader bug**. PR1 `AntigravityStepStoreReader` stays valid as a
  generic read-only SQLite step reader. The earlier "IDE/CLI shared active store → O(delta) reachable" was
  an unproven assumption (now disproven for IDE Desktop active progress).

## Implication for REG10

- REG10 (SQLite reader replacing `pollForSteps`) is reachable **only for the AGY CLI carrier (F210)**.
- Current Bengal runs on **IDE Desktop carrier (F061)** → REG10 reader does not apply to its active progress.
- REG10 is therefore **carrier-gated on F210 (AGY CLI migration)** for the Desktop path; for AGY CLI it is
  an F210-Phase-H-style trajectory observer, not a Desktop-REG10 completion.

## Oracle pairing note (blocks PR2B decoder)

- oracle = same conversation present in BOTH SQLite (`step_payload` protobuf) AND a live LS
  (`GetCascadeTrajectorySteps` decoded JSON), captured together.
- But: persisted SQLite convs are LS-not-found; LS active cascades have no SQLite file → **no static pairing
  is available from the current environment.**
- A real pairing needs an **AGY-CLI-run-in-progress** capture (SQLite row ↔ transient agy LS decoded view,
  while the run is live). If the transient LS closes too fast to capture → stop at proof, **do NOT hand-guess
  the protobuf schema from headers/strings** (per codex). PR2B decoder waits for a real pairing.
