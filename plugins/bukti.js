const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

/* ===== HELPER DOWNLOAD IMAGE ===== */
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

            /* ===== AMBIL TEXT DARI SEMUA SUMBER ===== */
            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                ''

            console.log('[BUKTI] Incoming:', text)

            if (!text || !text.toLowerCase().startsWith('/bukti')) return

            console.log('[BUKTI] TRIGGERED')

            /* ===== PARSE PAKET ===== */
            const match = text.match(/paket=(\d+)/i)
            const paket = match ? match[1] : null

            if (!paket) {
                return sock.sendMessage(from, {
                    text: '❌ Format salah\nContoh:\n/bukti paket=30'
                }, { quoted: msg })
            }

            /* ===== DETEKSI GAMBAR ===== */
            let imageMessage = null

            // case 1: kirim gambar langsung + caption
            if (msg.message?.imageMessage) {
                imageMessage = msg.message.imageMessage
            }

            // case 2: reply gambar
            const quoted =
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

            if (!imageMessage && quoted?.imageMessage) {
                imageMessage = quoted.imageMessage
            }

            if (!imageMessage) {
                return sock.sendMessage(from, {
                    text: '❌ Kirim gambar bukti + caption:\n/bukti paket=30'
                }, { quoted: msg })
            }

            /* ===== DOWNLOAD IMAGE ===== */
            let buffer
            try {
                buffer = await getBuffer(imageMessage)
            } catch (err) {
                console.error('[BUKTI] download error:', err)
                return sock.sendMessage(from, {
                    text: '❌ Gagal mengambil gambar.'
                }, { quoted: msg })
            }

            /* ===== KIRIM KE OWNER ===== */
            const owners = global.config.owner || []

            if (!owners.length) {
                console.log('[BUKTI] owner kosong di config')
            }

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

Gunakan:
*/addprem ${number} ${paket}*
                        `.trim()
                    })
                } catch (err) {
                    console.error('[BUKTI] gagal kirim ke owner:', err)
                }
            }

            /* ===== NOTIF USER ===== */
            await sock.sendMessage(from, {
                text: `✅ Bukti berhasil dikirim!

⏳ Tunggu konfirmasi dari owner ya.`
            }, { quoted: msg })

        } catch (err) {
            console.error('[BUKTI FATAL ERROR]', err)
        }
    }
}
