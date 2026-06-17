/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fetch } from "undici";
import { P1_PROMPT, P2_PROMPT, P3_PROMPT, P4_PROMPT, SYSTEM_INSTRUCTIONS } from "./src/schemaPrompt";

dotenv.config();

// ANSI Escape Codes for Terminal styling
const cl = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bgDark: "\x1b[40m",
};

const clearScreen = () => process.stdout.write("\x1b[2J\x1b[H");

const DEFAULT_SAMPLE_TEXT = `Giacomo Medici is an Italian antiquities dealer who was convicted in 2005 of receiving stolen goods. Medici started dealing in antiquities in Rome during the 1960s. In July 1967, he was convicted in Italy of receiving looted artefacts, though in the same year he met and became an important supplier of antiquities to US dealer Robert Hecht. In 1968, Medici opened the gallery Antiquaria Romana in Rome and began to explore business opportunities in Switzerland. It is widely believed that in December 1971 he bought the illegally-excavated Euphronios (Sarpedon) krater from tombaroli before transporting it to Switzerland and selling it to Hecht.`;

// Workspace persistence settings
const WORKSPACE_DIR = path.join(process.cwd(), "tui_workspace");
const STAGE_FILENAMES = {
  p1: "stage1_reify.md",
  p2: "stage2_seeds.md",
  p3: "stage3_audits.md",
  p4: "stage4_consolidated.md"
};

// Application State
let inputText = DEFAULT_SAMPLE_TEXT;
const stageOutputs = {
  p1: "",
  p2: "",
  p3: "",
  p4: ""
};

/**
 * Ensures the workspace directory exists on disk
 */
