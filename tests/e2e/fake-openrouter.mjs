// Stand-in for OpenRouter in e2e tests. Never used outside tests.
// POST /api/v1/chat/completions answers like a model would;
// GET /last returns the last Ask request so tests can check what was sent.
import http from "node:http";

let lastAsk = null;

function reply(res, content) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/last") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(lastAsk));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const data = JSON.parse(body || "{}");
      const messages = data.messages ?? [];
      if (messages[0]?.role === "user" && messages[0].content.includes("Classify each")) {
        return reply(res, JSON.stringify({ results: [] }));
      }
      lastAsk = data;
      const asked = messages.filter((m) => m.role === "user").length;
      if (asked < 2) return reply(res, "How much do you need, and by when?");
      const system = messages[0]?.content ?? "";
      const spare = system.match(/(\[I\d+\])[^\n]*not linked to any goal/)?.[1] ?? "[I1]";
      return reply(
        res,
        `Take it from ${spare} first, since it isn't saving for a goal.\n- Leave [G1] alone so it stays on track.\n- Check for an **exit load** before you withdraw.`,
      );
    });
  })
  .listen(5329, "127.0.0.1", () => console.log("fake OpenRouter on 5329"));
