const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// Simple file serving
function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (pathname === '/' || pathname === '/index.html') {
        serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
    } else if (pathname === '/style.css') {
        serveFile(res, path.join(__dirname, 'public', 'style.css'), 'text/css');
    } else if (pathname === '/game.js') {
        serveFile(res, path.join(__dirname, 'public', 'simple-game.js'), 'application/javascript');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Simple Quest server running on http://localhost:${PORT}`);
    console.log('Note: This is a simplified version without real-time multiplayer');
    console.log('For full multiplayer experience, install dependencies with: npm install');
});