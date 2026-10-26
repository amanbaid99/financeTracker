// Stand-in for OpenRouter in e2e tests. Never used outside tests.
// POST /api/v1/chat/completions answers like a model would;
// GET /last returns the last Ask request so tests can check what was sent.
import http from "node:http";

let lastAsk = null;
let lastCard = null;

// Both free models give the same reading; one benefit isn't in the text,
// so the app should flag it.
const CARD_READING = {
  card_name: "Regalia Gold",
  annual_fee: 2500,
  rewards: "4 reward points per Rs 150 spent",
  benefits: ["12 complimentary lounge visits a year", "Free golf every month"],
  milestones: [
    {
      name: "Annual fee waiver",
      target: 400000,
      period: "card_year",
      reward: "Annual fee waived",
    },
    {
      name: "Milestone bonus",
      target: 800000,
      period: "card_year",
      reward: "10,000 bonus points",
    },
  ],
  best_for: ["travel", "dining"],
};

function reply(res, content) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
}

http
  .createServer((req, res) => {
    // Model list and key status, as the router reads them.
    if (req.method === "GET" && req.url === "/api/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const free = (id) => ({
        id,
        context_length: 128000,
        created: Math.floor(Date.now() / 1000),
        pricing: { prompt: "0", completion: "0" },
        supported_parameters: ["response_format"],
      });
      return res.end(
        JSON.stringify({ data: [free("test/free-a"), free("other/free-b")] }),
      );
    }
    if (req.method === "GET" && req.url === "/api/v1/key") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          data: {
            free_model_daily_requests: { remaining: 900 },
            usage_daily: 0,
            limit_remaining: null,
          },
        }),
      );
    }
    if (req.method === "GET" && req.url === "/last-card") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(lastCard));
    }
    if (req.method === "GET" && req.url === "/last") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(lastAsk));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const data = JSON.parse(body || "{}");
      const messages = data.messages ?? [];
      if (
        messages[0]?.role === "user" &&
        messages[0].content.includes("Classify each")
      ) {
        return reply(res, JSON.stringify({ results: [] }));
      }
      if (
        messages[0]?.role === "system" &&
        messages[0].content.includes("credit card feature documents")
      ) {
        lastCard = data;
        return reply(res, JSON.stringify(CARD_READING));
      }
      lastAsk = data;
      const asked = messages.filter((m) => m.role === "user").length;
      if (asked < 2) return reply(res, "How much do you need, and by when?");
      const system = messages[0]?.content ?? "";
      const spare =
        system.match(/(\[I\d+\])[^\n]*not linked to any goal/)?.[1] ?? "[I1]";
      return reply(
        res,
        `Take it from ${spare} first, since it isn't saving for a goal.\n- Leave [G1] alone so it stays on track.\n- Check for an **exit load** before you withdraw.`,
      );
    });
  })
  .listen(5329, "127.0.0.1", () => console.log("fake OpenRouter on 5329"));
