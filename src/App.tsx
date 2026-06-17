/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Activity,
  FileText,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Edit2,
  Check,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  UserCheck,
  Save,
  MessageSquare,
  Sparkle
} from "lucide-react";

interface ExtractionResult {
  p1: string;
  p2: string;
  p3: string;
  p4: string;
}

const DEFAULT_SAMPLE_TEXT = `The late second and early third centuries AD witnessed profound destabilization across the Middle Tiber Valley. The Antonine Plague, an epidemic event of catastrophic proportions, caused the abrupt termination of settlement continuity in several rural pagus sites. Scholars like Robert Witcher have analyzed archaeological evidence, specifically the sudden cessation of Terra Sigillata Italica imports in the late imperial settlement pattern. Horden and Purcell proposed a conceptual model of systemic connectivity, but we must critique this model of smooth adaptation: the plague propagated a systemic shock through the Middle Tiber Valley settlement network, shifting the recovery trajectory into a qualitatively different form. Furthermore, the Severan political purge under the Emperor Septimius Severus caused the abrupt termination of the Mola di Monte Gelato Villa, interrupting the institutional continuity of the regional elite estate network. This single-generation purge reset the agrarian land tenure, showing a clear shock rather than gradual decline.`;

const stageTitles = {
  p1: "Stage 1: Reify & Tag Entities",
  p2: "Stage 2: Seed Core Triples",
  p3: "Stage 3: Run Class Audits",
  p4: "Stage 4: Consolidate & Finalize Graph"
};

const stageDescriptions = {
  p1: "Review identified archaeological entities, their types, and provenance (ARG/HISTOGPHY). Direct the AI to re-scan with feedback, add data, or modify the table directly.",
  p2: "Inspect core triples mapped to the 16 strict thematic predicates. Instruct the model to refine relationships or append custom subject-predicate-object lines.",
  p3: "Perform system feedbacks checks (Classes 1-8: Shocks, competitive institutional claims, environmental feedback). Guide additional audit generation or edit manually.",
  p4: "Generate fully normalized tables. Table 1 holds unique reified entities; Table 2 maps high-fidelity triples annotated with historical provenance, cited agents, and logical flags."
};

const stagePlaceholders = {
  p1: "Examples: 'Ensure Septimius Severus is added as PoliticalActor', 'Robert Witcher must have a cited agent of Witcher', 'Include Mola di Monte Gelato as Site'...",
  p2: "Examples: 'Add triple for Witcher analyzing Terra Sigillata Italica', 'Remove the critique triple for Purcell if unsupported'...",
  p3: "Examples: 'Add a Class 7 Shock flag to the Severan political purge triple', 'Check for Class 2 Conflict-Environment feedback'...",
  p4: "Examples: 'Set unique paradox ID for the connectivity conflict', 'Change canonical label formatting to CAPITALIZED nouns'..."
};

