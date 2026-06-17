/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { fetch } from "undici";
import { P1_PROMPT, P2_PROMPT, P3_PROMPT, P4_PROMPT, SYSTEM_INSTRUCTIONS } from "./src/schemaPrompt";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/**
 * Core LLM caller logic
 */
async function queryCustomEndpoint(systemPrompt: string, userPrompt: string): Promise<string> {
  const host = (process.env.LOCAL_API_HOST || "https://rcsllm.carleton.ca/rcsapi").replace(/\/$/, "");
  const apiKey = process.env.LOCAL_API_KEY || "";
  const model = process.env.LOCAL_API_MODEL || "qwen3:8b";

  // Use /api/chat to allow the system + user message structure
  const endpoint = `${host}/api/chat`;

  console.log(`[LLM] Requesting model: ${model} at ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2400 * 1000); // 40 min limit

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`, // Reverted to Bearer as per your curl
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: 32000 
        }
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM Error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    return data.message?.content || data.response || "";
  } catch (error: any) {
    console.error("[Fetch Error]:", error.message);
    throw error;
  }
}

// Pass 1 Endpoint
app.post("/api/extract/p1", async (req, res) => {
  try {
    const output = await queryCustomEndpoint(SYSTEM_INSTRUCTIONS, P1_PROMPT.replace("{{inputText}}", req.body.inputText));
    res.json({ success: true, data: output });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// Pass 2 Endpoint
app.post("/api/extract/p2", async (req, res) => {
  try {
    const prompt = P2_PROMPT.replace("{{inputText}}", req.body.inputText).replace("{{p1Output}}", req.body.p1Output);
    const output = await queryCustomEndpoint(SYSTEM_INSTRUCTIONS, prompt);
    res.json({ success: true, data: output });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// Pass 3 Endpoint
app.post("/api/extract/p3", async (req, res) => {
  try {
    const prompt = P3_PROMPT.replace("{{inputText}}", req.body.inputText).replace("{{p1Output}}", req.body.p1Output).replace("{{p2Output}}", req.body.p2Output);
    const output = await queryCustomEndpoint(SYSTEM_INSTRUCTIONS, prompt);
    res.json({ success: true, data: output });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// Pass 4 Endpoint
app.post("/api/extract/p4", async (req, res) => {
  try {
    const prompt = P4_PROMPT.replace("{{p1Output}}", req.body.p1Output).replace("{{p2Output}}", req.body.p2Output).replace("{{p3Output}}", req.body.p3Output);
    const output = await queryCustomEndpoint(SYSTEM_INSTRUCTIONS, prompt);
    res.json({ success: true, data: output });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`[Server] Online at port ${PORT}`));
}

startServer().catch(console.error);