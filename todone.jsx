import { useState, useEffect, useRef, useMemo } from "react";
import { supabase, signIn, signUp, signOutUser, resetPassword, getUserName, resendConfirmation } from './src/supabase.js';

/*
 * TO DONE ✦ v5
 * A11y + Dark Mode + Auth screens (no backend)
 *
 * ACCESSIBILITY FIXES:
 * 1.  aria-label on all buttons (toggle, delete, schedule, split, etc.)
 * 2.  role="checkbox" + aria-checked on task toggles & subtasks
 * 3.  :focus-visible outlines on all interactive elements
 * 4.  Contrast fixed: muted text #8A8279 on light (4.7:1), #9A9490 on dark
 * 5.  Semantic h1/h2 headings, <main>, <header>, <section>, <article>
 * 6.  Skip-to-content link
 * 7.  aria-live="polite" for suggestions, task counts, announcements
 * 8.  Keyboard reorder: Alt+↑/↓ on focused task
 * 9.  @media prefers-reduced-motion: reduce
 * 10. aria-hidden on decorative emojis/confetti, sr-only text alternatives
 * 11. All inputs have labels (aria-label or <label>)
 * 12. Color never sole indicator: priority always has text label
 * 13. Dark mode via CSS custom properties + prefers-color-scheme
 * 14. Form landmark on add-task panel
 * 15. Escape key closes modals/panels
 */

// ============================================================
// CONSTANTS & HELPERS
// ============================================================
const PRIORITIES = { high: "Alta", medium: "Media", low: "Baja" };
const EFFORT_OPTIONS = [15, 30, 60, 120, 180, 240];
const WORKDAY_MINUTES = 480;

function fmt(min) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (min >= 480) return `${Math.round(min / 480 * 10) / 10}d`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtS(min) {
  if (!min) return "?";
  if (min < 60) return `${min}m`;
  if (min >= 480) return `${Math.round(min / 60)}h`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

// ============================================================
// AI SUGGEST
// ============================================================
function aiSuggest(text) {
  const lo = text.toLowerCase().trim();
  let pr = null, prR = "", sc = null, scR = "", mn = null, mnR = "";
  if (/\b(urgente|importante|crítico|asap|ya|deadline|vence|expira|jefe|cliente|inversores?|board)\b/i.test(lo)) { pr = "high"; prR = "Detecté urgencia"; }
  else if (/\b(presentación|propuesta|contrato|factura|pago|emergencia|error|bug|caído|roto)\b/i.test(lo)) { pr = "high"; prR = "Contexto importante"; }
  else if (/\b(cuando pueda|algún día|eventualmente|no urge|tranqui|opcional|si puedo)\b/i.test(lo)) { pr = "low"; prR = "No parece urgente"; }
  if (/\b(hoy|today|ahora|ya mismo|esta tarde|esta mañana)\b/i.test(lo)) { sc = "hoy"; scR = "Mencionás hoy"; }
  else if (/\b(mañana|tomorrow)\b/i.test(lo)) { sc = "mañana"; scR = "Mencionás mañana"; }
  else if (/\b(esta semana|this week|estos días)\b/i.test(lo)) { sc = "semana"; scR = "Esta semana"; }
  else if (/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(lo)) { const m = lo.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i); if (m) { sc = "semana"; scR = `Mencionás ${m[1]}`; } }
  else if (/\b(semana que viene|próxima semana)\b/i.test(lo)) { sc = "semana"; scR = "Próxima semana"; }
  else if (pr === "high" && !sc) { sc = "hoy"; scR = "Es urgente → hoy"; }
  if (/\b(llamar|contestar|responder|enviar|mandar|confirmar|comprar|chequear)\b/i.test(lo)) { if (/\b(email|mail|mensaje|whatsapp)\b/i.test(lo)) { mn = 5; mnR = "Mensaje rápido"; } else if (/\b(llamar|call)\b/i.test(lo)) { mn = 15; mnR = "Llamada típica"; } else { mn = 10; mnR = "Tarea rápida"; } }
  else if (/\b(presentación|informe|reporte|propuesta|proyecto|estrategia|auditoría)\b/i.test(lo)) { mn = /\b(presentación|propuesta)\b/i.test(lo) ? 180 : 240; mnR = mn === 180 ? "Presentación compleja" : "Documento largo"; }
  else if (/\b(preparar|armar|escribir|diseñar|desarrollar|crear|investigar|programar|planificar|redactar)\b/i.test(lo)) { mn = /\b(diseñar|desarrollar|programar)\b/i.test(lo) ? 120 : 90; mnR = mn === 120 ? "Trabajo técnico" : "Requiere preparación"; }
  else if (/\b(revisar|leer|analizar|reunión|meeting|call|sync|entrevista)\b/i.test(lo)) { mn = /\b(reunión|meeting|call|sync)\b/i.test(lo) ? 45 : 30; mnR = mn === 45 ? "Reunión estándar" : "Revisión/análisis"; }
  const tm = lo.match(/(\d+)\s*(min(?:utos?)?|h(?:oras?)?|hora)/i);
  if (tm) { const v = parseInt(tm[1]); if (tm[2].toLowerCase().startsWith("h")) { mn = v * 60; mnR = `Mencionás ${v}h`; } else { mn = v; mnR = `Mencionás ${v} min`; } }
  let cl = text.trim();
  [/\b(urgente|importante|crítico|asap|ya|cuando pueda|algún día|eventualmente|no urge|tranqui|opcional|si puedo)\b/gi, /\b(hoy|today|ahora|ya mismo|esta tarde|esta mañana|mañana|tomorrow)\b/gi, /\b(esta semana|this week|estos días|semana que viene|próxima semana)\b/gi, /\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/gi, /\d+\s*(min(?:utos?)?|h(?:oras?)?|hora)\b/gi].forEach(p => { cl = cl.replace(p, ""); });
  cl = cl.replace(/\s+/g, " ").replace(/^[\s,\-·]+|[\s,\-·]+$/g, "").trim();
  return { cleanText: cl || text.trim(), priority: pr, priorityReason: prR, scheduledFor: sc, scheduleReason: scR, minutes: mn, minutesReason: mnR, hasAny: !!(pr || sc || mn) };
}

// ============================================================
// SOUNDS
// ============================================================
function playComplete() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); [523.25, 659.25, 783.99].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0, c.currentTime + i * .08); g.gain.linearRampToValueAtTime(.12, c.currentTime + i * .08 + .04); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .08 + .5); o.start(c.currentTime + i * .08); o.stop(c.currentTime + i * .08 + .5); }); } catch (e) { } }
function playAdd() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; o.type = "sine"; g.gain.setValueAtTime(.08, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .15); o.start(); o.stop(c.currentTime + .15); } catch (e) { } }
function playClick() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; o.type = "triangle"; g.gain.setValueAtTime(.05, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .06); o.start(); o.stop(c.currentTime + .06); } catch (e) { } }

// ============================================================
// THEME
// ============================================================
const themes = {
  light: {
    bg: "linear-gradient(160deg, #FFF8F0 0%, #FFF1E6 30%, #FEEBD6 70%, #FDE8D0 100%)",
    card: "#FFFAF5", cardDone: "rgba(129,178,154,0.04)", cardDrag: "#FFF5ED",
    surface: "#FFFFFF", text: "#3D405B", textSec: "#505870",
    textMuted: "#685E5A", textFaint: "#8A8690",
    border: "rgba(224,122,95,0.07)", borderDone: "rgba(129,178,154,0.1)",
    inputBg: "#FAFAFA", inputBorder: "#E5E7EB", barBg: "#F0E6DB",
    overlay: "rgba(0,0,0,0.06)", focusRing: "#E07A5F", placeholder: "#B8B0A6",
    panelBg: "#FFFFFF", panelShadow: "0 -4px 30px rgba(0,0,0,0.1)",
  },
  dark: {
    bg: "linear-gradient(160deg, #1A1B1E 0%, #1E1F23 30%, #22232A 70%, #1A1B1E 100%)",
    card: "#26272D", cardDone: "rgba(129,178,154,0.06)", cardDrag: "#2E2A25",
    surface: "#2A2B31", text: "#E8E4DF", textSec: "#C8C0B5",
    textMuted: "#AEA9A2", textFaint: "#7E7A76",
    border: "rgba(224,122,95,0.15)", borderDone: "rgba(129,178,154,0.15)",
    inputBg: "#2A2B31", inputBorder: "#3A3B41", barBg: "#3A3530",
    overlay: "rgba(255,255,255,0.06)", focusRing: "#E6AA68", placeholder: "#6B6560",
    panelBg: "#26272D", panelShadow: "0 -4px 30px rgba(0,0,0,0.5)",
  }
};

