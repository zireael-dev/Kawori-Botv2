# KaworiBot 🤖

**KaworiBot** adalah bot WhatsApp sederhana dan modular yang dibangun menggunakan Node.js. Bot ini dirancang agar mudah dikembangkan dengan sistem plugin.

## 📂 Struktur Folder

Penjelasan singkat mengenai struktur file dalam project ini:

- **`/plugins`**: Tempat menyimpan fitur-fitur bot (command). Tambahkan file baru di sini untuk membuat fitur baru.
- **`/settings`**: Berisi konfigurasi bot (seperti owner number, API keys, dll).
- **`/lib`**: Kumpulan fungsi helper/library pendukung.
- **`/kawori-session`**: (Otomatis dibuat) Menyimpan sesi login WhatsApp agar tidak perlu scan QR ulang. **JANGAN DI-SHARE!**

## 🛠️ Persyaratan (Requirements)

Sebelum menjalankan bot, pastikan kamu sudah menginstall:

- [Node.js](https://nodejs.org/en/) (Disarankan versi 16 ke atas)
- [Git](https://git-scm.com/)
- FFmpeg (Opsional, untuk fitur stiker/media)

## 🚀 Cara Install & Menjalankan

1. **Clone Repository ini**
   ```bash
   git clone [https://github.com/zireael-dev/kawori-botv2.git](https://github.com/zireael-dev/kawori-botv2.git)
   cd kawori-botv2
