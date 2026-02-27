/**
 * plugins/ig.js
 * Instagram Downloader (photo, video, carousel)
 * Command: /ig [link]
 * Limit:
 * - Free  : terbatas (via lib/limit)
 * - Premium: unlimited
 */

const axios = require('axios')
const { checkLimit } = require('../lib/limit')

module.exports = {
    name: 'instagram',

    async onMessage(sock, msg) {
        const m = msg
        const from = m.key.remoteJid
        const name = m.pushName || 'User'

        const body =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            m.message?.imageMessage?.caption ||
            m.message?.videoMessage?.caption ||
            ''

        if (!body) return

        const args = body.trim().split(/\s+/)
        const command = args[0].toLowerCase()
        const link = args[1]

        if (command !== '/ig') return

        if (!link || !/^https:\/\/(www\.)?instagram\.com/i.test(link)) {
            return sock.sendMessage(from, {
                text: '❌ Contoh:\n/ig https://www.instagram.com/p/xxxx'
            }, { quoted: m })
        }

        /* ===== CHECK LIMIT ===== */
        const limitCheck = checkLimit(from, name)
        if (!limitCheck.ok) {
            return sock.sendMessage(from, {
                text: `❌ Limit harian kamu sudah habis

📊 Digunakan: ${limitCheck.user.used}/${limitCheck.user.limit}
💎 Premium = Unlimited`
            }, { quoted: m })
        }

        /* ===== PROCESS ===== */
        await sock.sendMessage(from, {
            react: { text: '⏳', key: m.key }
        })

        const apiKey = global.config?.api?.neoxr

        let json
        try {
            const apiUrl =
                `https://api.neoxr.eu/api/ig?url=${encodeURIComponent(link)}&apikey=${apiKey}`

            const res = await axios.get(apiUrl)
            json = res.data
        } catch (err) {
            console.error('[IG API ERROR]', err)
            return sock.sendMessage(from, {
                text: '❌ Gagal memanggil API Instagram.'
            }, { quoted: m })
        }

        if (!json?.status || !Array.isArray(json.data) || !json.data.length) {
            return sock.sendMessage(from, {
                text: '❌ Media tidak ditemukan (private / invalid / dihapus).'
            }, { quoted: m })
        }

        /* ===== SEND MEDIA ===== */
        for (const media of json.data) {
            try {
                const file = await axios.get(media.url, {
                    responseType: 'arraybuffer'
                })

                if (media.type === 'mp4') {
                    await sock.sendMessage(from, {
                        video: Buffer.from(file.data),
                        mimetype: 'video/mp4'
                    }, { quoted: m })
                } else {
                    await sock.sendMessage(from, {
                        image: Buffer.from(file.data),
                        mimetype: 'image/jpeg'
                    }, { quoted: m })
                }

                // delay biar aman
                await new Promise(r => setTimeout(r, 1200))
            } catch (err) {
                console.error('[IG SEND ERROR]', err)
                await sock.sendMessage(from, {
                    text: `⚠️ Gagal upload ke WhatsApp.\nDownload manual:\n${media.url}`
                }, { quoted: m })
            }
        }

        await sock.sendMessage(from, {
            react: { text: '✅', key: m.key }
        })
    }
}