function ensureWorkspaceDir() {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

/**
 * Saves current input text to the workspace
 */
function saveWorkspaceInput() {
  ensureWorkspaceDir();
  fs.writeFileSync(path.join(WORKSPACE_DIR, "input.txt"), inputText, "utf-8");
}

/**
 * Writes an individual stage output to disk for audit
 */
function saveWorkspaceStage(stage: "p1" | "p2" | "p3" | "p4") {
  ensureWorkspaceDir();
  const filePath = path.join(WORKSPACE_DIR, STAGE_FILENAMES[stage]);
  fs.writeFileSync(filePath, stageOutputs[stage], "utf-8");

  // If Stage 4 is saved, automatically export a synchronized CSV
  if (stage === "p4") {
    if (stageOutputs.p4) {
      try {
        const csvContent = translateToCSV(stageOutputs.p4);
        fs.writeFileSync(path.join(WORKSPACE_DIR, "stage4_triples.csv"), csvContent, "utf-8");
      } catch (e) {
        // Suppress background CSV generation errors
      }
    } else {
      const csvPath = path.join(WORKSPACE_DIR, "stage4_triples.csv");
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  }
}

/**
 * Loads existing files from the tui_workspace directory if they exist
 */
function loadWorkspace() {
  ensureWorkspaceDir();
  const inputPath = path.join(WORKSPACE_DIR, "input.txt");
  
  if (fs.existsSync(inputPath)) {
    inputText = fs.readFileSync(inputPath, "utf-8");
  } else {
    inputText = DEFAULT_SAMPLE_TEXT;
    saveWorkspaceInput();
  }

  for (const [stage, filename] of Object.entries(STAGE_FILENAMES) as ["p1" | "p2" | "p3" | "p4", string][]) {
    const stagePath = path.join(WORKSPACE_DIR, filename);
    if (fs.existsSync(stagePath)) {
      stageOutputs[stage] = fs.readFileSync(stagePath, "utf-8");
    } else {
      stageOutputs[stage] = "";
    }
  }
}

/**
 * Reinitializes the workspace and clears files from disk
 */
function resetWorkspace() {
  ensureWorkspaceDir();
  inputText = DEFAULT_SAMPLE_TEXT;
  saveWorkspaceInput();

  for (const filename of Object.values(STAGE_FILENAMES)) {
    const filePath = path.join(WORKSPACE_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  const csvPath = path.join(WORKSPACE_DIR, "stage4_triples.csv");
  if (fs.existsSync(csvPath)) {
    fs.unlinkSync(csvPath);
  }

  stageOutputs.p1 = "";
  stageOutputs.p2 = "";
  stageOutputs.p3 = "";
  stageOutputs.p4 = "";
}

/**
 * Direct LLM querying logic matching server configurations
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
    throw new Error(`Connection failed: ${error.message}`);
  }
}

/**
 * Appends corrective guidance parameters or legacy outputs
 */
function applyGuidance(prompt: string, previousOutput?: string, guidance?: string): string {
  if (!guidance && !previousOutput) return prompt;
  
  let refined = prompt;
  if (previousOutput) {
    refined += `\n\n### Existing Output:\n"""\n${previousOutput}\n"""`;
  }
  if (guidance) {
    refined += `\n\n### Corrective Revision Instructions:\n${guidance}\nPlease revise the output based strictly on these instructions.`;
  }
  return refined;
}

/**
 * Translates tabular outputs into CSV columns
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
          if (escaped.startsWith('""') && escaped.endsWith('""') && escaped.length > 2) {
             escaped = `"${escaped.slice(2, -2)}"`;
          }
        }
        return escaped;
      }).join(",")
    )
    .join("\n");
}

async function main() {
  // Synchronize on-disk workspace with runtime memory at boot
  loadWorkspace();

  const rl = readline.createInterface({ input, output });

  while (true) {
    clearScreen();
    console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
    console.log(`  ${cl.bold}Chronos TUI - Persistent Stage-by-Stage Workspace [Disk-Backed]${cl.reset}`);
    console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);
    console.log(`  [1] View / Edit Active Source Literature`);
    console.log(`  [2] Run Autopilot Pipeline (Stages P1 -> P4 Sequentially)`);
    console.log(`  [3] Run Step-by-Step Interactive Workbench`);
    console.log(`  [4] Inspect Workspace Audit Folder (${cl.dim}./tui_workspace/${cl.reset})`);
    console.log(`  [5] Reset Active Workspace (Deletes Stage Files)`);
    console.log(`  [0] Exit`);
    console.log(`${cl.cyan}------------------------------------------------------------------------${cl.reset}`);
    
    // Status Panel
    console.log(`  ${cl.bold}Workspace State:${cl.reset}`);
    console.log(`  - Source Text:  ${inputText ? `${inputText.substring(0, 50)}... (${inputText.length} chars)` : `${cl.red}Empty${cl.reset}`}`);
    console.log(`  - Pass 1 (Reify):     ${stageOutputs.p1 ? `${cl.green}Ready (${STAGE_FILENAMES.p1})${cl.reset}` : `${cl.dim}Unprocessed${cl.reset}`}`);
    console.log(`  - Pass 2 (Seeds):     ${stageOutputs.p2 ? `${cl.green}Ready (${STAGE_FILENAMES.p2})${cl.reset}` : `${cl.dim}Unprocessed${cl.reset}`}`);
    console.log(`  - Pass 3 (Audits):    ${stageOutputs.p3 ? `${cl.green}Ready (${STAGE_FILENAMES.p3})${cl.reset}` : `${cl.dim}Unprocessed${cl.reset}`}`);
    console.log(`  - Pass 4 (Consolid):  ${stageOutputs.p4 ? `${cl.green}Ready (${STAGE_FILENAMES.p4})${cl.reset}` : `${cl.dim}Unprocessed${cl.reset}`}`);
    console.log(`${cl.bold}${cl.cyan}========================================================================${cl.reset}`);

    const choice = await rl.question(`${cl.bold}Select option: ${cl.reset}`);

    if (choice === "1") {
      await menuViewEditSource(rl);
    } else if (choice === "2") {
      await menuRunAutopilot(rl);
    } else if (choice === "3") {
      await menuInteractiveWorkbench(rl);
    } else if (choice === "4") {
      await menuInspectWorkspaceFiles(rl);
    } else if (choice === "5") {
      resetWorkspace();
      await rl.question(`\nWorkspace files removed. State reset. Press [Enter] to continue.`);
    } else if (choice === "0") {
      break;
    }
  }

  rl.close();
  console.log("TUI Closed.");
}

async function menuViewEditSource(rl: readline.Interface) {
  clearScreen();
  console.log(`${cl.bold}${cl.yellow}=== Active Source Literature ===${cl.reset}\n`);
  console.log(inputText || "[Empty]");
  console.log(`\n${cl.cyan}------------------------------------------------------------------------${cl.reset}`);
  console.log("  [1] Paste New Text");
  console.log("  [2] Revert to Default Sample Text");
  console.log("  [0] Back");
  
  const choice = await rl.question(`\nSelect action: `);
  if (choice === "1") {
    console.log(`\nPaste or type your text below. When done, type ${cl.bold}END${cl.reset} on a new line and press Enter:\n`);
    const lines: string[] = [];
    while (true) {
      const line = await rl.question("");
      if (line.trim() === "END") break;
      lines.push(line);
    }
    inputText = lines.join("\n");
    saveWorkspaceInput();
    console.log(`\nSuccessfully loaded ${inputText.length} characters and saved to input.txt.`);
    await rl.question("Press [Enter] to return.");
  } else if (choice === "2") {
    inputText = DEFAULT_SAMPLE_TEXT;
    saveWorkspaceInput();
    console.log("\nReverted to default, written to input.txt.");
    await rl.question("Press [Enter] to return.");
  }
}

async function menuRunAutopilot(rl: readline.Interface) {
  clearScreen();
  console.log(`${cl.bold}${cl.yellow}=== Autopilot Processing (Writing Directly to Files) ===${cl.reset}\n`);
  if (!inputText.trim()) {
    console.log(`${cl.red}Error: No input text provided.${cl.reset}`);
    await rl.question("\nPress [Enter] to abort.");
    return;
  }

  try {
    console.log(`[1/4] Running Pass 1: Reify & Tag...`);
    const p1Raw = P1_PROMPT.replace("{{inputText}}", inputText);
    stageOutputs.p1 = await queryLLM(SYSTEM_INSTRUCTIONS, p1Raw);
    saveWorkspaceStage("p1");
    console.log(`${cl.green}✔ Pass 1 Complete and saved to ${STAGE_FILENAMES.p1}.${cl.reset}\n`);

    console.log(`[2/4] Running Pass 2: Seed Triples...`);
    const p2Raw = P2_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", stageOutputs.p1);
    stageOutputs.p2 = await queryLLM(SYSTEM_INSTRUCTIONS, p2Raw);
    saveWorkspaceStage("p2");
    console.log(`${cl.green}✔ Pass 2 Complete and saved to ${STAGE_FILENAMES.p2}.${cl.reset}\n`);

    console.log(`[3/4] Running Pass 3: Class Audits...`);
    const p3Raw = P3_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", stageOutputs.p1).replace("{{p2Output}}", stageOutputs.p2);
    stageOutputs.p3 = await queryLLM(SYSTEM_INSTRUCTIONS, p3Raw);
    saveWorkspaceStage("p3");
    console.log(`${cl.green}✔ Pass 3 Complete and saved to ${STAGE_FILENAMES.p3}.${cl.reset}\n`);

    console.log(`[4/4] Running Pass 4: Consolidation...`);
    const p4Raw = P4_PROMPT.replace("{{p1Output}}", stageOutputs.p1).replace("{{p2Output}}", stageOutputs.p2).replace("{{p3Output}}", stageOutputs.p3);
    stageOutputs.p4 = await queryLLM(SYSTEM_INSTRUCTIONS, p4Raw);
    saveWorkspaceStage("p4");
    console.log(`${cl.green}✔ Pass 4 Complete and saved to ${STAGE_FILENAMES.p4}.${cl.reset}\n`);

    console.log(`${cl.bold}${cl.green}Autopilot successfully processed all stages and synchronized files!${cl.reset}`);
  } catch (err: any) {
    console.log(`\n${cl.red}Pipeline Error: ${err.message}${cl.reset}`);
  }

  await rl.question("\nPress [Enter] to return to Main Menu.");
}

async function menuInteractiveWorkbench(rl: readline.Interface) {
  let activeStage: "p1" | "p2" | "p3" | "p4" = "p1";

  while (true) {
    clearScreen();
    console.log(`${cl.bold}${cl.yellow}=== Step-by-Step Interactive Workbench ===${cl.reset}`);
    console.log(`Active Viewing: Stage ${cl.bold}${activeStage.toUpperCase()}${cl.reset} (File-backed: ${STAGE_FILENAMES[activeStage]})\n`);

    console.log(`${cl.dim}--- Output Content ---${cl.reset}`);
    console.log(stageOutputs[activeStage] || `${cl.red}[No data extracted for this stage yet]${cl.reset}`);
    console.log(`${cl.dim}----------------------${cl.reset}\n`);

    console.log(`  [1] Switch Stage Tab: ${activeStage === "p1" ? "[P1]" : "P1"} -> ${activeStage === "p2" ? "[P2]" : "P2"} -> ${activeStage === "p3" ? "[P3]" : "P3"} -> ${activeStage === "p4" ? "[P4]" : "P4"}`);
    console.log(`  [2] Generate / Redo Stage`);
    console.log(`  [3] Generate with Corrective Guidance Feedback`);
    console.log(`  [4] Continue adding data to current Stage`);
    console.log(`  [5] Manually Edit Stage Text Output`);
    console.log(`  [0] Return to Main Menu`);
    console.log(`${cl.cyan}------------------------------------------------------------------------${cl.reset}`);

    const option = await rl.question("Choose action: ");

    if (option === "1") {
      const stages: ("p1" | "p2" | "p3" | "p4")[] = ["p1", "p2", "p3", "p4"];
      const nextIdx = (stages.indexOf(activeStage) + 1) % 4;
      activeStage = stages[nextIdx];
    } else if (option === "2") {
      await runStageInteractive(rl, activeStage, false);
    } else if (option === "3") {
      const guidance = await rl.question("\nEnter corrective instructions for the LLM:\n> ");
      await runStageInteractive(rl, activeStage, false, guidance);
    } else if (option === "4") {
      await runStageInteractive(rl, activeStage, true);
    } else if (option === "5") {
      await manualEditStage(rl, activeStage);
    } else if (option === "0") {
      break;
    }
  }
}

async function runStageInteractive(rl: readline.Interface, stage: "p1" | "p2" | "p3" | "p4", appendMode = false, guidance?: string) {
  console.log(`\nQuerying Model... Please wait...`);
  try {
    let systemPrompt = SYSTEM_INSTRUCTIONS;
    let basePrompt = "";

    if (stage === "p1") {
      basePrompt = P1_PROMPT.replace("{{inputText}}", inputText);
    } else if (stage === "p2") {
      if (!stageOutputs.p1) throw new Error("Pass 1 data is required.");
      basePrompt = P2_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", stageOutputs.p1);
    } else if (stage === "p3") {
      if (!stageOutputs.p1 || !stageOutputs.p2) throw new Error("Pass 1 & 2 data are required.");
      basePrompt = P3_PROMPT.replace("{{inputText}}", inputText).replace("{{p1Output}}", stageOutputs.p1).replace("{{p2Output}}", stageOutputs.p2);
    } else if (stage === "p4") {
      if (!stageOutputs.p1 || !stageOutputs.p2 || !stageOutputs.p3) throw new Error("Pass 1, 2, and 3 data are required.");
      basePrompt = P4_PROMPT.replace("{{p1Output}}", stageOutputs.p1).replace("{{p2Output}}", stageOutputs.p2).replace("{{p3Output}}", stageOutputs.p3);
    }

    const compiledPrompt = applyGuidance(basePrompt, appendMode ? stageOutputs[stage] : undefined, guidance);
    const result = await queryLLM(systemPrompt, compiledPrompt);

    if (appendMode) {
      stageOutputs[stage] += `\n\n${result}`;
    } else {
      stageOutputs[stage] = result;
    }

    // Save update instantly to disk
    saveWorkspaceStage(stage);
    console.log(`${cl.green}✔ Process finished. Output written to ${STAGE_FILENAMES[stage]}.${cl.reset}`);
  } catch (err: any) {
    console.log(`${cl.red}Error: ${err.message}${cl.reset}`);
  }
  await rl.question("\nPress [Enter] to continue.");
}

async function manualEditStage(rl: readline.Interface, stage: "p1" | "p2" | "p3" | "p4") {
  console.log(`\nEnter your edited text below. To preserve your edits, type ${cl.bold}SAVE${cl.reset} on a new line and press Enter:\n`);
  const lines: string[] = [];
  while (true) {
    const line = await rl.question("");
    if (line.trim() === "SAVE") break;
    lines.push(line);
  }
  stageOutputs[stage] = lines.join("\n");
  
  // Save update instantly to disk
  saveWorkspaceStage(stage);
  console.log(`\n${cl.green}Stage changes written to disk (${STAGE_FILENAMES[stage]}).${cl.reset}`);
  await rl.question("\nPress [Enter] to continue.");
}

async function menuInspectWorkspaceFiles(rl: readline.Interface) {
  clearScreen();
  console.log(`${cl.bold}${cl.yellow}=== Inspecting Workspace Folder ===${cl.reset}`);
  console.log(`Directory: ${WORKSPACE_DIR}\n`);

  const files = fs.readdirSync(WORKSPACE_DIR);
  if (files.length === 0) {
    console.log("No files are currently stored in the workspace.");
  } else {
    for (const file of files) {
      const stats = fs.statSync(path.join(WORKSPACE_DIR, file));
      console.log(`  - ${cl.bold}${file}${cl.reset} (${stats.size} bytes, modified: ${stats.mtime.toLocaleTimeString()})`);
    }
  }

  await rl.question(`\nPress [Enter] to return.`);
}

main().catch(console.error);