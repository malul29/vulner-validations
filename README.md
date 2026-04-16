# Vulner-Validator
Aplikasi web untuk memeriksa keamanan domain dengan fokus pada validasi sertifikat SSL dan konfigurasi keamanan cookie.

## Fitur Utama

- ✅ **Validasi SSL**
  - Periksa tanggal kedaluwarsa sertifikat
  - Hitung hari tersisa hingga kedaluwarsa
  - Penilaian tingkat keparahan (OK, Warning, Critical)
  - Tampilkan informasi issuer dan validitas

- ✅ **Analisis Keamanan Cookie**
  - Deteksi cookie tanpa atribut `Secure`
  - Periksa flag `HttpOnly`
  - Verifikasi pengaturan `SameSite`
  - Laporkan cookie yang tidak patuh

- ✅ **Pemrosesan Batch**
  - Validasi banyak domain sekaligus
  - Tampilkan hasil secara real-time
  - Ekspor hasil ke format JSON

## Instalasi

1. Masuk ke direktori proyek:
   ```bash
   cd Vulner-Validator-main
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

## Cara Pemakaian

1. Jalankan server:
   ```bash
   npm start
   ```

2. Buka browser dan kunjungi:
   ```text
   http://localhost:3000
   ```

3. Tambahkan domain yang ingin diperiksa:
   - Masukkan nama domain, seperti `google.com` atau `https://example.com`
   - Klik tombol "Add Domain" atau tekan Enter

4. Jalankan validasi:
   - Klik "Validate All Domains"
   - Tunggu hingga proses selesai
   - Tinjau hasil yang muncul

5. Ekspor hasil (jika tersedia):
   - Unduh hasil pemeriksaan dalam format JSON

## API Endpoints

### Health Check
```http
GET /api/health
```

### SSL Certificate Check
```http
GET /api/check-ssl/:domain
```

### Cookie Security Check
```http
GET /api/check-cookies/:domain
```

### Batch Validation
```http
POST /api/validate
Content-Type: application/json
Body: { "domains": ["example.com", "google.com"] }
```

## Teknologi

- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript
- **Dependensi:**
  - `express`
  - `cors`
  - `ssl-checker`
  - `axios`
  - `helmet`

## Konfigurasi

Aplikasi berjalan pada port default `3000`.

Untuk menggunakan port lain:
```bash
PORT=8080 npm start
```

## Pemeriksaan Keamanan

### SSL Certificate
- ✅ Tanggal kedaluwarsa
- ✅ Sisa hari validitas
- ✅ Informasi issuer
- ✅ Status keparahan

### Cookie Security
- ✅ Atribut `Secure`
- ✅ Atribut `HttpOnly`
- ✅ Atribut `SameSite`
- ✅ Laporan masalah per cookie

## Lisensi

MIT
