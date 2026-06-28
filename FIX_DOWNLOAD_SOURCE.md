# Fix Download Source Code Tidak Muncul

Masalah yang diperbaiki:
- Setelah key valid, tombol Buka Source Code tidak menampilkan link download.
- Key lama bisa belum punya `fileUrl` kalau dibuat sebelum link source code disimpan.
- Link source code di detail project sudah ada, tapi belum tersinkron ke key lama.

Perubahan:
- Setelah key valid, web menampilkan tombol `Download / Buka Source Code`.
- Ditambah tombol `Copy Link Download`.
- Saat admin klik Edit Project → Simpan Perubahan, link source code otomatis disinkronkan ke semua key project itu.
- Saat generate key baru, link source code wajib ada dan harus aman.
- Kalau key valid tapi link belum ada, muncul pesan jelas agar admin menyimpan ulang project.

Langkah setelah deploy:
1. Upload ZIP ini ke GitHub.
2. Tunggu Vercel redeploy.
3. Pasang ulang `firestore.rules` terbaru.
4. Login admin.
5. Buka detail project → Edit → pastikan Link Download Project terisi → Simpan Perubahan.
6. Coba login member lagi dan buka link public.
