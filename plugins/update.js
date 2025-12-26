/**
 * plugins/update.js
 * Owner-only Git Update Plugin
 * Command: /update
 */

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const isOwner = require('../lib/isOwner')

module.exports = {
    name: 'update',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        if (text !== '/update') return

        // 🔒 Owner check
        if (!isOwner(msg)) {
            return sock.sendMessage(from, {
                text: '❌ Command ini khusus owner'
            }, { quoted: msg })
        }

        await sock.sendMessage(from, {
            text: '🔄 Checking for updates from GitHub...\nMohon tunggu.'
        }, { quoted: msg })

        exec('git pull', { cwd: process.cwd() }, async (err, stdout, stderr) => {
            if (err) {
                console.error('[UPDATE ERROR]', err)
                return sock.sendMessage(from, {
                    text: `❌ Update gagal:\n${stderr || err.message}`
                }, { quoted: msg })
            }

            const output = stdout.trim()

            // Sudah versi terbaru
            if (/already up.to.date|already up-to-date|sudah up.to.date/i.test(output)) {
                return sock.sendMessage(from, {
                    text: `✅ KaworiBot sudah versi terbaru.\n\n${output}`
                }, { quoted: msg })
            }

            // Ada update → restart
            await sock.sendMessage(from, {
                text:
                    `🎉 Update berhasil!\n\n${output}\n\n` +
                    `♻️ Bot akan restart otomatis...`
            }, { quoted: msg })

            // flag optional (kalau nanti mau notif after restart)
            try {
                fs.writeFileSync(
                    path.join(process.cwd(), 'just_restarted.txt'),
                    Date.now().toString()
                )
            } catch {}

            // delay sebentar lalu exit
            setTimeout(() => {
                process.exit(0)
            }, 1500)
        })
    }
}
