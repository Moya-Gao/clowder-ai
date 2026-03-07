# F063 Gap 4: File Management — VSCode-level UX

**Goal:** Create/upload/delete/rename files in Hub Workspace without Finder or IDE.
**UX Benchmark:** VSCode file explorer (hover icons + inline input + drag-drop).

## Backend (workspace-edit.ts, reuse edit token security)

1. `POST /api/workspace/file/create` — create file (path + content, defaults to empty)
2. `POST /api/workspace/dir/create` — create directory (mkdir -p)
3. `POST /api/workspace/upload` — upload file (multipart/form-data)
4. `DELETE /api/workspace/file` — delete file or empty directory
5. `POST /api/workspace/file/rename` — rename/move (oldPath + newPath)

All require editSessionToken + worktreeId. All pass through resolveWorkspacePath + isDenylisted.

## Frontend

6. TreeItem hover action bar: +file / +dir icons for directories, rename/delete for all
7. Inline input component (reusable): appears in tree for create/rename
8. Upload button + drag-drop zone on directory rows
9. Auto-open + enter edit mode after file creation
10. useWorkspace hook extensions: createFile, createDir, uploadFile, deleteItem, renameItem

## Task Order

Backend P4-1..P4-5 first (parallel-safe, TDD).
Then frontend P4-6..P4-10 (visual, test with mock API).
