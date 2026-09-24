import http from "http";
import { scrapeWithFallback, shutdownBrowser } from "./engine";

const port = Number(process.env.SCRAPE_WORKER_PORT || 8787);

function readBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/scrape") {
    try {
      const body = JSON.parse(await readBody(req)) as { name?: string; url?: string; html?: string };
      if (!body.url) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "url required" }));
        return;
      }
      const result = await scrapeWithFallback(body.name || body.url, body.url, body.html);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error?.message || "scrape failed" }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(port, () => {
  console.log(`Scrape worker listening on ${port}`);
});

async function stop() {
  server.close();
  await shutdownBrowser();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
