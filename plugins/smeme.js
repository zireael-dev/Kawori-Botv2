/**
 * plugins/smeme.js
 * Meme sticker dengan font Futura Condensed Extra Bold
 * Command: /smeme TEKS ATAS|TEKS BAWAH
 */

const { createCanvas, loadImage, registerFont } = require('canvas')
const { downloadContentFromMessage } = require('@shennmine/baileys')
const { Sticker, StickerTypes } = require('wa-sticker-formatter')
const path = require('path')

// ===== REGISTER FONT =====
const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'FuturaCondensedExtraBold.otf')
registerFont(FONT_PATH, { family: 'FuturaCondensedExtraBold' })

// ===== UTIL: download image buffer =====
async function downloadImage(message) {
    const stream = await downloadContentFromMessage(message, 'image')
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    return buffer
}

// ===== UTIL: auto font size =====
function calcFontSize(text) {
    if (!text) return 0
    const len = text.length
    if (len <= 5) return 120
    if (len <= 8) return 100
    if (len <= 11) return 80
    if (len <= 15) return 64
    return 48
}

module.exports = {
    name: 'smeme',

    async onMessage(sock, m) {
        const from = m.key.remoteJid

        const text =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ''

        if (!text.toLowerCase().startsWith('/smeme')) return

        // ===== PARSE TEXT =====
        const payload = text.slice(6).trim()
        let [top = '', bottom = ''] = payload.split('|').map(t => t.trim().toUpperCase())

        if (top.length > 15) top = top.slice(0, 15)
        if (bottom.length > 15) bottom = bottom.slice(0, 15)

        if (!top && !bottom) {
            return sock.sendMessage(from, {
                text: '❌ Format:\n/smeme TEKS ATAS|TEKS BAWAH\n\nMaks 15 karakter per baris.'
            }, { quoted: m })
        }

        // ===== GET IMAGE =====
        const quoted =
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
        const imageMessage = quoted || m.message?.imageMessage

        if (!imageMessage) {
            return sock.sendMessage(from, {
                text: '❌ Reply atau kirim gambar dengan caption /smeme'
            }, { quoted: m })
        }

        let imageBuffer
        try {
            imageBuffer = await downloadImage(imageMessage)
        } catch {
            return sock.sendMessage(from, {
                text: '❌ Gagal mengunduh gambar.'
            }, { quoted: m })
        }

        try {
            // ===== CANVAS =====
            const SIZE = 512
            const canvas = createCanvas(SIZE, SIZE)
            const ctx = canvas.getContext('2d')

            const img = await loadImage(imageBuffer)
            ctx.drawImage(img, 0, 0, SIZE, SIZE)

            ctx.textAlign = 'center'
            ctx.fillStyle = 'white'
            ctx.strokeStyle = 'black'
            ctx.lineWidth = 8

            // ===== TOP TEXT =====
            if (top) {
                const fontSize = calcFontSize(top)
                ctx.font = `${fontSize}px "FuturaCondensedExtraBold"`
                ctx.textBaseline = 'top'
                ctx.strokeText(top, SIZE / 2, 20)
                ctx.fillText(top, SIZE / 2, 20)
            }

            // ===== BOTTOM TEXT =====
            if (bottom) {
                const fontSize = calcFontSize(bottom)
                ctx.font = `${fontSize}px "FuturaCondensedExtraBold"`
                ctx.textBaseline = 'bottom'
                ctx.strokeText(bottom, SIZE / 2, SIZE - 20)
                ctx.fillText(bottom, SIZE / 2, SIZE - 20)
            }

            // ===== STICKER =====
            const sticker = new Sticker(canvas.toBuffer(), {
                pack: global.config?.sticker?.packname || global.config?.botName || 'Kawori-Bot',
                author: global.config?.sticker?.author || 'Made by Zireael',
                type: StickerTypes.FULL,
                quality: 100
            })

            await sock.sendMessage(from, {
                sticker: await sticker.toBuffer()
            }, { quoted: m })

        } catch (err) {
            console.error('[SMEME ERROR]', err)
            await sock.sendMessage(from, {
                text: '❌ Gagal membuat sticker meme.'
            }, { quoted: m })
        }
    }
}
