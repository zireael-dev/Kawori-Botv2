const { getUser, updateUser } = require('../lib/user')

module.exports = {
    name: 'addprem',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const sender = msg.key.participant || from

        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (!text.startsWith('/addprem')) return

        /* ===== OWNER CHECK ===== */
        const ownerJids = global.config.owner.map(v => v + '@s.whatsapp.net')
        if (!ownerJids.includes(sender)) {
            return sock.sendMessage(from, {
                text: '❌ Command ini hanya untuk owner.'
            }, { quoted: msg })
        }

        /* ===== PARSE TARGET ===== */
        const args = text.split(/\s+/)

        // mentioned user
        let target =
            msg.message?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

        // fallback: nomor manual
        if (!target && args[1]) {
            const num = args[1].replace(/\D/g, '')
            if (num.length < 8) {
                return sock.sendMessage(from, {
                    text: '❌ Nomor tidak valid.'
                }, { quoted: msg })
            }
            target = num + '@s.whatsapp.net'
        }

        const days = parseInt(args[2])

        if (!target || !days) {
            return sock.sendMessage(from, {
                text: `❌ Format salah

Gunakan:
• /addprem @user 30
• /addprem 62812xxxx 30`
            }, { quoted: msg })
        }

        /* ===== SET PREMIUM ===== */
        const user = getUser(target)

        const expired = new Date()
        expired.setDate(expired.getDate() + days)

        updateUser(target, {
            premium: {
                status: true,
                expired: expired.toISOString(),
                plan: `${days} days`
            }
        })

        await sock.sendMessage(from, {
            text: `✅ Premium berhasil ditambahkan

User: @${target.split('@')[0]}
Durasi: ${days} hari
Expired: ${expired.toLocaleString('id-ID')}`,
            mentions: [target]
        }, { quoted: msg })
    }
}
