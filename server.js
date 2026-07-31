const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 5173;
const DATA_FILE = path.join(__dirname, 'data.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const EMPTY_DATA = { records: [], operators: [], retailers: [] };

function readData() {
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        return {
            records: Array.isArray(parsed.records) ? parsed.records : [],
            operators: Array.isArray(parsed.operators) ? parsed.operators : [],
            retailers: Array.isArray(parsed.retailers) ? parsed.retailers : []
        };
    } catch (err) {
        return { ...EMPTY_DATA };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Last-write-wins merge on `updatedAt`, so desktop aur mobile dono taraf ke
// changes bina kisi ek device ka data mitaye combine ho jate hain.
function mergeLists(serverList, clientList) {
    const merged = new Map();
    serverList.forEach(item => item && item.id && merged.set(item.id, item));

    clientList.forEach(item => {
        if (!item || !item.id) return;
        const existing = merged.get(item.id);
        if (!existing) {
            merged.set(item.id, item);
            return;
        }
        const existingTime = Date.parse(existing.updatedAt || existing.timestamp || 0) || 0;
        const incomingTime = Date.parse(item.updatedAt || item.timestamp || 0) || 0;
        if (incomingTime >= existingTime) merged.set(item.id, item);
    });

    return Array.from(merged.values());
}

function getNetworkUrls() {
    const urls = [`http://localhost:${PORT}`];
    Object.values(os.networkInterfaces()).forEach(list => {
        (list || []).forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                urls.push(`http://${iface.address}:${PORT}`);
            }
        });
    });
    return urls;
}

function sendJSON(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end(JSON.stringify(payload), 'utf-8');
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') return sendJSON(res, 204, {});

    if (req.url === '/api/info') {
        return sendJSON(res, 200, { port: PORT, urls: getNetworkUrls() });
    }

    if (req.url === '/api/data' && req.method === 'GET') {
        return sendJSON(res, 200, readData());
    }

    if (req.url === '/api/sync' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 20 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
            let incoming;
            try {
                incoming = JSON.parse(body || '{}');
            } catch (err) {
                return sendJSON(res, 400, { error: 'Invalid JSON' });
            }

            const serverData = readData();
            const merged = {
                records: mergeLists(serverData.records, incoming.records || []),
                operators: mergeLists(serverData.operators, incoming.operators || []),
                retailers: mergeLists(serverData.retailers, incoming.retailers || [])
            };

            try {
                writeData(merged);
            } catch (err) {
                return sendJSON(res, 500, { error: 'Data file write failed: ' + err.code });
            }
            sendJSON(res, 200, merged);
        });
        return;
    }

    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Aadhaar Tracker Portal is running successfully!`);
    getNetworkUrls().forEach((url, i) => {
        console.log(`👉 ${i === 0 ? 'Local Desktop URL ' : 'Mobile/Network URL'}: ${url}`);
    });
    console.log(`💾 Shared data file    : ${DATA_FILE}`);
    console.log(`====================================================`);
});
