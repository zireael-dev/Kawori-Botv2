const payment = require('../lib/payment')
const { clearTimeout } = require('../lib/timeout')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

/* ===== HELPER: DOWNLOAD IMAGE ===== */
async function getBuffer(message) {
    const stream = await downloadContentFromMessage(message, 'image')
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

module.exports = {
    name: 'bukti',

    async onMessage(sock, msg) {
        try {
            const from = msg.key.remoteJid
            const sender = msg.key.participant || msg.key.remoteJid
            const number = sender.split('@')[0]
            const name = msg.pushName || 'User'

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                ''

            if (!text.startsWith('/bukti')) return

            /* ===== AMBIL PAKET ===== */
            const paket = text.match(/paket=(\d+)/)?.[1]
            if (!paket) {
                return sock.sendMessage(from, {
                    text: '❌ Format salah\n\nContoh:\n/bukti paket=30'
                }, { quoted: msg })
            }

            /* ===== AMBIL MEDIA ===== */
            let imageMessage = null

            // jika kirim langsung gambar + caption
            if (msg.message?.imageMessage) {
                imageMessage = msg.message.imageMessage
            }

            // jika reply gambar
            const ctx = msg.message?.extendedTextMessage?.contextInfo
            const quoted = ctx?.quotedMessage

            if (!imageMessage && quoted?.imageMessage) {
                imageMessage = quoted.imageMessage
            }

            if (!imageMessage) {
                return sock.sendMessage(from, {
                    text: '❌ Kirim atau reply *foto bukti pembayaran* dengan:\n/bukti paket=30'
                }, { quoted: msg })
            }

            /* ===== STOP TIMEOUT (JIKA ADA) ===== */
            try {
                clearTimeout(from)
                payment.remove(from)
            } catch {}

            /* ===== DOWNLOAD IMAGE ===== */
            let buffer
            try {
                buffer = await getBuffer(imageMessage)
            } catch (err) {
                console.error('[BUKTI] download error:', err)
                return sock.sendMessage(from, {
                    text: '❌ Gagal mengambil gambar bukti.'
                }, { quoted: msg })
            }

            /* ===== KIRIM KE OWNER ===== */
            const owners = global.config.owner || []

            for (const owner of owners) {
                const ownerJid = owner + '@s.whatsapp.net'

                try {
                    await sock.sendMessage(ownerJid, {
                        image: buffer,
                        caption: `
💳 *BUKTI PEMBAYARAN PREMIUM*

👤 Nama   : ${name}
📱 Nomor  : ${number}
📦 Paket  : ${paket} hari

🔧 Command:
*/addprem ${number} ${paket}*
                        `.trim()
                    })
                } catch (err) {
                    console.log('[BUKTI] gagal kirim ke owner:', err)
                }
            }

            /* ===== NOTIF KE USER ===== */
            await sock.sendMessage(from, {
                text: `
✅ *Bukti berhasil dikirim!*

⏳ Mohon tunggu verifikasi dari owner.

Terima kasih 🤍
                `.trim()
            }, { quoted: msg })

        } catch (err) {
            console.error('[BUKTI ERROR]', err)
        }
    }
}
