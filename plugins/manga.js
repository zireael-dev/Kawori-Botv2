/**
 * plugins/manga.js
 * Manga Reader (Mangabats Scraper)
 *
 * Command:
 * /manga <judul>     -> search manga
 * /m <nomor>         -> buka detail manga
 * /chapters [page]   -> list chapter
 * /c <nomor>         -> baca chapter (render image)
 * /cl <nomor>        -> kirim link chapter
 */

const axios = require('axios')
const cheerio = require('cheerio')

const BASE_URL   = 'https://www.mangabats.com'
const PAGE_SIZE  = 30
const MAX_PAGES  = 15
const DELAY_MS   = 600

const delay = ms => new Promise(r => setTimeout(r, ms))

/* ===== SESSION PER CHAT ===== */
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

/* ===== HTTP HELPER ===== */
async function fetchHTML(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    })
    return cheerio.load(data)
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

        const raw   = text.trim()
        const lower = raw.toLowerCase()
        const session = getSession(from)

        try {
            /* ================= /manga <judul> ================= */
            if (lower.startsWith('/manga ')) {
                const query = raw.slice(7).trim()
                if (!query) {
                    return sock.sendMessage(from, {
                        text: '❌ Contoh: /manga chainsaw man'
                    }, { quoted: m })
                }

                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } })

                const searchUrl = `${BASE_URL}/search/story/${encodeURIComponent(query.replace(/\s+/g, '_'))}`
                const $ = await fetchHTML(searchUrl)

                const results = []
                $('.panel-search-story .item').each((_, el) => {
                    const title = $(el).find('.item-title a').text().trim()
                    const url   = $(el).find('.item-title a').attr('href')
                    if (title && url) {
                        results.push({ title, url })
                    }
                })

                if (results.length === 0) {
                    return sock.sendMessage(from, {
                        text: '⚠️ Manga tidak ditemukan.'
                    }, { quoted: m })
                }

                session.search = results.slice(0, 10)
                session.chapters = []
                session.title = ''
                session.source = ''

                const lines = [`🔎 *Hasil pencarian "${query}"*`, '']
                session.search.forEach((v, i) => {
                    lines.push(`${i + 1}. ${v.title}`)
                })
                lines.push('')
                lines.push('➡️ Buka detail: */m <nomor>*')

                await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: m })
                await sock.sendMessage(from, { react: { text: '✅', key: m.key } })
                return
            }

            /* ================= /m <nomor> ================= */
            if (lower.startsWith('/m ')) {
                const idx = parseInt(raw.slice(3).trim(), 10)
                if (isNaN(idx) || idx < 1 || idx > session.search.length) {
                    return sock.sendMessage(from, {
                        text: '❌ Nomor tidak valid. Gunakan /manga dulu.'
                    }, { quoted: m })
                }

                const pick = session.search[idx - 1]
                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } })

                const $ = await fetchHTML(pick.url)

                const title = $('.story-info-right h1').text().trim() || pick.title
                const chapters = []

                $('.row-content-chapter li a').each((_, el) => {
                    const chapTitle = $(el).text().trim()
                    const chapUrl   = $(el).attr('href')
                    if (chapTitle && chapUrl) {
                        chapters.push({ title: chapTitle, url: chapUrl })
                    }
                })

                chapters.reverse() // ASC order

                session.chapters = chapters
                session.title = title
                session.source = pick.url

                const preview = chapters.slice(0, 10)
                const lines = [
                    `📖 *${title}*`,
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
                    return sock.sendMessage(from, {
                        text: '❌ Buka manga dulu dengan /m <nomor>'
                    }, { quoted: m })
                }

                const page = Math.max(1, parseInt(raw.split(' ')[1] || '1', 10))
                const start = (page - 1) * PAGE_SIZE
                const end   = Math.min(start + PAGE_SIZE, session.chapters.length)

                if (start >= session.chapters.length) {
                    return sock.sendMessage(from, {
                        text: '❌ Halaman tidak valid.'
                    }, { quoted: m })
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
                const chap = session.chapters[idx - 1]
                if (!chap) {
                    return sock.sendMessage(from, {
                        text: '❌ Chapter tidak valid.'
                    }, { quoted: m })
                }

                return sock.sendMessage(from, {
                    text: `🔗 *${session.title}*\n${chap.title}\n${chap.url}`
                }, { quoted: m })
            }

            /* ================= /c <nomor> ================= */
            if (lower.startsWith('/c ')) {
                const idx = parseInt(raw.slice(3).trim(), 10)
                const chap = session.chapters[idx - 1]
                if (!chap) {
                    return sock.sendMessage(from, {
                        text: '❌ Chapter tidak valid.'
                    }, { quoted: m })
                }

                await sock.sendMessage(from, { react: { text: '📖', key: m.key } })

                const $ = await fetchHTML(chap.url)
                const images = []

                $('.container-chapter-reader img').each((_, el) => {
                    const src = $(el).attr('src')
                    if (src) images.push(src)
                })

                const sendCount = Math.min(images.length, MAX_PAGES)

                await sock.sendMessage(from, {
                    text: `📖 *${session.title}*\n${chap.title}\nMengirim ${sendCount} halaman…`
                }, { quoted: m })

                for (let i = 0; i < sendCount; i++) {
                    await sock.sendMessage(from, {
                        image: { url: images[i] },
                        caption: `Halaman ${i + 1}/${sendCount}`
                    }, { quoted: m })
                    await delay(DELAY_MS)
                }

                if (images.length > sendCount) {
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
