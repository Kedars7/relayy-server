const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');


const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

const activeTunnels = {};
const pendingRequests = {};

app.use((req, res) => {

    const parts = req.path.split('/');
    const tunnelId = parts[1];

    const socket = activeTunnels[tunnelId];
    if(!socket) {
        return res.status(502).send('Tunnel not found');
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
                    tunnelId
                })
            )

            console.log(`Tunnel created with ID: ${tunnelId}`);
        }
        else if(data.type === "response") {
            const res = pendingRequests[data.requestId];

            if(res) {
                res.status(data.status).send(data.body);

                delete pendingRequests[data.requestId];
            }
        }
    })

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

