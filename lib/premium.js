const { updateUser } = require('./user')

function isPremium(user, jid) {
    if (!user.premium?.status) return false

    // kalau tidak ada expired (lifetime)
    if (!user.premium.expired) return true

    const now = Date.now()
    const expiredTime = new Date(user.premium.expired).getTime()

    // EXPIRED
    if (now > expiredTime) {
        updateUser(jid, {
            premium: {
                status: false,
                expired: null,
                plan: null
            }
        })
        return false
    }

    return true
}

module.exports = { isPremium }
