# HCS Performance Dashboard

Dashboard statis HCS untuk GitHub Pages dengan sumber data Google Sheet melalui Google Apps Script.

## Struktur

- `index.html`: halaman login dan dashboard.
- `js/config.js`: URL Apps Script dan kredensial login sederhana.
- `js/app.js`: pemrosesan data dan visualisasi.
- `apps-script/Code.gs`: endpoint yang membaca seluruh tab Google Sheet.
- `assets`, `css`, `libs`: aset dan library lokal tanpa CDN.

## Konfigurasi

1. Buat project di https://script.google.com.
2. Salin `apps-script/Code.gs`, jalankan `testReadSpreadsheet`, lalu deploy sebagai Web App.
3. Pilih **Execute as: Me** dan **Who has access: Anyone**.
4. Tempel URL `/exec` ke `APPS_SCRIPT_URL` dalam `js/config.js`.
5. Ganti username dan password awal dalam `js/config.js` bila diperlukan.

> Login ini hanya pembatas sederhana. Pada repository publik, kredensial di source code tetap dapat dilihat oleh pengguna teknis.

## Update database

Buka Google Sheet master, lalu pilih **File > Impor > Upload > Ganti spreadsheet**. Pertahankan nama tab utama berikut:

- `1_PLG_TAHUNAN`
- `2_PLGKWH_BULANAN2026`
- `3_KWH_KUMULATIF2026`
- `4_NASIONAL_KWH_TAHUNAN`
- `5_PLGKWH_BULANAN_INTEGRASI`
- `6_KWH_DIKSON`

Setelah impor selesai, tekan **Refresh Database** pada dashboard.

## GitHub Pages

Push isi folder ini ke branch `main`. Di GitHub, buka **Settings > Pages**, pilih **Deploy from a branch**, lalu gunakan branch `main` dan folder `/ (root)`.
