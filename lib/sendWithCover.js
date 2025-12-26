const fs = require('fs')
const path = require('path')

module.exports = async function sendWithCover(sock, jid, text, options = {}) {
    const coverPath = path.join(__dirname, '..', 'media', 'cover.jpg')

    let contextInfo = {}

    if (fs.existsSync(coverPath)) {
        const buffer = fs.readFileSync(coverPath)
        contextInfo.externalAdReply = {
            title: options.title || 'KaworiBot v2',
            body: options.body || '',
            thumbnail: buffer,
            mediaType: 1,
            renderLargerThumbnail: true
        }
    }

    return sock.sendMessage(jid, {
        text,
        contextInfo
    }, options.quoted ? { quoted: options.quoted } : {})
}
