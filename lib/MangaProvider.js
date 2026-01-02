const { firefox } = require('playwright');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const BASE_URL = 'https://mangabuddy.com'; 

// User Agent Firefox agar terlihat seperti PC biasa
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0';

const MangaProvider = {
    
    // --- 1. SEARCH MANGABUDDY ---
    search: async (keyword) => {
        console.log(`🔍 [MangaBuddy] Searching: ${keyword}`);
        
        const browser = await firefox.launch({ headless: true });
        
        try {
            const context = await browser.newContext({
                userAgent: USER_AGENT,
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: {
                    'Referer': BASE_URL,
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            const page = await context.newPage();
            
            // Format URL MangaBuddy: /search?q=chainsaw+man
            const query = keyword.trim().replace(/\s+/g, '+');
            const url = `${BASE_URL}/search?q=${query}`;
            
            console.log(`➡️  Mengakses: ${url}`);
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // --- SMART WAIT (Tunggu hasil muncul) ---
            try {
                console.log("⏳ Menunggu hasil pencarian...");
                // Selector umum hasil search MangaBuddy
                await page.waitForSelector('.book-detailed-item, .list-story-item, .item', { timeout: 20000 });
            } catch (e) {
                console.log("⚠️ Timeout menunggu selector hasil. Cek logs judul halaman.");
            }

            const title = await page.title();
            console.log(`📄 Judul Halaman: "${title}"`);

            // Scrape Data
            const results = await page.evaluate(() => {
                // Coba beberapa kemungkinan selector MangaBuddy
                let items = document.querySelectorAll('.book-detailed-item'); // Layout baru
                if (!items.length) items = document.querySelectorAll('.list-story-item'); // Layout lama
                if (!items.length) items = document.querySelectorAll('.item'); // Fallback

                return Array.from(items).map(item => {
                    const titleEl = item.querySelector('a.title, .item-title, h3 a');
                    const imgEl = item.querySelector('img');
                    const chapterEl = item.querySelector('.chapter, .item-chapter');

                    return {
                        title: titleEl ? titleEl.innerText.trim() : 'No Title',
                        url: titleEl ? titleEl.href : null,
                        thumb: imgEl ? (imgEl.dataset.src || imgEl.src) : null,
                        latest: chapterEl ? chapterEl.innerText.trim() : '-'
                    };
                }).filter(r => r.url); // Hapus hasil kosong
            });

            console.log(`✅ Ditemukan ${results.length} hasil.`);
            await browser.close();
            return results;

        } catch (error) {
            console.error("❌ Search Error:", error.message);
            await browser.close();
            return [];
        }
    },

    // --- 2. GET CHAPTER LIST ---
    getChapters: async (mangaUrl) => {
        const browser = await firefox.launch({ headless: true });

        try {
            const context = await browser.newContext({ userAgent: USER_AGENT });
            const page = await context.newPage();
            
            await page.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Tunggu list chapter muncul
            try {
                await page.waitForSelector('#chapter-list, .chapter-list', { timeout: 15000 });
            } catch (e) {}

            const chapters = await page.evaluate(() => {
                // Selector khusus MangaBuddy (biasanya di dalam ul#chapter-list)
                const list = document.querySelectorAll('#chapter-list li a, .chapter-list li a');
                return Array.from(list).map(link => ({
                    title: link.innerText.trim(), // Contoh: "Chapter 224"
                    url: link.href
                }));
            });

            await browser.close();
            return chapters;

        } catch (error) {
            console.error("❌ Get Chapters Error:", error.message);
            await browser.close();
            return [];
        }
    },

    // --- 3. DOWNLOAD PDF ---
    downloadChapter: async (chapterUrl, outputFilename) => {
        console.log(`🚀 Download PDF: ${chapterUrl}`);
        const browser = await firefox.launch({ headless: true });
        
        try {
            const context = await browser.newContext({ 
                userAgent: USER_AGENT,
                extraHTTPHeaders: { 'Referer': BASE_URL } 
            });
            const page = await context.newPage();

            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Tunggu gambar (Selector MangaBuddy: #chapter-images img)
            try {
                await page.waitForSelector('#chapter-images img, .chapter-content img', { timeout: 30000 });
            } catch (e) {
                console.log("⚠️ Gambar tidak muncul otomatis dalam 30 detik.");
            }

            // Auto Scroll (Penting untuk trigger lazy load)
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 200;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            
            await page.waitForTimeout(4000); // Tunggu render akhir

            const imageUrls = await page.evaluate(() => {
                // Selector gambar MangaBuddy
                const container = document.querySelector('#chapter-images') || document.querySelector('.chapter-content');
                if (!container) return [];
                
                return Array.from(container.querySelectorAll('img')).map(img => {
                    // Cek data-src dulu karena lazy load
                    return img.dataset.src || img.src;
                }).filter(url => url && !url.includes('loading')); // Filter url kosong/icon loading
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan.");

            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

            console.log(`⬇️  Mengambil ${imageUrls.length} gambar...`);

            for (let i = 0; i < imageUrls.length; i++) {
                const base64Data = await page.evaluate(async (url) => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const bitmap = await createImageBitmap(blob);
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = bitmap.width;
                        canvas.height = bitmap.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(bitmap, 0, 0);
                        return canvas.toDataURL('image/jpeg', 0.85);
                    } catch (e) { return null; }
                }, imageUrls[i]);

                if (base64Data) {
                    const imgBuffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                    doc.addPage({ size: 'A4' });
                    doc.image(imgBuffer, 0, 0, { width: 595.28 });
                }
            }

            doc.end();
            await browser.close();

            return new Promise((resolve) => {
                writeStream.on('finish', () => resolve(outputFilename));
                writeStream.on('error', () => resolve(null));
            });

        } catch (error) {
            console.error("\n❌ Download Error:", error.message);
            await browser.close();
            return null;
        }
    }
};

module.exports = MangaProvider;
