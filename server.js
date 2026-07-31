const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 5173;
const DATA_FILE = path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL || '';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const KINDS = ['records', 'operators', 'retailers'];

function emptyData() {
    return { records: [], operators: [], retailers: [] };
}

// Last-write-wins merge on `updatedAt`, so desktop aur mobile dono taraf ke
// changes bina kisi ek device ka data mitaye combine ho jate hain.
function itemTime(item) {
    return Date.parse((item && (item.updatedAt || item.timestamp)) || 0) || 0;
}

function mergeLists(serverList, clientList) {
    const merged = new Map();
    serverList.forEach(item => item && item.id && merged.set(item.id, item));

    clientList.forEach(item => {
        if (!item || !item.id) return;
        const existing = merged.get(item.id);
        if (!existing || itemTime(item) >= itemTime(existing)) merged.set(item.id, item);
    });

    return Array.from(merged.values());
}

// --- Storage drivers -------------------------------------------------------
// Cloud par SQL (Postgres) use hota hai taki kisi bhi mobile se, kahin se bhi
// data mile. Local desktop par bina kisi install ke JSON file chalti hai.

function createFileStore() {
    function readData() {
        try {
            const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            const data = emptyData();
            KINDS.forEach(kind => {
                if (Array.isArray(parsed[kind])) data[kind] = parsed[kind];
            });
            return data;
        } catch (err) {
            return emptyData();
        }
    }

    return {
        name: 'json-file',
        location: DATA_FILE,
        async init() {},
        async getAll() {
            return readData();
        },
        async merge(incoming) {
            const current = readData();
            const merged = emptyData();
            KINDS.forEach(kind => {
                merged[kind] = mergeLists(current[kind], incoming[kind] || []);
            });
            fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
            return merged;
        }
    };
}

function createPostgresStore() {
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 5
    });

    return {
        name: 'postgres',
        location: DATABASE_URL.replace(/:[^:@/]*@/, ':****@'),
        async init() {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS aadhaar_items (
                    kind TEXT NOT NULL,
                    id TEXT NOT NULL,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (kind, id)
                )
            `);
        },
        async getAll() {
            const data = emptyData();
            const { rows } = await pool.query('SELECT kind, data FROM aadhaar_items');
            rows.forEach(row => {
                if (data[row.kind]) data[row.kind].push(row.data);
            });
            return data;
        },
        async merge(incoming) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const kind of KINDS) {
                    for (const item of incoming[kind] || []) {
                        if (!item || !item.id) continue;
                        const stamp = new Date(itemTime(item) || Date.now()).toISOString();
                        await client.query(
                            `INSERT INTO aadhaar_items (kind, id, data, updated_at)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (kind, id) DO UPDATE
                               SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
                               WHERE aadhaar_items.updated_at <= EXCLUDED.updated_at`,
                            [kind, item.id, JSON.stringify(item), stamp]
                        );
                    }
                }
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
            return this.getAll();
        }
    };
}

const store = DATABASE_URL ? createPostgresStore() : createFileStore();

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

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 20 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return sendJSON(res, 204, {});

    try {
        if (req.url === '/api/info') {
            return sendJSON(res, 200, { port: PORT, urls: getNetworkUrls(), storage: store.name });
        }

        if (req.url === '/api/health') {
            await store.getAll();
            return sendJSON(res, 200, { ok: true, storage: store.name });
        }

        if (req.url === '/api/data' && req.method === 'GET') {
            return sendJSON(res, 200, await store.getAll());
        }

        if (req.url === '/api/sync' && req.method === 'POST') {
            const incoming = await readBody(req);
            return sendJSON(res, 200, await store.merge(incoming));
        }
    } catch (err) {
        return sendJSON(res, err.message === 'Invalid JSON' ? 400 : 500, { error: err.message });
    }

    const safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(__dirname, safePath === '/' ? 'index.html' : safePath);
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

store.init()
    .then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log('====================================================');
            console.log('🚀 Aadhaar Tracker Portal is running successfully!');
            getNetworkUrls().forEach((url, i) => {
                console.log(`👉 ${i === 0 ? 'Local Desktop URL ' : 'Mobile/Network URL'}: ${url}`);
            });
            console.log(`💾 Storage             : ${store.name} (${store.location})`);
            console.log('====================================================');
        });
    })
    .catch(err => {
        console.error('Storage init failed:', err.message);
        process.exit(1);
    });
