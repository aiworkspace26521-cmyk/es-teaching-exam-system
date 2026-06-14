import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Settings, 
  ArrowRight, 
  Award, 
  AlertTriangle, 
  HelpCircle, 
  RotateCcw,
  Sparkles,
  Save,
  Check,
  X
} from "lucide-react";
import textbooksData from "./data/textbooks.json";
import mockExamsData from "./data/mock_exams.json";

// Helper function to render mathematical formulas
const parseMathContent = (text) => {
  if (!text) return "";
  
  // Replace standard symbols
  let processed = text
    .replace(/\{<=\}/g, "≤")
    .replace(/\{>=\}/g, "≥")
    .replace(/\{!=\}/g, "≠")
    .replace(/\{\*\}/g, "×")
    .replace(/\{\/\}/g, "÷");

  const parts = [];
  let currentIndex = 0;
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(processed)) !== null) {
    if (match.index > currentIndex) {
      parts.push(processed.substring(currentIndex, match.index));
    }

    const expression = match[1];
    if (expression.startsWith("frac(")) {
      const commaIndex = expression.indexOf(",");
      if (commaIndex !== -1) {
        const num = expression.substring(5, commaIndex);
        const den = expression.substring(commaIndex + 1, expression.length - 1);
        parts.push(
          <span key={match.index} className="math-frac">
            <span className="math-frac-num">{num}</span>
            <span className="math-frac-den">{den}</span>
          </span>
        );
      } else {
        parts.push(match[0]);
      }
    } else if (expression.includes("^")) {
      const caretIndex = expression.indexOf("^");
      const base = expression.substring(0, caretIndex);
      const exp = expression.substring(caretIndex + 1);
      parts.push(<span key={match.index}>{base}<sup>{exp}</sup></span>);
    } else if (expression.includes("_")) {
      const underIndex = expression.indexOf("_");
      const base = expression.substring(0, underIndex);
      const sub = expression.substring(underIndex + 1);
      parts.push(<span key={match.index}>{base}<sub>{sub}</sub></span>);
    } else {
      parts.push(expression);
    }

    currentIndex = regex.lastIndex;
  }

  if (currentIndex < processed.length) {
    parts.push(processed.substring(currentIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Default publisher helper based on subject and grade
const getDefaultPublisher = (subj, grd) => {
  if (subj === "math") {
    return grd === "五年級" ? "康軒" : "翰林";
  }
  if (subj === "chinese") {
    return grd === "五年級" ? "翰林" : "南一";
  }
  if (subj === "english") {
    return "何嘉仁";
  }
  if (subj === "science") {
    return "翰林";
  }
  if (subj === "social") {
    return grd === "五年級" ? "康軒" : "翰林";
  }
  return "康軒";
};

// Helper function to shuffle loaded offline exam
const shuffleLoadedExam = (exam) => {
  if (!exam || !exam.questions) return exam;

  // 1. Deep clone the exam object to avoid mutating the original import
  const newExam = JSON.parse(JSON.stringify(exam));

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // 2. Separate questions by type
  const mcQuestions = newExam.questions.filter((q) => q.type === "mc");
  const blankQuestions = newExam.questions.filter((q) => q.type === "blank");
  const openQuestions = newExam.questions.filter((q) => q.type === "open");

  // 3. Shuffle each type independently to maintain exam structure but randomize sequence
  shuffleArray(mcQuestions);
  shuffleArray(blankQuestions);
  shuffleArray(openQuestions);

  // 4. Shuffle multiple choice options and update correct answer & solution
  const shuffledMcQuestions = mcQuestions.map((q) => {
    if (!q.options || !q.answer) return q;

    const oldAnswer = q.answer; // e.g. 'A'
    const correctText = q.options[oldAnswer];

    // Shuffle options
    const optionValues = Object.values(q.options);
    shuffleArray(optionValues);

    const keys = ["A", "B", "C", "D"];
    const newOptions = {};
    let newAnswer = oldAnswer;

    optionValues.forEach((val, idx) => {
      const key = keys[idx];
      newOptions[key] = val;
      if (val === correctText) {
        newAnswer = key;
      }
    });

    q.options = newOptions;
    q.answer = newAnswer;

    // Correct the letter inside the solution text if the correct answer letter changed
    if (q.solution && oldAnswer !== newAnswer) {
      const regex = new RegExp(`(選)\\s*\\(?${oldAnswer}\\)?`, "g");
      q.solution = q.solution.replace(regex, `$1 (${newAnswer})`);
    }

    return q;
  });

  // 5. Recombine questions and re-assign sequential IDs
  const combinedQuestions = [
    ...shuffledMcQuestions,
    ...blankQuestions,
    ...openQuestions
  ];

  combinedQuestions.forEach((q, idx) => {
    q.id = idx + 1;
  });

  newExam.questions = combinedQuestions;
  return newExam;
};

// Graphic component to render beautiful mathematical diagrams dynamically
function QuestionGraphic({ graphic }) {
  if (!graphic) return null;
  const { type, params } = graphic;

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "1.5rem 0" }}>
      {type === "prism" && (
        <svg width="240" height="160" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Back faces (dashed) */}
          <line x1="90" y1="110" x2="90" y2="40" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          <line x1="90" y1="110" x2="190" y2="110" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          <line x1="90" y1="40" x2="40" y2="40" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          {/* Front Face */}
          <rect x="40" y="70" width="100" height="70" fill="none" stroke="var(--secondary)" strokeWidth="2" />
          {/* Back Top/Right */}
          <line x1="140" y1="70" x2="190" y2="40" stroke="var(--secondary)" strokeWidth="2" />
          <line x1="140" y1="140" x2="190" y2="110" stroke="var(--secondary)" strokeWidth="2" />
          <line x1="40" y1="70" x2="90" y2="40" stroke="var(--secondary)" strokeWidth="2" />
          <line x1="190" y1="40" x2="190" y2="110" stroke="var(--secondary)" strokeWidth="2" />
          <line x1="90" y1="40" x2="190" y2="40" stroke="var(--secondary)" strokeWidth="2" />
          {/* Labels */}
          <text x="90" y="155" fill="var(--text-secondary)" fontSize="12" textAnchor="middle">長 {params.length}</text>
          <text x="175" y="135" fill="var(--text-secondary)" fontSize="12" textAnchor="middle">寬 {params.width}</text>
          <text x="155" y="105" fill="var(--text-secondary)" fontSize="12" textAnchor="start">高 {params.height}</text>
        </svg>
      )}

      {type === "cube" && (
        <svg width="200" height="160" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Back faces (dashed) */}
          <line x1="80" y1="110" x2="80" y2="40" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          <line x1="80" y1="110" x2="150" y2="110" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          <line x1="80" y1="40" x2="40" y2="40" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4" />
          {/* Front Face */}
          <rect x="40" y="80" width="70" height="70" fill="none" stroke="var(--accent)" strokeWidth="2" />
          {/* Perspective lines */}
          <line x1="110" y1="80" x2="150" y2="40" stroke="var(--accent)" strokeWidth="2" />
          <line x1="110" y1="150" x2="150" y2="110" stroke="var(--accent)" strokeWidth="2" />
          <line x1="40" y1="80" x2="80" y2="40" stroke="var(--accent)" strokeWidth="2" />
          <line x1="150" y1="40" x2="150" y2="110" stroke="var(--accent)" strokeWidth="2" />
          <line x1="80" y1="40" x2="150" y2="40" stroke="var(--accent)" strokeWidth="2" />
          {/* Labels */}
          <text x="75" y="165" fill="var(--text-secondary)" fontSize="12" textAnchor="middle">邊長 {params.edge}</text>
        </svg>
      )}

      {type === "lineChart" && (
        <svg width="260" height="160" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Y Gridlines & Labels */}
          {[0, 10, 20, 30, 40].map((val, i) => {
            const y = 120 - val * 2.2;
            return (
              <g key={val}>
                <line x1="40" y1={y} x2="240" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <text x="32" y={y + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">{val}</text>
              </g>
            );
          })}
          {/* X Labels */}
          {["一", "二", "三", "四", "五"].map((day, i) => {
            const x = 50 + i * 42;
            return (
              <text key={day} x={x} y="138" fill="var(--text-muted)" fontSize="11" textAnchor="middle">週{day}</text>
            );
          })}
          {/* Axes */}
          <line x1="40" y1="20" x2="40" y2="120" stroke="var(--text-muted)" strokeWidth="1.5" />
          <line x1="40" y1="120" x2="240" y2="120" stroke="var(--text-muted)" strokeWidth="1.5" />
          {/* Graph Path */}
          <path
            d="M 50 98 L 92 87 L 134 98 L 176 65 L 218 32"
            fill="none"
            stroke="var(--secondary)"
            strokeWidth="3"
          />
          {/* Dots */}
          {[
            { x: 50, y: 98, val: 10 },
            { x: 92, y: 87, val: 15 },
            { x: 134, y: 98, val: 10 },
            { x: 176, y: 65, val: 25 },
            { x: 218, y: 32, val: 40 }
          ].map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="5" fill="var(--bg-main)" stroke="var(--secondary)" strokeWidth="2.5" />
              <text x={pt.x} y={pt.y - 8} fill="var(--text-primary)" fontSize="9" fontWeight="bold" textAnchor="middle">{pt.val}</text>
            </g>
          ))}
        </svg>
      )}

      {type === "tag" && (
        <svg width="240" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Tag Body */}
          <path d="M 30 30 L 170 30 L 210 75 L 170 120 L 30 120 Z" fill="rgba(99, 102, 241, 0.1)" stroke="var(--primary)" strokeWidth="2" />
          {/* Tag Hole */}
          <circle cx="190" cy="75" r="6" fill="var(--bg-main)" stroke="var(--primary)" strokeWidth="1.5" />
          <line x1="196" y1="75" x2="230" y2="75" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="3" />
          {/* Tag Content */}
          <text x="100" y="55" fill="var(--text-primary)" fontSize="14" fontWeight="bold" textAnchor="middle">大衣定價: {params.price} 元</text>
          <rect x="40" y="65" width="120" height="1" fill="rgba(255,255,255,0.1)" />
          <text x="45" y="85" fill="var(--secondary)" fontSize="11" textAnchor="start">① 家樂福：打八折</text>
          <text x="45" y="105" fill="var(--accent)" fontSize="11" textAnchor="start">② 大潤發：便宜 25%</text>
        </svg>
      )}

      {type === "warehouse" && (
        <svg width="240" height="160" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Roof Line */}
          <polygon points="50,60 110,30 170,60" fill="rgba(236, 72, 153, 0.15)" stroke="var(--accent)" strokeWidth="2" />
          <polygon points="110,30 175,10 230,35 170,60" fill="rgba(236, 72, 153, 0.1)" stroke="var(--accent)" strokeWidth="2" />
          {/* Side wall */}
          <polygon points="170,60 230,35 230,95 170,120" fill="rgba(15, 23, 42, 0.5)" stroke="var(--accent)" strokeWidth="2" />
          {/* Front wall */}
          <rect x="50" y="60" width="120" height="60" fill="none" stroke="var(--accent)" strokeWidth="2" />
          {/* Door */}
          <rect x="95" y="90" width="30" height="30" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          {/* Labels */}
          <text x="110" y="138" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">長 {params.length}</text>
          <text x="205" y="90" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">寬 {params.width}</text>
          <text x="35" y="95" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">高 {params.height}</text>
        </svg>
      )}

      {type === "factory" && (
        <svg width="240" height="140" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Clock Circle */}
          <circle cx="70" cy="70" r="45" fill="rgba(14, 165, 233, 0.1)" stroke="var(--secondary)" strokeWidth="2" />
          <circle cx="70" cy="70" r="3" fill="var(--secondary)" />
          {/* Clock Hands indicating 7:40 */}
          <line x1="70" y1="70" x2="52" y2="85" stroke="var(--text-primary)" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="70" y1="70" x2="38" y2="88" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          
          {/* Calendar Block */}
          <rect x="135" y="35" width="80" height="70" rx="8" fill="rgba(255,255,255,0.05)" stroke="var(--border)" strokeWidth="1.5" />
          <rect x="135" y="35" width="80" height="20" rx="4" fill="var(--primary)" />
          <text x="175" y="49" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">WORKING</text>
          <text x="175" y="75" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle">{params.days}</text>
          <text x="175" y="93" fill="var(--text-muted)" fontSize="9" textAnchor="middle">工作天數</text>
          
          <text x="70" y="130" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">日工時: {params.hours}小時{params.minutes}分</text>
        </svg>
      )}

      {type === "grid" && (
        <svg width="260" height="140" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Land Border */}
          <rect x="25" y="30" width="210" height="80" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
          {/* Forest Reserve Area (80 ha) */}
          <rect x="25" y="30" width="90" height="80" fill="rgba(16, 185, 129, 0.15)" stroke="var(--success)" strokeWidth="2" />
          <text x="70" y="65" fill="var(--success)" fontSize="11" fontWeight="bold" textAnchor="middle">森林保護區</text>
          <text x="70" y="85" fill="var(--text-secondary)" fontSize="10" textAnchor="middle">{params.forestArea}</text>
          
          {/* Remaining split into 5 projects */}
          {[1, 2, 3, 4, 5].map((idx) => {
            const x = 115 + (idx - 1) * 24;
            return (
              <g key={idx}>
                <rect x={x} y="30" width="24" height="80" fill="rgba(14, 165, 233, 0.05)" stroke="var(--border)" strokeWidth="1" />
                <text x={x + 12} y="75" fill="var(--secondary)" fontSize="10" fontWeight="bold" textAnchor="middle">{idx}</text>
              </g>
            );
          })}
          
          {/* Labels */}
          <text x="175" y="20" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">剩餘土地均分 5 個建案</text>
          <text x="130" y="125" fill="var(--text-muted)" fontSize="10" textAnchor="middle">總面積 {params.totalArea}</text>
        </svg>
      )}

      {type === "hospital" && (
        <svg width="200" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Building */}
          <rect x="50" y="40" width="100" height="90" fill="rgba(239, 68, 68, 0.05)" stroke="var(--error)" strokeWidth="2" />
          {/* Roof */}
          <polygon points="40,40 100,10 160,40" fill="rgba(239, 68, 68, 0.1)" stroke="var(--error)" strokeWidth="2" />
          {/* Red Cross */}
          <rect x="92" y="55" width="16" height="30" fill="var(--error)" />
          <rect x="85" y="62" width="30" height="16" fill="var(--error)" />
          {/* Door */}
          <rect x="85" y="100" width="30" height="30" fill="none" stroke="var(--error)" strokeWidth="1.5" />
          <line x1="100" y1="100" x2="100" y2="130" stroke="var(--error)" strokeWidth="1.5" />
        </svg>
      )}

      {type === "postOffice" && (
        <svg width="200" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          <rect x="50" y="45" width="100" height="85" fill="rgba(16, 185, 129, 0.05)" stroke="var(--success)" strokeWidth="2" />
          <polygon points="40,45 100,15 160,45" fill="rgba(16, 185, 129, 0.1)" stroke="var(--success)" strokeWidth="2" />
          {/* Envelope Icon */}
          <rect x="80" y="65" width="40" height="25" fill="none" stroke="var(--success)" strokeWidth="1.5" />
          <path d="M 80 65 L 100 80 L 120 65" fill="none" stroke="var(--success)" strokeWidth="1.5" />
          {/* Door */}
          <rect x="85" y="100" width="30" height="30" fill="none" stroke="var(--success)" strokeWidth="1.5" />
        </svg>
      )}

      {type === "bakery" && (
        <svg width="200" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          <rect x="50" y="45" width="100" height="85" fill="rgba(245, 158, 11, 0.05)" stroke="var(--secondary)" strokeWidth="2" />
          <polygon points="40,45 100,15 160,45" fill="rgba(245, 158, 11, 0.1)" stroke="var(--secondary)" strokeWidth="2" />
          {/* Bread Icon */}
          <path d="M 75 80 C 75 70, 85 65, 100 65 C 115 65, 125 70, 125 80 C 125 90, 115 95, 100 95 C 85 95, 75 90, 75 80 Z" fill="rgba(245, 158, 11, 0.2)" stroke="var(--secondary)" strokeWidth="1.5" />
          <line x1="90" y1="70" x2="90" y2="90" stroke="var(--secondary)" strokeWidth="1" />
          <line x1="100" y1="70" x2="100" y2="90" stroke="var(--secondary)" strokeWidth="1" />
          <line x1="110" y1="70" x2="110" y2="90" stroke="var(--secondary)" strokeWidth="1" />
          {/* Door */}
          <rect x="85" y="100" width="30" height="30" fill="none" stroke="var(--secondary)" strokeWidth="1.5" />
        </svg>
      )}

      {type === "soundWave" && (
        <svg width="240" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Center line */}
          <line x1="30" y1="75" x2="210" y2="75" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          {/* Grid lines */}
          <line x1="30" y1="35" x2="210" y2="35" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
          <line x1="30" y1="115" x2="210" y2="115" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
          {/* High Frequency or Amplitude Wave */}
          <path
            d={params.waveType === "highFreq" 
              ? "M 30 75 Q 37.5 35 45 75 T 60 75 T 75 75 T 90 75 T 105 75 T 120 75 T 135 75 T 150 75 T 165 75 T 180 75 T 195 75 T 210 75" 
              : params.waveType === "highAmp"
              ? "M 30 75 Q 75 15 120 75 T 210 75"
              : "M 30 75 Q 75 50 120 75 T 210 75"}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth="2"
          />
          <text x="120" y="138" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">
            {params.label || "聲音波形示意圖"}
          </text>
        </svg>
      )}

      {type === "circuit" && (
        <svg width="220" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Battery */}
          <rect x="90" y="25" width="40" height="20" fill="none" stroke="var(--primary)" strokeWidth="2" />
          <rect x="130" y="31" width="5" height="8" fill="var(--primary)" />
          <text x="80" y="38" fill="var(--text-muted)" fontSize="10">-</text>
          <text x="142" y="38" fill="var(--text-muted)" fontSize="10">+</text>
          {/* Bulb */}
          <circle cx="110" cy="115" r="15" fill={params.lit ? "rgba(234, 179, 8, 0.2)" : "none"} stroke="var(--warning)" strokeWidth="2" />
          {/* Filament */}
          <path d="M 102 115 Q 110 100 118 115" fill="none" stroke="var(--warning)" strokeWidth="1.5" />
          {/* Glow rays if lit */}
          {params.lit && (
            <g stroke="var(--warning)" strokeWidth="1.5">
              <line x1="110" y1="92" x2="110" y2="82" />
              <line x1="94" y1="100" x2="86" y2="94" />
              <line x1="126" y1="100" x2="134" y2="94" />
              <line x1="94" y1="130" x2="86" y2="136" />
              <line x1="126" y1="130" x2="134" y2="136" />
            </g>
          )}
          {/* Switch */}
          <g>
            <circle cx="40" cy="70" r="3" fill="var(--text-primary)" />
            <circle cx="70" cy="70" r="3" fill="var(--text-primary)" />
            {params.closed ? (
              <line x1="40" y1="70" x2="70" y2="70" stroke="var(--text-primary)" strokeWidth="2.5" />
            ) : (
              <line x1="40" y1="70" x2="65" y2="50" stroke="var(--text-primary)" strokeWidth="2.5" />
            )}
            <text x="55" y="85" fill="var(--text-secondary)" fontSize="9" textAnchor="middle">
              {params.closed ? "通路" : "斷路"}
            </text>
          </g>
          {/* Wires */}
          <path d="M 90 35 L 40 35 L 40 70" fill="none" stroke="var(--border)" strokeWidth="1.5" />
          <path d="M 70 70 L 70 115 L 95 115" fill="none" stroke="var(--border)" strokeWidth="1.5" />
          <path d="M 125 115 L 180 115 L 180 35 L 135 35" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        </svg>
      )}

      {type === "taiwanMap" && (
        <svg width="180" height="220" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* A simplified polygon outlining Taiwan shape */}
          <polygon
            points="90,15 105,30 115,50 120,70 125,95 120,120 110,145 95,175 85,195 72,205 65,200 68,185 70,165 72,145 68,125 60,105 55,85 62,60 72,40 82,25"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          {/* Marked spots */}
          {params.spots && params.spots.map((spot, idx) => (
            <g key={idx}>
              <circle cx={spot.x} cy={spot.y} r="5" fill="var(--accent)" />
              <text x={spot.x + 8} y={spot.y + 4} fill="var(--text-primary)" fontSize="10" fontWeight="bold">{spot.label}</text>
            </g>
          ))}
          <text x="90" y="212" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
            {params.title || "臺灣地圖示意圖"}
          </text>
        </svg>
      )}

      {type === "pieChart" && (
        <svg width="200" height="150" style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {/* Simple SVG Pie segments using standard stroke-dasharray */}
          <circle cx="80" cy="75" r="30" fill="none" stroke="var(--primary)" strokeWidth="60" strokeDasharray="56.5 131.9" transform="rotate(-90 80 75)" style={{ opacity: 0.8 }} />
          <circle cx="80" cy="75" r="30" fill="none" stroke="var(--secondary)" strokeWidth="60" strokeDasharray="94.2 94.2" transform="rotate(18 80 75)" style={{ opacity: 0.8 }} />
          <circle cx="80" cy="75" r="30" fill="none" stroke="var(--accent)" strokeWidth="60" strokeDasharray="37.7 150.7" transform="rotate(198 80 75)" style={{ opacity: 0.8 }} />
          {/* Legend */}
          {params.labels && params.labels.map((lbl, idx) => (
            <g key={idx} transform={`translate(140, ${35 + idx * 25})`}>
              <rect x="0" y="0" width="12" height="12" fill={idx === 0 ? "var(--primary)" : idx === 1 ? "var(--secondary)" : "var(--accent)"} rx="2" />
              <text x="18" y="10" fill="var(--text-secondary)" fontSize="10">{lbl}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function App() {
  // App states
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("六年級");
  const [semester, setSemester] = useState("2");
  const [subject, setSubject] = useState("math");
  const [publisher, setPublisher] = useState("康軒");
  const [examType, setExamType] = useState("期末考");
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [customPrompt, setCustomPrompt] = useState("");
  
  const [currentScreen, setCurrentScreen] = useState("dashboard"); // dashboard, config, exam, result
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Settings state (Gemini, Google Sheets)
  const [settings, setSettings] = useState({
    geminiApiKey: localStorage.getItem("es_exam_gemini_api_key") || "",
    googleScriptUrl: localStorage.getItem("es_exam_google_script_url") || "https://script.google.com/macros/s/AKfycbyktbvfQKxCRoRmOuy8jvNomVTuHH41Ltxo9CDtFV53XGIrI1yPJK3BEFzur8COXXKNwA/exec"
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  
  // Exam states
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [gradedResult, setGradedResult] = useState(null);
  const [extensionData, setExtensionData] = useState({}); // { [questionId]: { loading: boolean, question: object, studentAnswer: string, checked: boolean, correct: boolean } }
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(2400); // 40 minutes (2400 seconds)
  const timerRef = useRef(null);

  // Auto-update publisher on subject or grade change
  useEffect(() => {
    setPublisher(getDefaultPublisher(subject, grade));
  }, [subject, grade]);

  // Reset selected units on subject/publisher/grade change
  useEffect(() => {
    setSelectedUnits([]);
  }, [subject, publisher, grade, semester]);

  // Timer Countdown Logic
  useEffect(() => {
    if (currentScreen === "exam" && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentScreen, timeRemaining]);

  const saveSettings = (apiKey, scriptUrl) => {
    const trimmedKey = apiKey.trim();
    localStorage.setItem("es_exam_gemini_api_key", trimmedKey);
    localStorage.setItem("es_exam_google_script_url", scriptUrl.trim());
    setSettings({ geminiApiKey: trimmedKey, googleScriptUrl: scriptUrl.trim() });
    setSettingsModalOpen(false);
  };

  // Format time remaining MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get units list from consolidated textbooks data
  const getAvailableUnits = () => {
    const gradeNum = grade === "五年級" ? "5" : grade === "六年級" ? "6" : "";
    const term = `${gradeNum}${semester === "1" ? "上" : "下"}`;
    const subjData = textbooksData[subject];
    if (subjData && subjData.publishers && subjData.publishers[publisher] && subjData.publishers[publisher][term]) {
      return subjData.publishers[publisher][term].units || [];
    }
    return [];
  };

  // --- Client-side Gemini API generation helpers ---
  const callGeminiDirectly = async (apiKey, prompt, retries = 3, delayMs = 1500) => {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3
            }
          })
        });

        if (response.status === 429) {
          const errorText = await response.text();
          let retryAfterMs = delayMs;
          try {
            const errJson = JSON.parse(errorText);
            const retryInfo = errJson.error?.details?.find((d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo");
            if (retryInfo && retryInfo.retryDelay) {
              const match = retryInfo.retryDelay.match(/^(\d+)s$/);
              if (match) {
                retryAfterMs = (parseInt(match[1]) + 1) * 1000;
              }
            }
          } catch (parseErr) {}
          console.warn(`[callGemini] Rate limited (429). Retrying in ${retryAfterMs}ms... (Attempt ${i + 1}/${retries}).`);
          await new Promise(resolve => setTimeout(resolve, retryAfterMs));
          delayMs *= 2;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${errorText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        return JSON.parse(text.trim());
      } catch (error) {
        if (i === retries - 1) throw error;
        console.warn(`[callGemini] Error: ${error.message}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
    throw new Error("Failed to call Gemini after multiple retries");
  };

  const getMcPromptDetails = (subject, count) => {
    if (subject === "數學") {
      return `\n請生成 ${count} 題選擇題 (mc)，每題 5 分。\n規則：\n- 四選一，必須提供完整 A, B, C, D 選項。正確選項必須儘量平均分佈，且嚴格禁止連續兩題答案相同。\n- 認知層次：包含記憶 (第1級)、理解 (第2級)、應用/分析 (第3-4級)。\n- 請確保題目中數字合理、可整除。在題目文字中，若有數學符號（如分數、平方或根號），使用大括號 {} 標記，例如 {frac(3,4)} 代表 3/4 分數，{x^2} 代表平方。\n- ⚠️必須包含至少 1 題具有 "graphic" 欄位以利前端渲染。圖形題類型：\n  - 長方體表面積："graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } }\n  - 正方體表面積："graphic": { "type": "cube", "params": { "edge": "8cm" } }\n  - 折線圖讀圖題："graphic": { "type": "lineChart", "params": {} }\n  - 定價與折扣應用題："graphic": { "type": "tag", "params": { "price": "1200" } }\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "mc",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 5,\n      "question": "題目文字",\n      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },\n      "answer": "A",\n      "solution": "極簡解析",\n      "graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } } // 選填\n    }\n  ]\n}\n`;
    } else if (subject === "國語") {
      return `\n請生成 ${count} 題選擇題 (mc)，每題 3 分。\n規則：\n- 包含字音字形辨析、詞義理解、修辭判定。四選一，必須有完整 A, B, C, D，正確答案儘量均勻分佈，嚴格禁止連續兩題答案相同。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "mc",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 3,\n      "question": "題目文字",\n      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },\n      "answer": "A",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "英語") {
      return `\n請生成 ${count} 題選擇題 (mc)，每題 2 分。\n規則：\n- 包含發音辨析 (phonics)、字彙 (vocabulary)、文法 (grammar)、日常對話 (dialogue) 等類型。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。\n- 若題目是有關於社區場所 (hospital, post office, bakery)，可以加上對應的 "graphic" 欄位，例如： "graphic": { "type": "hospital", "params": {} }\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "mc",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 2,\n      "question": "題目文字",\n      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },\n      "answer": "A",\n      "solution": "極簡解析",\n      "graphic": { "type": "hospital", "params": {} } // 選填\n    }\n  ]\n}\n`;
    } else if (subject === "自然") {
      return `\n請生成 ${count} 題選擇題 (mc)，每題 4 分。\n規則：\n- 基礎概念判定、實驗數據與控制變因。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。\n- 若題目是有關於聲音或電路/實驗，可加上對應的 "graphic" 欄位，例如： "graphic": { "type": "circuit", "params": { "lit": true, "closed": true } }\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "mc",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 4,\n      "question": "題目文字",\n      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },\n      "answer": "A",\n      "solution": "極簡解析",\n      "graphic": { "type": "circuit", "params": { "lit": true, "closed": true } } // 選填\n    }\n  ]\n}\n`;
    } else { // 社會
      return `\n請生成 ${count} 題選擇題 (mc)，每題 4 分。\n規則：\n- 歷史事件、地理環境、公民民主與法律常識。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。\n- 若題目是有關於臺灣地理/位置/圓餅統計圖，可加上對應的 "graphic" 欄位，例如： "graphic": { "type": "taiwanMap", "params": { "spots": [{"x": 90, "y": 40, "label": "台北地區"}], "title": "台灣地圖位置判讀" } }\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "mc",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 4,\n      "question": "題目文字",\n      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },\n      "answer": "A",\n      "solution": "極簡解析",\n      "graphic": { "type": "taiwanMap", "params": { "spots": [{"x": 90, "y": 40, "label": "台北地區"}], "title": "台灣地圖位置判讀" } } // 選填\n    }\n  ]\n}\n`;
    }
  };

  const getBlankPromptDetails = (subject, count) => {
    if (subject === "數學") {
      return `\n請生成 ${count} 題填充題 (blank)，每題 5 分。\n規則：\n- 答案需簡短明確 (數字或特定名稱)。\n- 若有數學符號（如分數、平方或根號），使用大括號 {} 標記，例如 {frac(3,4)} 代表 3/4 分數，{x^2} 代表平方。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "blank",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 5,\n      "question": "題目文字（以 ______ 標示填空處）",\n      "answer": "答案內容",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "國語") {
      return `\n請生成 ${count} 題填充題 (blank)，每題 5 分。\n規則：\n- 代表國字注音與改錯字。例如：「在繁複的功課壓力下，我們依然要保持開朗的心境，不要因為挫折而自爆自棄。」錯字為（ 爆 ），應改正為（ 暴 ）。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "blank",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 5,\n      "question": "題目文字（以 ______ 標示填空處，或寫出錯字及改正的敘述）",\n      "answer": "答案內容",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "英語") {
      return `\n請生成 ${count} 題填充題 (blank)，每題 6 分。\n規則：\n- 看圖填單字題型。請以文字描述情境代替圖片，例如：「(Look at the picture: a girl is studying in the study room) Where is she? She is in the s_ _ _ _ (blank answer: study)」。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "blank",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 6,\n      "question": "題目文字（以文字描述圖片情境，並以底線或提示字元標示填空處，例如 s_ _ _ _）",\n      "answer": "答案內容",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "自然") {
      return `\n請生成 ${count} 題填充題 (blank)，每題 5 分。\n規則：\n- 器材名稱填寫、實驗變因分類或填空。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "blank",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 5,\n      "question": "題目文字（以 ______ 標示填空處）",\n      "answer": "答案內容",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else { // 社會
      return `\n請生成 ${count} 題配合/填充題 (blank)，每題 5 分。\n規則：\n- 人物與事蹟配合、地方政府職責填寫。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "blank",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 5,\n      "question": "題目文字（以 ______ 標示填空處，或設計人物/事蹟配合題的描述）",\n      "answer": "答案內容",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    }
  };

  const getOpenPromptDetails = (subject, count) => {
    if (subject === "數學") {
      return `\n請生成 ${count} 題應用題 (open)，每題 7.5 分。\n規則：\n- 每一題必須拆分為兩個子題 (1) 佔 3 分，(2) 佔 4.5 分。\n- 在題目文字中，若有數學符號（如分數、平方或根號），使用大括號 {} 標記。\n- ⚠️必須包含至少 1 題具有 "graphic" 欄位以利前端渲染。圖形題類型：\n  - 長方體表面積："graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } }\n  - 正方體表面積："graphic": { "type": "cube", "params": { "edge": "8cm" } }\n  - 定價與折扣應用題："graphic": { "type": "tag", "params": { "price": "4500" } }\n  - 長方體倉庫四周油漆題："graphic": { "type": "warehouse", "params": { "length": "12m", "width": "8m", "height": "4m" } }\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "open",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 7.5,\n      "question": "應用題/簡答題題目，包含 (1) 子題和 (2) 子題的敘述與配分",\n      "answer": "簡短標準答案",\n      "solution": "極簡解析與計算步驟",\n      "graphic": { "type": "warehouse", "params": { "length": "12m", "width": "8m", "height": "4m" } } // 選填\n    }\n  ]\n}\n`;
    } else if (subject === "國語") {
      return `\n請生成 ${count} 題非選擇題 (open)，每題 10 分。\n規則：\n- 代表閱讀測驗。你必須在第一題前面附加一篇 150-300 字的繁體中文白話文故事（並在文字中明顯標記為「閱讀測驗文章：[文章內容]」），然後針對該文章內容設計 ${count} 題簡答題/理解題，讓學生寫出思考解析。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "open",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 10,\n      "question": "題目內容（第 1 題必須附上閱讀測驗文章，例如：閱讀測驗文章：[文章] ... \\n\\n 題目：請問...）",\n      "answer": "簡短標準答案",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "英語") {
      return `\n請生成 ${count} 題非選擇題 (open)，每題 8 分。\n規則：\n- 包含句型重組 (Sentence Unscramble) 或閱讀測驗引導簡答（若為閱讀測驗，請附上一篇 50-100 字簡單英文短文，並提出問答題）。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "open",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 8,\n      "question": "題目內容（如重組題目「is / She / study / in / study room / the .」，或英文短文與閱讀問答題）",\n      "answer": "正確英文句子或簡答",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else if (subject === "自然") {
      return `\n請生成 ${count} 題應用/非選擇題 (open)，每題 7.5 分。\n規則：\n- 代表實驗申論題。每一題必須包含 (1) 佔 3 分，(2) 佔 4.5 分。涉及具體實驗情境（如：熱對流、空氣與燃燒、防鏽實驗等）。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "open",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 7.5,\n      "question": "實驗題目，包含 (1) 子題和 (2) 子題的敘述與配分",\n      "answer": "簡短答案",\n      "solution": "極簡解析"\n    }\n  ]\n}\n`;
    } else { // 社會
      return `\n請生成 ${count} 題非選擇/簡答題 (open)，每題 7.5 分。\n規則：\n- 地圖判讀與統計圖表題。每一題必須包含 (1) 佔 3 分，(2) 佔 4.5 分。例如：讀取經緯度、人口統計圖、臺灣水資源分配圖等。\n- 若題目是有關於臺灣地理/位置，可加上對應的 "graphic" 欄位。\n\n回傳格式 JSON Schema：\n{\n  "questions": [\n    {\n      "type": "open",\n      "section": "單元名稱",\n      "bloom_level": "認知層次",\n      "points": 7.5,\n      "question": "題目內容，包含 (1) 子題 and (2) 子題的敘述與配分",\n      "answer": "簡短答案",\n      "solution": "極簡解析",\n      "graphic": { "type": "pieChart", "params": { "labels": ["農業", "工業", "服務業"] } } // 選填\n    }\n  ]\n}\n`;
    }
  };

  // Load or Generate Exam
  const handleStartExam = async () => {
    setLoading(true);
    setLoadingMessage("正在準備您的專屬試卷...");
    setAnswers({});
    setGradedResult(null);
    setExtensionData({});
    setTimeRemaining(2400); // Reset timer to 40 minutes

    // Formulate scope description
    let scopeDesc = "";
    const unitsList = getAvailableUnits();
    if (examType === "自訂單元") {
      const selectedNames = unitsList
        .filter((u) => selectedUnits.includes(u.id))
        .map((u) => u.name);
      scopeDesc = selectedNames.join("、");
    } else {
      const filteredUnits = unitsList.filter((u) => u.exam === examType);
      if (filteredUnits.length > 0) {
        scopeDesc = `${examType}範圍 (${filteredUnits.map((u) => u.name).join("、")})`;
      } else {
        scopeDesc = examType;
      }
    }

    // Attempt Gemini Generation if Key is set
    if (settings.geminiApiKey) {
      try {
        setLoadingMessage("正在使用 Gemini AI 設計全新試卷...");
        
        const subjName = subject === "math" ? "數學" : subject === "chinese" ? "國語" : subject === "english" ? "英語" : subject === "science" ? "自然" : "社會";
        const randomSeed = Math.random().toString(36).substring(2, 10);
        const commonHeader = `你是一位臺灣國小 ${grade} ${subjName} 科目的專業資深命題教師。
請為學生出一份符合「臺灣教育部國小課綱」與下述設定的 ${publisher} 版 模擬段考試卷題目。

考卷設定：
- 年級：${grade}
- 學期：第 ${semester} 學期
- 科目：${subjName}
- 版本：${publisher}
- 範圍：${scopeDesc}
- 隨機種子 (隨機因子)：${randomSeed}

⚠️隨機性與多樣性要求（每次測驗務必產生新考題）：
- 請務必結合隨機種子進行命題。
- 為了確保「每次測驗都能產生新的考題」，請務必隨機替換題目情境中的主角姓名（如小明、小華、小娟、Neil、Emma等，以及本土化的故事主角）、日常情境設定（如不同的購物場景、不同的量測或實驗器材）與具體數值（如長度、重量、價格、百分率等）。
- 嚴格禁止直接重複產出常見的範例庫題目。即使是相同的範圍與科目，也要確保每題的故事背景與數據都是重新構思生成的。

⚠️重要且關鍵（攸關網路連線是否逾時）：
- ⚠️為避免連線逾時，所有的題目文字、選項文字、解析文字都必須極度精簡！
- ⚠️解析（solution）欄位：請嚴格限制在 1 句話（20 字）以內，只寫出關鍵概念或核心公式，絕對不可囉唆！
- 所有的題目、解析及選項文字，都必須是繁體中文 (Traditional Chinese)。
- 請嚴格確保回傳合法的 JSON 字串，不可包含 markdown \`\`\`json 標籤或任何引言，只需輸出純 JSON 字串。
- 若有其他自訂要求，請遵循：${customPrompt || "無"}
`;

        // Decide question counts for each part
        let mcCount = 10;
        let blankCount = 6;
        let openCount = 4;

        if (subjName === "數學") {
          mcCount = 8; blankCount = 6; openCount = 4;
        } else if (subjName === "國語") {
          mcCount = 10; blankCount = 6; openCount = 4;
        } else if (subjName === "英語") {
          mcCount = 15; blankCount = 5; openCount = 5;
        } else if (subjName === "自然") {
          mcCount = 10; blankCount = 6; openCount = 4;
        } else if (subjName === "社會") {
          mcCount = 10; blankCount = 6; openCount = 4;
        }

        const mcPrompt = commonHeader + getMcPromptDetails(subjName, mcCount);
        const blankPrompt = commonHeader + getBlankPromptDetails(subjName, blankCount);
        const openPrompt = commonHeader + getOpenPromptDetails(subjName, openCount);

        let isCancelled = false;
        const callWithDelay = async (prompt, delay) => {
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          if (isCancelled) {
            throw new Error("Request cancelled due to previous failure");
          }
          try {
            return await callGeminiDirectly(settings.geminiApiKey, prompt);
          } catch (err) {
            isCancelled = true;
            throw err;
          }
        };

        const [mcData, blankData, openData] = await Promise.all([
          callWithDelay(mcPrompt, 0),
          callWithDelay(blankPrompt, 800),
          callWithDelay(openPrompt, 1600)
        ]);

        const questions = [];
        let currentId = 1;

        if (mcData && Array.isArray(mcData.questions)) {
          mcData.questions.forEach((q) => { q.id = currentId++; questions.push(q); });
        }
        if (blankData && Array.isArray(blankData.questions)) {
          blankData.questions.forEach((q) => { q.id = currentId++; questions.push(q); });
        }
        if (openData && Array.isArray(openData.questions)) {
          openData.questions.forEach((q) => { q.id = currentId++; questions.push(q); });
        }

        const parsedExam = {
          school_year: "114",
          semester,
          exam_number: "1",
          grade,
          subject: subjName,
          scope: `${publisher}版第 ${semester} 學期 - ${scopeDesc}`,
          total_time: 40,
          total_points: 100,
          questions
        };

        setExam(parsedExam);
        setCurrentScreen("exam");
        setLoading(false);
        return;
      } catch (err) {
        const errMsg = err.message || String(err);
        const isRateLimit = errMsg.includes("429") || errMsg.includes("retries") || errMsg.includes("頻率限制");
        if (isRateLimit) {
          alert(`⚠️ Gemini AI 命題系統忙碌中 (頻率限制 429)\n\nGoogle API 的每分鐘呼叫次數已達上限。請點擊「確定」，系統會先為您載入內建試卷；若您仍想產生新題目，請等待約 30 秒後重新整理網頁並再試一次！`);
        } else {
          alert(`Gemini AI 命題失敗：${errMsg}\n\n系統將為您自動載入內建離線試卷庫！`);
        }
        console.warn("Gemini API call failed, falling back to local database:", err);
      }
    }

    // Fallback Mode: Try loading from offline mock_exams.json
    setLoadingMessage("載入內建試卷庫中...");
    
    // Key format: Grade_Semester_Subject_ExamType (e.g. 五年級_2_數學_期末考)
    const subjName = subject === "math" ? "數學" : subject === "chinese" ? "國語" : subject === "english" ? "英語" : subject === "science" ? "自然" : "社會";
    const lookupKey = `${grade}_${semester}_${subjName}_${examType}`;
    let loadedExam = mockExamsData[lookupKey];

    if (!loadedExam) {
      // General fallback to that subject's default (五年級_2_學科_期末考)
      const fallbackKey = `五年級_2_${subjName}_期末考`;
      loadedExam = mockExamsData[fallbackKey];
      
      if (!loadedExam) {
        loadedExam = mockExamsData["五年級_2_數學_期末考"];
      }
      
      console.warn(`No offline mock exam found for: ${lookupKey}. Loading fallback: ${fallbackKey}`);
      alert(`說明：因未設定 Gemini API 金鑰且試卷庫中無 [${grade}${semester === "1" ? "上" : "下"}${subjName}${examType}] 的離線資料，系統已自動載入「五年級下學期${subjName}期末考」做為示範！`);
    }

    const shuffledExam = shuffleLoadedExam(loadedExam);
    setExam(shuffledExam);
    setCurrentScreen("exam");
    setLoading(false);
  };

  const handleAnswerChange = (qId, val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val
    }));
  };

  // Grade test and submit to Google Sheets
  const handleSubmitExam = async (auto = false) => {
    if (!auto) {
      if (!confirm("確定要交卷嗎？交卷後系統將進行批改並提供詳細解析。")) return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    setLoadingMessage("正在認真批改您的試卷...");

    const wrongList = [];
    let correctCount = 0;
    
    // Automatically grade MC and Fill-in-the-blank
    const gradedQuestions = exam.questions.map((q) => {
      const studentAns = (answers[q.id] || "").toString().trim();
      const correctAns = q.answer.toString().trim();
      
      let isCorrect = false;

      if (q.type === "mc") {
        isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();
      } else if (q.type === "blank") {
        // Simple case-insensitive trim match
        isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase();
      } else {
        // Open questions default to incorrect initially until self-graded by student
        isCorrect = false;
      }

      if (isCorrect) correctCount++;
      
      const gradedQ = {
        ...q,
        studentAnswer: studentAns,
        isCorrect: isCorrect
      };

      if (!isCorrect) {
        wrongList.push({
          id: q.id,
          type: q.type === "mc" ? "選擇題" : q.type === "blank" ? "填充題" : "非選擇題",
          question: q.question,
          studentAnswer: studentAns || "(未答)",
          correctAnswer: q.answer,
          solution: q.solution,
          section: q.section,
          bloom_level: q.bloom_level
        });
      }

      return gradedQ;
    });

    // Calculate score based on actual question points (default to 5 points if missing)
    const totalPossiblePoints = exam.questions.reduce((sum, q) => sum + (q.points || 5), 0);
    const totalPointsObtained = gradedQuestions.reduce((sum, q) => sum + (q.isCorrect ? (q.points || 5) : 0), 0);
    const calculatedScore = Math.round((totalPointsObtained / totalPossiblePoints) * 100);

    const result = {
      score: calculatedScore,
      questions: gradedQuestions,
      wrongQuestions: wrongList,
      maxScore: totalPossiblePoints
    };

    setGradedResult(result);
    setCurrentScreen("result");
    setLoading(false);

    // Send to Google Sheets if configured
    if (settings.googleScriptUrl) {
      try {
        const subjName = subject === "math" ? "數學" : subject === "chinese" ? "國語" : subject === "english" ? "英語" : subject === "science" ? "自然" : "社會";
        await fetch("/api/log-error", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-google-script-url": settings.googleScriptUrl
          },
          body: JSON.stringify({
            studentName: studentName,
            subject: subjName,
            gradeSemester: `${grade}${semester === "1" ? "上" : "下"}`,
            scope: exam.scope,
            score: calculatedScore,
            totalQuestions: exam.questions.length,
            wrongCount: wrongList.length,
            wrongQuestions: wrongList
          })
        });
      } catch (err) {
        console.error("Failed to log results to Google Sheets:", err);
      }
    }
  };

  const handleAutoSubmit = () => {
    alert("考試時間已到！系統正在自動交卷...");
    handleSubmitExam(true);
  };

  // Adjust score dynamically if student self-grades open questions
  const handleToggleSelfGrade = (qId, setCorrect) => {
    setGradedResult((prev) => {
      if (!prev) return prev;
      
      const updatedQuestions = prev.questions.map((q) => {
        if (q.id === qId) {
          return { ...q, isCorrect: setCorrect };
        }
        return q;
      });

      // Recalculate score based on actual question points
      const totalPossiblePoints = prev.maxScore;
      const totalPointsObtained = updatedQuestions.reduce((sum, q) => sum + (q.isCorrect ? (q.points || 5) : 0), 0);
      const newScore = Math.round((totalPointsObtained / totalPossiblePoints) * 100);
      
      // Update wrong list
      const newWrongList = [];
      updatedQuestions.forEach((q) => {
        if (!q.isCorrect) {
          newWrongList.push({
            id: q.id,
            type: q.type === "mc" ? "選擇題" : q.type === "blank" ? "填充題" : "非選擇題",
            question: q.question,
            studentAnswer: q.studentAnswer || "(未答)",
            correctAnswer: q.answer,
            solution: q.solution,
            section: q.section,
            bloom_level: q.bloom_level
          });
        }
      });

      return {
        ...prev,
        score: newScore,
        questions: updatedQuestions,
        wrongQuestions: newWrongList
      };
    });
  };

  // Generate dynamic extension question (擴充題) via Gemini
  const handleGenerateExtension = async (wrongQ) => {
    // Set loading for this specific question
    setExtensionData((prev) => ({
      ...prev,
      [wrongQ.id]: { loading: true, question: null, studentAnswer: "", checked: false, correct: false }
    }));

    if (settings.geminiApiKey) {
      try {
        const subjName = subject === "math" ? "數學" : subject === "chinese" ? "國語" : subject === "english" ? "英語" : subject === "science" ? "自然" : "社會";
        const randomSeed = Math.random().toString(36).substring(2, 10);
        const systemPrompt = `你是一位臺灣國小 ${grade} ${subjName} 科目的專業教師。
學生在做以下題目時答錯了。請出一題與原錯題「概念相同、情境或數值不同」的「擴充練習題（類題）」，讓學生能進一步練習該知識點。

隨機種子：${randomSeed}
請務必結合此隨機種子，重新設計新出的類題主角姓名、日常情境與具體數值，確保多次生成此題目時均具備隨機性與多樣性。

原錯題資訊：
- 單元/章節：${wrongQ.section || "未指定"}
- 認知層次：${wrongQ.bloom_level || "未指定"}
- 題型：${wrongQ.type === "mc" ? "選擇題" : wrongQ.type === "blank" ? "填充題" : "非選擇題/應用題"}
- 原題目：${wrongQ.question}
\${wrongQ.options ? \`- 原選項：A: \${wrongQ.options.A}, B: \${wrongQ.options.B}, C: \${wrongQ.options.C}, D: \${wrongQ.options.D}\` : ""}
- 原正確答案：${wrongQ.answer}
- 原解析：${wrongQ.solution}
\${wrongQ.graphic ? \`- 原圖形示意圖：\${JSON.stringify(wrongQ.graphic)}\` : ""}

出題規則：
1. 必須與原題目的「題型」完全一致（如果是選擇題，必須提供四個選項；若是填充或應用題，請出對應題型）。
2. 核心考點不變，但請更換裡面的數值、姓名或日常情境（例如將購買蘋果改成購買橘子，或者將速率的數值進行替換，確保可整除或符合邏輯）。
3. 題目與選項、解析均使用繁體中文。
4. 如果原題目包含 \`graphic\` 欄位，請在您新出的題目中，也附上結構相同但數值參數（params）符合您新題目的 \`graphic\` 欄位（例如：若原題圖形是 prism，新題若長寬高不同，請填入新長寬高）。
5. 回傳格式為嚴格的 JSON：
   {
     "type": "\${wrongQ.type}",
     "question": "新出題目的內容",
     "options": \${wrongQ.type === "mc" ? '{"A": "新選項A", "B": "新選項B", "C": "新選項C", "D": "新選項D"}' : "null"},
     "answer": "新答案",
     "solution": "新題目的詳細解題過程與步驟說明",
     "graphic": \${wrongQ.graphic ? '{"type": "原圖形類型", "params": { "新圖形參數" }}' : "null"}
   }

注意：請只回傳符合 JSON 的字串，不要加上 markdown 標示！解析 (solution) 必須簡短，限 1 句話（20 字）內。`;

        const extensionQ = await callGeminiDirectly(settings.geminiApiKey, systemPrompt);
        setExtensionData((prev) => ({
          ...prev,
          [wrongQ.id]: {
            loading: false,
            question: extensionQ,
            studentAnswer: "",
            checked: false,
            correct: false
          }
        }));
        return;
      } catch (err) {
        console.error("Error generating extension question:", err);
      }
    }

    setTimeout(() => {
      // Simple offline hardcoded extension question based on original type
      let mockExt = null;
      if (wrongQ.type === "選擇題") {
        mockExt = {
          type: "mc",
          question: `【擴充練習題】${wrongQ.question} (數值更改類題)`,
          options: {
            A: `新選項A (正確解答)`,
            B: `新選項B (干擾項)`,
            C: `新選項C (干擾項)`,
            D: `新選項D (干擾項)`
          },
          answer: "A",
          solution: "這是一題針對原錯題所產生的類題，恭喜您答對了！這題的正確解析與原題邏輯完全一致。"
        };
      } else {
        mockExt = {
          type: "blank",
          question: `【擴充練習題】請回答與原題概念相同的計算題，答案為 100。`,
          answer: "100",
          solution: "計算解析：解答內容與原題考點一致，正確答案為 100。"
        };
      }

      setExtensionData((prev) => ({
        ...prev,
        [wrongQ.id]: {
          loading: false,
          question: mockExt,
          studentAnswer: "",
          checked: false,
          correct: false
        }
      }));
      alert("說明：因未設定 Gemini API 金鑰，系統已載入範例擴充題！");
    }, 1000);
  };

  const handleCheckExtension = (qId, correctAns) => {
    const ext = extensionData[qId];
    if (!ext) return;

    const studentAns = ext.studentAnswer.trim();
    let isCorrect = false;

    if (ext.question.type === "mc") {
      isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();
    } else {
      isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase();
    }

    setExtensionData((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        checked: true,
        correct: isCorrect
      }
    }));
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <div className="logo-section">
          <span className="logo-icon">📝</span>
          <div>
            <h1>國小高年級模擬試題系統</h1>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.25rem" }}>
              {studentName && <span className="student-tag">學生：{studentName}</span>}
              {settings.geminiApiKey ? (
                <span className="mode-tag ai-active">🤖 AI 隨機命題模式已啟用</span>
              ) : (
                <span className="mode-tag offline-active">🔌 離線隨機試卷模式（已啟用隨機洗牌，若要體驗全新 AI 命題，請於系統設定填寫有效的 API 金鑰）</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-secondary" onClick={() => setSettingsModalOpen(true)}>
            <Settings size={18} />
            系統設定
          </button>
          {currentScreen !== "dashboard" && (
            <button className="btn btn-danger" onClick={() => {
              if (confirm("確定要返回首頁嗎？當前測驗將不會被保存。")) {
                if (timerRef.current) clearInterval(timerRef.current);
                setCurrentScreen("dashboard");
                setStudentName("");
              }
            }}>
              返回首頁
            </button>
          )}
        </div>
      </header>

      {/* Screen Loading */}
      {loading ? (
        <div className="glass-panel loading-overlay">
          <div className="spinner"></div>
          <h2>{loadingMessage}</h2>
          <p style={{ color: "var(--text-muted)" }}>這可能需要花費 10-20 秒，請稍候...</p>
        </div>
      ) : (
        <>
          {/* SCREEN 1: DASHBOARD (Student Selection) */}
          {currentScreen === "dashboard" && (
            <div className="glass-panel" style={{ maxWidth: "600px", margin: "3rem auto" }}>
              <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>👦 請選擇學生開始測驗 👧</h2>
              <div className="profile-selection">
                <div className="profile-card" onClick={() => { setStudentName("Neil"); setGrade("六年級"); setCurrentScreen("config"); }}>
                  <div className="avatar">👦</div>
                  <div className="profile-name">Neil</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>六年級</span>
                </div>
                <div className="profile-card" onClick={() => { setStudentName("Emma"); setGrade("六年級"); setCurrentScreen("config"); }}>
                  <div className="avatar">👧</div>
                  <div className="profile-name">Emma</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>六年級</span>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: EXAM CONFIGURATION */}
          {currentScreen === "config" && (
            <div className="glass-panel dashboard-grid">
              {/* Form Config */}
              <div className="card-section">
                <h3 className="section-title"><BookOpen size={18} /> 測驗範圍設定</h3>
                
                <div className="form-group">
                  <label>年級選擇</label>
                  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="五年級">五年級</option>
                    <option value="六年級">六年級</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>學期選擇</label>
                  <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                    <option value="1">第一學期 (上)</option>
                    <option value="2">第二學期 (下)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>科目選擇</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                    <option value="chinese">國語</option>
                    <option value="math">數學</option>
                    <option value="english">英語</option>
                    <option value="science">自然</option>
                    <option value="social">社會</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>教科書版本 (已自動載入預設版本)</label>
                  <select value={publisher} onChange={(e) => setPublisher(e.target.value)}>
                    {subject === "english" ? (
                      <option value="何嘉仁">何嘉仁版 (Super Fun)</option>
                    ) : (
                      <>
                        <option value="康軒">康軒版</option>
                        <option value="翰林">翰林版</option>
                        <option value="南一">南一版</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Scope Selection */}
              <div className="card-section">
                <h3 className="section-title"><Clock size={18} /> 考試範圍</h3>
                
                <div className="form-group">
                  <label>範圍類型</label>
                  <select value={examType} onChange={(e) => setExamType(e.target.value)}>
                    <option value="期中考">期中考範圍</option>
                    <option value="期末考">期末考範圍</option>
                    <option value="自訂單元">自訂單元範圍</option>
                  </select>
                </div>

                {examType === "自訂單元" && (
                  <div className="form-group">
                    <label>選擇單元 (可複選)</label>
                    <div className="units-selection-box">
                      {getAvailableUnits().map((unit) => (
                        <label key={unit.id} className="unit-checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={selectedUnits.includes(unit.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUnits([...selectedUnits, unit.id]);
                              } else {
                                setSelectedUnits(selectedUnits.filter(id => id !== unit.id));
                              }
                            }}
                          />
                          <span>{unit.name}</span>
                        </label>
                      ))}
                      {getAvailableUnits().length === 0 && (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>此版本/年級無單元資料</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>AI 命題額外要求 (選填)</label>
                  <textarea 
                    placeholder="例如：多出一些速率相關題目、字彙題簡單點..." 
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: "100%", height: "50px" }}
                    onClick={handleStartExam}
                    disabled={examType === "自訂單元" && selectedUnits.length === 0}
                  >
                    開始測驗 (40分鐘)
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: EXAM SESSION */}
          {currentScreen === "exam" && exam && (
            <div className="exam-border-style glass-panel">
              <div className="exam-header">
                <div>
                  <h2 style={{ fontSize: "1.4rem" }}>{exam.grade}{exam.semester === "1" ? "上學期" : "下學期"}{exam.subject}科 模擬試卷</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                    範圍：{exam.scope} | 滿分：{exam.total_points} 分
                  </p>
                </div>
                <div className={`timer-box ${timeRemaining < 300 ? "danger" : ""}`}>
                  <Clock size={22} />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>

              <div className="questions-list">
                {exam.questions.map((q, idx) => (
                  <div key={q.id} className="question-card">
                    <div className="question-meta">
                      <div className="question-tag-group">
                        <span className="tag tag-index">第 {idx + 1} 題</span>
                        <span className="tag tag-bloom">{q.bloom_level}</span>
                        {q.section && <span className="tag tag-section">{q.section}</span>}
                      </div>
                    </div>
                    
                    <div className="question-body">
                      {parseMathContent(q.question)}
                    </div>
                    {q.graphic && <QuestionGraphic graphic={q.graphic} />}

                    {/* MC Question options */}
                    {q.type === "mc" && q.options && (
                      <div className="options-grid">
                        {Object.entries(q.options).map(([key, value]) => (
                          <button
                            key={key}
                            className={`option-btn ${answers[q.id] === key ? "selected" : ""}`}
                            onClick={() => handleAnswerChange(q.id, key)}
                          >
                            <span className="option-letter">{key}</span>
                            <span>{parseMathContent(value)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Blank Question input */}
                    {q.type === "blank" && (
                      <div className="blank-input-wrapper">
                        <input
                          type="text"
                          placeholder="請輸入答案..."
                          value={answers[q.id] || ""}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        />
                      </div>
                    )}

                    {/* Open Question textarea */}
                    {q.type === "open" && (
                      <div className="open-input-wrapper">
                        <textarea
                          placeholder="請寫出計算過程與解答步驟..."
                          value={answers[q.id] || ""}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          rows={4}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginTop: "3rem" }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: "200px", height: "50px" }}
                  onClick={() => handleSubmitExam(false)}
                >
                  確認交卷
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 4: GRADING & REVIEW RESULTS */}
          {currentScreen === "result" && gradedResult && (
            <div>
              {/* Score Circle Card */}
              <div className="glass-panel result-summary-box">
                <div className={`score-circle ${gradedResult.score >= 90 ? "perfect" : ""}`}>
                  <span className="score-num">{gradedResult.score}</span>
                  <span className="score-label">總得分</span>
                </div>
                <h2>🎉 {studentName} 考試結束！</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                  本次得分：{gradedResult.score} / 100 分。答對 {gradedResult.questions.filter(q => q.isCorrect).length} 題，答錯 {gradedResult.questions.filter(q => !q.isCorrect).length} 題。
                </p>
                {settings.googleScriptUrl ? (
                  <span style={{ fontSize: "0.85rem", color: "var(--success)", marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <CheckCircle size={14} /> 錯誤題型已成功自動記錄至 Google Sheet 資料庫中
                  </span>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "var(--warning)", marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <AlertTriangle size={14} /> 提醒：尚未設定 Google Sheets Web App 網址，考試結果將僅保存在本地
                  </span>
                )}
                <div style={{ marginTop: "1.5rem" }}>
                  <button className="btn btn-secondary" onClick={() => setCurrentScreen("config")}>
                    <RotateCcw size={16} />
                    再測一次
                  </button>
                </div>
              </div>

              {/* Wrong Questions Title */}
              <h3 className="wrong-review-header">
                <AlertTriangle size={20} />
                試卷逐題檢視與錯題解析
              </h3>

              {/* Review Questions List */}
              <div className="questions-list">
                {gradedResult.questions.map((q, idx) => {
                  const isWrong = !q.isCorrect;
                  const hasExtension = extensionData[q.id];

                  return (
                    <div key={q.id} className={`question-card review-card ${isWrong ? "incorrect" : ""}`}>
                      <div className="question-meta">
                        <div className="question-tag-group">
                          <span className="tag tag-index">第 {idx + 1} 題</span>
                          <span className="tag tag-bloom">{q.bloom_level}</span>
                          {q.section && <span className="tag tag-section">{q.section}</span>}
                        </div>
                        
                        {/* Self grading for application questions */}
                        {q.type === "open" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>此題為應用題，請手動校對評分：</span>
                            <button
                              className={`btn btn-outline-success`}
                              style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => handleToggleSelfGrade(q.id, true)}
                              disabled={q.isCorrect}
                            >
                              評為答對
                            </button>
                            <button
                              className={`btn btn-secondary`}
                              style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem", borderColor: "var(--error)", color: "var(--error)" }}
                              onClick={() => handleToggleSelfGrade(q.id, false)}
                              disabled={!q.isCorrect}
                            >
                              評為答錯
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="question-body">
                        {parseMathContent(q.question)}
                      </div>
                      {q.graphic && <QuestionGraphic graphic={q.graphic} />}

                      {/* Options (if MC) */}
                      {q.type === "mc" && q.options && (
                        <div className="options-grid" style={{ marginBottom: "1rem" }}>
                          {Object.entries(q.options).map(([key, value]) => {
                            let optionClass = "";
                            if (key === q.answer) optionClass = "selected"; // highlight correct answer
                            return (
                              <button key={key} className={`option-btn ${optionClass}`} disabled>
                                <span className="option-letter">{key}</span>
                                <span>{parseMathContent(value)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Display Student Answers and Correct Answers */}
                      <div className="answer-status-bar">
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          {q.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          批改結果：{q.isCorrect ? "答對" : "答錯"}
                        </span>
                        <span>您的答案：<strong style={{ textDecoration: isWrong ? "line-through" : "none" }}>{q.studentAnswer || "(空)"}</strong></span>
                        <span>正確答案：<strong>{q.answer}</strong></span>
                      </div>

                      {/* Explanation */}
                      <div className="explanation-box">
                        <div className="explanation-title">
                          <HelpCircle size={16} />
                          詳細解析說明
                        </div>
                        <p style={{ whiteSpace: "pre-wrap" }}>{parseMathContent(q.solution)}</p>
                      </div>

                      {/* Action for Wrong Questions: Generate Extension Question */}
                      {isWrong && (
                        <div className="extension-container">
                          {!hasExtension ? (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => handleGenerateExtension(q)}
                            >
                              <Sparkles size={16} />
                              另外出一題「擴充題」加強練習
                            </button>
                          ) : hasExtension.loading ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem" }}>
                              <div className="spinner" style={{ width: "20px", height: "20px", borderWidth: "2px" }}></div>
                              <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>正在透過 AI 產生相似題型...</span>
                            </div>
                          ) : (
                            <div className="extension-box-wrapper">
                              <div className="extension-header">
                                <span>📚 概念強化擴充題 (類題)</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>類型：{hasExtension.question.type === "mc" ? "選擇題" : "填充題"}</span>
                              </div>

                              <div className="question-body" style={{ fontSize: "1rem" }}>
                                {parseMathContent(hasExtension.question.question)}
                              </div>

                              {/* MC Extension options */}
                              {hasExtension.question.type === "mc" && hasExtension.question.options && (
                                <div className="options-grid" style={{ marginBottom: "1rem" }}>
                                  {Object.entries(hasExtension.question.options).map(([key, value]) => (
                                    <button
                                      key={key}
                                      className={`option-btn ${hasExtension.studentAnswer === key ? "selected" : ""}`}
                                      onClick={() => {
                                        if (hasExtension.checked) return;
                                        setExtensionData((prev) => ({
                                          ...prev,
                                          [q.id]: { ...prev[q.id], studentAnswer: key }
                                        }));
                                      }}
                                      disabled={hasExtension.checked}
                                    >
                                      <span className="option-letter">{key}</span>
                                      <span>{parseMathContent(value)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Blank Extension input */}
                              {hasExtension.question.type !== "mc" && (
                                <div className="blank-input-wrapper" style={{ marginBottom: "1rem" }}>
                                  <input
                                    type="text"
                                    placeholder="請輸入類題解答..."
                                    value={hasExtension.studentAnswer}
                                    onChange={(e) => {
                                      if (hasExtension.checked) return;
                                      setExtensionData((prev) => ({
                                        ...prev,
                                        [q.id]: { ...prev[q.id], studentAnswer: e.target.value }
                                      }));
                                    }}
                                    disabled={hasExtension.checked}
                                  />
                                </div>
                              )}

                              {/* Action Buttons for Extension */}
                              {!hasExtension.checked ? (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: "0.4rem 1rem", fontSize: "0.9rem" }}
                                  onClick={() => handleCheckExtension(q.id, hasExtension.question.answer)}
                                  disabled={!hasExtension.studentAnswer}
                                >
                                  檢查答案
                                </button>
                              ) : (
                                <div>
                                  <div className={`extension-result ${hasExtension.correct ? "correct" : "incorrect"}`}>
                                    {hasExtension.correct ? (
                                      <span>🎉 太棒了！答對了！</span>
                                    ) : (
                                      <span>❌ 答錯了！正確答案是：{hasExtension.question.answer}</span>
                                    )}
                                  </div>
                                  <div className="explanation-box" style={{ marginTop: "1rem", background: "rgba(0,0,0,0.2)" }}>
                                    <div className="explanation-title" style={{ color: "var(--primary)" }}>類題解析</div>
                                    <p style={{ whiteSpace: "pre-wrap" }}>{parseMathContent(hasExtension.question.solution)}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <p>© 2026 國小高年級段考模擬試題系統 | 設計開發: Antigravity AI Team</p>
        <p style={{ marginTop: "0.25rem" }}>
          本系統整合了 <a href="#" onClick={(e) => { e.preventDefault(); setSettingsModalOpen(true); }}>Gemini 模組</a> 與 <a href="#" onClick={(e) => { e.preventDefault(); setSettingsModalOpen(true); }}>Google Sheets 資料庫</a> 以提供極致的學習體驗。
        </p>
      </footer>

      {/* SYSTEM SETTINGS MODAL */}
      {settingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title"><Settings size={22} /> 系統金鑰與資料庫設定</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  Gemini API 金鑰 
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>(用於動態命題與類題生成)</span>
                </label>
                <input
                  type="password"
                  placeholder="請貼上您的 AIzaSy... 金鑰"
                  defaultValue={settings.geminiApiKey}
                  id="gemini-key-input"
                />
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  若留空，系統將會使用預先產出的試卷資料庫 (離線模式)。
                </p>
              </div>

              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  Google Sheets Apps Script 網頁應用程式網址
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>(用於上傳錯題記錄)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  defaultValue={settings.googleScriptUrl}
                  id="google-script-input"
                />
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  請參閱專案目錄中的 <code>google_apps_script.js</code> 部署說明來建立您的專屬試算表資料庫。
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setSettingsModalOpen(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const keyVal = document.getElementById("gemini-key-input").value;
                  const scriptVal = document.getElementById("google-script-input").value;
                  saveSettings(keyVal, scriptVal);
                }}
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
