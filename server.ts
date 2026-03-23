import { createServer } from "node:http";
import next from "next";
import { parse } from "node:url";
import { setupWebSocket, onMessage } from "./src/server/ws-server";
import { handleClientMessage, initializeHandler } from "./src/server/ws-handler";

// Ensure the SDK uses Claude Code subscription (OAuth), not an API key
delete process.env.ANTHROPIC_API_KEY;

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  setupWebSocket(server);
  onMessage(handleClientMessage);
  initializeHandler();

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
