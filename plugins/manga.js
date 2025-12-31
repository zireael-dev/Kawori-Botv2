/**
 * plugins/manga.js
 * Manga Reader (Neoxr API)
 *
 * Command:
 * /manga <judul>     -> search manga
 * /m <nomor>         -> buka detail + preview chapter
 * /chapters [page]   -> list chapter (paginated)
 * /c <nomor>         -> baca chapter (render image)
 * /cl <nomor>        -> kirim link chapter saja
 */

const axios = require('axios')

const API_KEY   = global.config?.api?.neoxr
const PAGE_SIZE = 25
const MAX_PAGES = 20
const DELAY_MS  = 500

const delay = ms => new Promise(r => setTimeout(r, ms))

/* ===== SESSION PER CHAT (TANPA GROUP SESSION) ===== */
global.db = global.db || {}
global.db.manga = global.db.manga || {}

function getSession(jid) {
    if (!global.db.manga[jid]) {
        global.db.manga[jid] = {
            search: [],
            chapters: [],
            title: '',
            source: ''
        }
    }
    return global.db.manga[jid]
}

/* ===== NORMALIZE CHAPTER ASC ===== */
function normalizeChapters(list = []) {
    const mapped = list
        .map(c => ({
            title: c.title || c.judul || 'Chapter',
            url: c.url || c.link
        }))
        .filter(c => c.url)

    return mapped.reverse() // Neoxr biasanya DESC → jadi ASC
}