// ============================================================
// DATA
// ============================================================
const initialTasks = [
  { id: 1, text: "Preparar presentación para inversores", priority: "high", minutes: 180, done: false, doneAt: null, createdAt: Date.now() - 86400000, subtasks: [], scheduledFor: "hoy", order: 0 },
  { id: 2, text: "Revisar métricas de NPS del mes", priority: "medium", minutes: 45, done: false, doneAt: null, createdAt: Date.now() - 43200000, subtasks: [], scheduledFor: "hoy", order: 1 },
  { id: 3, text: "Contestar emails pendientes", priority: "low", minutes: 15, done: false, doneAt: null, createdAt: Date.now() - 3600000, subtasks: [], scheduledFor: "hoy", order: 2 },
  { id: 4, text: "Llamar a cliente Andreani", priority: "high", minutes: 15, done: false, doneAt: null, createdAt: Date.now() - 7200000, subtasks: [], scheduledFor: "hoy", order: 3 },
  { id: 5, text: "Actualizar roadmap Q2", priority: "medium", minutes: 120, done: false, doneAt: null, createdAt: Date.now() - 100000000, subtasks: [], scheduledFor: "semana", order: 4 },
  { id: 6, text: "Diseñar nueva landing page", priority: "medium", minutes: 240, done: false, doneAt: null, createdAt: Date.now() - 80000000, subtasks: [], scheduledFor: "semana", order: 5 },
  { id: 7, text: "Investigar competencia en Brasil", priority: "low", minutes: 90, done: false, doneAt: null, createdAt: Date.now() - 120000000, subtasks: [], scheduledFor: "semana", order: 6 },
  { id: 8, text: "Comprar café", priority: "low", minutes: 10, done: true, doneAt: Date.now() - 50000, createdAt: Date.now() - 150000000, subtasks: [], scheduledFor: null, order: 98 },
  { id: 9, text: "Enviar propuesta a MercadoLibre", priority: "high", minutes: 60, done: true, doneAt: Date.now() - 20000, createdAt: Date.now() - 200000000, subtasks: [], scheduledFor: null, order: 99 },
];
const celebrations = ["🎉", "✨", "🚀", "💫", "⭐", "🔥", "💪", "🎯", "👏", "🌟"];

// ============================================================
// SMALL COMPONENTS
// ============================================================
function SrOnly({ children }) {
  return <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>{children}</span>;
}

function Confetti({ active }) {
  const [p, setP] = useState([]);
  useEffect(() => { if (active) { setP(Array.from({ length: 24 }, (_, i) => ({ id: i, style: { position: "fixed", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, backgroundColor: ["#E07A5F", "#E6AA68", "#81B29A", "#56CCF2", "#BB6BD9", "#F2C94C"][Math.floor(Math.random() * 6)], borderRadius: Math.random() > .5 ? "50%" : "2px", left: `${Math.random() * 100}vw`, top: "-10px", zIndex: 9999, animation: `confettiFall ${1.5 + Math.random() * 1.5}s ease-out forwards`, animationDelay: `${Math.random() * .3}s` } }))); setTimeout(() => setP([]), 3000); } }, [active]);
  return <div aria-hidden="true">{p.map(x => <div key={x.id} style={x.style} />)}</div>;
}

function KindStreak({ tasks }) {
  const streak = useMemo(() => { const n = new Date(); let s = 0; for (let i = 0; i < 30; i++) { const d = new Date(n); d.setDate(n.getDate() - i); const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); if (tasks.some(t => t.done && t.doneAt && t.doneAt >= ds && t.doneAt < ds + 86400000)) s++; else if (i > 0) break; } return s; }, [tasks]);
  if (streak < 1) return null;
  const msgs = [{ min: 1, t: "¡Primer día!", e: "🌱" }, { min: 2, t: `${streak} días seguidos`, e: "🌿" }, { min: 5, t: `¡${streak} días!`, e: "🌳" }, { min: 10, t: `${streak} días. Imparable.`, e: "🔥" }, { min: 20, t: `${streak}d. Leyenda.`, e: "👑" }];
  const m = [...msgs].reverse().find(x => streak >= x.min) || msgs[0];
  return (
    <div role="status" aria-label={`Racha: ${m.t}`} style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, rgba(129,178,154,0.1), rgba(230,170,104,0.06))", borderRadius: "12px", padding: "8px 14px", fontSize: "14px", color: "#81B29A", fontWeight: 600, marginBottom: "12px" }}>
      <span aria-hidden="true" style={{ fontSize: "18px" }}>{m.e}</span><span>{m.t}</span>
      <div aria-hidden="true" style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>{Array.from({ length: Math.min(streak, 7) }, (_, i) => <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "linear-gradient(135deg, #81B29A, #6FCF97)", opacity: .4 + (i / 7) * .6 }} />)}</div>
    </div>
  );
}

