# Fix Link Public Tidak Bisa Dibuka

Masalah:
- Rules ketat membuat halaman public gagal membaca path `users/{uid}/projects/{projectId}`.
- Akibatnya link public menampilkan: `Project tidak bisa dibuka`.

Fix:
- Web sekarang membaca data dari `publicProjects/{projectId}` lebih dulu.
- Jika mirror public belum ada, web fallback membaca project admin yang `isPublic = true`.
- Firestore rules diperbarui agar project admin yang public boleh dibaca guest/member.
- Link source code tetap tidak ikut terbuka karena disimpan di `private/settings` dan `keys`.

Wajib setelah upload:
1. Upload file ZIP ini ke GitHub.
2. Tunggu Vercel redeploy sampai Ready.
3. Pasang ulang `firestore.rules` di Firebase Console.
4. Login admin sekali, buka Dashboard/Project agar data public tersinkron.
5. Coba buka link public lagi.
