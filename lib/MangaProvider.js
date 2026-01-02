const { firefox } = require('playwright'); // Kita pakai Firefox, biasanya lebih tembus
const PDFDocument = require('pdfkit');
const fs = require('fs');

const BASE_URL = 'https://www.mangabats.com'; 

// User Agent Firefox Windows (Biar dikira PC Gaming, bukan Server)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0';

const MangaProvider = {
    
    // --- 1. SEARCH ---
    search: async (keyword) => {
        console.log(`🔍 [Playwright] Searching: ${keyword}`);
        
        const browser = await firefox.launch({ 
            headless: true // Playwright headless sangat stabil, tidak akan macet
        });
        
        try {
            // Buat Context dengan User Agent & Screen size PC
            const context = await browser.newContext({
                userAgent: USER_AGENT,
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: {
                    'Referer': 'https://www.google.com/', // Pura-pura dari Google
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });

            const page = await context.newPage();
            
            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `${BASE_URL}/search/story/${query}`;
            
            console.log(`➡️  Mengakses: ${url}`);
            
            // Tunggu load (domcontentloaded biasanya cukup)
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Cek Title
            const title = await page.title();
            console.log(`📄 Page Title: "${title}"`);

            if (title.includes("Just a moment") || title.includes("Cloudflare")) {
                console.log("⏳ Kena Cloudflare. Menunggu 6 detik...");
                await page.waitForTimeout(6000); // Playwright punya built-in wait
            }

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
                extraHTTPHeaders: { 'Referer': 'https://mangabats.com/' } // Referer PENTING
            });
            const page = await context.newPage();

            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Auto Scroll (Playwright Style)
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
            
            await page.waitForTimeout(4000); // Tunggu gambar render

            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan/Kena Blokir.");

            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

            console.log(`⬇️  Mengambil ${imageUrls.length} gambar...`);

            for (let i = 0; i < imageUrls.length; i++) {
                // Fetch & Convert di dalam Browser
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
