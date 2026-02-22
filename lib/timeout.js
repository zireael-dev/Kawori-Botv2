const payment = require('./payment')

const timers = new Map()

function startTimeout(sock, jid, messageKey) {
    if (timers.has(jid)) return

    const timer = setTimeout(async () => {
        payment.remove(jid)
        timers.delete(jid)

        try {
            // hapus pesan QRIS
            await sock.sendMessage(jid, {
                delete: messageKey
            })

            await sock.sendMessage(jid, {
                text: '⏱️ *Waktu pembayaran habis (10 menit)*\nSilakan ulangi dengan /buyprem'
            })
        } catch {}
    }, 10 * 60 * 1000)

    timers.set(jid, timer)
}

function clearTimeout(jid) {
    if (timers.has(jid)) {
        clearTimeout(timers.get(jid))
        timers.delete(jid)
    }
}

module.exports = { startTimeout, clearTimeout }
