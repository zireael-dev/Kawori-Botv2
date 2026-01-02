// lib/MangaProvider.js (V4 - Stealth Mode)

// GUNAKAN PUPPETEER-EXTRA (Bukan puppeteer biasa)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Aktifkan Mode Siluman
puppeteer.use(StealthPlugin());

// User Agent yang sangat mirip manusia
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const MangaProvider = {
    
    // --- 1. SEARCH ---
    search: async (keyword) => {
        console.log(`🔍 [STEALTH] Searching: ${keyword}`);
        
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled' // Sembunyikan status bot
            ] 
        });
        
        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            
            // Mengelabui deteksi viewport
            await page.setViewport({ width: 1280, height: 800 });

            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `https://www.mangabats.com/search/story/${query}`;
            
            // Timeout panjang karena Cloudflare butuh waktu redirect
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // TRIK: Tunggu sebentar (5-8 detik) untuk membiarkan Cloudflare selesai checking
            // Jika judul masih "Just a moment", kita tunggu redirectnya
            console.log("⏳ Menunggu Cloudflare checking...");
            await new Promise(r => setTimeout(r, 6000));

            // Cek Judul Setelah Menunggu
            const pageTitle = await page.title();
            console.log(`📄 Judul Akhir: "${pageTitle}"`);

            if (pageTitle.includes("Just a moment") || pageTitle.includes("Access denied")) {
                console.log("❌ Masih terblokir Cloudflare. Coba lagi nanti.");
                await browser.close();
                return [];
            }

            // Ambil data
            const results = await page.evaluate(() => {
                let items = document.querySelectorAll('.list-story-item');
                if (items.length === 0) items = document.querySelectorAll('.panel-search-story .search-story-item');
                
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

    // --- 2. GET CHAPTERS ---
    getChapters: async (mangaUrl) => {
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Tunggu Cloudflare lagi kalau kena
            await new Promise(r => setTimeout(r, 4000));

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
        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-web-security', 
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage'
            ]
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Scroll & Tunggu
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 50);
                });
            });
            
            // Tunggu render
            await new Promise(r => setTimeout(r, 3000));

            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan.");

            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

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
                        return canvas.toDataURL('image/jpeg', 0.80);
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
