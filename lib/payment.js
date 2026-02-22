const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'database', 'payments.json')

function loadPayments() {
    if (!fs.existsSync(DB_PATH)) return {}
    return JSON.parse(fs.readFileSync(DB_PATH))
}

function savePayments(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

module.exports = {
    get(jid) {
        const db = loadPayments()
        return db[jid]
    },

    set(jid, data) {
        const db = loadPayments()
        db[jid] = data
        savePayments(db)
    },

    remove(jid) {
        const db = loadPayments()
        delete db[jid]
        savePayments(db)
    }
}
