const { config, createAudioFromText } = require('tiktok-tts')
const fs = require('fs')
const path = require('path')

// Masukkan sessionid TikTok kamu
config('a7208223c705b88d269d6cdca5745b7d')

// Daftar pintasan (alias) untuk mempermudah user memilih suara
// Kamu bisa menambah atau mengubah kata kuncinya sesuka hati
const voiceMap = {
    'id': 'id_001',          // Indonesia - Cewek
    'en': 'en_us_001',       // Inggris (US) - Cewek
    'enc': 'en_male_narration', // Inggris (US) - Cowok (Story Teller)
    'jp': 'jp_001',          // Jepang - Cewek
    'jpc': 'jp_male_keiichinakano', // Jepang - Cowok (Morio's Kitchen)
    'kr': 'kr_003',          // Korea - Cewek
    'br': 'br_001',          // Brazil / Portugis
    'es': 'es_002'           // Spanyol
}

module.exports = {
    name: 'tiktok-tts-steve',
    onMessage: async (sock, msg, store) => {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        const [command, ...args] = text.split(' ')

        if (!command.match(/^[.!/](tts|suara)$/i)) return

        const from = msg.key.remoteJid

        if (args.length === 0) {
            return sock.sendMessage(from, { 
                text: `*Cara Penggunaan:*\n.tts [kode_suara] [teks]\n\n*Daftar Kode Suara:*\n- id (Indonesia)\n- en (Inggris Cewek)\n- enc (Inggris Cowok)\n- jp (Jepang Cewek)\n- jpc (Jepang Cowok)\n- kr (Korea)\n\n*Contoh:*\n.tts jp Ohayou gozaimasu!` 
            }, { quoted: msg })
        }

        let speaker = 'id_001' // Default suara jika user tidak memasukkan kode
        let textToSpeak = args.join(' ')

        // Mengecek apakah kata pertama yang diketik user ada di dalam daftar voiceMap
        const firstWord = args[0].toLowerCase()
        if (voiceMap[firstWord]) {
            speaker = voiceMap[firstWord] // Ubah suara sesuai pilihan user
            textToSpeak = args.slice(1).join(' ') // Buang kata pertama (kode suara) dari teks yang akan dibaca
        }

        // Cek lagi apakah setelah kode suara dihapus, teksnya masih ada?
        if (!textToSpeak.trim()) {
            return sock.sendMessage(from, { 
                text: 'Teksnya mana yang mau dibacakan?' 
            }, { quoted: msg })
        }

        try {
            const fileName = `tts_${Date.now()}`
            const filePathNoExt = path.join(__dirname, fileName) 
            const filePathFull = `${filePathNoExt}.mp3`

            // Generate suara berdasarkan pilihan speaker
            await createAudioFromText(textToSpeak, filePathNoExt, speaker)

            await sock.sendMessage(from, { 
                audio: { url: filePathFull }, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg })

            // Bersihkan file setelah terkirim
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
