const { getUser } = require('../lib/user')
const { isPremium } = require('../lib/premium')

module.exports = {
    name: 'me',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const sender = msg.key.participant || from
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (!['/me', '/profile'].includes(text.toLowerCase())) return

        const name = msg.pushName || 'User'
        const user = getUser(sender, name)

        const premiumText = isPremium(user)
            ? `🌟 Premium\nAktif sampai: ${user.premium.expired || '-'}`
            : 'Free'

        const limitText = isPremium(user)
            ? 'Unlimited'
            : `${user.used}/${user.limit}`

        const reply = `
👤 *Profil Kamu*

• Nama: ${user.name}
• Status: ${premiumText}
• Limit Harian: ${limitText}
• Reset: ${user.lastReset}
`.trim()

        await sock.sendMessage(from, { text: reply }, { quoted: msg })
    }
}
