# Security Specification — SIMS Absensi Firestore

## 1. Data Invariants
1. Every top-level user document (`/users/{userId}`) belongs exclusively to the verified authenticated user (`request.auth.uid == userId` and `request.auth.token.email_verified == true`), and `uid` inside the document is immutable and equal to `request.auth.uid`.
2. Every subcollection document (`classes`, `teachers`, `students`, `months`, `photos`) under `/users/{userId}` MUST:
   - Have a parent `/users/{userId}` document whose `uid == request.auth.uid` (Master Gate on single-document operations).
   - Store `ownerId == request.auth.uid` as an immutable field.
   - Enforce `allow list` strictly against `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.
3. All document IDs (`userId`, `classId`, `teacherId`, `studentId`, `monthKey`, `photoId`) must match `^[a-zA-Z0-9_-]+$` and `<= 128` characters.
4. All string fields enforce explicit `.size()` bounds matching `firebase-blueprint.json`.
5. `createdAt` is immutable and equals `request.time` on create; `updatedAt` equals `request.time` on create and update.
6. No shadow/ghost keys are permitted on `create` (`hasAll` + `hasOnly`) or `update` (`affectedKeys().hasOnly(...)`).
7. PII (`email` in `/users/{userId}`) is strictly isolated to owner-only `get` (never `list` on `/users`).

## 2. The "Dirty Dozen" Payloads (All Must Result in PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` attempting `get /users/u1` or `create /users/u1/students/1`.
2. **Unverified email write**: `request.auth.uid == 'u1'` with `email_verified: false` creating `/users/u1`.
3. **Cross-tenant read/write**: `request.auth.uid == 'u2'` (`email_verified: true`) reading `/users/u1/students/1`.
4. **Identity spoofing on create**: `u1` creating `/users/u1/students/1` with `ownerId: 'u2'`.
5. **Shadow / ghost field injection**: `u1` creating `/users/u1` with extra key `isAdmin: true`.
6. **ID poisoning**: `u1` creating `/users/u1/students/bad$id` or a 200-char document ID.
7. **Oversized string DoW**: `u1` creating `/users/u1/students/1` with 2,000-character `n`.
8. **Immutable field mutation**: `u1` updating `/users/u1` attempting to modify `createdAt` or `uid`.
9. **Client-forged timestamp**: `u1` creating `/users/u1/classes/1` with `createdAt` != `request.time`.
10. **Orphaned subcollection write**: `u1` creating `/users/u1/students/1` when `/users/u1` does not exist.
11. **Invalid enum / type poisoning**: `u1` creating `/users/u1/students/1` with `g: 'X'` or `c: 'not-a-number'`.
12. **Blanket list query on PII**: Any user attempting `list /users` or listing `/users/u1/students` without `resource.data.ownerId == request.auth.uid`.
