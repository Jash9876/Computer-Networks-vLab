// Authentication Utilities: JWT & Password Hashing
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('FATAL: JWT_SECRET environment variable is missing in production.');
        }
        return 'dev_secret_vlab_jwt_key_2026';
    }
    return secret;
}

const TOKEN_EXPIRY = '7d';

// Hash plaintext password with bcrypt
async function hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
}

// Compare candidate password with hash
async function comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
}

// Issue JWT Token
function generateToken(user) {
    const payload = {
        id: user.id,
        registerNumber: user.register_number,
        fullName: user.full_name,
        email: user.email,
        role: user.role, // 'student' | 'faculty' | 'admin'
        department: user.department,
        section: user.section
    };
    return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

// Verify JWT Token
function verifyToken(token) {
    try {
        return jwt.verify(token, getJwtSecret());
    } catch (err) {
        return null;
    }
}

// Extract session user from incoming request (Cookies or Authorization Header)
function getUserFromRequest(req) {
    let token = null;

    // 1. Check HTTP-only cookie
    if (req.headers.cookie) {
        const cookies = cookie.parse(req.headers.cookie);
        if (cookies.vlab_session) {
            token = cookies.vlab_session;
        }
    }

    // 2. Fallback to Authorization Header
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) return null;
    return verifyToken(token);
}

// Create Session Cookie Header
function createSessionCookie(token) {
    const isProduction = process.env.NODE_ENV === 'production';
    return cookie.serialize('vlab_session', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/'
    });
}

// Clear Session Cookie Header
function clearSessionCookie() {
    return cookie.serialize('vlab_session', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/'
    });
}

module.exports = {
    hashPassword,
    comparePassword,
    verifyPassword: comparePassword,
    generateToken,
    verifyToken,
    getUserFromRequest,
    extractUserFromRequest: getUserFromRequest,
    createSessionCookie,
    clearSessionCookie
};
