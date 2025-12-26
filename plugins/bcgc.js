/**
 * plugins/bcgc.js
 * Broadcast Group dengan Cover (OWNER ONLY)
 * Command: /bcgc <pesan>
 */

const isOwner = require('../lib/isOwner')
const sendWithCover = require('../lib/sendWithCover')

module.exports = {
    name: 'bcgc',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (!text.startsWith('/bcgc')) return

        // 🔒 Owner only
        if (!isOwner(msg)) {
            return sock.sendMessage(from, {
                text: '❌ Command ini khusus owner'
            }, { quoted: msg })
        }

        const content = text.slice(5).trim()
        if (!content) {
            return sock.sendMessage(from, {
                text: '❌ Format salah.\nContoh:\n/bcgc Halo semua!'
            }, { quoted: msg })
        }

        // Ambil semua grup
        let groups
        try {
            groups = await sock.groupFetchAllParticipating()
        } catch (err) {
            console.error('[BCGC] Fetch group error:', err)
            return sock.sendMessage(from, {
                text: '❌ Gagal mengambil daftar grup'
            }, { quoted: msg })
        }

        const groupIds = Object.keys(groups)
        if (!groupIds.length) {
            return sock.sendMessage(from, {
                text: '⚠️ Bot tidak tergabung di grup manapun.'
            }, { quoted: msg })
        }

        await sock.sendMessage(from, {
            text: `📢 Broadcast dimulai ke ${groupIds.length} grup...`
        }, { quoted: msg })

        let success = 0
        let failed = 0

        for (const jid of groupIds) {
            try {
                await sendWithCover(
                    sock,
                    jid,
                    content,
                    {
                        title: `© ${global.config.botName}`,
                        body: 'Official Broadcast',
                    }
                )
                success++
                // delay biar aman
                await new Promise(r => setTimeout(r, 350))
            } catch (e) {
                failed++
                console.error('[BCGC] Send error:', jid, e.message)
            }
        }

        await sock.sendMessage(from, {
            text:
`✅ Broadcast selesai!

📦 Total grup : ${groupIds.length}
✅ Terkirim   : ${success}
❌ Gagal     : ${failed}`
        }, { quoted: msg })
    }
}