function TimeBar({ total, done, T }) {
  const pct = Math.min((total / WORKDAY_MINUTES) * 100, 100);
  const donePct = total > 0 ? Math.min((done / total) * 100, 100) * (pct / 100) : 0;
  const over = total > WORKDAY_MINUTES;
  return (
    <div role="status" aria-label={`Hoy: ${fmt(done) || "0 min"} de ${fmt(total)} planeadas`} style={{ marginBottom: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 500 }}>{fmt(done) || "0 min"} hechas de {fmt(total)} plan.</span>
        {over && <span style={{ fontSize: "13px", color: "#E07A5F", fontWeight: 700 }}>+{fmt(total - WORKDAY_MINUTES)} sobre 8h</span>}
      </div>
      <div role="progressbar" aria-valuenow={Math.round(donePct)} aria-valuemin={0} aria-valuemax={100} style={{ height: "6px", borderRadius: "3px", background: T.barBg, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "3px", background: over ? "linear-gradient(90deg, #E6AA68, #E07A5F)" : "linear-gradient(90deg, #E6AA68, #81B29A)", width: `${pct}%`, transition: "width 0.6s ease", opacity: 0.25 }} />
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #81B29A, #6FCF97)", width: `${donePct}%`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function TodayCard({ total, done, taskCount, T }) {
  const r = 22, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = taskCount > 0 && pct >= 1;
  return (
    <div style={{ background: T.surface, borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>Plan de hoy</p>
        <p style={{ fontSize: "34px", fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-1.5px" }}>{fmt(total) || "—"}</p>
        <p style={{ fontSize: "12px", color: T.textMuted, marginTop: "6px", fontWeight: 500 }}>
          {done > 0 ? <><span style={{ color: "#81B29A", fontWeight: 700 }}>{fmt(done)}</span> completadas · </> : ""}{taskCount} tarea{taskCount !== 1 ? "s" : ""}
        </p>
      </div>
      <svg width="60" height="60" style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="none" stroke={T.barBg} strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={allDone ? "#81B29A" : "#E07A5F"} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="30" y="34" textAnchor="middle" fontSize="11" fontWeight="700" fill={T.textSec}>{Math.round(pct * 100)}%</text>
      </svg>
    </div>
  );
}

function AIChip({ label, value, reason, onAccept, onDismiss, color, T }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div role="group" aria-label={`Sugerencia: ${label} ${value}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: `${color}10`, border: `1px solid ${color}20`, borderRadius: "20px", padding: "3px 5px 3px 10px", fontSize: "11px", animation: "fadeInUp 0.25s ease" }}>
      <span style={{ color: T.textFaint, fontWeight: 500 }}>✨ {label}:</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
      <span style={{ color: T.textFaint, fontSize: "9px", fontStyle: "italic" }}>({reason})</span>
      <button onClick={() => { onAccept(); playClick(); }} aria-label={`Aceptar: ${label} ${value}`} style={{ background: color, color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</button>
      <button onClick={() => { setGone(true); onDismiss(); playClick(); }} aria-label={`Descartar: ${label}`} style={{ background: T.overlay, color: T.textMuted, border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ============================================================
// TASK ITEM
// ============================================================
function TaskItem({ task, onToggle, onDelete, onSplit, onAddSub, onSchedule, onDefer, onMove, isDragging, dragOver, T, autoSplit }) {
  const [showSplit, setShowSplit] = useState(false);
  useEffect(() => { if (autoSplit) { setShowSplit(true); } }, [autoSplit]);
  const [splitText, setSplitText] = useState("");
  const [justDone, setJustDone] = useState(false);
  const [celeb, setCeleb] = useState("");
  const ref = useRef(null);
  const pc = task.priority === "high" ? "#E07A5F" : task.priority === "medium" ? "#E6AA68" : "#81B29A";

  const handleToggle = () => {
    if (!task.done) { setJustDone(true); setCeleb(celebrations[Math.floor(Math.random() * celebrations.length)]); playComplete(); setTimeout(() => { setJustDone(false); }, 1200); }
    else playClick();
    onToggle(task.id);
  };

  return (
    <article aria-label={`${task.text}${task.done ? ", completada" : ""}`} tabIndex={task.done ? -1 : 0}
      onKeyDown={e => { if (task.done) return; if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); onMove(task.id, -1); } if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); onMove(task.id, 1); } }}
      style={{
        background: task.done ? T.cardDone : isDragging ? T.cardDrag : T.card,
        borderRadius: "14px", padding: task.done ? "10px 16px" : "14px 18px", marginBottom: "6px",
        border: `1.5px solid ${isDragging ? "#E6AA68" : task.done ? T.borderDone : T.border}`,
        transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: justDone ? "scale(1.02)" : isDragging ? "scale(1.03)" : "scale(1)",
        boxShadow: isDragging ? "0 8px 30px rgba(224,122,95,0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
        opacity: task.done ? .5 : 1, cursor: task.done ? "default" : "grab", userSelect: "none",
        borderTop: dragOver ? "2.5px solid #E6AA68" : "2.5px solid transparent", outline: "none",
      }}>
      {justDone && <div aria-hidden="true" style={{ position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)", fontSize: "26px", animation: "popIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>{celeb}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", gap: task.done ? "8px" : "12px" }}>
        {!task.done && <div aria-hidden="true" style={{ paddingTop: "5px", opacity: .2, flexShrink: 0 }}><div style={{ width: "10px", display: "flex", flexWrap: "wrap", gap: "2px" }}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textFaint }} />)}</div></div>}
        <button role="checkbox" aria-checked={task.done} aria-label={task.done ? `Desmarcar: ${task.text}` : `Completar: ${task.text}`} onClick={handleToggle}
          style={{ width: task.done ? "18px" : "22px", height: task.done ? "18px" : "22px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${task.done ? "#81B29A" : pc}`, background: task.done ? "#81B29A" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px" }}>
          {task.done && <svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: task.done ? "15px" : "16px", fontWeight: 500, color: task.done ? T.textFaint : T.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, flex: 1 }}>{task.text}</span>
            {!task.done && task.minutes && <span aria-label={`${fmt(task.minutes)}`} style={{ fontSize: "12px", fontWeight: 700, color: T.textFaint, background: T.overlay, padding: "3px 10px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}><span aria-hidden="true">🕐</span> {fmtS(task.minutes)}</span>}
          </div>
          {!task.done && (
            <div style={{ display: "flex", gap: "5px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: pc, background: `${pc}15`, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase" }}>{PRIORITIES[task.priority]}</span>
              {!task.scheduledFor && <button onClick={() => { onSchedule(task.id, "hoy"); }} aria-label={`Agendar para hoy: ${task.text}`} style={{ fontSize: "12px", color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 600 }}>+ Hoy</button>}
              {task.scheduledFor === "hoy" && <button onClick={() => { onDefer(task.id); }} aria-label={`Dejar para después: ${task.text}`} style={{ fontSize: "12px", color: "#9B6DB5", background: "rgba(155,109,181,0.12)", border: "1px solid rgba(155,109,181,0.3)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}>Después</button>}
              {task.scheduledFor === "semana" && <button onClick={() => { onSchedule(task.id, "hoy"); }} aria-label={`Mover a hoy: ${task.text}`} style={{ fontSize: "12px", color: "#3B9EC4", background: "rgba(86,204,242,0.12)", border: "1px solid rgba(86,204,242,0.3)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}>→ Hoy</button>}
              {task.minutes >= 120 && task.subtasks.length === 0 && <button onClick={e => { e.stopPropagation(); setShowSplit(!showSplit); }} aria-label={`Dividir: ${task.text}`} style={{ fontSize: "12px", color: "#BB6BD9", background: "rgba(187,107,217,0.08)", border: "1px solid rgba(187,107,217,0.2)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}><span aria-hidden="true">🧩</span> Dividir</button>}
              {task.subtasks.length === 0 && !showSplit && <button onClick={e => { e.stopPropagation(); setShowSplit(true); }} aria-label={`Agregar subtarea a: ${task.text}`} style={{ fontSize: "12px", color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 600 }}>+ Sub</button>}
            </div>
          )}
          {!task.done && task.subtasks.length > 0 && (
            <ul role="list" aria-label="Subtareas" style={{ marginTop: "8px", paddingLeft: 0, listStyle: "none" }}>
              {task.subtasks.map((st, i) => (
                <li key={i} role="checkbox" aria-checked={st.done} tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); } }}
                  onClick={() => { const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); }}
                  style={{ fontSize: "14px", color: st.done ? T.textFaint : T.textSec, padding: "3px 0", display: "flex", alignItems: "center", gap: "7px", textDecoration: st.done ? "line-through" : "none", cursor: "pointer" }}>
                  <span aria-hidden="true" style={{ width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${st.done ? "#81B29A" : T.inputBorder}`, background: st.done ? "#81B29A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {st.done && <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>{st.text}
                </li>
              ))}
              <li style={{ listStyle: "none" }}><input ref={ref} aria-label={`Agregar subtarea a ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); } }} placeholder="+ subtarea..." style={{ width: "100%", fontSize: "13px", padding: "5px 8px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px" }} /></li>
            </ul>
          )}
          {showSplit && !task.done && task.subtasks.length === 0 && (
            <div style={{ marginTop: "8px", animation: "slideDown 0.3s ease" }}>
              <input autoFocus aria-label={`Primera subtarea de: ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); } }} placeholder="Primera subtarea... (Enter)" style={{ width: "100%", fontSize: "14px", padding: "7px 10px", borderRadius: "10px", border: "1.5px solid rgba(187,107,217,0.2)", background: "rgba(187,107,217,0.03)", outline: "none", color: T.text, boxSizing: "border-box" }} />
            </div>
          )}
        </div>
        {!task.done && <button onClick={() => onDelete(task.id)} aria-label={`Eliminar: ${task.text}`} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: T.textFaint, fontSize: "20px", lineHeight: 1, flexShrink: 0 }}><span aria-hidden="true">×</span></button>}
      </div>
    </article>
  );
}

// ============================================================
// AUTH SCREENS
// ============================================================
function AuthScreen({ onLogin, dark, setDark }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const T = dark ? themes.dark : themes.light;

  const handleResend = async () => {
    setResendLoading(true);
    try { await resendConfirmation(email); setResendSent(true); }
    catch (e) { /* silently ignore */ }
    finally { setResendLoading(false); }
  };

  const validate = () => {
    const e = {};
    if (mode === "register" && !name.trim()) e.name = "Ingresá tu nombre";
    if (!email.trim()) e.email = "Ingresá tu email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email no válido";
    if (mode !== "forgot") {
      if (!pass) e.pass = "Ingresá tu contraseña";
      else if (pass.length < 6) e.pass = "Mínimo 6 caracteres";
    }
    if (mode === "register" && pass !== passConfirm) e.passConfirm = "Las contraseñas no coinciden";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccess("Te enviamos un email para restablecer tu contraseña");
      } else if (mode === "login") {
        const { data, error } = await signIn(email, pass);
        if (error) throw error;
        onLogin(data.user);
      } else {
        const { data, error } = await signUp(email, pass, name || email.split("@")[0]);
        if (error) throw error;
        if (data.user && !data.session) {
          setMode("verify");
        } else {
          onLogin(data.user);
        }
      }
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%", fontSize: "15px", padding: "14px 16px", borderRadius: "14px",
    border: `1.5px solid ${errors[field] ? "#E07A5F" : T.inputBorder}`,
    background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s ease",
  });
  const labelStyle = { fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "6px" };
  const errorStyle = { fontSize: "11px", color: "#E07A5F", marginTop: "4px", fontWeight: 500 };

  // ── Verify pending screen ──────────────────────────────────────────────────
  if (mode === "verify") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
          @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
          *{box-sizing:border-box;margin:0;padding:0}
          *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        `}</style>
        <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px" }}>
              to <span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
              <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
            </h1>
          </div>
          <div style={{ background: T.surface, borderRadius: "20px", padding: "36px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div aria-hidden="true" style={{ fontSize: "52px", marginBottom: "16px", lineHeight: 1 }}>📬</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Revisá tu email</h2>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "6px" }}>Te enviamos un link de confirmación a</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "16px", wordBreak: "break-all" }}>{email}</p>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "28px" }}>
              Hacé click en el enlace del email para activar tu cuenta.<br />La app se va a abrir automáticamente.
            </p>
            {resendSent ? (
              <p role="alert" style={{ fontSize: "13px", color: "#81B29A", fontWeight: 600, marginBottom: "16px" }}>✓ Email reenviado</p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendLoading}
                style={{ width: "100%", background: T.overlay, border: `1px solid ${T.inputBorder}`, borderRadius: "12px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, color: T.textMuted, cursor: resendLoading ? "wait" : "pointer", marginBottom: "12px", fontFamily: "'DM Sans', sans-serif" }}>
                {resendLoading ? "Reenviando…" : "¿No llegó? Reenviar email"}
              </button>
            )}
            <button type="button" onClick={() => { setMode("login"); setSuccess(""); setResendSent(false); }}
              style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              ← Volver al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
      `}</style>

      <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px", marginBottom: "8px" }}>
            to <span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
            <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
          </h1>
          <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 500 }}>
            {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Empezá a organizarte sin culpa" : "Recuperá tu cuenta"}
          </p>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <button onClick={() => setDark(!dark)} aria-label={dark ? "Modo claro" : "Modo oscuro"} aria-pressed={dark}
            style={{ background: T.overlay, border: "none", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            {dark ? "☀️" : "🌙"} {dark ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div role="alert" style={{ background: "rgba(129,178,154,0.1)", border: "1px solid rgba(129,178,154,0.3)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px", fontSize: "13px", color: "#81B29A", fontWeight: 600, textAlign: "center" }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate aria-label={mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Recuperar contraseña"}
          style={{ background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>


          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {mode === "register" && (
              <div>
                <label htmlFor="auth-name" style={labelStyle}>Nombre</label>
                <input id="auth-name" type="text" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} placeholder="Tu nombre" autoComplete="given-name" style={inputStyle("name")} />
                {errors.name && <p role="alert" style={errorStyle}>{errors.name}</p>}
              </div>
            )}
            <div>
              <label htmlFor="auth-email" style={labelStyle}>Email</label>
              <input id="auth-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); setSuccess(""); }} placeholder="tu@email.com" autoComplete="email" style={inputStyle("email")} />
              {errors.email && <p role="alert" style={errorStyle}>{errors.email}</p>}
            </div>
            {mode !== "forgot" && (
              <div>
                <label htmlFor="auth-pass" style={labelStyle}>Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input id="auth-pass" type={showPass ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setErrors(p => ({ ...p, pass: undefined })); }}
                    placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"} autoComplete={mode === "login" ? "current-password" : "new-password"} style={{ ...inputStyle("pass"), paddingRight: "48px" }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: T.textFaint, padding: "4px" }}>
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
                {errors.pass && <p role="alert" style={errorStyle}>{errors.pass}</p>}
              </div>
            )}
            {mode === "register" && (
              <div>
                <label htmlFor="auth-pass-confirm" style={labelStyle}>Confirmar contraseña</label>
                <input id="auth-pass-confirm" type="password" value={passConfirm} onChange={e => { setPassConfirm(e.target.value); setErrors(p => ({ ...p, passConfirm: undefined })); }} placeholder="Repetí tu contraseña" autoComplete="new-password" style={inputStyle("passConfirm")} />
                {errors.passConfirm && <p role="alert" style={errorStyle}>{errors.passConfirm}</p>}
              </div>
            )}
          </div>

          {/* Forgot password link */}
          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", fontSize: "12px", color: "#E07A5F", fontWeight: 600, cursor: "pointer", marginTop: "8px", padding: 0 }}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {/* General API error */}
          {errors.general && (
            <div role="alert" style={{ background: "rgba(224,122,95,0.1)", border: "1px solid rgba(224,122,95,0.3)", borderRadius: "12px", padding: "12px 14px", marginTop: "12px", fontSize: "13px", color: "#E07A5F", fontWeight: 500 }}>
              {errors.general}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", background: loading ? T.inputBorder : "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", fontSize: "15px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Enviar link"}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textMuted }}>
          {mode === "login" ? "¿No tenés cuenta? " : mode === "register" ? "¿Ya tenés cuenta? " : ""}
          {mode === "forgot" ? (
            <button type="button" onClick={() => { setMode("login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>← Volver al inicio</button>
          ) : (
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              {mode === "login" ? "Creá una" : "Iniciá sesión"}
            </button>
          )}
        </p>

        {/* Terms */}
        {mode === "register" && (
          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: T.textFaint, lineHeight: 1.5 }}>
            Al crear tu cuenta aceptás los <button type="button" style={{ background: "none", border: "none", color: "#E07A5F", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>términos</button> y la <button type="button" style={{ background: "none", border: "none", color: "#E07A5F", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>política de privacidad</button>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function ToDone() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const T = dark ? themes.dark : themes.light;

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);


  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: `3px solid ${T.inputBorder}`, borderTopColor: "#E07A5F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={setUser} dark={dark} setDark={setDark} />;

  return <AppMain user={user} onLogout={() => signOutUser()} dark={dark} setDark={setDark} T={T} />;
}

// ── DB ↔ local task mapping ───────────────────────────────────────────────────
function toLocal(t) {
  return {
    id: t.id,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    doneAt: t.done_at ? new Date(t.done_at).getTime() : null,
    createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
    subtasks: t.subtasks || [],
    scheduledFor: t.scheduled_for,
    order: t.order ?? 0,
  };
}
function toDb(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    done_at: t.doneAt ? new Date(t.doneAt).toISOString() : null,
    subtasks: t.subtasks || [],
    scheduled_for: t.scheduledFor ?? null,
    order: t.order ?? 0,
  };
}

function AppMain({ user, onLogout, dark, setDark, T }) {
  const [tasks, setTasks] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newSchedule, setNewSchedule] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [dismissedSuggIds, setDismissedSuggIds] = useState(new Set());
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const aiDebounceRef = useRef(null);
  const estimateDebounceRef = useRef(null);
  const tasksRef = useRef([]);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState(null);
  const [quickDump, setQuickDump] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiAccepted, setAiAccepted] = useState({ priority: false, schedule: false, minutes: false });
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [announce, setAnnounce] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [addBtnHover, setAddBtnHover] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState(null); // { type: "ok"|"err", text }
  const accountRef = useRef(null);
  const suggScrollRef = useRef(null);
  const [suggAtStart, setSuggAtStart] = useState(true);
  const [suggAtEnd, setSuggAtEnd] = useState(false);

  const completedToday = tasks.filter(t => t.done && t.doneAt && (Date.now() - t.doneAt) < 86400000).length;
  const todayTasks = useMemo(() => tasks.filter(t => !t.done && t.scheduledFor === "hoy").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [tasks]);
  const weekTasks = useMemo(() => tasks.filter(t => !t.done && t.scheduledFor === "semana").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [tasks]);
  const unscheduled = useMemo(() => tasks.filter(t => !t.done && !t.scheduledFor).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), [tasks]);
  const todayMin = todayTasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const todayDoneMin = tasks.filter(t => t.done && t.scheduledFor === "hoy").reduce((s, t) => s + (t.minutes || 0), 0);
  const todayTotalMin = todayMin + todayDoneMin; // fixed denominator: all today tasks regardless of done state
  const weekMin = weekTasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const pendingCount = tasks.filter(t => !t.done).length;
  const overloaded = todayMin > WORKDAY_MINUTES;

  const suggestions = useMemo(() => {
    const all = [];
    if (overloaded) all.push({ id: "overload", text: `Tenés ${fmt(todayMin)} para hoy (${fmt(todayMin - WORKDAY_MINUTES)} de más). ¿Movemos la menos urgente?`, icon: "⚠️", action: { type: "unload" }, color: "#E07A5F" });
    const large = todayTasks.filter(t => t.minutes >= 120 && t.subtasks.length === 0);
    if (large.length > 0) all.push({ id: `split-${large[0].id}`, text: `"${large[0].text}" son ${fmt(large[0].minutes)}. Dividirla en pasos la hace más manejable.`, icon: "🧩", action: { type: "split", taskId: large[0].id }, color: "#BB6BD9" });
    if (todayTasks.length === 0 && pendingCount > 0) all.push({ id: "suggest", text: "No tenés tareas para hoy. ¿Querés que mueva las más prioritarias?", icon: "📋", action: { type: "suggest" }, color: "#56CCF2" });
    if (completedToday >= 5) all.push({ id: "done5", text: "¡5 tareas completadas hoy! Sos una máquina.", icon: "🏆", color: "#81B29A" });
    else if (completedToday >= 3) all.push({ id: "done3", text: `¡${completedToday} completadas! Muy buen ritmo por hoy.`, icon: "🎖️", color: "#81B29A" });
    if (weekTasks.length > 5 && !overloaded) all.push({ id: "weekload", text: `Tenés ${weekTasks.length} tareas en la semana. Buen momento para revisar prioridades.`, icon: "📅", color: "#E6AA68" });
    if (unscheduled.length >= 3) all.push({ id: "unscheduled", text: `${unscheduled.length} tareas sin fecha. Agendarlas te ayuda a no olvidarlas.`, icon: "📥", action: { type: "suggest" }, color: "#9B6DB5" });
    if (todayMin > 0 && !overloaded && completedToday < 3 && todayTasks.length > 0) all.push({ id: "balanced", text: `Tenés ${fmt(todayMin)} planeadas para hoy. Día bien equilibrado.`, icon: "✅", color: "#81B29A" });
    return all.filter(s => !dismissedSuggIds.has(s.id));
  }, [tasks, todayTasks, weekTasks, unscheduled, todayMin, completedToday, overloaded, pendingCount, dismissedSuggIds]);

  const dismissSugg = (id) => setDismissedSuggIds(prev => new Set([...prev, id]));

  // Keep tasksRef in sync so fetchAiSuggestions always has current data
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const fetchAiSuggestions = async () => {
    const currentTasks = tasksRef.current;
    setAiSuggestionsLoading(true);
    try {
      const todayT = currentTasks.filter(t => !t.done && t.scheduledFor === 'hoy');
      const weekT  = currentTasks.filter(t => !t.done && t.scheduledFor === 'semana');
      const doneToday = currentTasks.filter(t => t.done && t.doneAt && Date.now() - t.doneAt < 86400000).length;
      const unscheduledN = currentTasks.filter(t => !t.done && !t.scheduledFor).length;
      const todayMin = todayT.reduce((s, t) => s + (t.minutes || 0), 0);

      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTasks: todayT.slice(0, 8).map(t => ({ text: t.text, priority: t.priority, minutes: t.minutes })),
          weekTasks: weekT.slice(0, 5).map(t => ({ text: t.text, priority: t.priority })),
          doneTodayCount: doneToday,
          todayMinutes: todayMin,
          workdayMinutes: WORKDAY_MINUTES,
          unscheduledCount: unscheduledN,
          hour: new Date().getHours(),
        }),
      });
      const data = await res.json();
      console.log('[ai-suggest] status:', res.status, 'data:', data);
      if (res.ok && data.suggestions?.length > 0) {
        setAiSuggestions(data.suggestions.map(s => ({ ...s, isAI: true })));
      }
    } catch (e) {
      console.error('[ai-suggest] error:', e);
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  // Load tasks from Supabase on mount
  useEffect(() => {
    supabase.from('tasks').select('*').eq('user_id', user.id).order('order').then(({ data, error }) => {
      if (error) console.error('[tasks]', error);
      else {
        const loaded = (data || []).map(toLocal);
        setTasks(loaded);
        tasksRef.current = loaded;
      }
      setDbLoaded(true);
    });
  }, [user.id]);

  // Fetch AI suggestions on load and when task state changes meaningfully
  useEffect(() => {
    if (!dbLoaded) return;
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    const delay = aiSuggestions.length === 0 ? 800 : 8000;
    aiDebounceRef.current = setTimeout(fetchAiSuggestions, delay);
  }, [dbLoaded, pendingCount, completedToday]); // eslint-disable-line react-hooks/exhaustive-deps

  // DB sync helpers (defined here to close over user.id)
  const dbInsert = (task) => supabase.from('tasks').insert(toDb(task, user.id)).then(({ error }) => { if (error) console.error('[db:insert]', error); });
  const dbUpdate = (id, patch) => supabase.from('tasks').update(patch).eq('id', id).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:update]', error); });
  const dbDelete = (id) => supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:delete]', error); });
  const dbUpsertMany = (rows) => supabase.from('tasks').upsert(rows.map(t => toDb(t, user.id)), { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[db:upsert]', error); });

  useEffect(() => {
    const trimmed = newTask.trim();
    if (trimmed.length <= 3) { setAiResult(null); setEstimateLoading(false); return; }
    // Show rule-based result immediately while user types
    const quick = aiSuggest(trimmed);
    setAiResult(quick);
    setAiAccepted({ priority: false, schedule: false, minutes: false });
    // If rule-based had no results, show dots while waiting for API
    setEstimateLoading(!quick.hasAny);
    // Debounce Claude upgrade
    if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = await res.json();
        console.log('[estimate] status:', res.status, 'data:', data);
        if (res.ok && (data.priority || data.scheduledFor || data.minutes)) {
          setAiResult({ ...data, cleanText: trimmed, hasAny: true });
        }
      } catch (e) {
        console.error('[estimate] error:', e);
      } finally {
        setEstimateLoading(false);
      }
    }, 600);
  }, [newTask]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close account menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAccountMenu]);

  // Close panel on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && showAdd) { setShowAdd(false); setNewTask(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAdd]);

  const addTask = () => {
    if (!newTask.trim()) return;
    const ai = aiResult || aiSuggest(newTask);
    const t = { id: crypto.randomUUID(), text: ai.cleanText, priority: aiAccepted.priority && ai.priority ? ai.priority : newPriority, minutes: aiAccepted.minutes && ai.minutes ? ai.minutes : newMinutes, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: aiAccepted.schedule && ai.scheduledFor ? ai.scheduledFor : newSchedule || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: -1 };
    setTasks(prev => { const p = [t, ...prev.filter(x => !x.done)].map((x, i) => ({ ...x, order: i })); return [...p, ...prev.filter(x => x.done)]; });
    dbInsert(t);
    setAnnounce(`Tarea "${ai.cleanText}" agregada`);
    setNewTask(""); setNewPriority("medium"); setNewMinutes(30); setNewSchedule(null); setAiResult(null); setAiAccepted({ priority: false, schedule: false, minutes: false }); setShowAdd(false); playAdd();
  };
  const quickDumpAdd = () => {
    if (!quickText.trim()) return;
    const lines = quickText.split("\n").filter(l => l.trim());
    const nt = lines.map((line, i) => { const ai = aiSuggest(line); return { id: crypto.randomUUID(), text: ai.cleanText, priority: ai.priority || "medium", minutes: ai.minutes || 30, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: ai.scheduledFor || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: i }; });
    setTasks(prev => { const p = [...nt, ...prev.filter(t => !t.done)].map((t, i) => ({ ...t, order: i })); return [...p, ...prev.filter(t => t.done)]; });
    dbUpsertMany(nt);
    setAnnounce(`${lines.length} tareas agregadas`);
    setQuickText(""); setQuickDump(false); playAdd();
  };
  const toggleTask = id => {
    const t = tasks.find(x => x.id === id);
    const newDone = !t.done;
    const newDoneAt = newDone ? Date.now() : null;
    if (newDone) { setShowConfetti(true); setConfettiKey(k => k + 1); setTimeout(() => setShowConfetti(false), 100); setAnnounce(`"${t.text}" completada`); } else { setAnnounce(`"${t.text}" desmarcada`); }
    setTasks(prev => prev.map(x => x.id === id ? { ...x, done: newDone, doneAt: newDoneAt } : x));
    dbUpdate(id, { done: newDone, done_at: newDoneAt ? new Date(newDoneAt).toISOString() : null });
  };
  const deleteTask = id => {
    const t = tasks.find(x => x.id === id);
    setAnnounce(`"${t?.text}" eliminada`);
    setTasks(prev => prev.filter(t => t.id !== id));
    dbDelete(id);
  };
  const updateSubs = (id, subs) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, subtasks: subs } : t));
    dbUpdate(id, { subtasks: subs });
  };
  const addSub = (id, text) => {
    const newSubs = [...(tasks.find(t => t.id === id)?.subtasks || []), { text, done: false }];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, subtasks: newSubs } : t));
    dbUpdate(id, { subtasks: newSubs });
  };
  const scheduleTask = (id, when) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: when } : t));
    dbUpdate(id, { scheduled_for: when ?? null });
    playClick();
  };
  const deferTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: "semana" } : t));
    dbUpdate(id, { scheduled_for: "semana" });
    playClick();
  };
  const moveTask = (id, dir) => {
    const pending = tasks.filter(t => !t.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = pending.findIndex(t => t.id === id);
    if (idx === -1) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= pending.length) return;
    const item = pending[idx];
    pending.splice(idx, 1);
    pending.splice(ni, 0, item);
    const newPending = pending.map((t, i) => ({ ...t, order: i }));
    setTasks([...newPending, ...tasks.filter(t => t.done)]);
    dbUpsertMany(newPending);
  };

  const handleSuggAction = (sugg) => {
    if (!sugg?.action) return;
    if (sugg.action.type === "unload") {
      // Move the LEAST urgent today task (highest priority number = low priority) to semana
      const p = { high: 2, medium: 1, low: 0 };
      const least = todayTasks.slice().sort((a, b) => (p[a.priority] ?? 1) - (p[b.priority] ?? 1))[0];
      if (least) { setTasks(prev => prev.map(t => t.id === least.id ? { ...t, scheduledFor: "semana" } : t)); dbUpdate(least.id, { scheduled_for: "semana" }); }
    }
    if (sugg.action.type === "suggest") {
      // Move top-priority pending tasks (from any section) to today
      const p = { high: 2, medium: 1, low: 0 };
      const allPending = tasks.filter(t => !t.done && t.scheduledFor !== "hoy");
      const ids = allPending.sort((a, b) => (p[b.priority] ?? 1) - (p[a.priority] ?? 1)).slice(0, 3).map(t => t.id);
      if (ids.length > 0) {
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, scheduledFor: "hoy" } : t));
        supabase.from('tasks').update({ scheduled_for: "hoy" }).in('id', ids).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:suggest]', error); });
      }
    }
    if (sugg.action.type === "split" && sugg.action.taskId) {
      setSplitTargetId(sugg.action.taskId);
      // Auto-clear after user has had time to interact
      setTimeout(() => setSplitTargetId(null), 8000);
    }
    dismissSugg(sugg.id); playClick();
  };

  // Drag
  const dStart = (e, id) => { if (tasks.find(t => t.id === id)?.done) return; setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); };
  const dOver = (e, id) => { e.preventDefault(); if (!tasks.find(t => t.id === id)?.done) setDragOverId(id); };
  const dDrop = (e, tid) => {
    e.preventDefault();
    if (!dragId || dragId === tid) { setDragId(null); setDragOverId(null); return; }
    const dt = tasks.find(t => t.id === dragId);
    if (!dt || dt.done) { setDragId(null); setDragOverId(null); return; }
    const tt = tasks.find(t => t.id === tid);
    if (!tt) { setDragId(null); setDragOverId(null); return; }
    const ud = { ...dt, scheduledFor: tt.scheduledFor };
    let ap = tasks.filter(t => !t.done && t.id !== dragId);
    const ti = ap.findIndex(t => t.id === tid);
    ap.splice(ti, 0, ud);
    const newPending = ap.map((t, i) => ({ ...t, order: i }));
    setTasks([...newPending, ...tasks.filter(t => t.done)]);
    dbUpsertMany(newPending);
    setDragId(null); setDragOverId(null); playClick();
  };
  const dEnd = () => { setDragId(null); setDragOverId(null); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  const renderList = (list) => list.map((task, i) => (
    <div key={task.id} draggable={!task.done} onDragStart={e => dStart(e, task.id)} onDragOver={e => dOver(e, task.id)} onDrop={e => dDrop(e, task.id)} onDragEnd={dEnd} style={{ animation: `fadeInUp 0.3s ease ${i * .03}s both` }}>
      <TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} isDragging={dragId === task.id} dragOver={dragOverId === task.id && dragId !== task.id} T={T} autoSplit={splitTargetId === task.id} />
    </div>
  ));

  const sectionH = (icon, title, count, minutes) => (
    <h2 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", marginTop: "16px", padding: "0 2px", fontSize: "16px", fontWeight: 700, color: T.text }}>
      <span aria-hidden="true">{icon}</span> {title} <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 600 }}>({count})</span>
      {minutes > 0 && <span style={{ fontSize: "12px", color: T.textFaint, marginLeft: "auto", background: T.overlay, padding: "3px 10px", borderRadius: "8px", fontWeight: 600 }}><span aria-hidden="true">🕐</span> {fmt(minutes)}</span>}
    </h2>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes confettiFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes popIn{0%{transform:translateY(-50%) scale(0);opacity:0}60%{transform:translateY(-50%) scale(1.3)}100%{transform:translateY(-50%) scale(1);opacity:1}}
        @keyframes slideDown{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{0%{opacity:0;transform:translateX(28px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes audioBar{0%,100%{height:3px;opacity:0.4}50%{height:20px;opacity:1}}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder,textarea::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        button:active{transform:scale(0.97)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px}
        .sugg-scroll{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:2px}
        .sugg-scroll::-webkit-scrollbar{display:none}
        .sugg-arrow{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1px solid rgba(128,128,128,0.15);background:rgba(255,255,255,0.85);backdrop-filter:blur(6px);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:rgba(80,80,80,0.7);box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:opacity 0.2s,transform 0.15s;z-index:2;line-height:1}
        .sugg-arrow:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 3px 12px rgba(0,0,0,0.13)}
        .dark .sugg-arrow{background:rgba(40,40,45,0.85);color:rgba(220,220,220,0.7);border-color:rgba(255,255,255,0.1)}
      `}</style>

      {/* Skip link */}
      <a href="#main-content" className="sr-only" style={{ position: "absolute", top: 0, left: 0, background: T.focusRing, color: "white", padding: "8px 16px", zIndex: 10000, fontSize: "14px" }}
        onFocus={e => Object.assign(e.currentTarget.style, { position: "static", clip: "auto", width: "auto", height: "auto" })}
        onBlur={e => Object.assign(e.currentTarget.style, { position: "absolute", clip: "rect(0,0,0,0)", width: "1px", height: "1px" })}>
        Ir al contenido
      </a>

      {/* Live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

      <Confetti key={confettiKey} active={showConfetti} />

      <main id="main-content" style={{ maxWidth: "520px", margin: "0 auto", padding: "32px 20px 190px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "30px", fontWeight: 800, color: T.text, letterSpacing: "-0.5px" }}>
            to <span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
            <span aria-hidden="true" style={{ fontSize: "8px", verticalAlign: "super", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
          </h1>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button onClick={() => { setQuickDump(!quickDump); playClick(); }} aria-label="Captura rápida" aria-expanded={quickDump} style={{ background: quickDump ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.overlay, color: quickDump ? "white" : T.textFaint, border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}><span aria-hidden="true">⚡</span> Quick dump</button>
            {/* Avatar / Account menu */}
            <div ref={accountRef} style={{ position: "relative" }}>
              <button onClick={() => { setShowAccountMenu(!showAccountMenu); playClick(); }}
                aria-label="Menú de cuenta" aria-expanded={showAccountMenu} aria-haspopup="true"
                style={{
                  width: "36px", height: "36px", borderRadius: "50%", border: `2px solid ${showAccountMenu ? "#E07A5F" : T.inputBorder}`,
                  background: "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  transition: "border-color 0.2s ease", lineHeight: 1,
                }}>
                {getUserName(user).charAt(0).toUpperCase()}
              </button>
              {showAccountMenu && (
                <div role="menu" aria-label="Opciones de cuenta"
                  style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: "200px",
                    background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "8px", zIndex: 200,
                    animation: "slideDown 0.2s ease",
                  }}>
                  {/* User info */}
                  <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.inputBorder}`, marginBottom: "4px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{getUserName(user)}</p>
                    <p style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>{user.email}</p>
                  </div>
                  {/* Menu items */}
                  <button role="menuitem" onClick={() => { setShowAccountMenu(false); setShowChangePass(true); setChangePassMsg(null); setNewPass(""); setNewPassConfirm(""); }}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                      background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    Mi cuenta
                  </button>
                  <button role="menuitem" onClick={() => { setShowAccountMenu(false); setDark(!dark); }}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                      background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {dark ? "Modo claro" : "Modo oscuro"}
                  </button>
                  <div style={{ height: "1px", background: T.inputBorder, margin: "4px 0" }} />
                  <button role="menuitem" onClick={() => { setShowAccountMenu(false); onLogout(); }}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                      background: "transparent", cursor: "pointer", fontSize: "13px", color: "#E07A5F", fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <p style={{ fontSize: "15px", color: T.textMuted, fontWeight: 500, marginBottom: "16px" }}>{greeting}, {getUserName(user)} <span aria-hidden="true">✦</span></p>

        {quickDump && (
          <section aria-label="Captura rápida" style={{ background: T.surface, borderRadius: "16px", padding: "16px", marginBottom: "14px", border: `1.5px solid ${T.border}`, animation: "slideDown 0.3s ease" }}>
            <p id="qd-desc" style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", fontWeight: 600 }}>Una tarea por línea.</p>
            <textarea autoFocus value={quickText} onChange={e => setQuickText(e.target.value)} aria-label="Captura rápida" aria-describedby="qd-desc" placeholder={"Llamar a Juan mañana\nPreparar presentación urgente"} style={{ width: "100%", minHeight: "90px", fontSize: "14px", padding: "12px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, resize: "vertical", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button onClick={quickDumpAdd} style={{ flex: 1, padding: "10px", borderRadius: "12px", background: quickText.trim() ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: quickText.trim() ? "white" : T.textFaint, border: "none", fontSize: "13px", fontWeight: 700, cursor: quickText.trim() ? "pointer" : "default" }}>Agregar {quickText.split("\n").filter(l => l.trim()).length}</button>
              <button onClick={() => { setQuickDump(false); setQuickText(""); }} aria-label="Cancelar" style={{ padding: "10px 16px", borderRadius: "12px", background: T.overlay, color: T.textFaint, border: "none", fontSize: "13px", cursor: "pointer" }}>Cancelar</button>
            </div>
            <p aria-hidden="true" style={{ fontSize: "10px", color: T.textFaint, marginTop: "8px" }}>✨ IA asigna día, prioridad y tiempo</p>
          </section>
        )}

        {!dbLoaded && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ width: "20px", height: "20px", border: `3px solid ${T.inputBorder}`, borderTopColor: "#E07A5F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {dbLoaded && <>
        <KindStreak tasks={tasks} />

        {/* AI suggestion cards — Claude-generated if available, rule-based fallback */}

        {(() => {
          const display = (aiSuggestions.length > 0 ? aiSuggestions : suggestions).filter(s => !dismissedSuggIds.has(s.id));
          if (display.length === 0) return null;
          const scrollSugg = (dir) => {
            const el = suggScrollRef.current;
            if (!el) return;
            const card = el.firstElementChild;
            const w = card ? card.offsetWidth + 10 : el.clientWidth * 0.85;
            el.scrollBy({ left: dir * w, behavior: 'smooth' });
          };
          const onSuggScroll = () => {
            const el = suggScrollRef.current;
            if (!el) return;
            setSuggAtStart(el.scrollLeft <= 8);
            setSuggAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
          };
          return (
            <div style={{ position: "relative", marginBottom: "14px" }}>
              {display.length > 1 && !suggAtStart && (
                <button className="sugg-arrow" onClick={() => scrollSugg(-1)} aria-label="Anterior sugerencia" style={{ left: "-13px" }}>‹</button>
              )}
              <div className="sugg-scroll" ref={suggScrollRef} onScroll={onSuggScroll} role="region" aria-label="Sugerencias">
                {display.map((sugg) => (
                  <div key={sugg.id} role="status" style={{ flex: "0 0 82%", scrollSnapAlign: "start", background: T.surface, borderRadius: "16px", padding: "13px 16px", display: "flex", flexDirection: "column", gap: "10px", border: `1px solid ${sugg.color ? sugg.color + "25" : T.border}`, borderLeft: `3px solid ${sugg.color || T.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span aria-hidden="true" style={{ fontSize: "20px", flexShrink: 0 }}>{sugg.icon}</span>
                      <p style={{ fontSize: "14px", color: T.textSec, lineHeight: 1.5, fontWeight: 500, flex: 1 }}>{sugg.text}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {sugg.isAI ? <span style={{ fontSize: "10px", color: T.textFaint, fontWeight: 600, letterSpacing: "0.3px" }}>✦ ToDone</span> : <span />}
                      <div style={{ display: "flex", gap: "6px" }}>
                        {sugg.action && <button onClick={() => handleSuggAction(sugg)} aria-label="Aplicar sugerencia" style={{ background: sugg.color || "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Dale</button>}
                        <button onClick={() => dismissSugg(sugg.id)} aria-label="Descartar sugerencia" style={{ background: T.overlay, color: T.textFaint, border: "none", borderRadius: "10px", padding: "6px 10px", fontSize: "14px", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {display.length > 1 && !suggAtEnd && (
                <button className="sugg-arrow" onClick={() => scrollSugg(1)} aria-label="Siguiente sugerencia" style={{ right: "-13px" }}>›</button>
              )}
            </div>
          );
        })()}

        {todayTotalMin > 0 && <TodayCard total={todayTotalMin} done={todayDoneMin} taskCount={todayTasks.length + tasks.filter(t => t.done && t.scheduledFor === "hoy").length} T={T} />}

        {/* HOY */}
        <section aria-label="Tareas de hoy">
          {sectionH("☀️", "Hoy", todayTasks.length, todayMin)}
          <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
            {todayTasks.length === 0
              ? <p style={{ textAlign: "center", padding: "24px 20px", color: T.textMuted, fontSize: "13px" }}>Sin tareas para hoy</p>
              : renderList(todayTasks)}
          </div>
        </section>

        {/* DESPUÉS */}
        {(weekTasks.length > 0 || unscheduled.length > 0) && (() => {
          const despues = [...weekTasks, ...unscheduled];
          const despuesMin = despues.reduce((s, t) => s + (t.minutes || 0), 0);
          return (
            <section aria-label="Tareas para después" style={{ marginTop: "8px" }}>
              {sectionH("📅", "Después", despues.length, despuesMin)}
              <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
                {renderList(despues)}
              </div>
            </section>
          );
        })()}

        {/* COMPLETADAS */}
        {doneTasks.length > 0 && (
          <section aria-label="Completadas" style={{ marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 8px" }}>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
              <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 600 }}>✓ Completadas ({doneTasks.length})</span>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
            </div>
            <div style={{ maxHeight: "clamp(160px, 30vh, 400px)", overflowY: "auto", paddingRight: "2px" }}>
              {doneTasks.map((task, i) => <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * .02}s both` }}><TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} isDragging={false} dragOver={false} T={T} /></div>)}
            </div>
          </section>
        )}
        </>}
      </main>

      {/* FIXED FOOTER */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: T.panelBg, borderTop: `1px solid ${T.border}`, padding: "14px 20px 16px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, fontWeight: 500 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "13px", color: T.text }}>to <span style={{ color: "#E07A5F" }}>done</span></span> no tiene costos.
        </p>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, marginTop: "2px" }}>
          Si te ayuda a organizarte, podés bancarnos con un{" "}
          <a href="https://cafecito.app/todone" target="_blank" rel="noopener noreferrer"
            style={{ color: "#E07A5F", fontWeight: 700, textDecoration: "none", borderBottom: "1.5px solid rgba(224,122,95,0.3)", paddingBottom: "1px" }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = "#E07A5F"}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = "rgba(224,122,95,0.3)"}>
            ☕ cafecito
          </a>
        </p>
      </footer>

      {/* CHANGE PASSWORD PANEL */}
      {showChangePass && (
        <div role="dialog" aria-label="Cambiar contraseña" aria-modal="true"
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.panelBg, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", boxShadow: T.panelShadow, animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 110 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>Mi cuenta</h3>
                <p style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>{user.email}</p>
              </div>
              <button onClick={() => setShowChangePass(false)} aria-label="Cerrar"
                style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ fontSize: "12px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Cambiar contraseña</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="password" value={newPass} onChange={e => { setNewPass(e.target.value); setChangePassMsg(null); }}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                aria-label="Nueva contraseña"
                style={{ width: "100%", fontSize: "15px", padding: "13px 16px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }}
              />
              <input
                type="password" value={newPassConfirm} onChange={e => { setNewPassConfirm(e.target.value); setChangePassMsg(null); }}
                placeholder="Repetir nueva contraseña"
                aria-label="Repetir nueva contraseña"
                style={{ width: "100%", fontSize: "15px", padding: "13px 16px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }}
              />
            </div>

            {changePassMsg && (
              <p role="alert" style={{ fontSize: "12px", color: changePassMsg.type === "ok" ? "#81B29A" : "#E07A5F", fontWeight: 600, marginTop: "10px" }}>
                {changePassMsg.text}
              </p>
            )}

            <button
              disabled={changePassLoading || !newPass || !newPassConfirm}
              onClick={async () => {
                if (newPass.length < 6) { setChangePassMsg({ type: "err", text: "Mínimo 6 caracteres" }); return; }
                if (newPass !== newPassConfirm) { setChangePassMsg({ type: "err", text: "Las contraseñas no coinciden" }); return; }
                setChangePassLoading(true);
                const { error } = await supabase.auth.updateUser({ password: newPass });
                setChangePassLoading(false);
                if (error) setChangePassMsg({ type: "err", text: error.message });
                else { setChangePassMsg({ type: "ok", text: "Contraseña actualizada" }); setNewPass(""); setNewPassConfirm(""); }
              }}
              style={{ width: "100%", marginTop: "16px", padding: "14px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, cursor: (changePassLoading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !changePassLoading) ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: (newPass && newPassConfirm && !changePassLoading) ? "white" : T.textFaint }}>
              {changePassLoading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </div>
      )}

      {/* ADD PANEL */}
      {showAdd ? (
        <div role="dialog" aria-label="Nueva tarea" aria-modal="true" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.panelBg, borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", boxShadow: T.panelShadow, animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 100 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>Nueva tarea</h3>
              <button onClick={() => { setShowAdd(false); setAiResult(null); setNewTask(""); }} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer" }}>✕</button>
            </div>
            <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} aria-label="Texto de la tarea" placeholder="Ej: Preparar propuesta mañana 2h urgente..." style={{ width: "100%", fontSize: "16px", padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }} />

            {newTask.trim().length > 3 && aiResult?.hasAny && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", animation: "fadeInUp 0.2s ease" }}>
                <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>✦ ToDone sugiere</p>
                {aiResult?.hasAny && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {aiResult.priority && !aiAccepted.priority && <AIChip label="Prioridad" value={PRIORITIES[aiResult.priority]} reason={aiResult.priorityReason} color={aiResult.priority === "high" ? "#E07A5F" : aiResult.priority === "low" ? "#81B29A" : "#E6AA68"} onAccept={() => setAiAccepted(p => ({ ...p, priority: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.priority && aiAccepted.priority && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: (aiResult.priority === "high" ? "#E07A5F" : "#81B29A") + "18", color: aiResult.priority === "high" ? "#E07A5F" : "#81B29A", fontWeight: 700 }}>✓ {PRIORITIES[aiResult.priority]}</span>}
                    {aiResult.scheduledFor && !aiAccepted.schedule && <AIChip label="Cuándo" value={aiResult.scheduledFor} reason={aiResult.scheduleReason} color="#3B9EC4" onAccept={() => setAiAccepted(p => ({ ...p, schedule: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.scheduledFor && aiAccepted.schedule && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(86,204,242,0.12)", color: "#3B9EC4", fontWeight: 700 }}>✓ 📅 {aiResult.scheduledFor}</span>}
                    {aiResult.minutes && !aiAccepted.minutes && <AIChip label="Tiempo" value={fmt(aiResult.minutes)} reason={aiResult.minutesReason} color="#6B7280" onAccept={() => setAiAccepted(p => ({ ...p, minutes: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.minutes && aiAccepted.minutes && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(61,64,91,0.06)", color: "#6B7280", fontWeight: 700 }}>✓ 🕐 {fmt(aiResult.minutes)}</span>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "14px", marginBottom: "14px" }}>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Prioridad</legend>
                <div style={{ display: "flex", gap: "4px" }}>
                  {Object.entries(PRIORITIES).map(([k, l]) => {
                    const active = (aiAccepted.priority && aiResult?.priority === k) || (!aiAccepted.priority && newPriority === k);
                    return <button key={k} onClick={() => { setNewPriority(k); setAiAccepted(p => ({ ...p, priority: false })); }} aria-pressed={active} style={{ flex: 1, padding: "6px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, border: active ? "none" : `1.5px solid ${T.inputBorder}`, background: active ? (k === "high" ? "#E07A5F" : k === "medium" ? "#E6AA68" : "#81B29A") : T.inputBg, color: active ? "white" : T.textMuted, cursor: "pointer" }}>{l}</button>;
                  })}
                </div>
              </fieldset>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tiempo</legend>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>{fmt((aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes)}</span>
                </div>
                <input
                  type="range" min={0} max={EFFORT_OPTIONS.length - 1} step={1}
                  value={(() => { const cur = (aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes; return EFFORT_OPTIONS.reduce((ci, m, i) => Math.abs(m - cur) < Math.abs(EFFORT_OPTIONS[ci] - cur) ? i : ci, 0); })()}
                  onChange={e => { setNewMinutes(EFFORT_OPTIONS[+e.target.value]); setAiAccepted(p => ({ ...p, minutes: false })); }}
                  aria-label={`Tiempo estimado: ${fmt(newMinutes)}`}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#E07A5F" }}
                />
                <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {EFFORT_OPTIONS.map(m => <span key={m} style={{ fontSize: "9px", color: T.textFaint }}>{fmtS(m)}</span>)}
                </div>
              </fieldset>
            </div>

            <button onClick={addTask} disabled={!newTask.trim()} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: newTask.trim() ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: newTask.trim() ? "white" : T.textFaint, border: "none", fontSize: "15px", fontWeight: 700, cursor: newTask.trim() ? "pointer" : "default" }}>Agregar tarea</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowAdd(true); playClick(); }}
          aria-label="Nueva tarea"
          onMouseEnter={() => setAddBtnHover(true)}
          onMouseLeave={() => setAddBtnHover(false)}
          style={{
            position: "fixed", bottom: "84px", right: "20px",
            height: "52px", borderRadius: "26px",
            width: addBtnHover ? "176px" : "52px",
            background: "linear-gradient(135deg, #E07A5F, #E6AA68)",
            color: "white", border: "none",
            padding: addBtnHover ? "0 22px 0 16px" : "0",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            gap: addBtnHover ? "8px" : "0",
            boxShadow: "0 4px 24px rgba(224,122,95,0.35)", zIndex: 100,
            fontSize: "16px", fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), padding 0.25s ease, gap 0.25s ease",
          }}>
          <span aria-hidden="true" style={{ fontSize: "28px", fontWeight: 300, lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px" }}>+</span>
          <span style={{ overflow: "hidden", maxWidth: addBtnHover ? "120px" : "0", opacity: addBtnHover ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.15s ease" }}>Nueva tarea</span>
        </button>
      )}
    </div>
  );
}
