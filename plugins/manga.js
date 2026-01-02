/**
 * plugins/manga.js
 * Mangabats Manga Reader (Interactive)
 */

const axios = require('axios')
const cheerio = require('cheerio')

const BASE = 'https://www.mangabats.com'
const MAX_PAGES = 15
const DELAY = 600

global.db = global.db || {}
global.db.manga = global.db.manga || {}

const delay = ms => new Promise(r => setTimeout(r, ms))

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

async function fetchHTML(url) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': BASE
        }
    })
    return cheerio.load(data)
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

        /* ================= SEARCH ================= */
        if (text.startsWith('/manga ')) {
            const query = text.slice(7).trim()
            if (!query) return

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            const searchUrl = `${BASE}/search/story/${query.replace(/\s+/g, '_')}`
            const $ = await fetchHTML(searchUrl)

            const results = []
            $('.panel-search-story .item').each((_, el) => {
                const title = $(el).find('.item-title a').text().trim()
                const url = $(el).find('.item-title a').attr('href')
                if (title && url) results.push({ title, url })
            })

            if (!results.length) {
                return sock.sendMessage(from, { text: '❌ Manga tidak ditemukan' })
            }

            session.search = results.slice(0, 10)

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: '📚 Manga Found',
                    footer: 'Pilih judul',
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📖 Pilih Manga',
                                    sections: [
                                        {
                                            title: 'Hasil',
                                            rows: session.search.map((m, i) => ({
                                                title: m.title,
                                                description: 'Klik untuk lihat chapter',
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

        /* ================= INTERACTIVE ================= */
        const params =
            msg.message?.interactiveResponseMessage
            ?.nativeFlowResponseMessage
            ?.paramsJson

        if (!params) return

        const parsed = JSON.parse(params)
        const id = parsed.id

        /* ================= OPEN MANGA ================= */
        if (id?.startsWith('manga_')) {
            const idx = parseInt(id.split('_')[1])
            const pick = session.search[idx]

            const $ = await fetchHTML(pick.url)
            const chapters = []

            $('.row-content-chapter li a').each((_, el) => {
                chapters.push({
                    title: $(el).text().trim(),
                    url: $(el).attr('href')
                })
            })

            session.title = pick.title
            session.chapters = chapters.reverse()

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: `📖 ${session.title}`,
                    footer: 'Pilih chapter',
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📄 Pilih Chapter',
                                    sections: [
                                        {
                                            title: 'Chapter List',
                                            rows: session.chapters.slice(0, 50).map((c, i) => ({
                                                title: c.title,
                                                description: 'Baca chapter',
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

        /* ================= READ CHAPTER ================= */
        if (id?.startsWith('chapter_')) {
            const idx = parseInt(id.split('_')[1])
            const chap = session.chapters[idx]

            await sock.sendMessage(from, {
                text: `📖 *${session.title}*\n${chap.title}\nMengirim halaman...`
            }, { quoted: msg })

            const $ = await fetchHTML(chap.url)
            const images = []

            $('.container-chapter-reader img').each((_, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src')
                if (src) images.push(src)
            })

            const sendCount = Math.min(images.length, MAX_PAGES)

            for (let i = 0; i < sendCount; i++) {
                await sock.sendMessage(from, {
                    image: { url: images[i] },
                    caption: `Halaman ${i + 1}/${sendCount}`
                }, { quoted: msg })
                await delay(DELAY)
            }

            if (images.length > sendCount) {
                await sock.sendMessage(from, {
                    text: `ℹ️ Chapter terlalu panjang.\nBaca full di:\n${chap.url}`
                }, { quoted: msg })
            }
        }
    }
}
