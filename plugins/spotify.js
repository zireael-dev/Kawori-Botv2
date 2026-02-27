/**
 * plugins/spotify.js
 * Command:
 * /spotify <url>
 * /sp <url>
 */

const axios = require('axios')
const { checkLimit } = require('../lib/limit')

module.exports = {
    name: 'spotify',

    // ===== MENU REGISTRY =====
    menu: {
        id: 'menu_spotify',
        title: 'Spotify Downloader',
        desc: 'Download lagu dari Spotify',
        category: 'Downloader'
    },

    async onMessage(sock, msg) {
        try {
            const from = msg.key.remoteJid
            const name = msg.pushName || 'User'

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                ''

            if (!text) return

            const args = text.trim().split(/\s+/)
            const command = args[0]?.toLowerCase()
            const url = args[1]

            const TRIGGERS = ['/spotify', '/sp']
            if (!TRIGGERS.includes(command)) return

            if (!url || !/spotify\.com/i.test(url)) {
                return sock.sendMessage(
                    from,
                    {
                        text: '❌ Contoh:\n/spotify https://open.spotify.com/track/xxxx'
                    },
                    { quoted: msg }
                )
            }

            /* ===== CHECK LIMIT ===== */
            const limitCheck = checkLimit(from, name)
            if (!limitCheck.ok) {
                return sock.sendMessage(from, {
                    text: `❌ Limit harian kamu sudah habis

📊 Digunakan: ${limitCheck.user.used}/${limitCheck.user.limit}
💎 Premium = Unlimited`
                }, { quoted: msg })
            }

            const apiKey = global.config?.api?.neoxr
            if (!apiKey) {
                return sock.sendMessage(
                    from,
                    { text: '❌ API key Neoxr belum diset di config' },
                    { quoted: msg }
                )
            }

            // react loading
            await sock.sendMessage(from, {
                react: { text: '⏳', key: msg.key }
            })

            /* ===== CALL API ===== */
            let json
            try {
                const apiUrl =
                    `https://api.neoxr.eu/api/spotify?url=${encodeURIComponent(url)}&apikey=${apiKey}`
                const res = await axios.get(apiUrl)
                json = res.data
            } catch (err) {
                console.error('[SPOTIFY] API ERROR:', err)
                return sock.sendMessage(
                    from,
                    { text: '❌ Gagal mengambil data Spotify' },
                    { quoted: msg }
                )
            }

            if (!json?.status || !json?.data?.url) {
                return sock.sendMessage(
                    from,
                    { text: '❌ Lagu tidak ditemukan atau tidak tersedia' },
                    { quoted: msg }
                )
            }

            const {
                title,
                artist,
                duration,
                thumbnail,
                url: audioUrl
            } = json.data

            /* ===== DOWNLOAD & SEND ===== */
            try {
                const audio = await axios.get(audioUrl, {
                    responseType: 'arraybuffer'
                })

                await sock.sendMessage(
                    from,
                    {
                        audio: Buffer.from(audio.data),
                        mimetype: 'audio/mpeg',
                        fileName: `${title || 'spotify'}.mp3`,
                        caption: `
🎵 *Spotify Downloader*

🎶 Judul  : ${title || '-'}
🎤 Artis  : ${artist || '-'}
⏱ Durasi : ${duration || '-'}
                        `.trim()
                    },
                    { quoted: msg }
                )

                await sock.sendMessage(from, {
                    react: { text: '✅', key: msg.key }
                })
            } catch (err) {
                console.error('[SPOTIFY] SEND ERROR:', err)
                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ Gagal upload ke WhatsApp\n\n` +
                            `Download manual:\n${audioUrl}`
                    },
                    { quoted: msg }
                )
            }
        } catch (fatal) {
            console.error('[SPOTIFY] FATAL ERROR:', fatal)
        }
    }
}
