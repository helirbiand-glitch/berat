# Firebase Security Specification (Zero-Trust)

## 1. Data Invariants
1. **NoSQL Payload Injection Prevention:** A session document must strictly contain exactly the designated fields (`id`, `time`, `movieId`, `peopleCount`, `isFinished`, `status`, and optionally `activeSince`, `groupId`, `bookings`). Any attempt to inject ghost fields (like `isAdmin: true` or `bypassed: true`) must be rejected.
2. **Denial of Wallet Guard:** All string fields must have strict `.size()` limits (e.g., maximum 128 characters for IDs, 1000 for details) to prevent malicious actors from uploading 1MB junk documents to exhaust bandwidth and storage quotas.
3. **Array Boundaries:** Bounded arrays like `sessionsBlocked` and `bookings` must not exceed a maximum length limit to prevent read/write parsing exhaustion.
4. **Action-Based Updates (State Machines):** Users cannot freely mutate the entire document during an update. They can only modify specific keys mapped to discrete actions through `affectedKeys().hasOnly()`.
5. **Immutability:** History items are append-only. Once created, they cannot be updated.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)
The following JSON payloads represent logic leaks meant to break the Firebase application. All must return `PERMISSION_DENIED`:

1.  **ID Poisoning:** `{ "id": "A".repeat(2000) }` - Rejected by `isValidId()` boundary check.
2.  **Ghost Field Injection:** `{ "id": "1", "time": "12:00", "isAdmin": true, ...core_fields }` - Rejected by strict `hasAll` and type validation limits.
3.  **Type Poisoning:** `{ "peopleCount": "fifty" }` (String instead of Number) - Rejected by `data.peopleCount is number`.
4.  **Negative Capacity:** `{ "peopleCount": -5 }` - Rejected by `data.peopleCount >= 0`.
5.  **Status Tampering:** `{ "status": "hacked" }` - Rejected by `status.matches('^(open|active|maintenance)$')`.
6.  **History Forgery:** Attempting to `update` a History document - Rejected globally (`allow update: if false`).
7.  **Unbounded Details Dump:** History `details` with 50,000 characters. - Rejected by `data.details.size() <= 1000`.
8.  **Malicious Bulk Shift:** Attempting to alter `groupId` using a timeshift action payload. - Rejected by `affectedKeys().hasOnly()`.
9.  **Booking Array Overflow:** Uploading a session with 10,000 bookings. - Rejected by list bounds (`data.bookings.size() <= 60`).
10. **Time String Manipulation:** `{ "time": "invalid_time" }` - Rejected by regex/size limits `data.time.size() == 5`.
11. **Orphan Write Attack:** Deleting setting configurations to break client logic. - `allow delete: if false` on settings.
12. **Unauthorized Read Scraping:** Reading history without being signed in. - Basic auth gate block.

## 3. Implementation Plan
We will deploy a `firestore.rules` file containing Validation Blueprints for every entity. We will ensure every database interaction is checked against the blueprint using `incoming().diff(existing()).affectedKeys()`.
