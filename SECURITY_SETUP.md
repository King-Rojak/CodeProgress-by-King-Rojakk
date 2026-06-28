# Security Setup CodeProgress

File web sudah ditambah hardening di sisi frontend, tapi keamanan utama tetap harus dikunci lewat Firebase Rules.

## Yang sudah diperketat di kode

- Admin harus cocok `uid` dan email, bukan email saja.
- Format key wajib seperti `CP-ABCD-1234-EFGH`.
- Percobaan key salah dibatasi: 5 kali, lalu cooldown 5 menit.
- Link source code dibatasi ke URL aman dan host yang diizinkan.
- Link foto project dibatasi ke HTTPS host gambar yang diizinkan.
- Link `javascript:`, `data:`, dan HTTP publik diblokir.
- Tambah security headers untuk deploy Vercel lewat `vercel.json`.

## Wajib dilakukan di Firebase

### 1. Update Firestore Rules

Buka:

Firebase Console → Firestore Database → Rules

Lalu pakai isi file:

```text
firestore.rules
```

Publish rules.

### 2. Update Storage Rules

Buka:

Firebase Console → Storage → Rules

Lalu pakai isi file:

```text
storage.rules
```

Publish rules.

## Catatan penting

Frontend tidak bisa 100% mengamankan data kalau Firestore Rules masih longgar.
Rules di file ini membatasi:
- hanya admin UID `ST4UPUpnnva8eBp11hpnTFuT6DP2` yang bisa membuat, edit, hapus project;
- member hanya bisa klaim key yang belum dipakai;
- member tidak bisa membaca private file project tanpa key yang sudah terkunci ke akun mereka.


## Security Hardening V2

- Klaim key tidak lagi membaca dokumen key sebelum update.
- Firestore Rules menolak pembacaan key yang belum dipakai oleh member.
- Member hanya boleh mengubah field klaim: `isUsed`, `usedBy`, `usedByEmail`, `usedByName`, `usedAt`.
- Anti double-click saat proses key.
- Baca juga `FIREBASE_RULES_KETAT.md`.
