module.exports = [
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
    `.trim()
},
{
    id: 'menu_fb',
    category: 'Downloader',
    title: 'Facebook Downloader',
    desc: 'Download video atau reels Facebook',
    reply: `
    📘 *Facebook Downloader*

    Cara pakai:
    /fb <link>
    `.trim()
},
{
    id: 'menu_sticker',
    category: 'Converter',
    title: 'Sticker Maker',
    desc: 'Ubah gambar atau video jadi sticker',
    reply: `
    🖼 *Sticker Maker*

    Upload gambar / video dengan caption:
     /s
    atau Reply gambar / video dengan:
    /s
    `.trim()
},
{
        id: 'menu_smeme',
        title: 'Sticker Meme',
        desc: 'Buat sticker meme dengan teks atas & bawah',
        category: 'Converter',
        reply: `
😂 *Sticker Meme (Smeme)*

Fungsi:
Membuat sticker meme dengan teks atas dan bawah.

Format:
 /smeme TEKS ATAS | TEKS BAWAH

Contoh:
 /smeme POTRET | ORANG GILA

Catatan:
• Wajib reply gambar/upload gambar
• Maks 15 karakter per baris
        `.trim()
    },

    /* ================= ANIMANGA ================= */

    {
        id: 'menu_manga',
        title: 'Manga Reader',
        desc: 'Cari dan baca manga langsung di WhatsApp',
        category: 'Animanga',
        reply: `
📚 *Manga Reader*

Fungsi:
Mencari dan membaca manga langsung di WhatsApp.

Langkah:
1. Cari manga:
   /manga <judul>
2. Pilih manga & chapter
3. Baca di chat atau kirim link

Catatan:
• Mendukung navigasi interaktif
• Render dibatasi agar chat tidak banjir
        `.trim()
    },

    /* ================= ADMIN / OWNER ================= */

    {
        id: 'menu_bcgc',
        title: 'Broadcast Group',
        desc: 'Kirim pesan ke semua group',
        category: 'Owner Zone',
        reply: `
📣 *Broadcast Group*

Fungsi:
Mengirim pesan broadcast ke semua group.

Cara pakai:
 /bcgc <pesan>

Catatan:
• Hanya bisa digunakan oleh owner
• Mendukung banner / cover embedded
        `.trim()
    },

    {
        id: 'menu_update',
        title: 'Update Bot',
        desc: 'Update bot langsung dari WhatsApp',
        category: 'Utilities',
        reply: `
🔄 *Update Bot*

Fungsi:
Melakukan update bot langsung dari WhatsApp.

Cara pakai:
 /update

Catatan:
• Hanya untuk owner
• Bot akan restart otomatis setelah update
        `.trim()
    }
]
