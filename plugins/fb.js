/**
 * plugins/fb.js
 * Facebook Video Downloader (Neoxr API)
 * Command: /fb /facebook /fbdl + link
 * npm install axios
 */

const axios = require('axios')

const TRIGGERS = ['/fb', '/facebook', '/fbdl']

module.exports = {
    name: 'facebook-downloader',

    async onMessage(sock, m) {
        const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        ''

        if (!text) return

            const args = text.trim().split(/\s+/)
            const command = args[0].toLowerCase()
            const link = args[1]

            if (!TRIGGERS.includes(command)) return

                if (!link || !link.includes('facebook.com')) {
                    return sock.sendMessage(
                        m.key.remoteJid,
                        { text: '❌ Kirim: /fb [link Facebook]\nContoh:\n/fb https://www.facebook.com/share/v/xxxxx' },
                        { quoted: m }
                    )
                }

                // react proses
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '⏳', key: m.key }
                })

                const apiKey = global.config.api?.neoxr
                if (!apiKey) {
                    return sock.sendMessage(
                        m.key.remoteJid,
                        { text: '❌ API key Neoxr belum diset di config.js' },
                        { quoted: m }
                    )
                }

                let json
                try {
                    const apiUrl =
                    `https://api.neoxr.eu/api/fb?url=${encodeURIComponent(link)}&apikey=${apiKey}`

                    const res = await axios.get(apiUrl)
                    json = res.data
                } catch (err) {
                    console.error('FB API error:', err)
                    return sock.sendMessage(
                        m.key.remoteJid,
                        { text: '❌ Gagal mengambil data dari Facebook.' },
                        { quoted: m }
                    )
                }

                if (!json.status || !json.data?.url) {
                    return sock.sendMessage(
                        m.key.remoteJid,
                        { text: '❌ Video Facebook tidak ditemukan atau private.' },
                        { quoted: m }
                    )
                }

                const videoUrl = json.data.url
                const caption = '🎥 Facebook Video'

                try {
                    const videoRes = await axios.get(videoUrl, {
                        responseType: 'arraybuffer'
                    })

                    await sock.sendMessage(
                        m.key.remoteJid,
                        {
                            video: Buffer.from(videoRes.data),
                                           mimetype: 'video/mp4',
                                           caption
                        },
                        { quoted: m }
                    )
                } catch (err) {
                    console.error('FB send error:', err)
                    await sock.sendMessage(
                        m.key.remoteJid,
                        {
                            text:
                            `❌ Gagal upload ke WhatsApp (mungkin file besar).\n` +
                            `Download manual:\n${videoUrl}`
                        },
                        { quoted: m }
                    )
                }
    }
}