module.exports = {
    name: 'manga',

    async onMessage(sock, m) {
        const from = m.key.remoteJid
        const text =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ''

        if (!text) return
        if (!API_KEY) {
            await sock.sendMessage(from, { text: '❌ API Manga belum diset.' }, { quoted: m })
            return
        }

        const raw = text.trim()
        const lower = raw.toLowerCase()
        const session = getSession(from)

        try {
            /* ================= /manga <judul> ================= */
            if (lower.startsWith('/manga ')) {
                const query = raw.slice(7).trim()
                if (!query) {
                    await sock.sendMessage(from, { text: '❌ Contoh: /manga one piece' }, { quoted: m })
                    return
                }

                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } })

                const url = `https://api.neoxr.eu/api/comic?q=${encodeURIComponent(query)}&apikey=${API_KEY}`
                const { data } = await axios.get(url)

                let results =
                    Array.isArray(data?.data) ? data.data :
                    Array.isArray(data?.data?.result) ? data.data.result :
                    []

                if (!data?.status || results.length === 0) {
                    await sock.sendMessage(from, {
                        text: '⚠️ Manga tidak ditemukan. Coba judul lain.'
                    }, { quoted: m })
                    return
                }

                session.search = results.slice(0, 10).map(v => ({
                    title: v.title || v.judul || 'Tanpa Judul',
                    url: v.url || v.link
                }))
                session.chapters = []
                session.title = ''
                session.source = ''

                const lines = [`🔎 *Hasil pencarian "${query}"*`, '']
                session.search.forEach((v, i) => {
                    lines.push(`${i + 1}. ${v.title}`)
                })
                lines.push('')
                lines.push('➡️ Ketik: */m <nomor>* untuk membuka detail')

                await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m })
                await sock.sendMessage(from, { react: { text: '✅', key: m.key } })
                return
            }

            /* ================= /m <nomor> ================= */
            if (lower.startsWith('/m ')) {
                const idx = parseInt(raw.slice(3).trim(), 10)
                if (isNaN(idx) || idx < 1 || idx > session.search.length) {
                    await sock.sendMessage(from, {
                        text: '❌ Nomor tidak valid. Gunakan /manga dulu.'
                    }, { quoted: m })
                    return
                }

                const pick = session.search[idx - 1]
                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } })

                const url = `https://api.neoxr.eu/api/comic-get?url=${encodeURIComponent(pick.url)}&apikey=${API_KEY}`
                const { data } = await axios.get(url)

                const rawChapters =
                    data?.data?.chapters ||
                    data?.data?.chapter ||
                    data?.data?.list ||
                    []

                const chapters = normalizeChapters(rawChapters)

                session.chapters = chapters
                session.title = data?.data?.title || pick.title
                session.source = pick.url

                const preview = chapters.slice(0, 10)

                const lines = [
                    `📖 *${session.title}*`,
                    '',
                    '*Preview Chapter:*'
                ]

                preview.forEach((c, i) => {
                    lines.push(`${i + 1}. ${c.title}`)
                })

                lines.push('')
                lines.push('➡️ Baca: */c <nomor>*')
                lines.push('➡️ Link: */cl <nomor>*')
                lines.push('➡️ Semua chapter: */chapters*')

                await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m })
                await sock.sendMessage(from, { react: { text: '✅', key: m.key } })
                return
            }

            /* ================= /chapters [page] ================= */
            if (lower.startsWith('/chapters')) {
                if (!session.chapters.length) {
                    await sock.sendMessage(from, {
                        text: '❌ Buka manga dulu dengan /m <nomor>'
                    }, { quoted: m })
                    return
                }

                const page = Math.max(1, parseInt(raw.split(' ')[1] || '1', 10))
                const start = (page - 1) * PAGE_SIZE
                const end = Math.min(start + PAGE_SIZE, session.chapters.length)

                if (start >= session.chapters.length) {
                    await sock.sendMessage(from, { text: '❌ Halaman tidak valid.' }, { quoted: m })
                    return
                }

                const lines = [
                    `📚 *${session.title}*`,
                    `Halaman ${page}`,
                    ''
                ]

                session.chapters.slice(start, end).forEach((c, i) => {
                    lines.push(`${start + i + 1}. ${c.title}`)
                })

                if (end < session.chapters.length) {
                    lines.push('')
                    lines.push(`➡️ Lanjut: */chapters ${page + 1}*`)
                }

                await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m })
                return
            }

            /* ================= /cl <nomor> ================= */
            if (lower.startsWith('/cl ')) {
                const idx = parseInt(raw.slice(4).trim(), 10)
                if (!session.chapters[idx - 1]) {
                    await sock.sendMessage(from, { text: '❌ Chapter tidak valid.' }, { quoted: m })
                    return
                }

                const chap = session.chapters[idx - 1]
                await sock.sendMessage(from, {
                    text: `🔗 *${session.title}*\n${chap.title}\n${chap.url}`
                }, { quoted: m })
                return
            }

            /* ================= /c <nomor> ================= */
            if (lower.startsWith('/c ')) {
                const idx = parseInt(raw.slice(3).trim(), 10)
                if (!session.chapters[idx - 1]) {
                    await sock.sendMessage(from, { text: '❌ Chapter tidak valid.' }, { quoted: m })
                    return
                }

                const chap = session.chapters[idx - 1]
                await sock.sendMessage(from, { react: { text: '📖', key: m.key } })

                const url = `https://api.neoxr.eu/api/comic-render?url=${encodeURIComponent(chap.url)}&apikey=${API_KEY}`
                const { data } = await axios.get(url)

                const pages = Array.isArray(data?.data) ? data.data : []
                const sendCount = Math.min(pages.length, MAX_PAGES)

                await sock.sendMessage(from, {
                    text: `📖 *${session.title}*\n${chap.title}\nMengirim ${sendCount} halaman…`
                }, { quoted: m })

                for (let i = 0; i < sendCount; i++) {
                    await sock.sendMessage(from, {
                        image: { url: pages[i] },
                        caption: `Halaman ${i + 1}/${sendCount}`
                    }, { quoted: m })
                    await delay(DELAY_MS)
                }

                if (pages.length > sendCount) {
                    await sock.sendMessage(from, {
                        text: `ℹ️ Halaman terlalu banyak.\nBaca lengkap: ${chap.url}`
                    }, { quoted: m })
                }

                return
            }

        } catch (err) {
            console.error('[MANGA ERROR]', err)
            await sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat memproses manga.'
            }, { quoted: m })
        }
    }
}
