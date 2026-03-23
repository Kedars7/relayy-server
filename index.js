const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');


const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

const activeTunnels = {};
const pendingRequests = {};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

app.use((req, res) => {

    const parts = req.path.split('/');
    const tunnelId = parts[1];
    const safeTunnelId = escapeHtml(tunnelId || '(missing)');
    const safeMethod = escapeHtml(req.method);
    const safeOriginalUrl = escapeHtml(req.originalUrl);

    const socket = activeTunnels[tunnelId];
    if(!socket) {
        return res.status(404).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tunnel Not Found</title>
    <style>
        :root {
            --bg: #f5f7fb;
            --card: #ffffff;
            --text: #1f2937;
            --muted: #6b7280;
            --accent: #0ea5e9;
            --danger: #ef4444;
            --border: #e5e7eb;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--text);
            background: radial-gradient(circle at 20% 20%, #e0f2fe 0%, transparent 40%), var(--bg);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .card {
            width: 100%;
            max-width: 640px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
            overflow: hidden;
        }

        .header {
            padding: 18px 22px;
            background: linear-gradient(90deg, #fef2f2, #fff);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--danger);
            font-weight: 700;
        }

        .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--danger);
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15);
        }

        .content {
            padding: 22px;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 1.45rem;
            line-height: 1.25;
        }

        p {
            margin: 0 0 14px;
            color: var(--muted);
            line-height: 1.6;
        }

        .meta {
            margin-top: 16px;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px;
            background: #f8fafc;
            font-family: Consolas, "Courier New", monospace;
            font-size: 0.92rem;
            color: #0f172a;
        }

        .meta-row {
            display: flex;
            gap: 8px;
            padding: 4px 0;
            flex-wrap: wrap;
        }

        .label {
            color: var(--muted);
            min-width: 92px;
        }

        .value {
            font-weight: 600;
        }

        .footer {
            margin-top: 18px;
            font-size: 0.9rem;
            color: var(--muted);
        }

        code {
            background: #e0f2fe;
            color: #075985;
            padding: 2px 6px;
            border-radius: 6px;
        }
    </style>
</head>
<body>
    <main class="card" role="main" aria-live="polite">
        <div class="header">
            <span class="dot" aria-hidden="true"></span>
            Tunnel Not Found
        </div>
        <div class="content">
            <h1>We could not find an active tunnel for this URL.</h1>
            <p>
                The tunnel may have expired, disconnected, or the URL might be incorrect.
                Start a new tunnel from your client and try again.
            </p>

            <section class="meta" aria-label="Request details">
                <div class="meta-row">
                    <span class="label">Tunnel ID:</span>
                    <span class="value">${safeTunnelId}</span>
                </div>
                <div class="meta-row">
                    <span class="label">Method:</span>
                    <span class="value">${safeMethod}</span>
                </div>
                <div class="meta-row">
                    <span class="label">Requested Path:</span>
                    <span class="value">${safeOriginalUrl}</span>
                </div>
            </section>

            <p class="footer">Tip: ensure your client is connected and using the same tunnel ID shown in your terminal output.</p>
        </div>
    </main>
</body>
</html>`);
    }

    const requestId = uuidv4();
    pendingRequests[requestId] = res;

    const realPath = "/" + parts.slice(2).join('/');

    socket.send(
        JSON.stringify({
            type: "request",
            requestId: requestId,
            method: req.method,
            path: realPath,
            headers: req.headers,
            body: req.body
        })
    );
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 


const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if(data.type === "register") {

            const randomName = uniqueNamesGenerator({
                dictionaries: [adjectives, animals],
                separator: '-',
                length: 2
            })

            const suffix = Math.random().toString(16).slice(2, 6);

            const tunnelId = `${randomName}-${suffix}`;

            activeTunnels[tunnelId] = ws;

            ws.send(
                JSON.stringify({
                    type: "tunnel_created",
                    tunnelId,
                    expiry: Date.now() + 30 * 60 * 1000 // 30 minutes
                })
            )

            console.log(`Tunnel created with ID: ${tunnelId}`);

            setTimeout(() => {
                if(activeTunnels[tunnelId]) {
                    console.log(`Tunnel expired: ${tunnelId}`);

                    ws.send(JSON.stringify({
                        type: "tunnel_expired"
                    }));

                    ws.close();

                    delete activeTunnels[tunnelId];
                }
            }, 30 * 60 * 1000); // Expire after 30 minutes
        }
        else if(data.type === "response") {
            const res = pendingRequests[data.requestId];

            if(res) {
                res.status(data.status).send(data.body);

                delete pendingRequests[data.requestId];
            }
        }
    });

    ws.on("close", () => {

        for (const id in activeTunnels) {
            if(activeTunnels[id] === ws) {
                delete activeTunnels[id];
                console.log("Tunnel closed: ", id);
            }
        }
    });

});


console.log('WebSocket server is running...');

