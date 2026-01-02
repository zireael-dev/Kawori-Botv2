/**
 * plugins/manga.js
 * Mangabats Manga Reader (Integrated with Puppeteer Engine)
 */

const MangaProvider = require('../MangaProvider'); // Sesuaikan path ini!
const fs = require('fs');

global.db = global.db || {}
global.db.manga = global.db.manga || {}

function getSession(jid) {
    if (!global.db.manga[jid]) {
        global.db.manga[jid] = {
            search: [],
            chapters: [],
            title: ''
        }
    }
    return global.db.manga[jid]
}

module.exports = {
    name: 'manga',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        const session = getSession(from)

        /* ================= 1. SEARCH MANGA ================= */
        if (text.startsWith('/manga ')) {
            const query = text.slice(7).trim()
            if (!query) return

            // Kirim reaksi loading karena Puppeteer butuh waktu boot
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            // --- INTEGRASI: Pakai MangaProvider ---
            const results = await MangaProvider.search(query)

            if (!results || results.length === 0) {
                return sock.sendMessage(from, { text: '❌ Manga tidak ditemukan atau server sibuk.' })
            }

            // Simpan hasil ke session database sementara
            session.search = results.slice(0, 10) // Ambil 10 teratas aja

            // Tampilkan Menu Interaktif
            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: '📚 Hasil Pencarian Manga',
                    body: { text: `Ditemukan ${results.length} hasil untuk "${query}"` },
                    footer: { text: 'Pilih salah satu untuk melihat chapter' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📖 PILIH MANGA',
                                    sections: [
                                        {
                                            title: 'Hasil Pencarian',
                                            // Mapping hasil dari MangaProvider ke format tombol WA
                                            rows: session.search.map((m, i) => ({
                                                title: m.title.substring(0, 24), // WA batasi panjang judul
                                                description: `Latest: ${m.latest}`,
                                                id: `manga_${i}`
                                            }))
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            }, { quoted: msg })
        }

        /* ================= HANDLING INTERACTIVE RESPONSE ================= */
        const params =
            msg.message?.interactiveResponseMessage
            ?.nativeFlowResponseMessage
            ?.paramsJson

        if (!params) return

        const parsed = JSON.parse(params)
        const id = parsed.id

        /* ================= 2. GET CHAPTER LIST ================= */
        if (id?.startsWith('manga_')) {
            const idx = parseInt(id.split('_')[1])
            const pick = session.search[idx]

            if (!pick) return sock.sendMessage(from, { text: 'Sesi kadaluarsa, cari ulang ya.' })

            await sock.sendMessage(from, { react: { text: '📂', key: msg.key } })

            // --- INTEGRASI: Pakai MangaProvider ---
            // Ambil daftar chapter pakai Puppeteer
            const chapters = await MangaProvider.getChapters(pick.url)

            if (!chapters.length) {
                return sock.sendMessage(from, { text: '❌ Gagal mengambil chapter. Coba lagi.' })
            }

            session.title = pick.title
            session.chapters = chapters // Biasanya sudah urut dari terbaru

            // WhatsApp List Message maksimal sekitar 50 row per section
            const chapterList = session.chapters.slice(0, 50) 

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: `📖 ${session.title}`,
                    body: { text: `Silakan pilih chapter yang ingin dibaca.\nTotal Chapter: ${chapters.length}` },
                    footer: { text: 'Format: PDF (High Quality)' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📄 PILIH CHAPTER',
                                    sections: [
                                        {
                                            title: 'Daftar Chapter Terbaru',
                                            rows: chapterList.map((c, i) => ({
                                                title: c.title.substring(0, 24),
                                                description: 'Klik untuk download PDF',
                                                id: `chapter_${i}`
                                            }))
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            }, { quoted: msg })
        }

        /* ================= 3. DOWNLOAD & SEND PDF ================= */
        if (id?.startsWith('chapter_')) {
            const idx = parseInt(id.split('_')[1])
            const chap = session.chapters[idx]

            if (!chap) return

            // Beritahu user proses sedang berjalan
            await sock.sendMessage(from, { text: `⏳ Sedang memproses *${chap.title}*...\nMohon tunggu sekitar 1-2 menit, sedang menyusun PDF.` }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } })

            // Nama file unik agar tidak bentrok
            const safeTitle = session.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            const safeChapter = chap.title.replace(/[^a-zA-Z0-9]/g, '_');
            const outputFilename = `./temp_${safeTitle}_${safeChapter}.pdf`;

            try {
                // --- INTEGRASI: Pakai MangaProvider ---
                // Download menggunakan teknik Browser Rendering (Anti-403)
                const pdfPath = await MangaProvider.downloadChapter(chap.url, outputFilename);

                if (pdfPath) {
                    // Kirim sebagai Dokumen
                    await sock.sendMessage(from, { 
                        document: { url: pdfPath }, 
                        mimetype: 'application/pdf', 
                        fileName: `${session.title} - ${chap.title}.pdf`,
                        caption: `✅ Berhasil! Selamat membaca.`
                    }, { quoted: msg });

                    // Hapus file sampah setelah terkirim
                    fs.unlinkSync(pdfPath);
                } else {
                    await sock.sendMessage(from, { text: '❌ Gagal membuat PDF. Mungkin proteksi website sedang tinggi.' }, { quoted: msg });
                }
            } catch (err) {
                console.error(err);
                await sock.sendMessage(from, { text: '❌ Terjadi kesalahan sistem.' }, { quoted: msg });
            }
        }
    }
}
