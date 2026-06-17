/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import dotenv from "dotenv";
import { fetch } from "undici";
import { P1_PROMPT, P2_PROMPT, P3_PROMPT, P4_PROMPT, SYSTEM_INSTRUCTIONS } from "./src/schemaPrompt";

dotenv.config();

// Console Colors
const cl = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Standard LLM caller matching server configurations
 */
async function queryLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const host = (process.env.LOCAL_API_HOST || "https://rcsllm.carleton.ca/rcsapi").replace(/\/$/, "");
  const apiKey = process.env.LOCAL_API_KEY || "";
  const model = process.env.LOCAL_API_MODEL || "qwen3:8b";
  const endpoint = `${host}/api/chat`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2400 * 1000); 

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
    throw new Error(`API Connection Failed: ${error.message}`);
  }
}

/**
 * Extract markdown table columns and format to a CSV string
 */
function translateToCSV(markdownText: string): string {
  const lines = markdownText.split("\n");
  const rows: string[][] = [];
  let isRecording = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      const lower = trimmed.toLowerCase();
      if (lower.includes("subject") && lower.includes("predicate")) {
        isRecording = true;
        const cols = trimmed.split("|").map(col => col.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        rows.push(cols);
        continue;
      }
      if (isRecording) {
        if (trimmed.replace(/[\s|:-]/g, "") === "") continue;
        const cols = trimmed.split("|").map(col => col.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        rows.push(cols);
      }
    }
  }

  return rows
    .map(row => 
      row.map(cell => {
        let escaped = cell.replace(/"/g, '""');
        if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
          escaped = `"${escaped}"`;
        }
        return escaped;
      }).join(",")
    )
    .join("\n");
}

async function runBatchPipeline() {
  const rl = readline.createInterface({ input, output });

  console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
  console.log(`  ${cl.bold}Chronos Batch Processor - Pipeline Multi-text Iterator${cl.reset}`);
  console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}\n`);

  // Prompt for Folder Configurations
  const defaultInputDir = path.join(process.cwd(), "inputs");
  const defaultOutputDir = path.join(process.cwd(), "outputs");

  const inputDirInput = await rl.question(`Enter path to input folder (default: ./inputs): `);
  const inputDir = inputDirInput.trim() ? path.resolve(inputDirInput.trim()) : defaultInputDir;

  const outputDirInput = await rl.question(`Enter path to output folder (default: ./outputs): `);
  const outputDir = outputDirInput.trim() ? path.resolve(outputDirInput.trim()) : defaultOutputDir;

  const generateCSVOption = await rl.question(`Generate CSV files alongside Markdown? (Y/n): `);
  const generateCSV = generateCSVOption.trim().toLowerCase() !== "n";

  rl.close();

  // Create directories if they do not exist
  if (!fs.existsSync(inputDir)) {
    console.log(`\nCreating input folder at: ${inputDir}`);
    fs.mkdirSync(inputDir, { recursive: true });
    console.log(`Please place your text files (.txt) inside this directory and run the script again.`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Scan input directory
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith(".txt"));

  if (files.length === 0) {
    console.log(`\n${cl.yellow}No .txt files found in input directory: ${inputDir}${cl.reset}`);
    return;
  }

  console.log(`\nFound ${cl.bold}${files.length}${cl.reset} files to process.`);
  console.log(`Outputs will be written to: ${outputDir}\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const fileIndexDisplay = `[${i + 1}/${files.length}]`;
    const textPath = path.join(inputDir, filename);
    const baseName = path.parse(filename).name;

    console.log(`${cl.cyan}${fileIndexDisplay} Processing: ${cl.bold}${filename}${cl.reset}...`);
    const inputText = fs.readFileSync(textPath, "utf-8");

    if (!inputText.trim()) {
      console.log(`  ${cl.red}↳ Skipped: File is empty.${cl.reset}`);
      failed++;
      continue;
    }

    // Set up output targets
    const fileOutputDir = path.join(outputDir, baseName);
    if (!fs.existsSync(fileOutputDir)) {
      fs.mkdirSync(fileOutputDir, { recursive: true });
    }

    try {
      // Step 1: Reify & Tag
      console.log(`  ↳ Step 1: Reifying Entities...`);
      const p1Raw = P1_PROMPT.replace("{{inputText}}", inputText);
      const p1Out = await queryLLM(SYSTEM_INSTRUCTIONS, p1Raw);
      fs.writeFileSync(path.join(fileOutputDir, `${baseName}_stage1.md`), p1Out, "utf-8");

      // Step 2: Seed Triples
      console.log(`  ↳ Step 2: Extracting Seed Triples...`);
      const p2Raw = P2_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", p1Out);
      const p2Out = await queryLLM(SYSTEM_INSTRUCTIONS, p2Raw);
      fs.writeFileSync(path.join(fileOutputDir, `${baseName}_stage2.md`), p2Out, "utf-8");

      // Step 3: Class Audits
      console.log(`  ↳ Step 3: Analyzing Classes 1-8 Audits...`);
      const p3Raw = P3_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", p1Out).replace("{{p2Output}}", p2Out);
      const p3Out = await queryLLM(SYSTEM_INSTRUCTIONS, p3Raw);
      fs.writeFileSync(path.join(fileOutputDir, `${baseName}_stage3.md`), p3Out, "utf-8");

      // Step 4: Consolidation
      console.log(`  ↳ Step 4: Normalizing Final Matrices...`);
      const p4Raw = P4_PROMPT.replace("{{p1Output}}", p1Out).replace("{{p2Output}}", p2Out).replace("{{p3Output}}", p3Out);
      const p4Out = await queryLLM(SYSTEM_INSTRUCTIONS, p4Raw);
      
      // Save Master outputs
      const finalMdPath = path.join(fileOutputDir, `${baseName}_final_report.md`);
      fs.writeFileSync(finalMdPath, p4Out, "utf-8");

      if (generateCSV) {
        const csvContent = translateToCSV(p4Out);
        const finalCsvPath = path.join(fileOutputDir, `${baseName}_triples.csv`);
        fs.writeFileSync(finalCsvPath, csvContent, "utf-8");
      }

      console.log(`  ${cl.green}↳ Success. Written to: ${fileOutputDir}${cl.reset}\n`);
      succeeded++;
    } catch (err: any) {
      console.log(`  ${cl.red}↳ Failed: ${err.message}${cl.reset}\n`);
      failed++;
    }
  }

  // Final summary
  console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
  console.log(`  ${cl.bold}Batch Execution Complete${cl.reset}`);
  console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
  console.log(`  Processed: ${succeeded + failed} files`);
  console.log(`  Succeeded: ${cl.green}${succeeded}${cl.reset}`);
  console.log(`  Failed:    ${failed > 0 ? `${cl.red}${failed}${cl.reset}` : "0"}`);
  console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
}

runBatchPipeline().catch(console.error);