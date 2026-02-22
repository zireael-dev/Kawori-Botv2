const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'database', 'users.json')

function ensureDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        fs.writeFileSync(DB_PATH, '{}')
    }
}

function loadDB() {
    ensureDB()
    return JSON.parse(fs.readFileSync(DB_PATH))
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function getUser(jid, name = 'User') {
    const db = loadDB()

    if (!db[jid]) {
        db[jid] = {
            id: jid,
            name,
            limit: 5,          // limit harian free
            used: 0,
            lastReset: new Date().toISOString().slice(0, 10),
            premium: {
                status: false,
                expired: null,
                plan: null
            }
        }
        saveDB(db)
    }

    return db[jid]
}

function updateUser(jid, data) {
    const db = loadDB()
    db[jid] = { ...db[jid], ...data }
    saveDB(db)
}

module.exports = {
    getUser,
    updateUser
}
