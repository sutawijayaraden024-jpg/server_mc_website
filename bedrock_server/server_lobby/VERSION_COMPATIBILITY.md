# Version Compatibility

Status server saat ini:

- Server version: `1.21.x`
- World: `Maharlika_City`

## Realistic expectation

Bedrock dedicated server biasanya paling aman untuk client yang sama versinya, atau setidaknya sangat dekat.

Artinya:

- `1.21.x` kemungkinan paling aman
- `1.20.x` dan versi yang jauh di atas `1.21.x` tidak bisa dijamin bisa masuk
- kalau ada perbedaan protokol besar, player akan ditolak oleh server

## Opsi yang realistis

1. Pakai satu versi patokan.
   - Pilih satu versi server utama, lalu minta player update ke versi itu.
2. Jalankan server terpisah per versi.
   - Ini lebih berat, tapi paling jelas kalau kamu memang ingin melayani beberapa versi besar.
3. Pakai proxy/translator pihak ketiga.
   - Ini jarang jadi solusi stabil untuk Bedrock lintas-versi yang jauh.
   - Kalau dipakai, biasanya tetap butuh pengujian manual.

## Rekomendasi saya

Untuk lobby server ini, paling aman:

- jadikan `1.21.x` sebagai versi utama
- minta player pakai versi yang sama atau sangat dekat
- kalau kamu benar-benar ingin dukung banyak versi yang jauh berbeda, siapkan server terpisah untuk masing-masing versi utama

## Catatan log

Kalau kamu melihat error seperti:

- `Error opening allow list file: allowlist.json`
- `Failed to load Vanilla Resource Pack`

itu masalah konfigurasi/world, bukan bukti bahwa versi client lintas-versi sudah kompatibel.
