const { firefox } = require('playwright');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const BASE_URL = 'https://www.mangabats.com'; 

// User Agent Firefox Windows (Supaya dikira PC)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0';

const MangaProvider = {
    
    // --- 1. SEARCH DENGAN SMART WAIT ---
    search: async (keyword) => {
        console.log(`🔍 [Playwright V7] Searching: ${keyword}`);
        
        const browser = await firefox.launch({ headless: true });
        
        try {
            const context = await browser.newContext({
                userAgent: USER_AGENT,
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: {
                    'Referer': 'https://www.google.com/',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            const page = await context.newPage();
            
            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `${BASE_URL}/search/story/${query}`;
            
            console.log(`➡️  Mengakses: ${url}`);
            
            // Timeout dinaikkan jadi 60 detik
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // --- LOGIKA BARU: TUNGGU SAMPAI LOLOS ---
            try {
                console.log("⏳ Sedang menunggu Cloudflare redirect (Maks 30 detik)...");
                
                // Bot akan DIAM di sini sampai elemen '.list-story-item' muncul
                // Kalau dalam 30 detik tidak muncul, dia baru error.
                await page.waitForSelector('.list-story-item, .panel-search-story', { timeout: 30000 });
                
                console.log("🔓 Lolos! Halaman manga terdeteksi.");
            } catch (e) {
                console.log("⚠️ Waktu habis! Masih tertahan atau halaman kosong.");
            }

            // Cek Judul Akhir (Untuk Debugging)
            const title = await page.title();
            console.log(`📄 Judul Akhir: "${title}"`);

            // Scrape Data
            const results = await page.evaluate(() => {
                let items = document.querySelectorAll('.list-story-item');
                if (!items.length) items = document.querySelectorAll('.panel-search-story .search-story-item');

                return Array.from(items).map(item => {
                    const titleEl = item.querySelector('.item-title') || item.querySelector('a.item-title');
                    const imgEl = item.querySelector('.item-img') || item.querySelector('img');
                    const chapterEl = item.querySelector('.item-chapter') || item.querySelector('.item-chapter a');

                    return {
                        title: titleEl ? titleEl.innerText : 'No Title',
                        url: titleEl ? titleEl.href : null,
                        thumb: imgEl ? imgEl.src : null,
                        latest: chapterEl ? chapterEl.innerText : '-'
                    };
                });
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
            
            // Smart Wait juga di sini
            try {
                await page.waitForSelector('.row-content-chapter', { timeout: 20000 });
            } catch (e) {}

            const chapters = await page.evaluate(() => {
                const list = document.querySelectorAll('.row-content-chapter li a');
                return Array.from(list).map(link => ({
                    title: link.innerText,
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
                extraHTTPHeaders: { 'Referer': 'https://mangabats.com/' }
            });
            const page = await context.newPage();

            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Tunggu container gambar muncul (Maks 30 detik)
            try {
                await page.waitForSelector('.container-chapter-reader img, .reading-content img', { timeout: 30000 });
            } catch (e) {
                console.log("⚠️ Gambar tidak muncul dalam 30 detik.");
            }

            // Auto Scroll
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
            
            await page.waitForTimeout(3000); // Tunggu render akhir

            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan (Kena Blokir/Kosong).");

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
