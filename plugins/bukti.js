const payment = require('../lib/payment')
const { clearTimeout } = require('../lib/timeout')

module.exports = {
    name: 'bukti',

    async onMessage(sock, msg) {
        const text = msg.message?.conversation || ''
        if (!text.startsWith('/bukti')) return

        const jid = msg.key.remoteJid
        const pending = payment.get(jid)
        if (!pending) {
            return sock.sendMessage(jid, {
                text: '❌ Tidak ada transaksi pending.\nGunakan /buyprem'
            }, { quoted: msg })
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        if (!quoted?.imageMessage) {
            return sock.sendMessage(jid, {
                text: '❌ Reply *foto bukti pembayaran* dengan /bukti'
            }, { quoted: msg })
        }

        const paket = text.match(/paket=(\d+)/)?.[1]
        if (!paket) {
            return sock.sendMessage(jid, {
                text: '❌ Sertakan paket.\nContoh: /bukti paket=30'
            }, { quoted: msg })
        }

        clearTimeout(jid)
        payment.set(jid, {
            ...pending,
            status: 'waiting_confirm',
            paket
        })

        // notif owner
        for (const owner of global.config.owner) {
            await sock.sendMessage(owner + '@s.whatsapp.net', {
                text: `
💳 *PEMBAYARAN BARU*

User: ${jid}
Paket: ${paket} hari

Gunakan:
/addprem ${jid.split('@')[0]} ${paket}
                `.trim()
            })
        }

        await sock.sendMessage(jid, {
            text: '✅ Bukti diterima.\nMenunggu verifikasi admin.'
        }, { quoted: msg })
    }
}
