module.exports = [

/* ================= DOWNLOADER ================= */

{
    id: 'menu_ig',
    category: 'Downloader',
    title: 'Instagram Downloader',
    desc: 'Download foto, video, dan carousel Instagram',
    reply: `
📸 *Instagram Downloader*

Download foto / video dari Instagram

Cara pakai:
 /ig <link>

Contoh:
 /ig https://www.instagram.com/p/xxxx
    `.trim()
},
{
    id: 'menu_tiktok',
    category: 'Downloader',
    title: 'TikTok Downloader',
    desc: 'Download video atau audio TikTok',
    reply: `
🎵 *TikTok Downloader*

Download video tanpa watermark atau audio

Perintah:
 /tiktok <link>
 /vt <link>
 /tikwm <link>
 /tikmp3 <link>

Contoh:
 /tiktok https://vt.tiktok.com/xxxx
    `.trim()
},
{
    id: 'menu_fb',
    category: 'Downloader',
    title: 'Facebook Downloader',
    desc: 'Download video atau reels Facebook',
    reply: `
📘 *Facebook Downloader*

Download video / reels Facebook

Cara pakai:
 /fb <link>

Contoh:
 /fb https://fb.watch/xxxx
    `.trim()
},
{
    id: 'menu_youtube',
    category: 'Downloader',
    title: 'YouTube Downloader',
    desc: 'Cari & download video YouTube (MP3 / MP4)',
    reply: `
🎬 *YouTube Downloader*

Mode Search (Interaktif):
 /yt <judul>

Mode Langsung:
 /ytmp3 <link>
 /ytmp4 <link>

Fitur:
• Pilih kualitas
• MP3 & MP4
• Interaktif & premium support
    `.trim()
},
{
    id: 'menu_spotify',
    category: 'Downloader',
    title: 'Spotify Downloader',
    desc: 'Download lagu dari Spotify',
    reply: `
🎧 *Spotify Downloader*

Download lagu Spotify (MP3)

Cara pakai:
 /spotify <link>

Contoh:
 /spotify https://open.spotify.com/track/xxxx
    `.trim()
},

/* ================= CONVERTER ================= */

{
    id: 'menu_sticker',
    category: 'Converter',
    title: 'Sticker Maker',
    desc: 'Ubah gambar atau video jadi sticker',
    reply: `
🖼 *Sticker Maker*

Buat sticker dari gambar / video

Cara:
• Upload gambar/video dengan caption:
  /s
• Atau reply gambar/video dengan:
  /s

Catatan:
• Mendukung video & gambar
    `.trim()
},
{
    id: 'menu_smeme',
    category: 'Converter',
    title: 'Sticker Meme',
    desc: 'Buat sticker meme dengan teks atas & bawah',
    reply: `
😂 *Sticker Meme (Smeme)*

Buat sticker meme custom

Format:
 /smeme TEKS ATAS | TEKS BAWAH

Contoh:
 /smeme POTRET | ORANG GILA

Catatan:
• Wajib reply gambar
• Maks 15 karakter per baris
    `.trim()
},

/* ================= ANIMANGA ================= */

{
    id: 'menu_manga',
    category: 'Animanga',
    title: 'Manga Reader',
    desc: 'Cari dan baca manga langsung di WhatsApp',
    reply: `
📚 *Manga Reader*

Cari & baca manga langsung di WhatsApp

Langkah:
1. Cari manga:
   /manga <judul>
2. Pilih manga & chapter
3. Baca di chat / link

Catatan:
• Navigasi interaktif
• Render dibatasi agar chat aman
    `.trim()
},

/* ================= USER / PREMIUM ================= */

{
    id: 'menu_profile',
    category: 'Utilities',
    title: 'Profil & Limit',
    desc: 'Lihat status akun & limit',
    reply: `
👤 *Profil Pengguna*

Cek status akun kamu

Perintah:
 /me

Info yang ditampilkan:
• Status premium
• Sisa limit harian
• Expired premium
    `.trim()
},
{
    id: 'menu_premium',
    category: 'Utilities',
    title: 'Premium User',
    desc: 'Info & pembelian premium',
    reply: `
💎 *Premium User*

Keuntungan Premium:
• Unlimited download
• Prioritas fitur
• Bebas limit harian

Cara beli:
 /buyprem
    `.trim()
},

/* ================= OWNER ZONE ================= */

{
    id: 'menu_bcgc',
    category: 'OwnerZone',
    title: 'Broadcast Group',
    desc: 'Kirim pesan ke semua group',
    reply: `
📣 *Broadcast Group*

Broadcast pesan ke semua group

Cara pakai:
 /bcgc <pesan>

Catatan:
• Khusus owner
• Support banner / cover
    `.trim()
},
{
    id: 'menu_update',
    category: 'OwnerZone',
    title: 'Update Bot',
    desc: 'Update bot langsung dari WhatsApp',
    reply: `
🔄 *Update Bot*

Update bot tanpa login VPS

Cara pakai:
 /update

Catatan:
• Khusus owner
• Bot restart otomatis
    `.trim()
}

]
