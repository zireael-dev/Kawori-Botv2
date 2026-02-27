/**
 * plugins/tiktok.js
 * Command:
 * /tiktok <url> (no wm)
 * /vt <url>     (no wm)
 * /tikwm <url>  (watermark)
 * /tikmp3 <url> (audio)
 */

const axios = require('axios')
const { checkLimit } = require('../lib/limit')

module.exports = {
    name: 'tiktok',

    // ===== MENU REGISTRY =====
    menu: {
        id: 'menu_tiktok',
        title: 'TikTok Downloader',
        desc: 'Download video / audio TikTok',
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

            const TRIGGERS = ['/tiktok', '/vt', '/tikwm', '/tikmp3']
            if (!TRIGGERS.includes(command)) return

            if (!url || !/tiktok\.com/i.test(url)) {
                return sock.sendMessage(
                    from,
                    { text: '❌ Contoh:\n/tiktok https://vt.tiktok.com/xxxxxx' },
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
                    `https://api.neoxr.eu/api/tiktok?url=${encodeURIComponent(url)}&apikey=${apiKey}`
                const res = await axios.get(apiUrl)
                json = res.data
            } catch (e) {
                console.error('[TIKTOK] API ERROR:', e)
                return sock.sendMessage(
                    from,
                    { text: '❌ Gagal mengambil data TikTok' },
                    { quoted: msg }
                )
            }

            if (!json?.status || !json?.data) {
                return sock.sendMessage(
                    from,
                    { text: '❌ Video tidak ditemukan atau private' },
                    { quoted: msg }
                )
            }

            /* ===== SELECT FILE ===== */
            let fileUrl
            let sendType = 'video'
            let caption = '🎬 TikTok'

            switch (command) {
                case '/tikmp3':
                    fileUrl = json.data.audio
                    sendType = 'audio'
                    caption = '🎵 TikTok Audio'
                    break
                case '/tikwm':
                    fileUrl = json.data.videoWM
                    caption = '🎥 TikTok (Watermark)'
                    break
                default:
                    fileUrl = json.data.video
                    caption = '🎬 TikTok (No WM)'
            }

            if (!fileUrl) {
                return sock.sendMessage(
                    from,
                    { text: '❌ Gagal mengambil file media' },
                    { quoted: msg }
                )
            }

            /* ===== DOWNLOAD & SEND ===== */
            try {
                const media = await axios.get(fileUrl, {
                    responseType: 'arraybuffer'
                })

                const buffer = Buffer.from(media.data)

                if (sendType === 'video') {
                    await sock.sendMessage(
                        from,
                        {
                            video: buffer,
                            mimetype: 'video/mp4',
                            caption
                        },
                        { quoted: msg }
                    )
                } else {
                    await sock.sendMessage(
                        from,
                        {
                            audio: buffer,
                            mimetype: 'audio/mp4',
                            ptt: false
                        },
                        { quoted: msg }
                    )
                }

                await sock.sendMessage(from, {
                    react: { text: '✅', key: msg.key }
                })
            } catch (e) {
                console.error('[TIKTOK] SEND ERROR:', e)
                await sock.sendMessage(
                    from,
                    {
                        text:
                            `❌ Gagal upload ke WhatsApp (mungkin file besar)\n\n` +
                            `Download manual:\n${fileUrl}`
                    },
                    { quoted: msg }
                )
            }
        } catch (fatal) {
            console.error('[TIKTOK] FATAL ERROR:', fatal)
        }
    }
}
