# Gunakan Node.js versi LTS berbasis Alpine Linux agar ukuran image kecil dan ringan
FROM node:20-alpine

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin file package.json dan package-lock.json terlebih dahulu
# Ini memanfaatkan layer caching Docker agar npm install tidak dijalankan ulang jika tidak ada perubahan dependensi
COPY package*.json ./

# Install dependensi (hanya dependency utama untuk production)
RUN npm ci --only=production

# Salin seluruh sisa file proyek ke dalam direktori kerja container
COPY . .

# Ekspos port 3000 yang digunakan oleh server Express Node.js
EXPOSE 3000

# Perintah untuk menjalankan aplikasi saat container dijalankan
CMD ["node", "server.js"]
