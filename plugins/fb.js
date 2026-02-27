const axios = require('axios')
const { checkLimit } = require('../lib/limit')

const TRIGGERS = ['/fb', '/fbdl', '/fbvid']

module.exports = {
    name: 'fb',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const name = msg.pushName || 'User'

        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (!text) return

        const args = text.trim().split(/\s+/)
        const command = args[0].toLowerCase()
        const url = args[1]

        if (!TRIGGERS.includes(command)) return

        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return sock.sendMessage(from, {
                text: '❌ Contoh:\n/fb https://fb.watch/xxxx'
            }, { quoted: msg })
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

        /* ===== PROCESS ===== */
        await sock.sendMessage(from, {
            react: { text: '⏳', key: msg.key }
        })

        let data
        try {
            const apiUrl =
                `https://api.neoxr.eu/api/fb?url=${encodeURIComponent(url)}&apikey=${global.config.api.neoxr}`

            const res = await axios.get(apiUrl)
            data = res.data
        } catch (err) {
            console.error('[FB API ERROR]', err)
            return sock.sendMessage(from, {
                text: '❌ Gagal mengambil data dari Facebook.'
            }, { quoted: msg })
        }

        if (!data?.status || !Array.isArray(data.data)) {
            return sock.sendMessage(from, {
                text: '❌ Video tidak ditemukan atau private.'
            }, { quoted: msg })
        }

        // pilih kualitas terbaik
        const video =
            data.data.find(v => v.quality === 'HD') ||
            data.data.find(v => v.quality === 'SD')

        if (!video?.url) {
            return sock.sendMessage(from, {
                text: '❌ Tidak bisa mengambil video.'
            }, { quoted: msg })
        }

        /* ===== SEND ===== */
        try {
            await sock.sendMessage(from, {
                video: { url: video.url },
                mimetype: 'video/mp4',
                caption: `🎬 Facebook Video (${video.quality})`
            }, { quoted: msg })
        } catch (err) {
            console.error('[FB SEND ERROR]', err)
            await sock.sendMessage(from, {
                text: `⚠️ Gagal upload ke WhatsApp.\nDownload manual:\n${video.url}`
            }, { quoted: msg })
        }
    }
}
