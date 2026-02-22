const payment = require('../lib/payment')
const { startTimeout } = require('../lib/timeout')
const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'buyprem',

    async onMessage(sock, msg) {
        const text = msg.message?.conversation || ''
        if (text !== '/buyprem') return

        const jid = msg.key.remoteJid
        if (payment.get(jid)) {
            return sock.sendMessage(jid, {
                text: '⚠️ Kamu masih punya transaksi pending.\nTunggu atau kirim /bukti.'
            }, { quoted: msg })
        }

        const qrisPath = path.join(__dirname, '..', 'media', 'qris.jpg')
        const qris = fs.readFileSync(qrisPath)

        const sent = await sock.sendMessage(jid, {
            image: qris,
            caption: `
💳 *PEMBAYARAN PREMIUM*

Paket:
• 30 hari : Rp. 15.000
• 90 hari : Rp. 40.000

⏱️ Batas waktu: *10 menit*

Setelah bayar:
1️⃣ Kirim foto bukti
2️⃣ Reply dengan:
/bukti paket=30
            `.trim()
        }, { quoted: msg })

        payment.set(jid, {
            status: 'pending',
            start: Date.now(),
            messageKey: sent.key
        })

        startTimeout(sock, jid, sent.key)
    }
}
