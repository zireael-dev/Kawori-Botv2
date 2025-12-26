/**
 * plugins/manga.js
 * Manga Interactive Reader (Neoxr API)
 */

const axios = require('axios')

const API_KEY   = global.config.api.neoxr
const PAGE_SIZE = 10
const MAX_RENDER = 20
const DELAY = ms => new Promise(r => setTimeout(r, ms))

function ensureDb() {
    global.db = global.db || {}
    global.db.mangaSessions = global.db.mangaSessions || {}
}

function getSession(jid) {
    ensureDb()
    if (!global.db.mangaSessions[jid]) {
        global.db.mangaSessions[jid] = {
            search: [],
            chapters: [],
            title: '',
            page: 1,
            selected: null
        }
    }
    return global.db.mangaSessions[jid]
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
            const q = text.slice(7).trim()
            if (!q) return

            const api = `https://api.neoxr.eu/api/comic?q=${encodeURIComponent(q)}&apikey=${API_KEY}`
            const { data } = await axios.get(api)

            if (!data?.status || !data.data?.length) {
                return sock.sendMessage(from, { text: '❌ Manga tidak ditemukan' }, { quoted: msg })
            }

            session.search = data.data.slice(0, 10)

            const rows = session.search.map((m, i) => ({
                title: m.title || 'Tanpa Judul',
                description: 'Klik untuk lihat chapter',
                id: `manga_open_${i}`
            }))

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: '📚 Hasil Pencarian Manga',
                    footer: 'Pilih salah satu',
                    nativeFlowMessage: {
                        buttons: [{
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '📖 Pilih Manga',
                                sections: [{
                                    title: 'Hasil',
                                    rows
                                }]
                            })
                        }]
                    }
                }
            }, { quoted: msg })
        }

        /* ================= INTERACTIVE CLICK ================= */
        const params =
            msg.message?.interactiveResponseMessage
            ?.nativeFlowResponseMessage
            ?.paramsJson

        if (!params) return

        const parsed = JSON.parse(params)
        const id = parsed.id

        /* ================= OPEN MANGA ================= */
        if (id.startsWith('manga_open_')) {
            const idx = Number(id.split('_').pop())
            const pick = session.search[idx]
            if (!pick) return

            const api = `https://api.neoxr.eu/api/comic-get?url=${encodeURIComponent(pick.url)}&apikey=${API_KEY}`
            const { data } = await axios.get(api)

            session.title = data.data.title || pick.title
            session.chapters = (data.data.chapters || []).reverse()
            session.page = 1

            return sendChapterMenu(sock, from, msg, session)
        }

        /* ================= PAGE NAV ================= */
        if (id === 'manga_next') {
            session.page++
            return sendChapterMenu(sock, from, msg, session)
        }

        if (id === 'manga_prev') {
            session.page = Math.max(1, session.page - 1)
            return sendChapterMenu(sock, from, msg, session)
        }

        /* ================= SELECT CHAPTER ================= */
        if (id.startsWith('manga_chapter_')) {
            const idx = Number(id.split('_').pop())
            session.selected = idx

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: `📖 ${session.title}`,
                    footer: 'Pilih cara membaca',
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🖼️ Baca di Chat',
                                    id: 'manga_read_chat'
                                })
                            },
                            {
                                name: 'quick_reply',
                                buttonParamsJson: JSON.stringify({
                                    display_text: '🔗 Kirim Link',
                                    id: 'manga_read_link'
                                })
                            }
                        ]
                    }
                }
            }, { quoted: msg })
        }

        /* ================= READ CHAT ================= */
        if (id === 'manga_read_chat') {
            const chap = session.chapters[session.selected]
            if (!chap) return

            const api = `https://api.neoxr.eu/api/comic-render?url=${encodeURIComponent(chap.url)}&apikey=${API_KEY}`
            const { data } = await axios.get(api)

            const pages = data.data.slice(0, MAX_RENDER)

            await sock.sendMessage(from, {
                text: `📖 *${session.title}*\n${chap.title}\n🖼️ ${pages.length} halaman`
            }, { quoted: msg })

            for (let i = 0; i < pages.length; i++) {
                await sock.sendMessage(from, {
                    image: { url: pages[i] },
                    caption: `Halaman ${i + 1}`
                }, { quoted: msg })
                await DELAY(700)
            }
        }

        /* ================= READ LINK ================= */
        if (id === 'manga_read_link') {
            const chap = session.chapters[session.selected]
            if (!chap) return

            return sock.sendMessage(from, {
                text: `🔗 *${session.title}*\n${chap.title}\n${chap.url}`
            }, { quoted: msg })
        }
    }
}

/* ================= HELPER ================= */
async function sendChapterMenu(sock, from, msg, session) {
    const start = (session.page - 1) * PAGE_SIZE
    const slice = session.chapters.slice(start, start + PAGE_SIZE)

    const rows = slice.map((c, i) => ({
        title: c.title || 'Chapter',
        description: 'Klik untuk baca',
        id: `manga_chapter_${start + i}`
    }))

    const nav = []
    if (session.page > 1) nav.push({ title: '⬅️ Prev', id: 'manga_prev' })
    if (start + PAGE_SIZE < session.chapters.length) nav.push({ title: '➡️ Next', id: 'manga_next' })

    return sock.sendMessage(from, {
        interactiveMessage: {
            title: `📚 ${session.title}`,
            footer: `Halaman ${session.page}`,
            nativeFlowMessage: {
                buttons: [{
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '📖 Pilih Chapter',
                        sections: [{
                            title: 'Chapter',
                            rows: [...rows, ...nav]
                        }]
                    })
                }]
            }
        }
    }, { quoted: msg })
}
