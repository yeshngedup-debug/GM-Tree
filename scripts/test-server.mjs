import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
const run = Date.now().toString();
mkdirSync("data/tests", { recursive: true });
let mode = "safe",
  generations = 0,
  lastGeneration = null;
const provider = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : {};
  if (req.url === "/control") {
    mode = body.mode || "safe";
    ((generations = 0), (lastGeneration = null));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === "/counts") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ generations, lastGeneration }));
    return;
  }
  res.setHeader("Content-Type", "application/json");
  if (mode === "failure") {
    res.statusCode = 503;
    res.end("{}");
    return;
  }
  if (mode === "timeout") {
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (req.url === "/v1/moderations") {
    res.end(
      JSON.stringify({
        results: [
          {
            flagged:
              mode === "input_flagged" ||
              (mode === "output_flagged" &&
                String(body.input).startsWith("May safe")) ||
              (mode === "reply_flagged" &&
                String(body.input).includes("Mock unsafe private reply")),
          },
        ],
      }),
    );
    return;
  }
  const isLeaf = Boolean(body.response_format);
  if (isLeaf) {
    generations++;
    lastGeneration = {
      model: body.model,
      reasoning_effort: body.reasoning_effort,
    };
  }
  const leaf = {
    safe: mode !== "rejected" && mode !== "rejected_empty",
    category: "education",
    leaf_message:
      mode === "rejected_empty"
        ? ""
        : mode === "pii"
          ? "Email student@example.com"
          : mode === "invalid"
            ? "x".repeat(140)
            : "May safe learning spaces help every student build a brighter future.",
    chamber_id: 3,
    visitor_reply:
      mode === "rejected_empty"
        ? ""
        : mode === "reply_pii"
          ? "You can email student@example.com to find a better school for your child."
          : mode === "reply_flagged"
            ? "Mock unsafe private reply about the visitor's school note."
            : mode === "reply_invalid"
              ? "x".repeat(400)
              : "Learning in a welcoming school can help students feel confident and supported. Your hope highlights how much that everyday experience matters to the city's future.",
    confidence: 0.98,
    moderation_flags: mode === "rejected" ? ["not_an_aspiration"] : [],
  };
  const output = isLeaf
    ? JSON.stringify(leaf)
    : "Among participating visitors, learning is a recurring hope.";
  if (req.url === "/v1/chat/completions") {
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { role: "assistant", content: output },
          },
        ],
      }),
    );
    return;
  }
  res.end(
    JSON.stringify({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: output }] }],
    }),
  );
});
await new Promise((resolve) => provider.listen(3102, "127.0.0.1", resolve));
const children = [
  {
    port: "3100",
    ai: "offline",
    key: "",
    db: resolve(`data/tests/${run}-offline.sqlite`),
  },
  {
    port: "3101",
    ai: "auto",
    key: "test-only-provider-key",
    db: resolve(`data/tests/${run}-ai.sqlite`),
  },
].map((config) =>
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      config.port,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ADMIN_PASSWORD:
          process.env.TEST_ADMIN_PASSWORD ||
          require("crypto").randomBytes(18).toString("base64url"),
        AI_MODE: config.ai,
        OPENAI_API_KEY: config.key,
        OPENAI_MODEL: "gpt-6-luna",
        OPENAI_BASE_URL: "http://127.0.0.1:3102/v1",
        AI_TIMEOUT_MS: "1200",
        DATABASE_PATH: config.db,
        NEXT_PUBLIC_APP_URL: "",
        GLOBAL_RATE_LIMIT: "300",
      },
    },
  ),
);
function stop() {
  for (const child of children) child.kill();
  provider.close();
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exit(code || 0);
  });
