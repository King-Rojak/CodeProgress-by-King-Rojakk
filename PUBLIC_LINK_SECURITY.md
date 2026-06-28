# Public Link Security Mode

Versi ini tetap memakai link public, tetapi akses dari web dibuat lebih ketat.

## Cara kerja

1. Link source code tidak ditaruh langsung di tombol `href`.
2. Setelah key valid, tombol `Buka Source Code` hanya berupa button.
3. Saat tombol ditekan, web mengecek ulang ke Firestore:
   - user masih login;
   - key masih ada;
   - key memang terkunci ke UID akun itu;
   - key cocok dengan project;
   - link source code masuk host aman.
4. Kalau semua valid, link public baru dibuka di tab baru.
5. Kalau key dicabut/dihapus admin, tombol tidak bisa membuka source lagi.

## Batasan

Karena link source code tetap public, user yang sudah berhasil membuka link tetap bisa menyalin dan membagikan link/file tersebut di luar web. Itu tidak bisa dicegah tanpa storage private/backend.

## Cara revoke akses

Admin bisa hapus key dari Riwayat Key. Setelah key dihapus:
- member tidak bisa membuka source dari web lagi;
- akses lama di localStorage akan dibersihkan saat gagal validasi ulang.
