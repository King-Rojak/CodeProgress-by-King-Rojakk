# Firebase Rules Ketat

Pasang file `firestore.rules` di Firebase Console → Firestore Database → Rules.

Pasang file `storage.rules` di Firebase Console → Storage → Rules.

Keamanan V2:
- Member tidak bisa membaca key yang belum dipakai.
- Member hanya bisa klaim key lewat update terbatas.
- Field `fileUrl`, `projectId`, `projectName`, `createdAt` tidak bisa diubah member.
- Admin dikunci ke UID `ST4UPUpnnva8eBp11hpnTFuT6DP2`.
- Jangan gunakan rules public seperti `allow read, write: if true;`.