export default function App() {
  const [inputText, setInputText] = useState(DEFAULT_SAMPLE_TEXT);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"p1" | "p2" | "p3" | "p4">("p1");
  const [pipelineStep, setPipelineStep] = useState<"idle" | "p1" | "p2" | "p3" | "p4" | "completed">("idle");
  const [pipelineMode, setPipelineMode] = useState<"interactive" | "autopilot">("interactive");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Interactive step-by-step states
  const [stageOutputs, setStageOutputs] = useState<ExtractionResult>({
    p1: "",
    p2: "",
    p3: "",
    p4: ""
  });
  const [stageLoading, setStageLoading] = useState<Record<"p1" | "p2" | "p3" | "p4", boolean>>({
    p1: false,
    p2: false,
    p3: false,
    p4: false
  });
  const [stageFeedback, setStageFeedback] = useState<Record<"p1" | "p2" | "p3" | "p4", string>>({
    p1: "",
    p2: "",
    p3: "",
    p4: ""
  });
  const [isEditing, setIsEditing] = useState<Record<"p1" | "p2" | "p3" | "p4", boolean>>({
    p1: false,
    p2: false,
    p3: false,
    p4: false
  });
  const [stageCompleted, setStageCompleted] = useState<Record<"p1" | "p2" | "p3" | "p4", boolean>>({
    p1: false,
    p2: false,
    p3: false,
    p4: false
  });

  const showToast = (message: string) => {
    setFeedback(message);
    setTimeout(() => setFeedback(null), 3500);
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast("Copied active stage content to clipboard!");
  };

  const downloadTextFile = (filename: string, content: string) => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded ${filename}`);
  };

  // Run the sequential autopilot pipeline on the frontend to prevent gateway timeouts
  const runAutopilotPipeline = async () => {
    if (!inputText.trim()) {
      setError("Please provide some source text to process.");
      return;
    }

    setLoading(true);
    setError(null);
    setPipelineMode("autopilot");

    try {
      // Pass 1: Reify & Tag
      setPipelineStep("p1");
      setActiveTab("p1");
      const r1 = await fetch("/api/extract/p1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText }),
      });
      const d1 = await r1.json();
      if (!d1.success) throw new Error(d1.error || "Pass 1 LLM extraction failed.");
      const p1Out = d1.output || d1.data || "";
      setStageOutputs((prev) => ({ ...prev, p1: p1Out }));
      setStageCompleted((prev) => ({ ...prev, p1: true }));

      // Pass 2: Seed Triples
      setPipelineStep("p2");
      setActiveTab("p2");
      const r2 = await fetch("/api/extract/p2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, p1Output: p1Out }),
      });
      const d2 = await r2.json();
      if (!d2.success) throw new Error(d2.error || "Pass 2 LLM extraction failed.");
      const p2Out = d2.output || d2.data || "";
      setStageOutputs((prev) => ({ ...prev, p2: p2Out }));
      setStageCompleted((prev) => ({ ...prev, p2: true }));

      // Pass 3: Class Audits
      setPipelineStep("p3");
      setActiveTab("p3");
      const r3 = await fetch("/api/extract/p3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, p1Output: p1Out, p2Output: p2Out }),
      });
      const d3 = await r3.json();
      if (!d3.success) throw new Error(d3.error || "Pass 3 LLM extraction failed.");
      const p3Out = d3.output || d3.data || "";
      setStageOutputs((prev) => ({ ...prev, p3: p3Out }));
      setStageCompleted((prev) => ({ ...prev, p3: true }));

      // Pass 4: Final Structure
      setPipelineStep("p4");
      setActiveTab("p4");
      const r4 = await fetch("/api/extract/p4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p1Output: p1Out, p2Output: p2Out, p3Output: p3Out }),
      });
      const d4 = await r4.json();
      if (!d4.success) throw new Error(d4.error || "Pass 4 LLM consolidation failed.");
      const p4Out = d4.output || d4.data || "";
      setStageOutputs((prev) => ({ ...prev, p4: p4Out }));
      setStageCompleted((prev) => ({ ...prev, p4: true }));

      setPipelineStep("completed");
      showToast("Autopilot extracted all 4 stages successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during Autopilot execution.");
      setPipelineStep("idle");
    } finally {
      setLoading(false);
    }
  };

  // Modular execution of stage 1
  const executeStage1 = async (guidanceText?: string, continueAdding = false) => {
    if (!inputText.trim()) {
      setError("Active source text is required.");
      return;
    }
    setStageLoading((prev) => ({ ...prev, p1: true }));
    setError(null);
    setPipelineStep("p1");

    try {
      const response = await fetch("/api/extract/p1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          previousOutput: continueAdding ? stageOutputs.p1 : undefined,
          guidance: guidanceText
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Pass 1 LLM extraction failed.");
      }

      const activeOut = data.output || data.data || "";
      setStageOutputs((prev) => ({ ...prev, p1: activeOut }));
      setStageCompleted((prev) => ({ ...prev, p1: true }));
      setStageFeedback((prev) => ({ ...prev, p1: "" }));
      showToast(continueAdding ? "Stage 1 continued / augmented successfully!" : "Stage 1 generated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during Stage 1.");
    } finally {
      setStageLoading((prev) => ({ ...prev, p1: false }));
    }
  };

  // Modular execution of stage 2
  const executeStage2 = async (guidanceText?: string, continueAdding = false) => {
    if (!stageOutputs.p1) {
      setError("Pass 1 output required to generate Pass 2 triples.");
      return;
    }
    setStageLoading((prev) => ({ ...prev, p2: true }));
    setError(null);
    setPipelineStep("p2");

    try {
      const response = await fetch("/api/extract/p2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          p1Output: stageOutputs.p1,
          previousOutput: continueAdding ? stageOutputs.p2 : undefined,
          guidance: guidanceText
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Pass 2 LLM extraction failed.");
      }

      const activeOut = data.output || data.data || "";
      setStageOutputs((prev) => ({ ...prev, p2: activeOut }));
      setStageCompleted((prev) => ({ ...prev, p2: true }));
      setStageFeedback((prev) => ({ ...prev, p2: "" }));
      showToast(continueAdding ? "Stage 2 expanded successfully!" : "Stage 2 generated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during Stage 2.");
    } finally {
      setStageLoading((prev) => ({ ...prev, p2: false }));
    }
  };

  // Modular execution of stage 3
  const executeStage3 = async (guidanceText?: string, continueAdding = false) => {
    if (!stageOutputs.p1 || !stageOutputs.p2) {
      setError("Pass 1 and Pass 2 outputs are required to audit stage 3.");
      return;
    }
    setStageLoading((prev) => ({ ...prev, p3: true }));
    setError(null);
    setPipelineStep("p3");

    try {
      const response = await fetch("/api/extract/p3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          p1Output: stageOutputs.p1,
          p2Output: stageOutputs.p2,
          previousOutput: continueAdding ? stageOutputs.p3 : undefined,
          guidance: guidanceText
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Pass 3 LLM extraction failed.");
      }

      const activeOut = data.output || data.data || "";
      setStageOutputs((prev) => ({ ...prev, p3: activeOut }));
      setStageCompleted((prev) => ({ ...prev, p3: true }));
      setStageFeedback((prev) => ({ ...prev, p3: "" }));
      showToast(continueAdding ? "Stage 3 audits augmented!" : "Stage 3 generated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during Stage 3.");
    } finally {
      setStageLoading((prev) => ({ ...prev, p3: false }));
    }
  };

  // Modular execution of stage 4
  const executeStage4 = async (guidanceText?: string, continueAdding = false) => {
    if (!stageOutputs.p1 || !stageOutputs.p2 || !stageOutputs.p3) {
      setError("Pass 1, Pass 2, and Pass 3 outputs are required to consolidate final tables.");
      return;
    }
    setStageLoading((prev) => ({ ...prev, p4: true }));
    setError(null);
    setPipelineStep("p4");

    try {
      const response = await fetch("/api/extract/p4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p1Output: stageOutputs.p1,
          p2Output: stageOutputs.p2,
          p3Output: stageOutputs.p3,
          previousOutput: continueAdding ? stageOutputs.p4 : undefined,
          guidance: guidanceText
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Pass 4 LLM consolidation failed.");
      }

      const activeOut = data.output || data.data || "";
      setStageOutputs((prev) => ({ ...prev, p4: activeOut }));
      setStageCompleted((prev) => ({ ...prev, p4: true }));
      setStageFeedback((prev) => ({ ...prev, p4: "" }));
      showToast(continueAdding ? "Stage 4 consolidation modified!" : "Stage 4 finalized successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during Stage 4.");
    } finally {
      setStageLoading((prev) => ({ ...prev, p4: false }));
    }
  };

  // Master handler for trigger or redo
  const handleStageAction = (stage: "p1" | "p2" | "p3" | "p4", continueAdding = false) => {
    const guidance = stageFeedback[stage];
    if (stage === "p1") executeStage1(guidance, continueAdding);
    if (stage === "p2") executeStage2(guidance, continueAdding);
    if (stage === "p3") executeStage3(guidance, continueAdding);
    if (stage === "p4") executeStage4(guidance, continueAdding);
  };

  // Master progress director
  const approveAndProgress = (currentStage: "p1" | "p2" | "p3" | "p4") => {
    if (currentStage === "p1") {
      setActiveTab("p2");
      if (!stageOutputs.p2) {
        executeStage2();
      } else {
        showToast("Switched to Stage 2. Verified loaded data.");
      }
    } else if (currentStage === "p2") {
      setActiveTab("p3");
      if (!stageOutputs.p3) {
        executeStage3();
      } else {
        showToast("Switched to Stage 3. Verified audited data.");
      }
    } else if (currentStage === "p3") {
      setActiveTab("p4");
      if (!stageOutputs.p4) {
        executeStage4();
      } else {
        showToast("Switched to final Stage 4.");
      }
    }
  };

  // Toggle raw text editing
  const handleToggleEditMode = (stage: "p1" | "p2" | "p3" | "p4") => {
    setIsEditing((prev) => {
      const nextVal = !prev[stage];
      if (!nextVal) {
        showToast("Manual modifications saved locally!");
      }
      return { ...prev, [stage]: nextVal };
    });
  };

  const handleManualTextChange = (stage: "p1" | "p2" | "p3" | "p4", val: string) => {
    setStageOutputs((prev) => ({ ...prev, [stage]: val }));
  };

  const handleResetWorkspace = () => {
    setInputText("");
    setStageOutputs({ p1: "", p2: "", p3: "", p4: "" });
    setStageCompleted({ p1: false, p2: false, p3: false, p4: false });
    setStageLoading({ p1: false, p2: false, p3: false, p4: false });
    setStageFeedback({ p1: "", p2: "", p3: "", p4: "" });
    setIsEditing({ p1: false, p2: false, p3: false, p4: false });
    setPipelineStep("idle");
    setActiveTab("p1");
    setError(null);
    showToast("Workspace was completely re-initialized.");
  };

  const exportTriplesToCSV = () => {
    const sourceText = stageOutputs.p4 || stageOutputs.p3 || stageOutputs.p2 || stageOutputs.p1;
    if (!sourceText) {
      showToast("No structured tables extracted yet to translate.");
      return;
    }

    const lines = sourceText.split("\n");
    const triplesRows: string[][] = [];
    let isRecording = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("|")) {
        const lower = trimmed.toLowerCase();
        if (lower.includes("subject") && lower.includes("predicate") && lower.includes("object")) {
          isRecording = true;
          const cols = trimmed.split("|").map(col => col.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          triplesRows.push(cols);
          continue;
        }

        if (isRecording) {
          if (trimmed.replace(/[\s|:-]/g, "") === "") {
            continue;
          }
          if (lower.includes("coanonical_label") || lower.includes("entity_type")) {
            isRecording = false;
            continue;
          }
          const cols = trimmed.split("|").map(col => col.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          triplesRows.push(cols);
        }
      } else if (trimmed.startsWith("#") && isRecording) {
        isRecording = false;
      }
    }

    if (triplesRows.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("|")) {
          if (trimmed.replace(/[\s|:-]/g, "") === "") continue;
          const cols = trimmed.split("|").map(col => col.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          if (cols.length >= 3) {
            triplesRows.push(cols);
          }
        }
      }
    }

    if (triplesRows.length === 0) {
      showToast("No standard markdown tabular layout found in selection to convert to CSV format. Please view table.");
      return;
    }

    const csvContent = triplesRows
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

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Tiber_Valley_KnowledgeGraph_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV file successfully prepared.");
  };

  // Visual helper
  const getStageMetadata = (stage: "p1" | "p2" | "p3" | "p4") => {
    const map = { p1: 1, p2: 2, p3: 3, p4: 4 };
    return map[stage];
  };

  const isActiveStageLoading = stageLoading[activeTab];
  const hasStageData = !!stageOutputs[activeTab];

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-slate-300 font-sans overflow-hidden border-8 border-[#1A1A1A] select-none">
      
      {/* Toast Notification */}
      {feedback && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider rounded border border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.5)] flex items-center gap-2 animate-bounce">
          <Sparkle className="w-3.5 h-3.5 fill-black" />
          {feedback}
        </div>
      )}

      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0F0F0F] border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-600 rounded-sm flex items-center justify-center text-black font-extrabold tracking-tighter italic select-none">
            KG
          </div>
          <div>
            <h1 className="text-lg font-serif text-slate-100 tracking-wide">
              Chronos <span className="text-amber-500/80">Interactive</span>
            </h1>
            <p className="text-[10px] text-slate-500 lowercase">stage-by-stage knowledge graph workshop</p>
          </div>
        </div>

        <div className="flex gap-4 items-center text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          <span className="text-emerald-500 flex items-center gap-1.5 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Mode: {pipelineMode === "interactive" ? "Human-In-The-Loop" : "Autopilot Sequential"}
          </span>
          <span className="px-2.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-[10px] font-mono">Carleton / Gemini LLM</span>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Hand Column: Input details & Execution triggers */}
        <section className="w-1/2 bg-[#050505] border-r border-slate-800 flex flex-col p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" /> Active Source Literature
            </h2>
            <button
              onClick={handleResetWorkspace}
              className="text-[10.5px] hover:text-white text-slate-500 flex items-center gap-1 transition-colors font-semibold uppercase tracking-wider"
              title="Reset raw values and clear outputs"
            >
              <RotateCcw className="w-3 h-3" /> Re-init
            </button>
          </div>

          {/* Source input editor textarea */}
          <div className="flex-1 flex flex-col min-h-0">
            <textarea
              className="flex-1 w-full bg-[#0A0A0A] border border-slate-900 rounded p-4 font-serif text-sm leading-relaxed text-slate-300 placeholder-slate-700 resize-none focus:outline-none focus:border-amber-500/40 transition-all select-text"
              placeholder="Paste raw Tiber Valley literature synthesis text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-950/10 border border-red-900/40 text-red-400 text-xs rounded flex items-start gap-1.5 leading-relaxed shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Workspace Stage Tracker Map */}
          <div className="mt-4 p-3 bg-[#0A0A0A] border border-slate-800 rounded-lg shrink-0">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2 font-mono">
              <span>Pipeline Stage Checklist</span>
              <span className="text-amber-500 font-bold">
                {pipelineStep === "completed" ? "Successfully Compiled" : "Interactive Map"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[9px]">
              <button
                onClick={() => setActiveTab("p1")}
                className={`p-1.5 border rounded cursor-pointer transition-all ${
                  stageCompleted.p1
                    ? "bg-green-950/20 border-green-800 text-green-400 font-semibold"
                    : activeTab === "p1"
                    ? "bg-amber-950/40 border-amber-500 text-amber-200"
                    : "bg-[#0A0A0A] border-slate-900 text-slate-600 hover:text-slate-400"
                }`}
              >
                1. Reify Tags
              </button>
              <button
                onClick={() => {
                  if (stageCompleted.p1 || stageOutputs.p1) {
                    setActiveTab("p2");
                  } else {
                    showToast("Please run Stage 1 first.");
                  }
                }}
                className={`p-1.5 border rounded cursor-pointer transition-all ${
                  stageCompleted.p2
                    ? "bg-green-950/20 border-green-800 text-green-400 font-semibold"
                    : activeTab === "p2"
                    ? "bg-amber-950/40 border-amber-500 text-amber-200"
                    : "bg-[#0A0A0A] border-slate-900 text-slate-600 hover:text-slate-400"
                }`}
              >
                2. Seed Triples
              </button>
              <button
                onClick={() => {
                  if (stageCompleted.p2 || stageOutputs.p2) {
                    setActiveTab("p3");
                  } else {
                    showToast("Please run Stage 1 and 2 first.");
                  }
                }}
                className={`p-1.5 border rounded cursor-pointer transition-all ${
                  stageCompleted.p3
                    ? "bg-green-950/20 border-green-800 text-green-400 font-semibold"
                    : activeTab === "p3"
                    ? "bg-amber-950/40 border-amber-500 text-amber-200"
                    : "bg-[#0A0A0A] border-slate-900 text-slate-600 hover:text-slate-400"
                }`}
              >
                3. Class Audits
              </button>
              <button
                onClick={() => {
                  if (stageCompleted.p3 || stageOutputs.p3) {
                    setActiveTab("p4");
                  } else {
                    showToast("Please run previous stages first.");
                  }
                }}
                className={`p-1.5 border rounded cursor-pointer transition-all ${
                  stageCompleted.p4
                    ? "bg-green-950/20 border-green-800 text-green-400 font-semibold"
                    : activeTab === "p4"
                    ? "bg-amber-950/40 border-amber-500 text-amber-200"
                    : "bg-[#0A0A0A] border-slate-900 text-slate-600 hover:text-slate-400"
                }`}
              >
                4. Final Graph
              </button>
            </div>
          </div>

          {/* Master Execution Options */}
          <div className="grid grid-cols-2 gap-3 mt-4 shrink-0">
            <button
              onClick={() => {
                setPipelineMode("interactive");
                setActiveTab("p1");
                executeStage1();
              }}
              disabled={loading || isActiveStageLoading || !inputText.trim()}
              className="py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:bg-slate-950 text-slate-200 disabled:text-slate-600 font-bold text-xs uppercase tracking-widest rounded transition-all flex items-center justify-center gap-1.5 select-none"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-500" />
              Step-by-Step Workbench
            </button>
            <button
              onClick={runAutopilotPipeline}
              disabled={loading || isActiveStageLoading || !inputText.trim()}
              className="py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-black font-extrabold text-xs uppercase tracking-widest rounded transition-all shadow-md flex items-center justify-center gap-1.5 select-none"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              Launch Autopilot Pass
            </button>
          </div>
        </section>

        {/* Right Hand Column: Pipeline Displays & Interactive Dialogue controls */}
        <section className="w-1/2 bg-[#050505] flex flex-col p-6 overflow-hidden">
          
          {/* Header Controls for Tab outputs */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" /> Pipeline Inspector
            </h2>

            {hasStageData && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleToggleEditMode(activeTab)}
                  className={`px-2 py-1 border rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    isEditing[activeTab]
                      ? "bg-amber-600 text-black border-amber-600"
                      : "bg-[#0C0C0C] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                  }`}
                  title="Manually alter the tabular content details"
                >
                  {isEditing[activeTab] ? (
                    <>
                      <Save className="w-3 h-3" />
                      <span>Lock Changes</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3 h-3" />
                      <span>Manually Edit</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(stageOutputs[activeTab])}
                  className="p-1 px-2 bg-[#0C0C0C] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
                  title="Copy output text details"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => downloadTextFile(`Chronos_Stage_${activeTab.toUpperCase()}_Extract.md`, stageOutputs[activeTab])}
                  className="p-1 px-2 bg-[#0C0C0C] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
                  title="Save markdown content"
                >
                  <Download className="w-3 h-3" />
                  <span>Save</span>
                </button>
                <button
                  onClick={exportTriplesToCSV}
                  className="p-1 px-2 bg-[#0C0C0C] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
                  title="Translate values to CSV structured columns"
                >
                  <FileSpreadsheet className="w-3 h-3 text-amber-500" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Active stage tab selectors */}
            <div className="flex border-b border-slate-800 mb-3 shrink-0 font-mono text-xs">
              {(["p1", "p2", "p3", "p4"] as const).map((stage) => {
                const numericVal = getStageMetadata(stage);
                const hasData = !!stageOutputs[stage];
                const active = activeTab === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => {
                      if (hasData || stage === "p1") {
                        setActiveTab(stage);
                        setError(null);
                      } else {
                        showToast(`Run preceding stages to unlock Stage ${numericVal}.`);
                      }
                    }}
                    className={`flex-1 py-1 px-2 text-center border-b-2 transition-all flex items-center justify-center gap-1 font-semibold ${
                      active
                        ? "border-amber-500 text-amber-500 bg-amber-500/5"
                        : hasData
                        ? "border-transparent text-slate-400 hover:text-slate-200"
                        : "border-transparent text-slate-700"
                    }`}
                  >
                    <span>Pass {numericVal}</span>
                    {stageCompleted[stage] && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </button>
                );
              })}
            </div>

            {/* Display Readout box OR load state tracker spinner */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {isActiveStageLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-slate-900 rounded bg-[#0A0A0A]/40 relative">
                  <Activity className="w-6 h-6 text-amber-500 animate-spin mb-4" />
                  <div className="text-center">
                    <p className="text-[11px] font-mono text-slate-400 animate-pulse uppercase tracking-wider">
                      {activeTab === "p1" && "Pass 1: Tagging canonical entities & provenance markers..."}
                      {activeTab === "p2" && "Pass 2: Seeding core triples via 16 strict standard predicates..."}
                      {activeTab === "p3" && "Pass 3: Analyzing Class 1-8 Checklists (Shocks/Feedback)..."}
                      {activeTab === "p4" && "Pass 4: Compiling consolidated matrices & canonical directory..."}
                    </p>
                    <span className="text-[9px] text-slate-600 block mt-2 uppercase tracking-widest font-mono">Running model verification</span>
                  </div>
                </div>
              ) : !hasStageData ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-900 rounded bg-[#0A0A0A]/40">
                  <Terminal className="w-8 h-8 text-slate-700 mb-3" />
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold">Waiting for Pipeline Stage {getStageMetadata(activeTab)} execution</h3>
                  <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed mt-2 uppercase tracking-wide">
                    Click 'Step-by-Step Workbench' to execute the pipeline starting here.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {/* The display block (editable if user triggered manually) */}
                  <div className="flex-1 bg-[#0A0A0A] border border-slate-900 rounded p-4 overflow-auto scrollbar-thin select-text">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2 shrink-0">
                      <span className="text-[9px] uppercase font-mono text-slate-500">
                        {isEditing[activeTab] ? "Live Document Sandbox Editor" : "Markdown High-Fidelity Pre-wrap Console"}
                      </span>
                      <span className="text-[8px] uppercase font-mono text-amber-500 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                        Unlocked
                      </span>
                    </div>

                    {isEditing[activeTab] ? (
                      <textarea
                        className="w-full h-[90%] bg-transparent border-0 text-xs text-slate-300 font-mono focus:outline-none p-1 resize-none select-text"
                        value={stageOutputs[activeTab]}
                        onChange={(e) => handleManualTextChange(activeTab, e.target.value)}
                      />
                    ) : (
                      <pre className="text-xs font-mono leading-relaxed text-slate-300 whitespace-pre-wrap select-text focus:outline-none">
                        {stageOutputs[activeTab]}
                      </pre>
                    )}
                  </div>

                  {/* Dynamic interactive workflow guidance panel & corrective dialogue */}
                  <div className="mt-3 p-4 border border-slate-800 rounded bg-[#0B0B0B] flex flex-col gap-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold font-mono text-[10px]">
                          {getStageMetadata(activeTab)}
                        </div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-200 font-bold">
                          {stageTitles[activeTab]} Dialogue
                        </h3>
                      </div>
                      {stageCompleted[activeTab] && (
                        <span className="px-2 py-0.5 bg-green-950/30 text-green-400 border border-green-900/40 rounded text-[8px] font-mono uppercase tracking-widest flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Checked & Locked
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wider font-mono">
                      {stageDescriptions[activeTab]}
                    </p>

                    {/* Stage Dialogue Console Form */}
                    <div className="border border-slate-900 rounded p-3 bg-[#0A0A0A] flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[9px] font-mono uppercase">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                        <span>Stage Guidance / Corrective Instructions</span>
                      </div>
                      <textarea
                        placeholder={stagePlaceholders[activeTab]}
                        value={stageFeedback[activeTab]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStageFeedback((prev) => ({ ...prev, [activeTab]: val }));
                        }}
                        className="w-full bg-[#0E0E0E] border border-slate-800 rounded p-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 resize-none h-14 select-text"
                      />

                      <div className="grid grid-cols-2 gap-2 shrink-0">
                        <button
                          onClick={() => handleStageAction(activeTab, false)}
                          disabled={isActiveStageLoading || isEditing[activeTab]}
                          className="py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:bg-[#080808] disabled:text-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                          Redo Stage
                        </button>

                        <button
                          onClick={() => handleStageAction(activeTab, true)}
                          disabled={isActiveStageLoading || isEditing[activeTab]}
                          className="py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:bg-[#080808] disabled:text-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                          Continue to Add Data
                        </button>
                      </div>
                    </div>

                    {/* Progress trigger */}
                    <div>
                      {activeTab !== "p4" ? (
                        <button
                          onClick={() => approveAndProgress(activeTab)}
                          disabled={isEditing[activeTab] || isActiveStageLoading}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-black font-extrabold text-[11px] uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md select-none"
                        >
                          <span>Lock & Progress to Stage {getStageMetadata(activeTab) + 1}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-black font-bold" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            showToast("All stage modifications locked and knowledge graph fully finalized!");
                            setPipelineStep("completed");
                          }}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md select-none"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Finalize & Lock Pipeline</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </section>

      </div>

      {/* Footer System Tray */}
      <footer className="h-9 bg-[#0F0F0F] border-t border-slate-800 flex items-center px-6 text-[10px] text-slate-500 gap-8 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          System Ready
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span>|</span>
          <span>neat, eh?</span>
        </div>
        <div className="ml-auto font-mono text-slate-600">
          STATUS: {loading || Object.values(stageLoading).some(Boolean) ? "PROCESS_ACTIVE" : "STANDBY"} // STAGE_MAP: ACTIVE_DOCKER
        </div>
      </footer>

    </div>
  );
}
