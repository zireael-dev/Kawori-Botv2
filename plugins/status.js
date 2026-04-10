const os = require('os')

// Fungsi bantuan untuk mengubah milidetik menjadi format Hari, Jam, Menit, Detik
function formatUptime(ms) {
    let d = Math.floor(ms / 86400000)
    let h = Math.floor(ms / 3600000) % 24
    let m = Math.floor(ms / 60000) % 60
    let s = Math.floor(ms / 1000) % 60
    return [d, 'Hari ', h, 'Jam ', m, 'Menit ', s, 'Detik'].map(v => v.toString().padStart(2, '0')).join('')
}

module.exports = {
    name: 'bot-status',
    onMessage: async (sock, msg, store) => {
        // Ekstrak teks dari pesan (mendukung pesan teks biasa atau pesan balasan/extended)
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""

        // Regex untuk trigger command, misalnya: .status, .info, atau /ping
        if (!text.match(/^[.!/](status|info|ping|bot)$/i)) return

        const from = msg.key.remoteJid

        // 1. Kalkulasi Ping / Kecepatan Respon
        const timestamp = msg.messageTimestamp
        const now = Date.now() / 1000
        const ping = (now - timestamp).toFixed(3)

        // 2. Info RAM Server
        const totalRAM = Math.round(os.totalmem() / 1024 / 1024)
        const freeRAM = Math.round(os.freemem() / 1024 / 1024)
        const usedRAM = totalRAM - freeRAM

        // 3. Kalkulasi Pengguna (Private Chat) & Grup dari Baileys Store
        // Pastikan store.chats sudah ter-bind di index.js kamu
        const chats = store?.chats?.dict || {}
        let groupCount = 0
        let privateCount = 0

        Object.keys(chats).forEach(jid => {
            if (jid.endsWith('@g.us')) groupCount++
            if (jid.endsWith('@s.whatsapp.net')) privateCount++
        })

        // 4. Info Waktu & Timezone (Menyesuaikan server kamu)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const timeServer = new Date().toLocaleString('id-ID', { timeZone: tz })

        // 5. Info Limit (Placeholder)
        // Karena sistem database/limit belum terlihat, kita ambil dari global.config jika ada
        const limitGlobal = global.config?.defaultLimit || 'Unlimited'

        // 6. Uptime Bot
        const uptimeBot = formatUptime(process.uptime() * 1000)
        // Uptime OS (Berapa lama PC/Server menyala)
        const uptimeOS = formatUptime(os.uptime() * 1000)

        // Menyusun pesan balasan
        const replyText = `
*🚀 STATUS KAWORIBOT v2*
──────────────────
*📊 Statistik Penggunaan:*
• *Private Chats:* ${privateCount} user
• *Groups Joined:* ${groupCount} grup
• *Total Chats:* ${groupCount + privateCount} obrolan

*💻 Sistem & Server:*
• *OS:* ${os.type()} ${os.release()} (${os.arch()})
• *RAM:* ${usedRAM} MB / ${totalRAM} MB
• *Bot Uptime:* ${uptimeBot}
• *System Uptime:* ${uptimeOS}
• *Kecepatan Respon:* ${ping} detik

*🕰️ Waktu & Pengaturan:*
• *Timezone:* ${tz}
• *Waktu Server:* ${timeServer}
• *Limit Global:* ${limitGlobal}
──────────────────
_Powered by Baileys & Node.js_`.trim()

        // Mengirim pesan balasan dan me-reply pesan pengguna yang mengetik command
        await sock.sendMessage(from, { text: replyText }, { quoted: msg })
    }
}
