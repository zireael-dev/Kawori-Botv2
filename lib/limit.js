const { getUser, updateUser } = require('./user')
const { isPremium } = require('./premium')

function resetIfNeeded(user) {
    const today = new Date().toISOString().slice(0, 10)
    if (user.lastReset !== today) {
        user.used = 0
        user.lastReset = today
    }
    return user
}

function checkLimit(jid, name) {
    let user = getUser(jid, name)
    user = resetIfNeeded(user)

    // PREMIUM = UNLIMITED
    if (isPremium(user)) {
        return { ok: true, user }
    }

    // FREE LIMIT
    if (user.used >= user.limit) {
        return { ok: false, user }
    }

    updateUser(jid, { used: user.used + 1 })
    return { ok: true, user }
}

module.exports = { checkLimit }
