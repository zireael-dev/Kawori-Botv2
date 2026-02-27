const payment = require('../lib/payment')
const { clearTimeout } = require('../lib/timeout')

// simpan foto terakhir per user
const lastImage = {}

module.exports = {
    name: 'bukti',

    async onMessage(sock, msg) {
        const jid = msg.key.remoteJid

        // ===== SIMPAN FOTO TERAKHIR =====
        const imageMsg = msg.message?.imageMessage
        if (imageMsg) {
            lastImage[jid] = imageMsg
        }

        // ===== AMBIL TEXT / CAPTION =====
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            ''

        if (!text.startsWith('/bukti')) return

        const pending = payment.get(jid)
        if (!pending) {
            return sock.sendMessage(jid, {
                text: '❌ Tidak ada transaksi aktif.\nGunakan /buyprem terlebih dahulu.'
            }, { quoted: msg })
        }

        // ===== AMBIL PAKET =====
        const paket = text.match(/paket=(\d+)/)?.[1]
        if (!paket) {
            return sock.sendMessage(jid, {
                text: '❌ Format salah.\nGunakan:\n/bukti paket=30'
            }, { quoted: msg })
        }

        // ===== AMBIL FOTO =====
        const image = lastImage[jid]
        if (!image) {
            return sock.sendMessage(jid, {
                text: '❌ Kirim foto bukti pembayaran terlebih dahulu.'
            }, { quoted: msg })
        }

        // ===== STOP TIMEOUT =====
        clearTimeout(jid)
        payment.remove(jid)

        // ===== INFO USER =====
        const number = jid.split('@')[0]
        const name = msg.pushName || 'Unknown'

        console.log('OWNER LIST:', global.config.owner)

        // ===== KIRIM KE OWNER =====
        for (const owner of global.config.owner) {
            const ownerJid = owner + '@s.whatsapp.net'

            try {
                // kirim gambar
                await sock.sendMessage(ownerJid, {
                    image,
                    caption: '💳 Bukti Pembayaran Premium'
                })

                // kirim info teks
                await sock.sendMessage(ownerJid, {
                    text: `
💳 *BUKTI PEMBAYARAN PREMIUM*

👤 Nama   : ${name}
📱 Nomor  : ${number}
📦 Paket  : ${paket} hari

Gunakan:
*/addprem ${number} ${paket}*
                    `.trim()
                })
            } catch (err) {
                console.log('❌ Gagal kirim ke owner:', err)
            }
        }

        // ===== BALAS KE USER =====
        await sock.sendMessage(jid, {
            text: '✅ Bukti pembayaran berhasil dikirim ke admin.\nMohon tunggu konfirmasi.'
        }, { quoted: msg })

        // ===== HAPUS CACHE FOTO =====
        delete lastImage[jid]
    }
}
