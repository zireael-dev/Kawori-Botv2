const payment = require('../lib/payment')
const { clearTimeout } = require('../lib/timeout')

module.exports = {
    name: 'bukti',

    async onMessage(sock, msg) {
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (!text.startsWith('/bukti')) return

        const jid = msg.key.remoteJid
        const pending = payment.get(jid)

        if (!pending) {
            return sock.sendMessage(jid, {
                text: '❌ Tidak ada transaksi aktif.\nGunakan /buyprem terlebih dahulu.'
            }, { quoted: msg })
        }

        // HARUS reply ke foto
        const ctx = msg.message?.extendedTextMessage?.contextInfo
        const quoted = ctx?.quotedMessage

        if (!quoted?.imageMessage) {
            return sock.sendMessage(jid, {
                text: '❌ Reply *foto bukti pembayaran* lalu ketik:\n/bukti paket=30'
            }, { quoted: msg })
        }

        // Ambil paket
        const paket = text.match(/paket=(\d+)/)?.[1]
        if (!paket) {
            return sock.sendMessage(jid, {
                text: '❌ Paket tidak ditemukan.\nContoh:\n/bukti paket=30'
            }, { quoted: msg })
        }

        // STOP TIMEOUT
        clearTimeout(jid)
        payment.remove(jid)

        // INFO USER
        const number = jid.split('@')[0]
        const name = msg.pushName || 'Unknown'

        // FORWARD FOTO KE OWNER (VERSI STABIL)
    console.log('OWNER LIST:', global.config.owner)
for (const owner of global.config.owner) {
    const ownerJid = owner + '@s.whatsapp.net'

    try {
        // kirim ulang gambar
        await sock.sendMessage(ownerJid, quoted)

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
