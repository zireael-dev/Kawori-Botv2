const { GoogleGenAI } = require('@google/genai')

const ai = new GoogleGenAI({ apiKey: 'AIzaSyAa82Qqp_jBS2V7FUH6ZSTjLHN-Ui_hBk0' })
const userSessions = {}

module.exports = {
    name: 'ai-interactive-story',
    onMessage: async (sock, msg, store) => {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        
        // Menangkap balasan dari tombol Interactive
        if (msg.message?.interactiveResponseMessage) {
            try {
                const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
                text = params.id 
            } catch (e) {
                console.error("Gagal membaca respons tombol", e)
            }
        }

        const [command, ...args] = text.split(' ')
        const from = msg.key.remoteJid
        const userMessage = args.join(' ')

        if (text.toLowerCase() === '.story reset') {
            if (userSessions[from]) {
                delete userSessions[from]
                return sock.sendMessage(from, { text: '🔄 _Sesi permainan diakhiri. Ketik .story untuk mulai baru._' }, { quoted: msg })
            }
            return
        }

        // TAHAP 1: MENGIRIM MENU INTERAKTIF
        if (!userSessions[from] && command.match(/^[.!/](story|main)$/i)) {
            userSessions[from] = { state: 'PILIH_GENRE', genre: '', mcName: '', aiChat: null }

            return sock.sendMessage(from, {    
                interactiveMessage: {      
                    title: "✨ KAWORIBOT ROLEPLAY ✨",      
                    footer: "Pilih dunia tempat ceritamu dimulai!",      
                    nativeFlowMessage: {        
                        buttons: [          
                            {            
                                name: "single_select",            
                                buttonParamsJson: JSON.stringify({              
                                    title: "Pilih Dunia (Klik Disini)",              
                                    sections: [                
                                        {                  
                                            title: "🔥 Action & Petualangan",                  
                                            rows: [                    
                                                { title: "Isekai Fantasy", description: "Sihir, guild, dan petualangan", id: "genre_1" },
                                                { title: "Cyberpunk City", description: "Distopia, hacker, aksi", id: "genre_2" },
                                                { title: "Zombie Apocalypse", description: "Bertahan hidup dari wabah", id: "genre_3" },
                                            ]                
                                        },
                                        {                  
                                            title: "💖 Drama & Romance",                  
                                            rows: [                    
                                                { title: "Slice of Life / Real Life", description: "Kampus/Kantor, romance, santai", id: "genre_4" },
                                                { title: "Royal Romance", description: "Drama kerajaan, pangeran/putri", id: "genre_5" },
                                                { title: "Supernatural Modern", description: "Vampir, iblis di dunia manusia", id: "genre_6" },
                                            ]                
                                        },
                                        {                  
                                            title: "🕵️‍♂️ Misteri & Sci-Fi",                  
                                            rows: [                    
                                                { title: "Detektif Noir", description: "Pecahkan kasus pembunuhan", id: "genre_7" },
                                                { title: "Sci-Fi Space", description: "Jelajahi galaksi antar bintang", id: "genre_8" }
                                            ]                
                                        }
                                    ]            
                                })          
                            }        
                        ]      
                    }    
                }  
            }, { quoted: msg })
        }

        if (userSessions[from]) {
            const session = userSessions[from]

            // TAHAP 2: MENERIMA BALASAN GENRE
            if (session.state === 'PILIH_GENRE') {
                const daftarGenre = {
                    'genre_1': 'Fantasi Isekai dengan sistem Guild, sihir, dan monster',
                    'genre_2': 'Kota Cyberpunk futuristik yang gelap dan penuh intrik',
                    'genre_3': 'Kiamat Zombie yang menegangkan',
                    'genre_4': 'Kehidupan nyata (Real Life) di masa kini, berfokus pada keseharian, pertemanan, dan romansa (kampus/kantor)',
                    'genre_5': 'Drama Kerajaan (Royal Romance) dengan intrik politik dan cinta',
                    'genre_6': 'Dunia modern namun ada mahluk gaib (Vampir/Werewolf/Iblis) yang hidup bersembunyi',
                    'genre_7': 'Misteri Detektif bergaya Noir',
                    'genre_8': 'Sci-Fi Penjelajahan Luar Angkasa'
                }

                if (!daftarGenre[text]) {
                    return sock.sendMessage(from, { text: '⚠️ _Silakan klik tombol "Pilih Dunia" pada pesan di atas._' }, { quoted: msg })
                }

                session.genre = daftarGenre[text]
                session.state = 'INPUT_NAMA' 
                
                return sock.sendMessage(from, { 
                    text: `✨ *Dunia ${session.genre} dipilih!*\n\nSekarang, ketik balas pesan ini dengan *Nama Karaktermu* (Pahlawan Utama).` 
                }, { quoted: msg })
            }

            // TAHAP 3: MENERIMA NAMA MC DAN MEMULAI AI
            if (session.state === 'INPUT_NAMA') {
                if (!text.trim()) return

                session.mcName = text.trim()
                session.state = 'BERMAIN'
                
                await sock.sendMessage(from, { text: `⏳ _Menyiapkan dunia untuk ${session.mcName}..._` }, { quoted: msg })

                // --- SYSTEM PROMPT BARU: GAYA JANITOR AI ---
                const systemInstruction = `
Kamu adalah partner Roleplay/Game Master.
Dunia: ${session.genre}. Pemain (MC): ${session.mcName}.

Gaya Penulisan & Aturan RP (PENTING):
1. Menulis layaknya RP di Janitor AI. Fokus pada interaksi karakter (NPC), dialog yang natural, bahasa tubuh, dan emosi yang mendalam.
2. JANGAN kaku. Gunakan deskripsi yang ekspresif. Jika ada unsur romance/flirting dari MC, balas dengan dinamis (tersipu, menggoda balik, atau menolak sesuai personality NPC).
3. Buat NPC terasa hidup, punya nama, dan punya motif sendiri.
4. Jaga batasan SFW (Aman). Boleh ada bumbu romance, ciuman, atau ketegangan emosional, tapi hindari konten eksplisit/NSFW.
5. Panjang cerita maksimal 2-3 paragraf pendek agar nyaman dibaca di WhatsApp.
6. Beri 3 pilihan aksi (A/B/C) di akhir pesan untuk memandu, tapi beri kebebasan pemain untuk membalas dengan ketikan sendiri.`

                try {
                    // Temperature dinaikkan ke 0.9 agar AI lebih kreatif dan luwes dalam berekspresi
                    session.aiChat = ai.chats.create({
                        model: 'gemini-2.0-flash',
                        config: { systemInstruction: systemInstruction, temperature: 0.9 }
                    })

                    const response = await session.aiChat.sendMessage({ message: `Halo, aku ${session.mcName}. Tolong buatkan narasi pembuka yang interaktif, perkenalkan satu NPC yang langsung berinteraksi denganku, dan berikan aku 3 pilihan tindakan pertama.` })
                    return sock.sendMessage(from, { text: response.text }, { quoted: msg })
                } catch (error) {
                    console.error('🔥 Error AI Start:', error)
                    delete userSessions[from]
                    return sock.sendMessage(from, { text: 'Gagal memulai server cerita. Coba lagi.' }, { quoted: msg })
                }
            }

            // TAHAP 4: LOOPING GAMEPLAY
            if (session.state === 'BERMAIN') {
                if (!text.trim() || command.match(/^[.!/]/i)) return 

                await sock.sendMessage(from, { text: '⏳ _Mengetik balasan..._' }, { quoted: msg })
                
                try {
                    // User bisa merespons seperti: "*Tersenyum menatap matanya* Aku tidak akan pergi."
                    const response = await session.aiChat.sendMessage({ message: text.trim() })
                    return sock.sendMessage(from, { text: response.text }, { quoted: msg })
                } catch (error) {
                    console.error('🔥 Error AI Story:', error)
                    return sock.sendMessage(from, { text: 'Terjadi anomali dimensi. Coba kirim ulang aksimu.' }, { quoted: msg })
                }
            }
        }
    }
}
