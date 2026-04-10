const { config, createAudioFromText } = require('tiktok-tts')
const fs = require('fs')
const path = require('path')

// 1. Masukkan sessionid TikTok kamu di sini
// Cara dapatnya: Login tiktok.com di browser PC -> Inspect Element -> Application -> Cookies -> cari "sessionid"
config('a7208223c705b88d269d6cdca5745b7d')

module.exports = {
    name: 'tiktok-tts-steve',
    onMessage: async (sock, msg, store) => {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        const [command, ...args] = text.split(' ')

        // Trigger menggunakan .tts atau .suara
        if (!command.match(/^[.!/](tts|suara)$/i)) return

        const from = msg.key.remoteJid
        const textToSpeak = args.join(' ')

        if (!textToSpeak) {
            return sock.sendMessage(from, { 
                text: 'Ketik teks yang ingin diubah jadi suara!\nContoh: .tts Halo semuanya' 
            }, { quoted: msg })
        }

        try {
            // Membuat nama file yang unik berdasarkan waktu agar tidak bentrok jika dipakai bersamaan
            const fileName = `tts_${Date.now()}`
            const filePathNoExt = path.join(__dirname, fileName) 
            const filePathFull = `${filePathNoExt}.mp3` // Library otomatis menambahkan .mp3

            // Generate suara dengan kode 'id_001' (Suara TikTok wanita Indonesia)
            // Untuk bahasa lain bisa cek di repository: en_us_001 (Inggris), jp_001 (Jepang)
            await createAudioFromText(textToSpeak, filePathNoExt, 'id_001')

            // Kirim file mp3-nya ke WhatsApp sebagai Voice Note
            await sock.sendMessage(from, { 
                audio: { url: filePathFull }, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg })

            // PENTING: Bersihkan / Hapus file mp3 setelah sukses terkirim agar storage server aman
            if (fs.existsSync(filePathFull)) {
                fs.unlinkSync(filePathFull)
            }

        } catch (error) {
            console.error('🔥 Error TikTok TTS:', error)
            await sock.sendMessage(from, { 
                text: 'Gagal membuat suara. Pastikan teks tidak terlalu panjang atau Session ID TikTok valid.' 
            }, { quoted: msg })
        }
    }
}
