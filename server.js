const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;

const ALLOWED_ORIGINS = [
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

const MAX_REQUEST_SIZE = 10 * 1024 * 1024;
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;

const requestCounts = new Map();

function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const clientData = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    
    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    
    clientData.count++;
    requestCounts.set(ip, clientData);
    
    return clientData.count <= RATE_LIMIT_MAX_REQUESTS;
}

function logRequest(req, res, statusCode) {
    const ip = getClientIP(req);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${ip} ${req.method} ${req.url} ${statusCode}`);
}

function isPathSafe(requestedPath, rootDir) {
    const resolvedPath = path.resolve(rootDir, requestedPath);
    const resolvedRoot = path.resolve(rootDir);
    return resolvedPath.startsWith(resolvedRoot);
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const clientIP = getClientIP(req);
    
    if (!checkRateLimit(clientIP)) {
        logRequest(req, res, 429);
        res.writeHead(429, { 'Content-Type': 'text/plain' });
        res.end('Too Many Requests');
        return;
    }

    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self';");

    if (req.method === 'OPTIONS') {
        logRequest(req, res, 200);
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    if (!isPathSafe(filePath, '.')) {
        logRequest(req, res, 403);
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 - 禁止访问</h1>');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                logRequest(req, res, 404);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - 文件未找到</h1>');
            } else {
                logRequest(req, res, 500);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - 服务器错误</h1>');
            }
        } else {
            logRequest(req, res, 200);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.on('connection', (socket) => {
    socket.setTimeout(30000);
});

server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';
    
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ip = iface.address;
                break;
            }
        }
    }
    
    console.log('========================================');
    console.log('🚀 拼豆计时器服务器已启动！');
    console.log('========================================');
    console.log(`📱 本地访问: http://localhost:${PORT}`);
    console.log(`🌐 局域网访问: http://${ip}:${PORT}`);
    console.log('========================================');
    console.log('🔒 安全特性已启用:');
    console.log('   - 路径遍历防护');
    console.log('   - CORS限制');
    console.log('   - 安全响应头');
    console.log('   - 请求速率限制');
    console.log('   - 连接超时保护');
    console.log('========================================');
    console.log('按 Ctrl+C 停止服务器');
    console.log('========================================');
});
