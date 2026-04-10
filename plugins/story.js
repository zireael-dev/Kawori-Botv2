// Kita tidak butuh module eksternal, cukup pakai fetch bawaan Node.js
const cohereApiKey = '9h0Ia5qSQpS9YHYJIunYc7G1ANbJqbFqnlpARpaf'
const cohereUrl = 'https://api.cohere.com/compatibility/v1/chat/completions/'

// Memori sesi sekarang akan menyimpan array history pesan
const userSessions = {}

module.exports = {
    name: 'cohere-interactive-story',
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
            // Perhatikan: aiChat diganti jadi array 'history'
            userSessions[from] = { state: 'PILIH_GENRE', genre: '', mcName: '', history: [] }

            return sock.sendMessage(from, {    
                interactiveMessage: {      
                    title: "✨ KAWORIBOT ROLEPLAY ✨",      
                    footer: "Powered by Cohere Command R",      
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

                const systemInstruction = `
Kamu adalah partner Roleplay/Game Master.
Dunia: ${session.genre}. Pemain (MC): ${session.mcName}.

Gaya Penulisan & Aturan RP (PENTING):
1. Menulis layaknya RP di Janitor AI. Fokus pada interaksi karakter (NPC), dialog yang natural, bahasa tubuh, dan emosi yang mendalam.
2. JANGAN kaku. Gunakan deskripsi yang ekspresif. Jika ada unsur romance/flirting dari MC, balas dengan dinamis.
3. Buat NPC terasa hidup, punya nama, dan punya motif sendiri.
4. Jaga batasan SFW (Aman).
5. Panjang cerita maksimal 2-3 paragraf pendek agar nyaman dibaca di WhatsApp.
6. Beri 3 pilihan aksi (A/B/C) di akhir pesan untuk memandu, tapi beri kebebasan pemain untuk membalas dengan ketikan sendiri.`

                // Memasukkan System Prompt dan Pesan Pertama User ke dalam array memory
                session.history = [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `Halo, aku ${session.mcName}. Tolong buatkan narasi pembuka yang interaktif, perkenalkan satu NPC yang langsung berinteraksi denganku, dan berikan aku 3 pilihan tindakan pertama.` }
                ]

                try {
                    const response = await fetch(cohereUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${cohereApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: "command-a-03-2025", // Model Cohere yang paling cocok untuk Roleplay
                            messages: session.history,
                            temperature: 0.8
                        })
                    })

                    const data = await response.json()
                    
                    if (!data.choices) throw new Error(JSON.stringify(data))

                    const aiReply = data.choices[0].message.content
                    
                    // Simpan balasan AI ke dalam memori agar ceritanya nyambung
                    session.history.push({ role: "assistant", content: aiReply })

                    return sock.sendMessage(from, { text: aiReply }, { quoted: msg })
                } catch (error) {
                    console.error('🔥 Error Cohere Start:', error)
                    delete userSessions[from]
                    return sock.sendMessage(from, { text: 'Gagal memulai server cerita. Coba lagi.' }, { quoted: msg })
                }
            }

            // TAHAP 4: LOOPING GAMEPLAY
            if (session.state === 'BERMAIN') {
                if (!text.trim() || command.match(/^[.!/]/i)) return 

                await sock.sendMessage(from, { text: '⏳ _Mengetik balasan..._' }, { quoted: msg })
                
                // Tambahkan pesan balasan user yang baru ke dalam memori
                session.history.push({ role: "user", content: text.trim() })

                try {
                    const response = await fetch(cohereUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${cohereApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: "command-a-03-2025",
                            messages: session.history, // Mengirim seluruh riwayat percakapan dari awal
                            temperature: 0.8
                        })
                    })

                    const data = await response.json()
                    
                    if (!data.choices) throw new Error(JSON.stringify(data))

                    const aiReply = data.choices[0].message.content

                    // Simpan lagi balasan AI yang baru ke dalam memori
                    session.history.push({ role: "assistant", content: aiReply })

                    return sock.sendMessage(from, { text: aiReply }, { quoted: msg })
                } catch (error) {
                    console.error('🔥 Error Cohere Story:', error)
                    // Jika error, hapus pesan user terakhir dari memori agar tidak bentrok saat mencoba lagi
                    session.history.pop() 
                    return sock.sendMessage(from, { text: 'Terjadi anomali dimensi. Coba kirim ulang aksimu.' }, { quoted: msg })
                }
            }
        }
    }
}
