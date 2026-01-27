import http from 'http';

const PORT = 3333;

const server = http.createServer((req, res) => {
    // 设置 CORS 头，允许跨域调用
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Custom-Header');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. JSON 响应测试 (标准对象)
    if (req.method === 'POST' && req.url === '/upload') {
        setTimeout(() => {
            const responseData = {
                "code": 200,
                "msg": "成功",
                "data": [
                    {
                        "id": "json_id",
                        "url": `http://localhost:${PORT}/f/json_image.png`,
                        "thumb": `http://localhost:${PORT}/f/json_thumb.png`,
                        "delete": `http://localhost:${PORT}/del/json_id`
                    }
                ]
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
            console.log(`[POST /upload] Handled JSON upload`);
        }, 200);
        return;
    }

    // 1.1 JSON 响应测试 (直接返回对象 - 无嵌套)
    if (req.method === 'POST' && req.url === '/upload/flat') {
        const responseData = {
            "status": "success",
            "url": `http://localhost:${PORT}/f/flat_image.png`,
            "delete_url": `http://localhost:${PORT}/del/flat_id`
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
        console.log(`[POST /upload/flat] Handled Flat JSON upload`);
        return;
    }

    // 1.2 JSON 响应测试 (直接返回数组)
    if (req.method === 'POST' && req.url === '/upload/array') {
        const responseData = [
            {
                "name": "image.png",
                "src": `http://localhost:${PORT}/f/array_image.png`
            }
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
        console.log(`[POST /upload/array] Handled Array JSON upload`);
        return;
    }

    // 1.3 纯文本响应测试
    if (req.method === 'POST' && req.url === '/upload/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`http://localhost:${PORT}/f/text_image.png`);
        console.log(`[POST /upload/text] Handled Text upload`);
        return;
    }

    // 2. Binary (PUT) 上传测试
    if (req.method === 'PUT' && req.url?.startsWith('/binary/')) {
        const filename = req.url.split('/').pop() || 'unknown';
        // 简单接收流
        let bodySize = 0;
        req.on('data', chunk => {
            bodySize += chunk.length;
        });
        req.on('end', () => {
             const responseData = {
                "url": `http://localhost:${PORT}/oss/${filename}`,
                "size": bodySize
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
            console.log(`[PUT /binary/${filename}] Handled Binary upload, size=${bodySize}`);
        });
        return;
    }

    // 3. Regex (XML/Text) 响应测试
    if (req.method === 'POST' && req.url === '/upload/xml') {
        setTimeout(() => {
            const xmlResponse = `
                <response>
                    <status>success</status>
                    <url>http://localhost:${PORT}/xml/image_123.jpg</url>
                    <thumb>http://localhost:${PORT}/xml/thumb_123.jpg</thumb>
                    <delete_url>http://localhost:${PORT}/delete/123</delete_url>
                </response>
            `;
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end(xmlResponse);
            console.log(`[POST /upload/xml] Handled XML upload`);
        }, 200);
        return;
    }

    // 4. Magic Variables 测试
    // 验证 URL 参数替换
    if (req.method === 'POST' && req.url?.startsWith('/upload/magic')) {
        const urlObj = new URL(req.url, `http://localhost:${PORT}`);
        const year = urlObj.searchParams.get('year');
        const filename = urlObj.searchParams.get('filename');
        const customHeader = req.headers['x-custom-uuid'];
        
        const responseData = {
            "code": 200,
            "msg": "Magic Verified",
            "data": {
                // 回显接收到的变量，用于构建最终 URL
                "url": `http://localhost:${PORT}/magic/${year}/${filename || 'unknown'}.jpg`,
                "received_header": customHeader
            }
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
        console.log(`[POST /upload/magic] Magic upload: year=${year}, filename=${filename}`);
        return;
    }

    // 5. JSON (Base64) 上传测试
    if (req.method === 'POST' && req.url === '/upload/base64') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const jsonBody = JSON.parse(body);
                if (jsonBody.file && typeof jsonBody.file === 'string') {
                    const responseData = {
                        "code": 200,
                        "msg": "Base64 Upload Success",
                        "data": {
                            "url": `http://localhost:${PORT}/base64/image.png`,
                            "size": jsonBody.file.length
                        }
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(responseData));
                    console.log(`[POST /upload/base64] Handled Base64 upload, size=${jsonBody.file.length}`);
                } else {
                    throw new Error('Missing file field');
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ code: 400, msg: "Invalid JSON or missing file field" }));
            }
        });
        return;
    }

    // 6. Header Token Auth 测试
    if (req.method === 'POST' && req.url === '/upload/auth') {
        const auth = req.headers['authorization'];
        if (auth === 'Bearer test-token-123') {
             const responseData = {
                "success": true,
                "payload": {
                    "url": `http://localhost:${PORT}/auth/image.jpg`
                }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
            console.log(`[POST /upload/auth] Authorized upload success`);
        } else {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, msg: "Unauthorized" }));
            console.log(`[POST /upload/auth] Unauthorized: ${auth}`);
        }
        return;
    }
    

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Mock server running at http://localhost:${PORT}`);
    console.log(`- JSON Upload: POST /upload`);
    console.log(`- Binary Upload: PUT /binary/{filename}`);
    console.log(`- XML Upload: POST /upload/xml`);
    console.log(`- Magic Variables: POST /upload/magic?year={year}&filename={name}`);
    console.log(`- Base64 Upload: POST /upload/base64`);
    console.log(`- Auth Upload: POST /upload/auth (Requires 'Authorization: Bearer test-token-123')`);
});
