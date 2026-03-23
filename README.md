# Relayy Server

A lightweight tunnel relay server built with Express and WebSocket.

It accepts public HTTP requests, forwards them to a connected CLI client through WebSocket, and returns the CLI response back to the original browser/client.

## What This Server Does

- Creates a temporary public tunnel ID for each connected CLI client
- Forwards incoming HTTP requests to the correct tunnel client
- Waits for the CLI response and sends it back to the requester
- Expires tunnels automatically after 30 minutes
- Returns a styled HTML error page when a tunnel is not found

## Tech Stack

- Node.js
- Express
- ws (WebSocket server)
- uuid
- unique-names-generator

## Project File

- Entry point: index.js

## How It Works

1. A CLI client connects to this server over WebSocket.
2. The CLI sends a register message.
3. The server generates a human-friendly tunnel ID (for example: calm-lion-a1b2).
4. Public HTTP requests sent to /:tunnelId/* are mapped to that active tunnel.
5. The server forwards request data to the CLI using requestId.
6. The CLI processes the request locally and sends a response message.
7. The server finds the pending HTTP response and completes it.

## Request Routing Contract

Incoming public route format:

/:tunnelId/<forwarded-path>

Example:

- Incoming URL: /calm-lion-a1b2/api/users
- Tunnel ID: calm-lion-a1b2
- Forwarded path to CLI: /api/users

## WebSocket Message Shapes (Current Implementation)

### 1) CLI registers tunnel

```json
{
  "type": "register"
}
```

### 2) Server confirms tunnel creation

```json
{
  "type": "tunnel_created",
  "tunnelId": "calm-lion-a1b2",
  "expiry": 1710000000000
}
```

### 3) Server forwards HTTP request to CLI

```json
{
  "type": "request",
  "requestId": "b65b3f57-77d2-4a4d-a4b6-8bb0d2e3e9af",
  "method": "GET",
  "path": "/api/users",
  "headers": {
    "accept": "application/json"
  },
  "body": null
}
```

### 4) CLI sends response back to server

```json
{
  "type": "response",
  "requestId": "b65b3f57-77d2-4a4d-a4b6-8bb0d2e3e9af",
  "status": 200,
  "body": {
    "ok": true
  }
}
```

## Tunnel Lifecycle

- Tunnel is active once register is accepted.
- Tunnel expires after 30 minutes.
- On expiry, server sends:

```json
{
  "type": "tunnel_expired"
}
```

- If WebSocket closes, tunnel is removed from active list.

## Missing Tunnel Behavior

If a request arrives for a tunnel that is not active, the server returns:

- HTTP status: 404
- Content-Type: text/html
- A styled HTML page describing:
  - Tunnel not found
  - Method
  - Requested path
  - Suggested next step

This helps browser users understand the failure quickly instead of seeing a blank response.

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

Run this from the server folder.

### Start the server

```bash
node index.js
```

Server defaults:

- Port: 8080 (override with PORT environment variable)

PowerShell example:

```powershell
$env:PORT=9090
node index.js
```

## Quick Verification

1. Start server.
2. Connect CLI and register a tunnel.
3. Open /<your-tunnel-id>/test in browser or use curl.
4. Confirm request appears at CLI and response returns to client.

## Troubleshooting

### Tunnel not found page appears

Possible reasons:

- Tunnel ID is wrong
- Tunnel has expired (30 minutes)
- CLI disconnected

Fix:

- Reconnect CLI and create a new tunnel
- Retry with the latest tunnel ID

### Browser keeps loading forever

Possible reasons:

- CLI did not send response message for requestId
- Local upstream service used by CLI is not responding

Fix:

- Ensure CLI sends response for every forwarded request
- Verify local service is running on expected port

### Port already in use

Fix:

- Set a different PORT environment variable and restart

## Security Notes

- This implementation stores active tunnels and pending requests in memory.
- No authentication is currently applied to tunnel creation.
- Avoid exposing sensitive services without additional auth and rate-limiting.

## Roadmap Suggestions

- Add auth token for tunnel registration
- Add request timeout handling and cleanup for pendingRequests
- Support response headers from CLI to browser
- Add structured logging with request correlation
- Add health endpoint and graceful shutdown handling

## License

ISC (as defined in package.json)
