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
const TIME_OPTIONS = [
  { label: "15 min", min: 15 },
  { label: "30 min", min: 30 },
  { label: "1 h",    min: 60 },
  { label: "2 h",    min: 120 },
  { label: "4 h+",   min: 240 },
];

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
let _soundOn = (() => { try { return localStorage.getItem("sound") !== "false"; } catch { return true; } })();
function playComplete() { if (!_soundOn) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(); [523.25, 659.25, 783.99].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0, c.currentTime + i * .08); g.gain.linearRampToValueAtTime(.12, c.currentTime + i * .08 + .04); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .08 + .5); o.start(c.currentTime + i * .08); o.stop(c.currentTime + i * .08 + .5); }); } catch (e) { } }
function playAdd() { if (!_soundOn) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; o.type = "sine"; g.gain.setValueAtTime(.08, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .15); o.start(); o.stop(c.currentTime + .15); } catch (e) { } }
function playClick() { if (!_soundOn) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; o.type = "triangle"; g.gain.setValueAtTime(.05, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .06); o.start(); o.stop(c.currentTime + .06); } catch (e) { } }

// ============================================================
// THEME
// ============================================================
const themes = {
  light: {
    bg: "#E4DDD7",
    card: "#EEEAE5", cardDone: "rgba(129,178,154,0.05)", cardDrag: "#E7E1DB",
    surface: "#EEEAE5", text: "#000000", textSec: "#3A3A3C",
    textMuted: "#636366", textFaint: "#7C7C80",
    border: "rgba(0,0,0,0.07)", borderDone: "rgba(129,178,154,0.2)",
    inputBg: "#E7E1DB", inputBorder: "rgba(0,0,0,0.1)", barBg: "#D5CFC9",
    overlay: "rgba(0,0,0,0.04)", focusRing: "#D38B71", placeholder: "#9E9E9E",
    panelBg: "#EEEAE5", panelShadow: "0 2px 12px rgba(0,0,0,0.06)",
    accent: "#D38B71", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
    priorityHigh: "#E07A5F", priorityMed: "#E6AA68", priorityLow: "#81B29A",
    success: "#81B29A", danger: "#E07A5F",
    info: "#3B9EC4", split: "#BB6BD9", shared: "#9B6DB5",
  },
  dark: {
    bg: "#000000",
    card: "#1C1C1E", cardDone: "rgba(129,178,154,0.04)", cardDrag: "#2C2C2E",
    surface: "#1C1C1E", text: "#FFFFFF", textSec: "rgba(235,235,245,0.6)",
    textMuted: "#8E8E93", textFaint: "#6E6E73",
    border: "rgba(255,255,255,0.1)", borderDone: "rgba(129,178,154,0.15)",
    inputBg: "#2C2C2E", inputBorder: "rgba(255,255,255,0.1)", barBg: "rgba(255,255,255,0.1)",
    overlay: "rgba(255,255,255,0.05)", focusRing: "#E5A48B", placeholder: "#48484A",
    panelBg: "#1C1C1E", panelShadow: "0 -0.5px 0 rgba(255,255,255,0.08)",
    accent: "#E5A48B", cardShadow: "none",
    priorityHigh: "#E07A5F", priorityMed: "#E6AA68", priorityLow: "#81B29A",
    success: "#81B29A", danger: "#E07A5F",
    info: "#56CCF2", split: "#BB6BD9", shared: "#9B6DB5",
  }
};

// ============================================================
// DATA
// ============================================================
const celebrations = ["🎉", "✨", "🚀", "💫", "⭐", "🔥", "💪", "🎯", "👏", "🌟"];

// ============================================================
// SMALL COMPONENTS
// ============================================================
function Confetti({ active }) {
  const [p, setP] = useState([]);
  useEffect(() => { if (active) { setP(Array.from({ length: 24 }, (_, i) => ({ id: i, style: { position: "fixed", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, backgroundColor: ["#E07A5F", "#E6AA68", "#81B29A", "#56CCF2", "#BB6BD9", "#F2C94C"][Math.floor(Math.random() * 6)], borderRadius: Math.random() > .5 ? "50%" : "2px", left: `${Math.random() * 100}vw`, top: "-10px", zIndex: 9999, animation: `confettiFall ${1.5 + Math.random() * 1.5}s ease-out forwards`, animationDelay: `${Math.random() * .3}s` } }))); setTimeout(() => setP([]), 3000); } }, [active]);
  return <div aria-hidden="true">{p.map(x => <div key={x.id} style={x.style} />)}</div>;
}

function KindStreak({ tasks, T }) {
  const streak = useMemo(() => {
    const n = new Date();
    let s = 0;
    for (let i = 0; i < 35; i++) {
      const d = new Date(n); d.setDate(n.getDate() - i);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const count = tasks.filter(t => t.done && t.doneAt && t.doneAt >= ds && t.doneAt < ds + 86400000).length;
      if (count > 0) s++; else if (i > 0) break;
    }
    return s;
  }, [tasks]);
  if (streak < 1) return null;
  const msgs = [{ min: 1, t: "¡Primer día!", e: "🌱" }, { min: 2, t: `${streak} días seguidos`, e: "🌿" }, { min: 5, t: `¡${streak} días!`, e: "🌳" }, { min: 10, t: `${streak} días. Imparable.`, e: "🔥" }, { min: 20, t: `${streak}d. Leyenda.`, e: "👑" }];
  const m = [...msgs].reverse().find(x => streak >= x.min) || msgs[0];
  return (
    <div role="status" aria-label={`Racha: ${m.t}`} style={{ display: "flex", alignItems: "center", gap: "8px", background: T.overlay, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", color: T.success, fontWeight: 600, marginBottom: "12px", border: `0.5px solid ${T.border}` }}>
      <span aria-hidden="true" style={{ fontSize: "16px" }}>{m.e}</span>
      <span>{m.t}</span>
      <div aria-hidden="true" style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>{Array.from({ length: Math.min(streak, 7) }, (_, i) => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.success, opacity: .3 + (i / 7) * .7 }} />)}</div>
    </div>
  );
}

function TodayCard({ total, done, taskCount, T }) {
  const r = 22, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = taskCount > 0 && pct >= 1;
  return (
    <div style={{ background: T.card, borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", border: `0.5px solid ${T.border}`, borderTop: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: T.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Plan de hoy</p>
        <p style={{ fontSize: "34px", fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(total) || "—"}</p>
        <p style={{ fontSize: "13px", color: T.textMuted, marginTop: "6px", fontWeight: 500 }}>
          {done > 0 ? <><span style={{ color: T.accent, fontWeight: 700 }}>{fmt(done)}</span> · </> : ""}{taskCount} tarea{taskCount !== 1 ? "s" : ""}
        </p>
      </div>
      <svg width="60" height="60" style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="none" stroke={T.barBg} strokeWidth="3" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={allDone ? T.success : T.accent} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="30" y="34" textAnchor="middle" fontSize="11" fontWeight="600" fill={allDone ? T.success : pct > 0 ? T.accent : T.textMuted}>{Math.round(pct * 100)}%</text>
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
// MOBILE TASK SHEET (bottom sheet for task details on mobile)
// ============================================================
function MobileTaskSheet({ task, onClose, onToggle, onDelete, onSchedule, onDefer, onUpdateText, onUpdateDescription, onUpdatePriority, onUpdateMinutes, onDelegate, onUnshare, onSplit, onAddSub, onMoveToList, T, lists }) {
  const [localText, setLocalText] = useState(task.text);
  const [localDesc, setLocalDesc] = useState(task.description ?? "");
  const [splitText, setSplitText] = useState("");
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState(null);
  const [openProp, setOpenProp] = useState(null);
  const pc = task.priority === "high" ? T.priorityHigh : task.priority === "medium" ? T.priorityMed : T.priorityLow;
  const PRIOS = [{ key: "high", label: "Alta", color: T.priorityHigh }, { key: "medium", label: "Media", color: T.priorityMed }, { key: "low", label: "Baja", color: T.priorityLow }];
  const pillBase = { fontSize: "12px", fontWeight: 700, padding: "6px 14px", borderRadius: "20px", cursor: "pointer", border: "none" };
  const selPill = (color) => ({ ...pillBase, color: color, background: `${color}18`, border: `1.5px solid ${color}` });
  const mutedPill = { ...pillBase, color: T.textMuted, background: T.overlay, border: `1.5px solid ${T.inputBorder}` };
  const currP = PRIOS.find(p => p.key === task.priority) || PRIOS[1];
  const currT = TIME_OPTIONS.find(o => o.min === task.minutes);
  const currL = task.listId ? lists?.find(l => l.id === task.listId) : null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, animation: "fadeIn 0.2s ease" }} />
      {/* Sheet */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: T.surface, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", animation: "sheetUp 0.3s cubic-bezier(0.4,0,0.2,1)", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}>
        {/* Handle + close */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", position: "relative" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: T.barBg }} />
          <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: "8px", right: "14px", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "22px", lineHeight: 1, padding: "4px 8px" }}>×</button>
        </div>
        <div style={{ padding: "8px 20px 24px" }}>
          {/* Task text — editable */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
            <button onClick={() => { onToggle(task.id); onClose(); }} style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${pc}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "4px" }} />
            <input value={localText} onChange={e => setLocalText(e.target.value)} maxLength={500}
              onBlur={() => { const v = localText.trim(); if (v && v !== task.text) onUpdateText(task.id, v); }}
              style={{ fontSize: "18px", fontWeight: 600, color: T.text, background: "transparent", border: "none", outline: "none", flex: 1, padding: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", minWidth: 0 }} />
          </div>
          {/* Description */}
          <textarea value={localDesc} onChange={e => setLocalDesc(e.target.value)}
            onBlur={() => { if (localDesc !== (task.description ?? "")) onUpdateDescription(task.id, localDesc); }}
            placeholder="Agregar descripción…" rows={2} maxLength={2000}
            style={{ width: "100%", fontSize: "14px", padding: "10px 12px", borderRadius: "12px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.textSec, resize: "none", boxSizing: "border-box", marginBottom: "16px" }} />
          {/* Collapsible property pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {/* Priority */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>Prioridad</span>
              {openProp === "priority"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    {PRIOS.map(p => <button key={p.key} onClick={() => { onUpdatePriority(task.id, p.key); setOpenProp(null); }} style={task.priority === p.key ? selPill(p.color) : mutedPill}>{p.label}</button>)}
                  </div>
                : <button onClick={() => setOpenProp("priority")} style={selPill(currP.color)}>{currP.label} ›</button>
              }
            </div>
            {/* Time */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>Tiempo</span>
              {openProp === "time"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    {TIME_OPTIONS.map(o => <button key={o.min} onClick={() => { onUpdateMinutes(task.id, o.min); setOpenProp(null); }} style={task.minutes === o.min ? selPill(T.accent) : mutedPill}>{o.label}</button>)}
                  </div>
                : <button onClick={() => setOpenProp("time")} style={currT ? selPill(T.accent) : mutedPill}>{currT ? `${currT.label} ›` : "Elegir ›"}</button>
              }
            </div>
            {/* Schedule */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>Cuándo</span>
              {openProp === "schedule"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    <button onClick={() => { onSchedule(task.id, "hoy"); setOpenProp(null); }} style={task.scheduledFor === "hoy" ? selPill(T.priorityMed) : mutedPill}>Hoy</button>
                    <button onClick={() => { onDefer(task.id); setOpenProp(null); }} style={task.scheduledFor === "semana" ? selPill(T.info) : mutedPill}>Semana</button>
                    {task.scheduledFor && <button onClick={() => { onSchedule(task.id, null); setOpenProp(null); }} style={mutedPill}>Quitar</button>}
                  </div>
                : <button onClick={() => setOpenProp("schedule")} style={task.scheduledFor === "hoy" ? selPill(T.priorityMed) : task.scheduledFor === "semana" ? selPill(T.info) : mutedPill}>{task.scheduledFor === "hoy" ? "Hoy ›" : task.scheduledFor === "semana" ? "Semana ›" : "Sin fecha ›"}</button>
              }
            </div>
            {/* List */}
            {lists?.length > 0 && onMoveToList && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>Lista</span>
                {openProp === "list"
                  ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                      <button onClick={() => { onMoveToList(task.id, null); setOpenProp(null); }} style={!task.listId ? selPill(T.accent) : mutedPill}>Sin lista</button>
                      {lists.map(l => <button key={l.id} onClick={() => { onMoveToList(task.id, l.id); setOpenProp(null); }} style={task.listId === l.id ? selPill(T.accent) : mutedPill}>{l.name}</button>)}
                    </div>
                  : <button onClick={() => setOpenProp("list")} style={selPill(T.accent)}>{currL ? `${currL.name} ›` : "Sin lista ›"}</button>
                }
              </div>
            )}
          </div>
          {/* Subtasks */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "8px" }}>Subtareas {task.subtasks.length > 0 && `(${task.subtasks.filter(s => s.done).length}/${task.subtasks.length})`}</span>
            {task.subtasks.map((st, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
                <span onClick={() => { const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); }}
                  style={{ width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${st.done ? T.success : T.inputBorder}`, background: st.done ? T.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {st.done && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span style={{ fontSize: "14px", color: st.done ? T.textFaint : T.text, textDecoration: st.done ? "line-through" : "none", flex: 1 }}>{st.text}</span>
                <button onClick={() => { const ns = task.subtasks.filter((_, idx) => idx !== i); onSplit(task.id, ns); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", color: T.textFaint, fontSize: "16px" }}>×</button>
              </div>
            ))}
            <input value={splitText} onChange={e => setSplitText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); } }}
              placeholder="+ subtarea..." maxLength={300}
              style={{ width: "100%", fontSize: "14px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px", boxSizing: "border-box" }} />
          </div>
          {/* Actions row: Delegate + Delete at same level */}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", paddingTop: "14px", borderTop: `1px solid ${T.inputBorder}` }}>
            {!task.isShared && (
              <button onClick={() => setOpenProp(openProp === "delegate" ? null : "delegate")}
                style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1px solid ${T.accent}33`, background: `${T.accent}0A`, color: T.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>↗</span> Delegar
              </button>
            )}
            <button onClick={() => { task.isShared ? onUnshare(task.id) : onDelete(task.id); onClose(); }}
              style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1px solid ${T.danger}33`, background: `${T.danger}0A`, color: T.danger, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              {task.isShared ? "Quitar" : "Eliminar"}
            </button>
          </div>
          {/* Delegate panel (expanded below buttons) */}
          {openProp === "delegate" && !task.isShared && (
            <div style={{ padding: "12px", background: T.overlay, borderRadius: "12px", marginTop: "10px", animation: "slideDown 0.2s ease" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <input type="email" value={delegateEmail} onChange={e => { setDelegateEmail(e.target.value); setDelegateMsg(null); }}
                  placeholder="email@ejemplo.com" maxLength={254} autoFocus
                  style={{ flex: 1, fontSize: "14px", padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, minWidth: 0, boxSizing: "border-box" }} />
                <button disabled={!delegateEmail.includes("@") || delegateLoading}
                  onClick={async () => { setDelegateLoading(true); const res = await onDelegate(task.id, delegateEmail); setDelegateLoading(false); setDelegateMsg({ ok: res.ok, text: res.msg || res.error || (res.ok ? "Delegada" : "Error") }); if (res.ok) setTimeout(onClose, 800); }}
                  style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: T.accent, color: "white", fontWeight: 700, fontSize: "13px", cursor: delegateEmail.includes("@") ? "pointer" : "default", opacity: delegateEmail.includes("@") ? 1 : 0.5 }}>
                  {delegateLoading ? "…" : "Enviar"}
                </button>
              </div>
              {delegateMsg && <p style={{ fontSize: "12px", color: delegateMsg.ok ? T.success : T.danger, marginTop: "6px" }}>{delegateMsg.text}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// TASK ITEM
// ============================================================
function TaskItem({ task, onToggle, onDelete, onSplit, onAddSub, onSchedule, onDefer, onMove, onUpdateText, onUpdateDescription, onUpdatePriority, onUpdateMinutes, onDelegate, onUnshare, onMoveToList, isDragging, dragOver, T, autoSplit, lists, activeListId, showAging, isMobile, onOpenSheet }) {
  const [showSplit, setShowSplit] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (autoSplit) { setShowSplit(true); setExpanded(true); } }, [autoSplit]);
  const [splitText, setSplitText] = useState("");
  const [justDone, setJustDone] = useState(false);
  const [celeb, setCeleb] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [localEditText, setLocalEditText] = useState(task.text);
  const [editingSubIdx, setEditingSubIdx] = useState(null);
  const [subEditText, setSubEditText] = useState("");
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState(null);
  const [localDesc, setLocalDesc] = useState(task.description ?? "");
  const [openProp, setOpenProp] = useState(null);
  const [cardHovered, setCardHovered] = useState(false);
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverDelegate, setHoverDelegate] = useState(false);

  const [hoverExpand, setHoverExpand] = useState(false);
  const editRef = useRef(null);
  const ref = useRef(null);
  const pc = task.priority === "high" ? T.priorityHigh : task.priority === "medium" ? T.priorityMed : T.priorityLow;

  const ageDays = (() => {
    if (!showAging || task.done || !task.createdAt) return 0;
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const createdMidnight = new Date(task.createdAt); createdMidnight.setHours(0, 0, 0, 0);
    return Math.floor((todayMidnight - createdMidnight) / 86400000);
  })();
  const agingColor = ageDays >= 14 ? "#A01414"
    : ageDays >= 7  ? "#C03220"
    : ageDays >= 4  ? "#D85030"
    : ageDays >= 2  ? T.priorityHigh
    : ageDays >= 1  ? T.priorityMed
    : null;

  const cycleSchedule = () => {
    if (!task.scheduledFor) onSchedule(task.id, "hoy");
    else if (task.scheduledFor === "hoy") onDefer(task.id);
    else onSchedule(task.id, null);
  };

  const handleToggle = () => {
    if (!task.done) { setJustDone(true); setCeleb(celebrations[Math.floor(Math.random() * celebrations.length)]); playComplete(); setTimeout(() => { setJustDone(false); }, 1200); }
    else playClick();
    onToggle(task.id);
  };

  return (
    <article aria-label={`${task.text}${task.done ? ", completada" : ""}`} tabIndex={task.done ? -1 : 0}
      onMouseEnter={() => setCardHovered(true)} onMouseLeave={() => { setCardHovered(false); setHoverDelete(false); setHoverDelegate(false); }}
      onClick={() => { if (isMobile && !task.done && onOpenSheet) onOpenSheet(task); }}
      onKeyDown={e => { if (task.done) return; if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); onMove(task.id, -1); } if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); onMove(task.id, 1); } }}
      style={{
        position: "relative",
        background: task.done ? T.cardDone : isDragging ? T.cardDrag : T.card,
        borderRadius: isMobile ? "14px" : "20px", padding: task.done ? (isMobile ? "8px 14px" : "10px 16px") : (isMobile ? "10px 14px" : "14px 18px"), marginBottom: isMobile ? "4px" : "6px",
        border: `0.5px solid ${isDragging ? T.accent : task.done ? T.borderDone : agingColor ? agingColor : T.border}`,
        transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: justDone ? "scale(1.02)" : isDragging ? "scale(1.03)" : "scale(1)",
        boxShadow: agingColor ? `inset 3px 0 0 ${agingColor}` : (T.cardShadow || "none"),
        opacity: task.done ? .5 : 1, cursor: task.done ? "default" : isMobile ? "pointer" : "grab", userSelect: "none",
        borderTop: dragOver ? `2px solid ${T.accent}` : undefined, outline: "none",
      }}>
      {justDone && <div aria-hidden="true" style={{ position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)", fontSize: "26px", animation: "popIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>{celeb}</div>}
      {agingColor && (
        <span aria-label={`Tarea de hace ${ageDays} día${ageDays !== 1 ? "s" : ""}`} title={`Creada hace ${ageDays} día${ageDays !== 1 ? "s" : ""}`}
          style={{ position: "absolute", top: "8px", right: "8px", fontSize: "9px", fontWeight: 800, color: agingColor, userSelect: "none", lineHeight: 1 }}>
          {ageDays}d
        </span>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: task.done ? "8px" : (isMobile ? "10px" : "12px") }}>
        {!task.done && !isMobile && <div aria-hidden="true" style={{ paddingTop: "5px", opacity: .2, flexShrink: 0 }}><div style={{ width: "10px", display: "flex", flexWrap: "wrap", gap: "2px" }}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textFaint }} />)}</div></div>}
        <button role="checkbox" aria-checked={task.done} aria-label={task.done ? `Desmarcar: ${task.text}` : `Completar: ${task.text}`} onClick={e => { if (isMobile) e.stopPropagation(); handleToggle(); }}
          style={{ width: task.done ? "18px" : (isMobile ? "20px" : "22px"), height: task.done ? "18px" : (isMobile ? "20px" : "22px"), borderRadius: "50%", flexShrink: 0, border: `2px solid ${task.done ? T.success : pc}`, background: task.done ? T.success : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px" }}>
          {task.done && <svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {editingText ? (
              <input ref={editRef} value={localEditText} onChange={e => setLocalEditText(e.target.value)} maxLength={500}
                onBlur={() => { const v = localEditText.trim(); if (v && v !== task.text) onUpdateText(task.id, v); else setLocalEditText(task.text); setEditingText(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setLocalEditText(task.text); setEditingText(false); } }}
                style={{ fontSize: "16px", fontWeight: 500, color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", padding: "2px 8px", outline: "none", flex: 1, fontFamily: "'DM Sans', sans-serif", minWidth: 0 }} />
            ) : (
              <span onClick={e => { if (isMobile) return; if (!task.done) { setEditingText(true); setLocalEditText(task.text); setTimeout(() => editRef.current?.focus(), 0); } }}
                style={{ fontSize: task.done ? (isMobile ? "13px" : "15px") : (isMobile ? "14px" : "16px"), fontWeight: 500, color: task.done ? T.textFaint : T.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, flex: 1, cursor: task.done ? "default" : (isMobile ? "pointer" : "text"), minWidth: 0, ...(isMobile ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : { overflowWrap: "break-word", wordBreak: "break-word" }) }}>{task.text}</span>
            )}
            {!task.done && task.subtasks.length > 0 && !expanded && (
              <span style={{ fontSize: "11px", color: T.textFaint, background: T.overlay, padding: "2px 8px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}>
                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
              </span>
            )}
            {!activeListId && task.listId && (() => { const l = lists?.find(x => x.id === task.listId); return l ? <span style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "2px 8px", borderRadius: "6px", flexShrink: 0, whiteSpace: "nowrap", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "middle" }}>{l.name}</span> : null; })()}
            {!task.done && !isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                <button
                  onClick={() => setExpanded(v => !v)}
                  onMouseEnter={() => setHoverExpand(true)} onMouseLeave={() => setHoverExpand(false)}
                  title={expanded ? "Colapsar" : "Ver detalles"}
                  style={{ background: expanded ? T.overlay : "none", border: `1px solid ${expanded || hoverExpand ? T.border : T.inputBorder}`, cursor: "pointer", padding: "4px 8px", color: expanded || hoverExpand ? T.textSec : T.textMuted, fontSize: "12px", lineHeight: 1, borderRadius: "8px", transition: "all 0.15s", flexShrink: 0 }}>
                  {expanded ? "▴" : "▾"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "2px", opacity: cardHovered || showDelegate ? 1 : 0.45, transition: "opacity 0.2s" }}>
                  <button
                    onClick={cycleSchedule}
                    onMouseEnter={() => setHoverSchedule(true)} onMouseLeave={() => setHoverSchedule(false)}
                    title={!task.scheduledFor ? "Mover a Hoy" : task.scheduledFor === "hoy" ? "Posponer a esta semana" : "Mover a Hoy"}
                    style={{ background: !task.scheduledFor ? "none" : task.scheduledFor === "hoy" ? `${T.priorityMed}1F` : `${T.info}1F`, border: "none", cursor: "pointer", padding: "6px 8px", color: !task.scheduledFor ? T.textMuted : task.scheduledFor === "hoy" ? T.priorityMed : T.info, fontSize: "11px", lineHeight: 1, borderRadius: "8px", fontWeight: 700, transition: "all 0.15s", whiteSpace: "nowrap" }}>
                    {!task.scheduledFor ? "→ Hoy" : task.scheduledFor === "hoy" ? "Posponer" : "→ Hoy"}
                  </button>
                  {!task.isShared && (
                    <button onClick={() => { setShowDelegate(v => !v); setDelegateMsg(null); setDelegateEmail(""); }} aria-label="Delegar tarea" title="Delegar"
                      onMouseEnter={() => setHoverDelegate(true)} onMouseLeave={() => setHoverDelegate(false)}
                      style={{ background: showDelegate ? `${T.danger}26` : hoverDelegate ? `${T.danger}1A` : "none", border: "none", cursor: "pointer", padding: "6px 8px", color: showDelegate || hoverDelegate ? T.danger : T.textMuted, fontSize: "14px", lineHeight: 1, borderRadius: "8px", fontWeight: 700, transition: "all 0.15s" }}>
                      ↗
                    </button>
                  )}
                  <button
                    onClick={() => task.isShared ? onUnshare(task.id) : onDelete(task.id)}
                    aria-label={task.isShared ? "Quitar tarea compartida" : `Eliminar: ${task.text}`}
                    title={task.isShared ? "Quitar de mi lista" : "Eliminar"}
                    onMouseEnter={() => setHoverDelete(true)} onMouseLeave={() => setHoverDelete(false)}
                    style={{ background: hoverDelete ? `${T.danger}1F` : "none", border: "none", cursor: "pointer", padding: "6px 8px", color: hoverDelete ? T.danger : T.textMuted, fontSize: "20px", lineHeight: 1, borderRadius: "8px", flexShrink: 0, transition: "all 0.15s" }}>
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>
            )}
            {!task.done && isMobile && (
              <span style={{ color: T.textFaint, fontSize: "16px", flexShrink: 0, marginLeft: "4px" }}>›</span>
            )}
          </div>
          {expanded && !task.done && !isMobile && (
            <div style={{ marginTop: "10px", animation: "slideDown 0.2s ease" }}>
              {/* Description */}
              <textarea
                value={localDesc}
                onChange={e => setLocalDesc(e.target.value)}
                onBlur={() => { if (localDesc !== (task.description ?? "")) onUpdateDescription(task.id, localDesc); }}
                placeholder="Agregar descripción…"
                rows={2}
                maxLength={2000}
                style={{ width: "100%", fontSize: "13px", padding: "8px 10px", borderRadius: "10px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.textSec, resize: "none", boxSizing: "border-box", marginBottom: "12px" }}
              />
              {/* Properties */}
              {(() => {
                const PRIOS = [{ key: "high", label: "Alta", color: T.priorityHigh }, { key: "medium", label: "Media", color: T.priorityMed }, { key: "low", label: "Baja", color: T.priorityLow }];
                const currP = PRIOS.find(p => p.key === task.priority) || PRIOS[1];
                const currT = TIME_OPTIONS.find(o => o.min === task.minutes);
                const currL = task.listId ? lists?.find(l => l.id === task.listId) : null;
                const pillBase = { fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", cursor: "pointer" };
                const selPill = (color) => ({ ...pillBase, color: color, background: `${color}18`, border: `1.5px solid ${color}` });
                const mutedPill = { ...pillBase, color: T.textMuted, background: T.overlay, border: `1.5px solid ${T.inputBorder}` };
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {/* Priority */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>Prioridad</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {openProp === "priority"
                          ? PRIOS.map(p => <button key={p.key} onClick={() => { onUpdatePriority(task.id, p.key); setOpenProp(null); }} style={task.priority === p.key ? selPill(p.color) : mutedPill}>{p.label}</button>)
                          : <button onClick={() => setOpenProp("priority")} style={selPill(currP.color)}>{currP.label} ▾</button>
                        }
                      </div>
                    </div>
                    {/* Time */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>Tiempo</span>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {openProp === "time"
                          ? TIME_OPTIONS.map(o => <button key={o.min} onClick={() => { onUpdateMinutes(task.id, o.min); setOpenProp(null); }} style={task.minutes === o.min ? selPill(T.accent) : mutedPill}>{o.label}</button>)
                          : <button onClick={() => setOpenProp("time")} style={currT ? selPill(T.accent) : mutedPill}>{currT ? `${currT.label} ▾` : "Elegir ▾"}</button>
                        }
                      </div>
                    </div>
                    {/* Lista */}
                    {lists?.length > 0 && onMoveToList && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>Lista</span>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {openProp === "list"
                            ? <>
                                <button onClick={() => { onMoveToList(task.id, null); setOpenProp(null); }} style={!task.listId ? selPill(T.accent) : mutedPill}>Sin lista</button>
                                {lists.map(l => <button key={l.id} onClick={() => { onMoveToList(task.id, l.id); setOpenProp(null); }} style={task.listId === l.id ? selPill(T.accent) : mutedPill}>{l.name}</button>)}
                              </>
                            : <button onClick={() => setOpenProp("list")} style={selPill(T.accent)}>{currL ? `${currL.name} ▾` : "Sin lista ▾"}</button>
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Subtasks */}
              <div style={{ borderTop: `1px solid ${T.inputBorder}`, paddingTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted }}>Subtareas</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {task.minutes >= 120 && task.subtasks.length === 0 && !showSplit && (
                      <button onClick={e => { e.stopPropagation(); setShowSplit(true); }} aria-label={`Dividir: ${task.text}`} style={{ fontSize: "11px", color: T.split, background: `${T.split}14`, border: `1px solid ${T.split}33`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}><span aria-hidden="true">🧩</span> Dividir</button>
                    )}
                    {task.subtasks.length === 0 && !showSplit && (
                      <button onClick={e => { e.stopPropagation(); setShowSplit(true); }} aria-label={`Agregar subtarea a: ${task.text}`} style={{ fontSize: "11px", color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 600 }}>+ Sub</button>
                    )}
                  </div>
                </div>
                {task.subtasks.length > 0 && (
                  <ul role="list" aria-label="Subtareas" style={{ marginTop: "0", paddingLeft: 0, listStyle: "none" }}>
                    {task.subtasks.map((st, i) => (
                      <li key={i} role="checkbox" aria-checked={st.done} tabIndex={0}
                        onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && editingSubIdx !== i) { e.preventDefault(); const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); } }}
                        style={{ fontSize: "14px", color: st.done ? T.textFaint : T.textSec, padding: "3px 0", display: "flex", alignItems: "center", gap: "7px", textDecoration: editingSubIdx === i ? "none" : st.done ? "line-through" : "none", cursor: "default" }}>
                        <span aria-hidden="true" onClick={() => { const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); }}
                          style={{ width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${st.done ? T.success : T.inputBorder}`, background: st.done ? T.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          {st.done && <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        {editingSubIdx === i ? (
                          <input autoFocus value={subEditText} onChange={e => setSubEditText(e.target.value)} maxLength={300}
                            onBlur={() => { const v = subEditText.trim(); if (v && v !== st.text) { const ns = [...task.subtasks]; ns[i] = { ...ns[i], text: v }; onSplit(task.id, ns); } setEditingSubIdx(null); }}
                            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingSubIdx(null); }}
                            style={{ fontSize: "14px", color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "6px", padding: "1px 6px", outline: "none", flex: 1, fontFamily: "'DM Sans', sans-serif", minWidth: 0 }} />
                        ) : (
                          <span onClick={() => { if (!st.done) { setEditingSubIdx(i); setSubEditText(st.text); } }}
                            style={{ flex: 1, cursor: st.done ? "default" : "text", overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 }}>{st.text}</span>
                        )}
                        <button
                          onClick={() => { const ns = task.subtasks.filter((_, idx) => idx !== i); onSplit(task.id, ns); }}
                          aria-label={`Eliminar subtarea: ${st.text}`}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: T.textFaint, fontSize: "14px", lineHeight: 1, borderRadius: "4px", flexShrink: 0, opacity: 0, transition: "opacity 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                        >×</button>
                      </li>
                    ))}
                    <li style={{ listStyle: "none" }}><input ref={ref} aria-label={`Agregar subtarea a ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); } }} placeholder="+ subtarea..." maxLength={300} style={{ width: "100%", fontSize: "13px", padding: "5px 8px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px" }} /></li>
                  </ul>
                )}
                {showSplit && task.subtasks.length === 0 && (
                  <div style={{ animation: "slideDown 0.3s ease" }}>
                    <input autoFocus aria-label={`Primera subtarea de: ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} maxLength={300}
                      onKeyDown={e => {
                        if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); }
                        if (e.key === "Escape") { setShowSplit(false); setSplitText(""); }
                      }}
                      onBlur={() => { if (!splitText.trim()) setShowSplit(false); }}
                      placeholder="Primera subtarea... (Enter · Esc para cerrar)" style={{ width: "100%", fontSize: "14px", padding: "7px 10px", borderRadius: "10px", border: `1.5px solid ${T.split}33`, background: `${T.split}08`, outline: "none", color: T.text, boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delegation badges */}
      {task.sharedFromEmail && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: T.shared, background: `${T.shared}1A`, border: `1px solid ${T.shared}33`, padding: "2px 10px", borderRadius: "20px", fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            De: {task.sharedFromName || task.sharedFromEmail}
          </span>
        </div>
      )}
      {task.assigneeEmail && !task.isShared && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: T.info, background: `${T.info}1A`, border: `1px solid ${T.info}33`, padding: "2px 10px", borderRadius: "20px", fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            → {task.assigneeEmail}
          </span>
        </div>
      )}

      {/* Delegate panel */}
      {showDelegate && !task.isShared && !task.done && !isMobile && (
        <div style={{ marginTop: "10px", padding: "12px 14px", background: T.overlay, borderRadius: "12px", animation: "slideDown 0.2s ease" }}>
          <p style={{ fontSize: "12px", color: T.textMuted, fontWeight: 600, marginBottom: "8px" }}>Delegar a</p>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              autoFocus
              type="email"
              value={delegateEmail}
              onChange={e => { setDelegateEmail(e.target.value); setDelegateMsg(null); }}
              onKeyDown={e => { if (e.key === "Escape") { setShowDelegate(false); setDelegateEmail(""); } }}
              placeholder="email@ejemplo.com"
              maxLength={254}
              style={{ flex: 1, fontSize: "13px", padding: "7px 10px", borderRadius: "10px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif", minWidth: 0 }}
            />
            <button
              disabled={!delegateEmail.includes("@") || delegateLoading}
              onClick={async () => {
                setDelegateLoading(true);
                const result = await onDelegate(task.id, delegateEmail.trim().toLowerCase());
                setDelegateLoading(false);
                if (result.ok) {
                  setDelegateMsg({ type: "ok", text: result.status === "shared" ? "Tarea compartida ✓" : "Invitación enviada ✓" });
                  setTimeout(() => { setShowDelegate(false); setDelegateMsg(null); }, 2000);
                } else {
                  setDelegateMsg({ type: "err", text: result.error || "Error al delegar" });
                }
              }}
              style={{ padding: "7px 14px", borderRadius: "10px", border: "none", background: delegateEmail.includes("@") && !delegateLoading ? T.accent : T.inputBorder, color: delegateEmail.includes("@") && !delegateLoading ? "white" : T.textFaint, fontSize: "13px", fontWeight: 700, cursor: delegateEmail.includes("@") && !delegateLoading ? "pointer" : "default", whiteSpace: "nowrap" }}>
              {delegateLoading ? "…" : "Enviar"}
            </button>
          </div>
          {delegateMsg && (
            <p role="alert" style={{ margin: "6px 0 0", fontSize: "12px", fontWeight: 600, color: delegateMsg.type === "ok" ? T.success : T.danger }}>
              {delegateMsg.text}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// AUTH SCREENS
// ============================================================
function AuthScreen({ onLogin, dark, setDark, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // login | register | forgot
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
    border: `1.5px solid ${errors[field] ? T.danger : T.inputBorder}`,
    background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s ease",
  });
  const labelStyle = { fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "6px" };
  const errorStyle = { fontSize: "11px", color: T.danger, marginTop: "4px", fontWeight: 500 };

  // ── Verify pending screen ──────────────────────────────────────────────────
  if (mode === "verify") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`
          @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
          *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        `}</style>
        <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px" }}>
              to <span style={{ color: T.accent }}>done</span>
              <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: T.accent, WebkitTextFillColor: T.accent, marginLeft: "2px" }}>✦</span>
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
              <p role="alert" style={{ fontSize: "13px", color: T.success, fontWeight: 600, marginBottom: "16px" }}>✓ Email reenviado</p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendLoading}
                style={{ width: "100%", background: T.overlay, border: `1px solid ${T.inputBorder}`, borderRadius: "12px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, color: T.textMuted, cursor: resendLoading ? "wait" : "pointer", marginBottom: "12px", fontFamily: "'DM Sans', sans-serif" }}>
                {resendLoading ? "Reenviando…" : "¿No llegó? Reenviar email"}
              </button>
            )}
            <button type="button" onClick={() => { setMode("login"); setSuccess(""); setResendSent(false); }}
              style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              ← Volver al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        input::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
      `}</style>

      <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px", marginBottom: "8px" }}>
            to <span style={{ color: T.accent }}>done</span>
            <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: T.accent, WebkitTextFillColor: T.accent, marginLeft: "2px" }}>✦</span>
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
          <div role="alert" style={{ background: `${T.success}1A`, border: `1px solid ${T.success}4D`, borderRadius: "14px", padding: "14px 16px", marginBottom: "16px", fontSize: "13px", color: T.success, fontWeight: 600, textAlign: "center" }}>
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
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: "4px", display: "flex", alignItems: "center" }}>
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.5"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.5"/><line x1="3" y1="3" x2="13" y2="13"/></svg>
                    }
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
            <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", fontSize: "12px", color: T.danger, fontWeight: 600, cursor: "pointer", marginTop: "8px", padding: 0 }}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {/* General API error */}
          {errors.general && (
            <div role="alert" style={{ background: `${T.danger}1A`, border: `1px solid ${T.danger}4D`, borderRadius: "12px", padding: "12px 14px", marginTop: "12px", fontSize: "13px", color: T.danger, fontWeight: 500 }}>
              {errors.general}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", background: loading ? T.inputBorder : T.accent, color: "white", border: "none", fontSize: "15px", fontWeight: 700, cursor: loading ? "wait" : "pointer", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Enviar link"}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textMuted }}>
          {mode === "login" ? "¿No tenés cuenta? " : mode === "register" ? "¿Ya tenés cuenta? " : ""}
          {mode === "forgot" ? (
            <button type="button" onClick={() => { setMode("login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>← Volver al inicio</button>
          ) : (
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              {mode === "login" ? "Creá una" : "Iniciá sesión"}
            </button>
          )}
        </p>

        {/* Terms */}
        {mode === "register" && (
          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: T.textFaint, lineHeight: 1.5 }}>
            Al crear tu cuenta aceptás los <button type="button" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>términos</button> y la <button type="button" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>política de privacidad</button>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NOTE CANVAS
// ============================================================
const NOTE_COLORS = [
  { light: "#FFF8F0", dark: "#282520" },
  { light: "#FDEBD0", dark: "#2C2418" },
  { light: "#F4E6D6", dark: "#3A2E24" },
  { light: "#DDE8E1", dark: "#1F2E28" },
  { light: "#DFF0F7", dark: "#1A2E38" },
  { light: "#EDE2F2", dark: "#2A1F34" },
];
const NOTE_TYPES = ["note", "list", "media"];

const NOTE_TYPE_LABELS = { note: "Nota", list: "Lista", media: "Enlace" };

function NoteTypeIcon({ type, size = 12 }) {
  const s = { width: size, height: size, display: "block" };
  if (type === "note") return (
    <svg style={s} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
    </svg>
  );
  if (type === "list") return (
    <svg style={s} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,3 2.5,4.5 5,1"/><line x1="7" y1="3" x2="11" y2="3"/>
      <polyline points="1,9 2.5,10.5 5,7"/><line x1="7" y1="9" x2="11" y2="9"/>
    </svg>
  );
  if (type === "media") return (
    <svg style={s} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8"/><path d="M8 1h3v3M11 1L5.5 6.5"/>
    </svg>
  );
  return null;
}

function NoteCard({ note, onChange, onDelete, T, dark, isNew }) {
  const [hov, setHov] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [urlMeta, setUrlMeta] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const dragging = useRef(false);
  const dragRef = useRef(null);
  const taRef = useRef(null);
  const newItemRef = useRef(null);
  const typeMenuRef = useRef(null);
  const colorPickerRef = useRef(null);
  const urlDebounceRef = useRef(null);
  const type = note.type || "note";

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = taRef.current.scrollHeight + "px";
    }
  }, [note.text, type]);

  useEffect(() => {
    if (!isNew) return;
    if (taRef.current) taRef.current.focus();
    else if (newItemRef.current) newItemRef.current.focus();
  }, [isNew]);

  // Close type menu on outside click
  useEffect(() => {
    if (!showTypeMenu) return;
    const handler = (e) => { if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) setShowTypeMenu(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showTypeMenu]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e) => { if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setShowColorPicker(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showColorPicker]);

  // URL metadata prefetch via microlink.io
  useEffect(() => {
    const url = note.mediaUrl;
    if (!url || !url.startsWith("http")) { setUrlMeta(null); setUrlLoading(false); return; }
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) { setUrlMeta(null); return; }
    setUrlLoading(true); setUrlMeta(null);
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.status === "success") setUrlMeta(data.data);
      } catch (_) {}
      setUrlLoading(false);
    }, 800);
    return () => { if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current); };
  }, [note.mediaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPD = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.closest("button") || e.target.closest("a")) return;
    e.preventDefault();
    dragging.current = true;
    dragRef.current = { mx: e.clientX, my: e.clientY, nx: note.x, ny: note.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPM = (e) => {
    if (!dragging.current || !dragRef.current) return;
    onChange({ ...note, x: Math.max(0, dragRef.current.nx + e.clientX - dragRef.current.mx), y: Math.max(0, dragRef.current.ny + e.clientY - dragRef.current.my) });
  };
  const onPU = () => { dragging.current = false; dragRef.current = null; };

  const toggleItem = (i) => onChange({ ...note, items: (note.items || []).map((it, idx) => idx === i ? { ...it, done: !it.done } : it) });
  const updateItem = (i, text) => onChange({ ...note, items: (note.items || []).map((it, idx) => idx === i ? { ...it, text } : it) });
  const deleteItem = (i) => onChange({ ...note, items: (note.items || []).filter((_, idx) => idx !== i) });
  const addItem = (text) => { onChange({ ...note, items: [...(note.items || []), { text, done: false }] }); playAdd(); };
  const isImg = (url) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  const cp = NOTE_COLORS[note.colorIdx % NOTE_COLORS.length];
  const bg = dark ? cp.dark : cp.light;

  return (
    <div onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: "absolute", left: note.x, top: note.y, width: 230,
        background: bg, borderRadius: "12px", padding: "10px 12px 14px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
        boxShadow: hov ? `0 8px 24px rgba(0,0,0,${dark ? .4 : .14})` : `0 2px 8px rgba(0,0,0,${dark ? .3 : .07})`,
        cursor: "grab", transition: "box-shadow 0.15s ease",
        userSelect: "none", zIndex: hov ? 10 : 1, touchAction: "none",
      }}>
      {/* Header: drag handle · type selector · color · delete */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", gap: "4px" }}>
        {/* Drag handle — standalone, not a button */}
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(2, 3px)", gap: "2.5px", padding: "2px", opacity: 0.35, cursor: "grab", flexShrink: 0 }}>
          {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textMuted }} />)}
        </div>
        {/* Type selector — separate button */}
        <div ref={typeMenuRef} style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowTypeMenu(v => !v); }}
            aria-label={`Tipo: ${NOTE_TYPE_LABELS[type]}`}
            style={{ background: showTypeMenu ? T.overlay : "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", padding: "3px 5px",
              borderRadius: "6px", transition: "background 0.15s ease", color: T.textMuted, opacity: 0.65 }}>
            <NoteTypeIcon type={type} />
          </button>
          {showTypeMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: T.surface, borderRadius: "10px",
              border: `1px solid ${T.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 200, overflow: "hidden", minWidth: "120px" }}>
              {NOTE_TYPES.map(t => (
                <button key={t} onClick={e => { e.stopPropagation(); onChange({ ...note, type: t, items: note.items || [], mediaUrl: note.mediaUrl || "" }); setShowTypeMenu(false); playClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px",
                    border: "none", background: t === type ? T.overlay : "transparent", cursor: "pointer",
                    fontSize: "12px", color: T.text, fontWeight: t === type ? 700 : 500 }}>
                  <NoteTypeIcon type={t} />
                  <span>{NOTE_TYPE_LABELS[t]}</span>
                  {t === type && <span style={{ marginLeft: "auto", color: T.success, fontSize: "11px" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {/* Color picker */}
        <div ref={colorPickerRef} style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowColorPicker(v => !v); setShowTypeMenu(false); }}
            aria-label="Color de la nota"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "3px 5px", borderRadius: "6px", display: "flex", alignItems: "center", opacity: hov || showColorPicker ? 1 : 0, transition: "opacity 0.15s ease" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: bg, border: `1.5px solid ${dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.22)"}` }} />
          </button>
          {showColorPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: T.surface, borderRadius: "10px", border: `1px solid ${T.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 201, padding: "8px", display: "flex", gap: "5px" }}>
              {NOTE_COLORS.map((c, i) => {
                const swatchBg = dark ? c.dark : c.light;
                const active = i === (note.colorIdx % NOTE_COLORS.length);
                return (
                  <button key={i} onClick={e => { e.stopPropagation(); onChange({ ...note, colorIdx: i }); setShowColorPicker(false); }}
                    aria-label={`Color ${i + 1}`} aria-pressed={active}
                    style={{ width: "22px", height: "22px", borderRadius: "50%", border: active ? `2.5px solid ${T.danger}` : `1.5px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`, background: swatchBg, cursor: "pointer", flexShrink: 0, transition: "transform 0.1s ease", transform: active ? "scale(1.2)" : "scale(1)" }} />
                );
              })}
            </div>
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(note.id); }} aria-label="Eliminar nota"
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "18px",
            padding: "0 2px", lineHeight: 1, opacity: hov ? .7 : 0, transition: "opacity 0.15s ease" }}>×</button>
      </div>

      {/* ── Note ── */}
      {type === "note" && (
        <textarea ref={taRef} value={note.text || ""} onChange={e => onChange({ ...note, text: e.target.value })}
          placeholder="Escribí algo..." onPointerDown={e => e.stopPropagation()}
          style={{ width: "100%", minHeight: "56px", background: "transparent", border: "none", outline: "none",
            resize: "none", fontSize: "13px", color: T.text, fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.6, cursor: "text", userSelect: "text", overflow: "hidden", padding: 0, display: "block" }} />
      )}

      {/* ── List ── */}
      {type === "list" && (
        <div onPointerDown={e => e.stopPropagation()}>
          {(note.items || []).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px", padding: "3px 0", userSelect: "text" }}>
              <button onClick={() => toggleItem(i)}
                style={{ width: "15px", height: "15px", borderRadius: "4px", flexShrink: 0, marginTop: "2px",
                  border: `1.5px solid ${item.done ? T.success : dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}`,
                  background: item.done ? T.success : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.done && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <input value={item.text} onChange={e => updateItem(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); newItemRef.current?.focus(); }
                  if (e.key === "Backspace" && !item.text) { e.preventDefault(); deleteItem(i); }
                }}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: "13px", color: T.text, lineHeight: 1.5,
                  textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.5 : 1, padding: 0 }} />
            </div>
          ))}
          <input ref={newItemRef} placeholder="+ ítem..."
            onKeyDown={e => { if (e.key === "Enter" && e.currentTarget.value.trim()) { addItem(e.currentTarget.value.trim()); e.currentTarget.value = ""; } }}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              borderTop: `1px dashed ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, marginTop: "4px",
              fontSize: "13px", color: T.textFaint, padding: "4px 0", cursor: "text" }} />
        </div>
      )}

      {/* ── Media ── */}
      {type === "media" && (
        <div onPointerDown={e => e.stopPropagation()}>
          <input type="url" value={note.mediaUrl || ""} onChange={e => onChange({ ...note, mediaUrl: e.target.value })}
            placeholder="Pegá una URL…"
            style={{ width: "100%", background: "transparent", border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
              borderRadius: "8px", outline: "none", fontSize: "12px", color: T.text,
              padding: "6px 8px", marginBottom: "8px", boxSizing: "border-box" }} />
          {/* Image direct preview */}
          {note.mediaUrl && isImg(note.mediaUrl) && (
            <img src={note.mediaUrl} alt="" onError={e => e.target.style.display = "none"}
              style={{ width: "100%", borderRadius: "8px", display: "block", maxHeight: "140px", objectFit: "cover" }} />
          )}
          {/* Loading */}
          {note.mediaUrl && !isImg(note.mediaUrl) && urlLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 12px", borderRadius: "10px",
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontSize: "11px", color: T.textFaint }}>
              <div style={{ width: "11px", height: "11px", border: `2px solid ${T.inputBorder}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              Cargando vista previa…
            </div>
          )}
          {/* Rich preview */}
          {note.mediaUrl && !isImg(note.mediaUrl) && !urlLoading && urlMeta && (
            <a href={note.mediaUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", borderRadius: "10px", overflow: "hidden",
                border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, textDecoration: "none" }}>
              {urlMeta.image?.url && (
                <img src={urlMeta.image.url} alt="" onError={e => e.target.style.display = "none"}
                  style={{ width: "100%", height: "90px", objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: "8px 10px", background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                  {urlMeta.logo?.url && <img src={urlMeta.logo.url} alt="" width="12" height="12" onError={e => e.target.style.display = "none"} style={{ borderRadius: "2px", objectFit: "contain" }} />}
                  <span style={{ fontSize: "10px", color: T.textFaint, fontWeight: 600 }}>{(() => { try { return new URL(note.mediaUrl).hostname; } catch { return ""; } })()}</span>
                </div>
                {urlMeta.title && <p style={{ fontSize: "12px", fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: "2px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{urlMeta.title}</p>}
                {urlMeta.description && <p style={{ fontSize: "11px", color: T.textMuted, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{urlMeta.description}</p>}
              </div>
            </a>
          )}
          {/* Fallback plain link */}
          {note.mediaUrl && !isImg(note.mediaUrl) && !urlLoading && !urlMeta && (
            <a href={note.mediaUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "8px",
                background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                fontSize: "12px", color: T.info, textDecoration: "none", wordBreak: "break-all", lineHeight: 1.4 }}>
              <span aria-hidden="true" style={{ fontSize: "14px", flexShrink: 0 }}>🔗</span>
              <span>{note.mediaUrl}</span>
            </a>
          )}
          {!note.mediaUrl && (
            <div style={{ textAlign: "center", padding: "12px 0", color: T.textFaint, fontSize: "11px" }}>
              <div style={{ fontSize: "22px", marginBottom: "4px", opacity: .5 }}>🖼️</div>
              Imagen o enlace
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteCanvas({ notes, setNotes, T, dark, onCollapse }) {
  const [newId, setNewId] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [hovDist, setHovDist] = useState(false);
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const CSIZE = 3000;
  const NOTE_W = 230;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 2.0;

  const estimateH = (note) => {
    const header = 38, pad = 28;
    if (note.type === "list") return header + Math.max(36, (note.items?.length || 1) * 26) + pad;
    if (note.type === "media") return header + 110 + pad;
    return header + Math.max(3, Math.ceil((note.text || "").length / 22)) * 20 + pad;
  };

  const makeNote = (x, y) => {
    const n = { id: crypto.randomUUID(), x: Math.max(10, x), y: Math.max(10, y), text: "", type: "note", items: [], mediaUrl: "", colorIdx: notes.length % NOTE_COLORS.length };
    setNotes(prev => [...prev, n]);
    setNewId(n.id);
    setTimeout(() => setNewId(null), 300);
    playAdd();
  };

  const onDblClick = (e) => {
    if (e.target !== canvasRef.current) return;
    const r = scrollRef.current.getBoundingClientRect();
    makeNote(
      (e.clientX - r.left + (scrollRef.current?.scrollLeft || 0)) / zoom - 110,
      (e.clientY - r.top  + (scrollRef.current?.scrollTop  || 0)) / zoom - 40
    );
  };

  const addBtn = () => {
    const i = notes.length;
    makeNote(30 + (i % 5) * 240, 30 + Math.floor(i / 5) * 180);
  };

  const zoomIn  = () => setZoom(z => Math.min(MAX_ZOOM, +((z + 0.15).toFixed(2))));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, +((z - 0.15).toFixed(2))));

  const fitNotes = (notesList) => {
    const nts = notesList || notes;
    if (nts.length === 0) { setZoom(1); scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); return; }
    const PAD = 32;
    const minX = Math.min(...nts.map(n => n.x));
    const minY = Math.min(...nts.map(n => n.y));
    const maxX = Math.max(...nts.map(n => n.x + NOTE_W));
    const maxY = Math.max(...nts.map(n => n.y + estimateH(n)));
    const cW = maxX - minX + PAD * 2;
    const cH = maxY - minY + PAD * 2;
    const panelW = scrollRef.current?.clientWidth  || 460;
    const panelH = scrollRef.current?.clientHeight || 600;
    const newZoom = Math.min(1.0, Math.max(MIN_ZOOM, Math.min(panelW / cW, panelH / cH)));
    setZoom(newZoom);
    setTimeout(() => scrollRef.current?.scrollTo({
      left: Math.max(0, (minX - PAD) * newZoom),
      top:  Math.max(0, (minY - PAD) * newZoom),
      behavior: "smooth"
    }), 30);
  };

  const resetView = () => { setZoom(1.0); scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); };

  const autoDistribute = () => {
    if (notes.length === 0) return;
    const GAP = 20, MARGIN = 24;
    const panelW = scrollRef.current?.clientWidth || 460;
    const cols = Math.max(2, Math.floor((panelW - 2 * MARGIN + GAP) / (NOTE_W + GAP)));
    const colH = Array(cols).fill(MARGIN);
    const positioned = notes.map(note => {
      const ci = colH.indexOf(Math.min(...colH));
      const x = MARGIN + ci * (NOTE_W + GAP);
      const y = colH[ci];
      colH[ci] += estimateH(note) + GAP;
      return { ...note, x, y };
    });
    setNotes(positioned);
    fitNotes(positioned);
    playClick();
  };

  // Compact control button helper
  const CB = ({ onClick, title, children }) => {
    const [h, setH] = useState(false);
    return (
      <button onClick={onClick} title={title} aria-label={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ background: h ? T.overlay : "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: "8px", color: h ? T.text : T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s, color 0.12s" }}>
        {children}
      </button>
    );
  };

  const SEP = () => <div style={{ width: "1px", height: "16px", background: T.inputBorder, margin: "0 1px", flexShrink: 0 }} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: dark ? "#1C1D22" : "#E6E1DC" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", flexShrink: 0, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={onCollapse} aria-label="Colapsar canvas"
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "18px", padding: "4px 6px", lineHeight: 1, borderRadius: "8px" }}>›</button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}><span style={{ color: T.accent }}>✦</span> Canvas</span>
        <span style={{ fontSize: "11px", color: T.textFaint }}>doble click para agregar</span>
        {notes.length > 0 && <span style={{ fontSize: "11px", color: T.textFaint, background: T.overlay, padding: "3px 9px", borderRadius: "7px" }}>{notes.length}</span>}
        {notes.length > 1 && (
          <button onClick={autoDistribute} title="Distribuir y ajustar notas a la pantalla" aria-label="Distribuir notas automáticamente"
            onMouseEnter={() => setHovDist(true)} onMouseLeave={() => setHovDist(false)}
            style={{ marginLeft: "auto", background: hovDist ? T.overlay : "transparent", color: hovDist ? T.text : T.textMuted, border: `1px solid ${hovDist ? T.border : T.inputBorder}`, borderRadius: "10px", padding: "7px 10px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="1" width="4" height="4" rx="1"/><rect x="9" y="1" width="4" height="4" rx="1"/>
              <rect x="1" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/>
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 600, maxWidth: hovDist ? "80px" : "0", overflow: "hidden", whiteSpace: "nowrap", transition: "max-width 0.2s" }}>Distribuir</span>
          </button>
        )}
        <button onClick={addBtn} style={{ marginLeft: notes.length > 1 ? "6px" : "auto", background: T.accent, color: "white", border: "none", borderRadius: "10px", padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Nota</button>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {notes.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "34px", marginBottom: "10px", opacity: .5 }}>📝</div>
              <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 600 }}>Canvas vacío</p>
              <p style={{ fontSize: "12px", color: T.textFaint, marginTop: "4px", lineHeight: 1.5 }}>Doble click para agregar<br/>o usá el botón <span style={{ color: T.accent, fontWeight: 600 }}>+ Nota</span></p>
            </div>
          </div>
        )}
        {/* Spacer keeps the scroll area proportional to zoom */}
        <div style={{ width: CSIZE * zoom, height: CSIZE * zoom, pointerEvents: "none" }} />
        {/* Scaled canvas layer */}
        <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `scale(${zoom})` }}>
          <div ref={canvasRef} onDoubleClick={onDblClick}
            style={{ position: "relative", width: CSIZE, height: CSIZE,
              backgroundImage: dark ? "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)" : "radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)",
              backgroundSize: "28px 28px" }}>
            {notes.map(note => (
              <NoteCard key={note.id} note={note}
                onChange={u => setNotes(prev => prev.map(n => n.id === u.id ? u : n))}
                onDelete={id => { setNotes(prev => prev.filter(n => n.id !== id)); playClick(); }}
                T={T} dark={dark} isNew={note.id === newId} />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation + zoom controls bar */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "6px 8px", borderTop: `1px solid ${T.border}`, background: T.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0", background: dark ? "#26272D" : "#EDEBE8", borderRadius: "12px", padding: "3px" }}>
        <CB onClick={() => scrollRef.current?.scrollBy({ left: 0, top: -130, behavior: "smooth" })} title="Mover arriba">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 10V3M3 6.5L6.5 3 10 6.5"/></svg>
        </CB>
        <CB onClick={() => scrollRef.current?.scrollBy({ left: 0, top: 130, behavior: "smooth" })} title="Mover abajo">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3v7M10 6.5L6.5 10 3 6.5"/></svg>
        </CB>
        <CB onClick={() => scrollRef.current?.scrollBy({ left: -130, top: 0, behavior: "smooth" })} title="Mover izquierda">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 6.5H3M6.5 3L3 6.5l3.5 3.5"/></svg>
        </CB>
        <CB onClick={() => scrollRef.current?.scrollBy({ left: 130, top: 0, behavior: "smooth" })} title="Mover derecha">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5h7M6.5 10L10 6.5 6.5 3"/></svg>
        </CB>
        <SEP />
        <CB onClick={zoomOut} title="Alejar">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4"/><line x1="8.7" y1="8.7" x2="12" y2="12"/><line x1="3" y1="5.5" x2="8" y2="5.5"/></svg>
        </CB>
        <span style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, minWidth: "34px", textAlign: "center", userSelect: "none" }}>{Math.round(zoom * 100)}%</span>
        <CB onClick={zoomIn} title="Acercar">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4"/><line x1="8.7" y1="8.7" x2="12" y2="12"/><line x1="5.5" y1="3" x2="5.5" y2="8"/><line x1="3" y1="5.5" x2="8" y2="5.5"/></svg>
        </CB>
        <SEP />
        <CB onClick={() => notes.length > 0 ? fitNotes() : resetView()} title="Ajustar a pantalla">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4V1h3M9 1h3v3M12 9v3H9M4 12H1V9"/></svg>
        </CB>
      </div>
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
  const [isRecovery, setIsRecovery] = useState(false);
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem("sound") !== "false"; } catch { return true; } });
  const toggleSound = () => { const next = !soundOn; setSoundOn(next); _soundOn = next; try { localStorage.setItem("sound", next ? "true" : "false"); } catch {} };
  const T = dark ? themes.dark : themes.light;

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: `3px solid ${T.inputBorder}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const signupParam = new URLSearchParams(window.location.search).get('signup');
  if (!user) return <AuthScreen onLogin={setUser} dark={dark} setDark={setDark} initialMode={signupParam ? "register" : "login"} />;

  if (isRecovery) return <PasswordResetScreen user={user} dark={dark} onDone={() => setIsRecovery(false)} />;

  return <AppMain user={user} onLogout={() => signOutUser()} dark={dark} setDark={setDark} T={T} isRecovery={false} onRecoveryHandled={() => {}} soundOn={soundOn} toggleSound={toggleSound} />;
}

// ============================================================
// PASSWORD RESET SCREEN (full-page, no escape)
// ============================================================
function PasswordResetScreen({ user, dark, onDone }) {
  const T = dark ? themes.dark : themes.light;
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) { setMsg({ type: "err", text: "Mínimo 6 caracteres" }); return; }
    if (newPass !== newPassConfirm) { setMsg({ type: "err", text: "Las contraseñas no coinciden" }); return; }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setMsg({ type: "err", text: "El link expiró o ya fue usado. Solicitá uno nuevo desde la pantalla de login." });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);
    if (error) { setMsg({ type: "err", text: error.message }); return; }
    setMsg({ type: "ok", text: "¡Contraseña actualizada! Ingresando…" });
    setTimeout(onDone, 1400);
  };

  const inp = { width: "100%", fontSize: "15px", padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif" };
  const lbl = { fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "6px" };

  return (
    <div className={dark ? "dark" : ""} style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        input::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
      `}</style>
      <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px", marginBottom: "8px" }}>
            to <span style={{ color: T.accent }}>done</span>
            <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: T.accent, WebkitTextFillColor: T.accent, marginLeft: "2px" }}>✦</span>
          </h1>
          <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 500 }}>Creá tu nueva contraseña</p>
        </div>
        <form onSubmit={handleSubmit} noValidate
          style={{ background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={lbl}>Nueva contraseña</label>
              <input type="password" value={newPass} onChange={e => { setNewPass(e.target.value); setMsg(null); }}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password" autoFocus style={inp} />
            </div>
            <div>
              <label style={lbl}>Repetir contraseña</label>
              <input type="password" value={newPassConfirm} onChange={e => { setNewPassConfirm(e.target.value); setMsg(null); }}
                placeholder="Repetí tu nueva contraseña" autoComplete="new-password" style={inp} />
            </div>
          </div>
          {msg && (
            <p role="alert" style={{ fontSize: "12px", color: msg.type === "ok" ? T.success : T.danger, fontWeight: 600, marginTop: "12px" }}>{msg.text}</p>
          )}
          <button type="submit" disabled={loading || !newPass || !newPassConfirm} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: (loading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !loading) ? T.accent : T.inputBorder, color: (newPass && newPassConfirm && !loading) ? "white" : T.textFaint }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {loading ? "Guardando…" : "Guardar contraseña"}
          </button>
          <p style={{ fontSize: "12px", color: T.textMuted, textAlign: "center", marginTop: "16px" }}>{user.email}</p>
        </form>
      </div>
    </div>
  );
}

// ── DB ↔ local task mapping ───────────────────────────────────────────────────
function toLocal(t, shareInfo = null) {
  return {
    id: t.id,
    listId: t.list_id ?? null,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    doneAt: t.done_at ? new Date(t.done_at).getTime() : null,
    createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
    subtasks: t.subtasks || [],
    scheduledFor: t.scheduled_for,
    description: t.description ?? "",
    order: t.order ?? 0,
    isShared: !!shareInfo,
    sharedFromEmail: shareInfo?.owner_email ?? null,
    sharedFromName: shareInfo?.owner_name ?? null,
    assigneeEmail: null,
  };
}
function toDb(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    list_id: t.listId ?? null,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    done_at: t.doneAt ? new Date(t.doneAt).toISOString() : null,
    subtasks: t.subtasks || [],
    scheduled_for: t.scheduledFor ?? null,
    description: t.description ?? null,
    order: t.order ?? 0,
  };
}

function AppMain({ user, onLogout, dark, setDark, T, isRecovery, onRecoveryHandled, soundOn, toggleSound }) {
  const [tasks, setTasks] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newSchedule, setNewSchedule] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [dismissedSuggIds, setDismissedSuggIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`dismissed_${user.id}`) || "[]")); }
    catch { return new Set(); }
  });
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const aiDebounceRef = useRef(null);
  const estimateDebounceRef = useRef(null);
  const tasksRef = useRef([]);

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
  const listScrollRef = useRef(null);
  const [listAtStart, setListAtStart] = useState(true);
  const [listAtEnd, setListAtEnd] = useState(true);
  const [deleteListTarget, setDeleteListTarget] = useState(null); // { id, name } | null
  const [deleteListReassignTo, setDeleteListReassignTo] = useState(undefined); // undefined=not chosen, null=Sin lista, "__none__"=no mover, listId=move to list
  const [showCanvas, setShowCanvas] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  const [wideEnough, setWideEnough] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileSheetTask, setMobileSheetTask] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(() => {
    if (typeof window === "undefined") return 600;
    const saved = localStorage.getItem("canvas_width");
    if (saved) return Math.max(280, Math.min(window.innerWidth - 320, +saved));
    return Math.round(window.innerWidth * 0.6);
  });
  const [isResizing, setIsResizing] = useState(false);
  const canvasResizeRef = useRef({ active: false, startX: 0, startW: 0, lastW: 0 });
  const [mobileView, setMobileView] = useState("list"); // "list" | "canvas"
  const [kbHeight, setKbHeight] = useState(0);
  const [canvasNotes, setCanvasNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`canvas_${user.id}`) || "[]"); }
    catch { return []; }
  });
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null); // null = "Todas"
  const [showAddList, setShowAddList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const notifyModifiedRef = useRef({});

  // Derived: tasks filtered by active list
  const visibleTasks = useMemo(() => activeListId ? tasks.filter(t => t.listId === activeListId) : tasks, [tasks, activeListId]);

  const completedToday = visibleTasks.filter(t => t.done && t.doneAt && (Date.now() - t.doneAt) < 86400000).length;
  const todayTasks = useMemo(() => visibleTasks.filter(t => !t.done && t.scheduledFor === "hoy").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const weekTasks = useMemo(() => visibleTasks.filter(t => !t.done && t.scheduledFor === "semana").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const unscheduled = useMemo(() => visibleTasks.filter(t => !t.done && !t.scheduledFor).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const doneTasks = useMemo(() => visibleTasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), [visibleTasks]);
  const todayMin = todayTasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayDoneMin = visibleTasks.filter(t => t.done && t.scheduledFor === "hoy" && t.doneAt && t.doneAt >= todayStart.getTime()).reduce((s, t) => s + (t.minutes || 0), 0);
  const todayTotalMin = todayMin + todayDoneMin; // fixed denominator: pending + done today

  const pendingCount = visibleTasks.filter(t => !t.done).length;
  const overloaded = todayMin > WORKDAY_MINUTES;

  const suggestions = useMemo(() => {
    const all = [];
    if (overloaded) all.push({ id: "overload", text: `Tenés ${fmt(todayMin)} para hoy (${fmt(todayMin - WORKDAY_MINUTES)} de más). ¿Movemos la menos urgente?`, icon: "⚠️", action: { type: "unload" }, color: T.danger });
    const large = todayTasks.filter(t => t.minutes >= 120 && t.subtasks.length === 0);
    if (large.length > 0) all.push({ id: `split-${large[0].id}`, text: `"${large[0].text}" son ${fmt(large[0].minutes)}. Dividirla en pasos la hace más manejable.`, icon: "🧩", action: { type: "split", taskId: large[0].id }, color: T.split });
    if (todayTasks.length === 0 && pendingCount > 0) all.push({ id: "suggest", text: "No tenés tareas para hoy. ¿Querés que mueva las más prioritarias?", icon: "📋", action: { type: "suggest" }, color: T.info });
    if (completedToday >= 5) all.push({ id: "done5", text: "¡5 tareas completadas hoy! Sos una máquina.", icon: "🏆", color: T.success });
    else if (completedToday >= 3) all.push({ id: "done3", text: `¡${completedToday} completadas! Muy buen ritmo por hoy.`, icon: "🎖️", color: T.success });
    if (weekTasks.length > 5 && !overloaded) all.push({ id: "weekload", text: `Tenés ${weekTasks.length} tareas en la semana. Buen momento para revisar prioridades.`, icon: "📅", color: T.priorityMed });
    if (unscheduled.length >= 3) all.push({ id: "unscheduled", text: `${unscheduled.length} tareas sin fecha. Agendarlas te ayuda a no olvidarlas.`, icon: "📥", action: { type: "suggest" }, color: T.shared });
    if (todayMin > 0 && !overloaded && completedToday < 3 && todayTasks.length > 0) all.push({ id: "balanced", text: `Tenés ${fmt(todayMin)} planeadas para hoy. Día bien equilibrado.`, icon: "✅", color: T.success });
    return all.filter(s => !dismissedSuggIds.has(s.id));
  }, [tasks, todayTasks, weekTasks, unscheduled, todayMin, completedToday, overloaded, pendingCount, dismissedSuggIds, T]);

  const dismissSugg = (id) => setDismissedSuggIds(prev => {
    const next = new Set([...prev, id]);
    localStorage.setItem(`dismissed_${user.id}`, JSON.stringify([...next]));
    return next;
  });

  // Keep tasksRef in sync so fetchAiSuggestions always has current data
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const fetchAiSuggestions = async () => {
    const currentTasks = tasksRef.current;
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

      if (res.ok && data.suggestions?.length > 0) {
        setAiSuggestions(data.suggestions.map(s => ({ ...s, isAI: true })));
      }
    } catch (e) {
      console.error('[ai-suggest] error:', e);
    }
  };

  // Load tasks from Supabase on mount (own tasks + shared tasks)
  useEffect(() => {
    // Activate pending shares first (for users who were invited before signup),
    // then load tasks so newly activated shares are included
    supabase.rpc('activate_pending_shares')
      .then(({ error }) => { if (error) console.error('[activate_shares]', error); })
      .finally(() => {
        Promise.all([
          supabase.from('tasks').select('*').eq('user_id', user.id).order('order'),
          supabase.from('task_shares').select('task_id, owner_email, owner_name').eq('shared_with_user_id', user.id),
          supabase.from('task_shares').select('task_id, shared_with_email').eq('owner_id', user.id),
        ]).then(async ([ownRes, incomingRes, outgoingRes]) => {
          if (ownRes.error) { console.error('[tasks:own]', ownRes.error); setDbError(true); setDbLoaded(true); return; }

          // Build outgoing-share map: taskId → assigneeEmail
          const outMap = {};
          (outgoingRes.data || []).forEach(s => { outMap[s.task_id] = s.shared_with_email; });

          // Own tasks
          const ownTasks = (ownRes.data || []).map(t => ({ ...toLocal(t), assigneeEmail: outMap[t.id] ?? null }));

          // Fetch shared-with-me tasks via security-definer RPC (bypasses RLS type issues)
          const incoming = incomingRes.data || [];
          let sharedTasks = [];
          if (incoming.length > 0) {
            const { data: sharedData, error: shErr } = await supabase.rpc('get_shared_tasks');
            if (shErr) console.error('[tasks:shared]', shErr);
            sharedTasks = (sharedData || []).map(t => {
              const share = incoming.find(s => s.task_id === t.id);
              return toLocal(t, share);
            });
          }

          const all = [...ownTasks, ...sharedTasks];
          setTasks(all);
          tasksRef.current = all;
          setDbError(false);
          setDbLoaded(true);
        }).catch(err => {
          console.error('[tasks:load]', err);
          setDbError(true);
          setDbLoaded(true);
        });
      });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime + background polling: sync own tasks and shared tasks
  useEffect(() => {
    const refreshOwn = () => {
      supabase.from('tasks').select('*').eq('user_id', user.id).order('order').then(({ data }) => {
        if (!data) return;
        setTasks(cur => {
          const shared = cur.filter(t => t.isShared);
          const outMap = {};
          cur.filter(t => !t.isShared && t.assigneeEmail).forEach(t => { outMap[t.id] = t.assigneeEmail; });
          const own = data.map(t => ({ ...toLocal(t), assigneeEmail: outMap[t.id] ?? null }));
          return [...own, ...shared];
        });
      });
    };

    const refreshShared = () => {
      supabase.rpc('get_shared_tasks').then(({ data }) => {
        if (!data) return;
        setTasks(cur => {
          const nonShared = cur.filter(t => !t.isShared);
          const sharedMeta = cur.filter(t => t.isShared);
          const refreshed = data.map(t => {
            const existing = sharedMeta.find(s => s.id === t.id);
            return { ...toLocal(t, { owner_email: existing?.sharedFromEmail, owner_name: existing?.sharedFromName }), isShared: true };
          });
          return [...nonShared, ...refreshed];
        });
      });
    };

    // Realtime for own tasks (catches delegated user's changes instantly)
    const channel = supabase
      .channel(`tasks-realtime:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => {
        setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...toLocal(payload.new), assigneeEmail: t.assigneeEmail } : t));
      })
      .subscribe();

    // Background polling every 20s as fallback
    const interval = setInterval(() => { refreshOwn(); refreshShared(); }, 20000);

    // Refresh on tab focus
    const onFocus = () => { refreshOwn(); refreshShared(); };
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load lists from Supabase on mount
  useEffect(() => {
    supabase.from('lists').select('*').eq('user_id', user.id).order('order').then(({ data, error }) => {
      if (error) console.error('[lists]', error);
      else setLists((data || []).map(l => ({ id: l.id, name: l.name, order: l.order ?? 0 })));
    });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch AI suggestions on load and when task state changes meaningfully
  useEffect(() => {
    if (!dbLoaded) return;
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    const delay = aiSuggestions.length === 0 ? 800 : 8000;
    aiDebounceRef.current = setTimeout(fetchAiSuggestions, delay);
  }, [dbLoaded, pendingCount, completedToday]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load notifications on mount + poll every 20s
  useEffect(() => {
    const fetchNotifs = () => {
      supabase.from('notifications').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50)
        .then(({ data, error }) => {
          if (error) console.error('[notifications]', error);
          else setNotifications(data || []);
        });
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 20000);
    const onFocus = () => fetchNotifs();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close notifications on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  // DB sync helpers (defined here to close over user.id)
  const dbInsert = (task) => supabase.from('tasks').insert(toDb(task, user.id)).then(({ error }) => { if (error) console.error('[db:insert]', error); });
  // No user_id filter on update — RLS (updated to allow shared-with users) handles auth
  const dbUpdate = (id, patch) => supabase.from('tasks').update(patch).eq('id', id).then(({ error }) => { if (error) console.error('[db:update]', error); });
  const dbDelete = (id) => supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:delete]', error); });
  const dbUpsertMany = (rows) => supabase.from('tasks').upsert(rows.map(t => toDb(t, user.id)), { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[db:upsert]', error); });

  // ── Notification helpers ────────────────────────────────────
  const notify = async (recipientUserId, type, taskId, taskText) => {
    if (!recipientUserId) return;
    try {
      const { error } = await supabase.rpc('create_notification', {
        p_user_id: recipientUserId,
        p_type: type,
        p_task_id: taskId,
        p_task_text: taskText,
        p_from_user_id: user.id,
        p_from_name: getUserName(user),
        p_from_email: user.email,
      });
      if (error) console.error('[notify]', error);
    } catch (e) {
      console.error('[notify:network]', e);
    }
  };

  const getOtherPartyId = async (task) => {
    if (!task.isShared && task.assigneeEmail) {
      const { data } = await supabase.from('task_shares').select('shared_with_user_id').eq('task_id', task.id).eq('owner_id', user.id).single();
      return data?.shared_with_user_id ?? null;
    }
    if (task.isShared) {
      const { data } = await supabase.from('task_shares').select('owner_id').eq('task_id', task.id).eq('shared_with_user_id', user.id).single();
      return data?.owner_id ?? null;
    }
    return null;
  };

  const notifyModified = (task) => {
    if (!task.isShared && !task.assigneeEmail) return;
    const key = task.id;
    if (notifyModifiedRef.current[key]) clearTimeout(notifyModifiedRef.current[key]);
    notifyModifiedRef.current[key] = setTimeout(() => {
      getOtherPartyId(task).then(otherId => {
        if (otherId) notify(otherId, 'task_modified', task.id, task.text);
      });
      delete notifyModifiedRef.current[key];
    }, 5000);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const notifMessage = (n) => {
    const name = n.from_name || n.from_email || 'Alguien';
    const text = n.task_text.length > 40 ? n.task_text.slice(0, 40) + '…' : n.task_text;
    switch (n.type) {
      case 'task_delegated': return `${name} te delegó: "${text}"`;
      case 'task_completed': return `${name} completó: "${text}"`;
      case 'task_modified': return `${name} modificó: "${text}"`;
      default: return `${name}: "${text}"`;
    }
  };

  const timeAgo = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    return new Date(isoStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  };

  useEffect(() => {
    const trimmed = newTask.trim();
    if (trimmed.length <= 3) { setAiResult(null); return; }
    // Show rule-based result immediately while user types
    const quick = aiSuggest(trimmed);
    setAiResult(quick);
    setAiAccepted({ priority: false, schedule: false, minutes: false });
    // Debounce Claude upgrade
    if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = await res.json();

        if (res.ok && (data.priority || data.scheduledFor || data.minutes)) {
          setAiResult({ ...data, cleanText: trimmed, hasAny: true });
        }
      } catch (e) {
        console.error('[estimate] error:', e);
      }
    }, 600);
  }, [newTask]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open change-password panel when user arrives via password reset email
  useEffect(() => {
    if (!isRecovery) return;
    setShowChangePass(true);
    setChangePassMsg(null);
    setNewPass("");
    setNewPassConfirm("");
    onRecoveryHandled();
  }, [isRecovery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close account menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAccountMenu]);

  // Track virtual keyboard height on mobile (visualViewport API)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  // Close panels on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (mobileSheetTask) setMobileSheetTask(null);
        else if (showNotifications) setShowNotifications(false);
        else if (showAdd) { setShowAdd(false); setNewTask(""); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAdd, showNotifications, mobileSheetTask]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    };
  }, []);

  // Canvas: persist notes to localStorage
  useEffect(() => {
    localStorage.setItem(`canvas_${user.id}`, JSON.stringify(canvasNotes));
  }, [canvasNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track viewport width for responsive behaviour
  useEffect(() => {
    const fn = () => { setWideEnough(window.innerWidth >= 1000); setIsMobile(window.innerWidth < 768); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Canvas: auto-close if screen becomes too narrow
  useEffect(() => {
    if (!wideEnough && showCanvas) setShowCanvas(false);
  }, [wideEnough, showCanvas]);

  // Recalculate list scroll arrows after lists change
  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    setListAtStart(el.scrollLeft <= 8);
    setListAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, [lists]);

  const addTask = () => {
    if (!newTask.trim() || addingTask) return;
    setAddingTask(true);
    const ai = aiResult || aiSuggest(newTask);
    const t = { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: aiAccepted.priority && ai.priority ? ai.priority : newPriority, minutes: aiAccepted.minutes && ai.minutes ? ai.minutes : newMinutes, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: aiAccepted.schedule && ai.scheduledFor ? ai.scheduledFor : newSchedule || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: -1 };
    setTasks(prev => { const p = [t, ...prev.filter(x => !x.done)].map((x, i) => ({ ...x, order: i })); return [...p, ...prev.filter(x => x.done)]; });
    dbInsert(t);
    setAnnounce(`Tarea "${ai.cleanText}" agregada`);
    setNewTask(""); setNewPriority("medium"); setNewMinutes(30); setNewSchedule(null); setAiResult(null); setAiAccepted({ priority: false, schedule: false, minutes: false }); setShowAdd(false); setAddingTask(false); playAdd();
  };
  const quickDumpAdd = () => {
    if (!quickText.trim() || addingTask) return;
    setAddingTask(true);
    const lines = quickText.split("\n").filter(l => l.trim());
    const nt = lines.map((line, i) => { const ai = aiSuggest(line); return { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: ai.priority || "medium", minutes: ai.minutes || 30, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: ai.scheduledFor || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: i }; });
    setTasks(prev => { const p = [...nt, ...prev.filter(t => !t.done)].map((t, i) => ({ ...t, order: i })); return [...p, ...prev.filter(t => t.done)]; });
    dbUpsertMany(nt);
    setAnnounce(`${lines.length} tareas agregadas`);
    setQuickText(""); setQuickDump(false); setAddingTask(false); playAdd();
  };
  const toggleTask = id => {
    const t = tasks.find(x => x.id === id);
    const newDone = !t.done;
    const newDoneAt = newDone ? Date.now() : null;
    if (newDone) { setShowConfetti(true); setConfettiKey(k => k + 1); setTimeout(() => setShowConfetti(false), 100); setAnnounce(`"${t.text}" completada`); } else { setAnnounce(`"${t.text}" desmarcada`); }
    setTasks(prev => prev.map(x => x.id === id ? { ...x, done: newDone, doneAt: newDoneAt } : x));
    dbUpdate(id, { done: newDone, done_at: newDoneAt ? new Date(newDoneAt).toISOString() : null });
    // Notify other party when completing a shared/delegated task
    if (newDone && (t.isShared || t.assigneeEmail)) {
      getOtherPartyId(t).then(otherId => {
        if (otherId) notify(otherId, 'task_completed', id, t.text);
      });
    }
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
    // Auto-complete parent when all subtasks are done
    if (subs.length > 0 && subs.every(s => s.done)) {
      const parent = tasks.find(t => t.id === id);
      if (parent && !parent.done) {
        setTimeout(() => toggleTask(id), 300);
      }
    }
  };
  const addSub = (id, text) => {
    const newSubs = [...(tasks.find(t => t.id === id)?.subtasks || []), { text, done: false }];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, subtasks: newSubs } : t));
    dbUpdate(id, { subtasks: newSubs });
  };
  const updateText = (id, text) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
    dbUpdate(id, { text });
    const t = tasks.find(x => x.id === id); if (t) notifyModified({ ...t, text });
  };
  const updateDescription = (id, description) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, description } : t));
    dbUpdate(id, { description });
  };
  const updatePriority = (id, priority) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    dbUpdate(id, { priority });
    const t = tasks.find(x => x.id === id); if (t) notifyModified(t);
  };
  const updateMinutes = (id, minutes) => {
    const m = Math.max(1, parseInt(minutes) || 0);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, minutes: m } : t));
    dbUpdate(id, { minutes: m });
  };
  const delegateTask = async (taskId, assigneeEmail) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { ok: false, error: 'Tarea no encontrada' };
    try {
      const res = await fetch('/api/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          taskText: task.text,
          taskPriority: task.priority,
          taskMinutes: task.minutes,
          assigneeEmail,
          assignerId: user.id,
          assignerEmail: user.email,
          assignerName: getUserName(user),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigneeEmail } : t));
        // Notify assignee about delegation (only if user already exists)
        if (data.status === 'shared') {
          supabase.from('task_shares').select('shared_with_user_id').eq('task_id', taskId).eq('shared_with_email', assigneeEmail).single()
            .then(({ data: s }) => { if (s?.shared_with_user_id) notify(s.shared_with_user_id, 'task_delegated', taskId, task.text); });
        }
      }
      return { ok: res.ok, ...data };
    } catch (e) {
      console.error('[delegate] network error:', e);
      return { ok: false, error: 'Sin conexión. Intentá de nuevo.' };
    }
  };
  const unshareTask = (taskId) => {
    supabase.from('task_shares').delete()
      .eq('task_id', taskId).eq('shared_with_user_id', user.id)
      .then(({ error }) => { if (error) console.error('[unshare]', error); });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    playClick();
  };
  const moveToList = (id, listId) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, listId: listId ?? null } : t));
    dbUpdate(id, { list_id: listId ?? null });
  };
  const addList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const newList = { id: crypto.randomUUID(), name, order: lists.length };
    const { error } = await supabase.from('lists').insert({ id: newList.id, user_id: user.id, name: newList.name, order: newList.order });
    if (error) { console.error('[lists:insert]', error); return; }
    setLists(prev => [...prev, newList]);
    setActiveListId(newList.id);
    setNewListName("");
    setShowAddList(false);
    playClick();
  };
  const deleteList = (id) => {
    const l = lists.find(x => x.id === id);
    if (!l) return;
    setDeleteListTarget(l);
    setDeleteListReassignTo(undefined);
  };
  const confirmDeleteList = async () => {
    if (!deleteListTarget) return;
    const { id } = deleteListTarget;
    const effectiveTarget = (deleteListReassignTo === "__none__" || deleteListReassignTo === undefined) ? null : deleteListReassignTo;
    setTasks(prev => prev.map(t => t.listId === id ? { ...t, listId: effectiveTarget } : t));
    await supabase.from('tasks').update({ list_id: effectiveTarget }).eq('list_id', id).eq('user_id', user.id);
    await supabase.from('lists').delete().eq('id', id).eq('user_id', user.id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
    setDeleteListTarget(null);
    setDeleteListReassignTo(null);
    playClick();
  };
  const scheduleTask = (id, when) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: when } : t));
    dbUpdate(id, { scheduled_for: when ?? null });
    const t = tasks.find(x => x.id === id); if (t) notifyModified(t);
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

  const renderList = (list, showAging = false) => list.map((task, i) => (
    <div key={task.id} draggable={!task.done && !isMobile} onDragStart={e => dStart(e, task.id)} onDragOver={e => dOver(e, task.id)} onDrop={e => dDrop(e, task.id)} onDragEnd={dEnd} style={{ animation: `fadeInUp 0.3s ease ${i * .03}s both` }}>
      <TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onDelegate={delegateTask} onUnshare={unshareTask} onMoveToList={moveToList} isDragging={dragId === task.id} dragOver={dragOverId === task.id && dragId !== task.id} T={T} autoSplit={splitTargetId === task.id} lists={lists} activeListId={activeListId} showAging={showAging} isMobile={isMobile} onOpenSheet={setMobileSheetTask} />
    </div>
  ));

  const sectionH = (icon, title, count, minutes) => (
    <h2 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", marginTop: "16px", padding: "0 2px", fontSize: "16px", fontWeight: 700, color: T.text }}>
      <span aria-hidden="true">{icon}</span> {title} <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 600 }}>({count})</span>
      {minutes > 0 && <span style={{ fontSize: "12px", color: T.accent, marginLeft: "auto", background: `${T.accent}12`, padding: "3px 10px", borderRadius: "8px", fontWeight: 600 }}><span aria-hidden="true">🕐</span> {fmt(minutes)}</span>}
    </h2>
  );

  return (
    <div className={dark ? "dark" : ""} style={{ minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", letterSpacing: "-0.015em", position: "relative", paddingRight: wideEnough ? (showCanvas ? `${canvasWidth}px` : "48px") : 0, boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes confettiFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes popIn{0%{transform:translateY(-50%) scale(0);opacity:0}60%{transform:translateY(-50%) scale(1.3)}100%{transform:translateY(-50%) scale(1);opacity:1}}
        @keyframes slideDown{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{0%{opacity:0;transform:translateX(28px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes audioBar{0%,100%{height:3px;opacity:0.4}50%{height:20px;opacity:1}}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes sheetUp{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
        @keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        body,div,header,footer,button,input,textarea,span,p,section{transition:background-color 0.35s ease,color 0.25s ease,border-color 0.3s ease;}
        input::placeholder,textarea::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        button:active{transform:scale(0.97)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px}
        .sugg-scroll{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:2px}
        .sugg-scroll::-webkit-scrollbar{display:none}
        .list-scroll::-webkit-scrollbar{display:none}
        .sugg-arrow{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1px solid rgba(128,128,128,0.15);background:rgba(255,255,255,0.85);backdrop-filter:blur(6px);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:rgba(80,80,80,0.7);box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:opacity 0.2s,transform 0.15s;z-index:2;line-height:1}
        .sugg-arrow:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 3px 12px rgba(0,0,0,0.13)}
        .dark .sugg-arrow{background:rgba(40,40,45,0.85);color:rgba(220,220,220,0.7);border-color:rgba(255,255,255,0.1)}
        .list-arrow{position:absolute;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;border:1px solid rgba(128,128,128,0.25);background:rgba(255,255,255,0.75);backdrop-filter:blur(4px);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(60,60,60,0.65);transition:all 0.15s;z-index:2;padding:0;line-height:1}
        .list-arrow:hover{color:rgba(60,60,60,0.95);border-color:rgba(128,128,128,0.5);background:rgba(255,255,255,0.98)}
        .dark .list-arrow{background:rgba(35,36,40,0.85);color:rgba(200,200,200,0.65);border-color:rgba(255,255,255,0.15)}
        .dark .list-arrow:hover{color:rgba(220,220,220,0.95);border-color:rgba(255,255,255,0.3);background:rgba(45,46,52,0.98)}
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

      {/* GLOBAL HEADER — full viewport width, above canvas */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 55, display: "flex", alignItems: "center", padding: "0 20px", height: "57px", background: T.panelBg, borderBottom: `0.5px solid ${T.border}`, backdropFilter: "blur(20px)" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 800, color: T.text, letterSpacing: "-0.5px", lineHeight: 1, display: "flex", alignItems: "center", flexShrink: 0 }}>
          to&nbsp;<span style={{ color: T.accent }}>done</span>
          <span aria-hidden="true" style={{ fontSize: "8px", position: "relative", top: "-8px", color: T.accent, marginLeft: "2px" }}>✦</span>
        </h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {!wideEnough && (
            <button onClick={() => { setMobileView(v => v === "list" ? "canvas" : "list"); playClick(); }} aria-label={mobileView === "canvas" ? "Ver lista" : "Ver canvas"} style={{ background: mobileView === "canvas" ? T.accent : T.overlay, color: mobileView === "canvas" ? (dark ? "#1C1C1E" : "#fff") : T.textFaint, border: "none", borderRadius: "10px", padding: "8px 10px", fontSize: "14px", cursor: "pointer" }}>
              <span aria-hidden="true">{mobileView === "canvas" ? "☰" : "◫"}</span>
            </button>
          )}
          {/* Sound toggle */}
          <button onClick={toggleSound} aria-label={soundOn ? "Silenciar sonidos" : "Activar sonidos"} aria-pressed={soundOn}
            style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: soundOn ? T.textMuted : T.textFaint, opacity: soundOn ? 1 : 0.45, transition: "opacity 0.2s" }}>
            {soundOn
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h2l4-4v12L4 10H2z"/><path d="M11 5a4 4 0 0 1 0 6"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h2l4-4v12L4 10H2z"/><line x1="13" y1="5" x2="9" y2="11"/></svg>
            }
          </button>
          {/* Theme toggle */}
          <button onClick={() => { setDark(d => !d); }} aria-label={dark ? "Modo claro" : "Modo oscuro"} aria-pressed={dark}
            style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "color 0.2s" }}>
            {dark
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3.5"/><line x1="8" y1="1" x2="8" y2="2.5"/><line x1="8" y1="13.5" x2="8" y2="15"/><line x1="1" y1="8" x2="2.5" y2="8"/><line x1="13.5" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.1" y2="4.1"/><line x1="11.9" y1="11.9" x2="12.95" y2="12.95"/><line x1="12.95" y1="3.05" x2="11.9" y2="4.1"/><line x1="4.1" y1="11.9" x2="3.05" y2="12.95"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z"/></svg>
            }
          </button>
          {/* Notification bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowNotifications(v => !v); if (!showNotifications && unreadCount > 0) markAllNotificationsRead(); playClick(); }}
              aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`} aria-expanded={showNotifications} aria-haspopup="true"
              style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: showNotifications ? T.overlay : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "color 0.2s", position: "relative" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 13a2 2 0 0 0 4 0"/><path d="M13 6a5 5 0 0 0-10 0c0 5-2 6-2 6h14s-2-1-2-6"/>
              </svg>
              {unreadCount > 0 && (
                <span aria-hidden="true" style={{ position: "absolute", top: "4px", right: "4px", width: unreadCount > 9 ? "18px" : "14px", height: "14px", borderRadius: "7px", background: T.danger, color: "white", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, border: `1.5px solid ${T.panelBg}` }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div role="menu" aria-label="Notificaciones"
                style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "320px", maxHeight: "400px", overflowY: "auto", background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "8px", zIndex: 200, animation: "slideDown 0.2s ease", scrollbarWidth: "thin" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${T.inputBorder}`, marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>Notificaciones</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: T.textFaint, fontSize: "13px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.4 }}>🔔</div>
                    Sin notificaciones
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} onClick={() => { if (!n.read) markNotificationRead(n.id); }}
                      style={{ padding: "10px 12px", borderRadius: "10px", background: n.read ? "transparent" : `${T.accent}0A`, cursor: n.read ? "default" : "pointer", display: "flex", alignItems: "flex-start", gap: "10px", transition: "background 0.15s" }}>
                      <span aria-hidden="true" style={{ fontSize: "16px", flexShrink: 0, marginTop: "2px" }}>
                        {n.type === 'task_delegated' ? '📩' : n.type === 'task_completed' ? '✅' : '✏️'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "13px", color: n.read ? T.textMuted : T.text, fontWeight: n.read ? 500 : 600, lineHeight: 1.4, margin: 0 }}>{notifMessage(n)}</p>
                        <p style={{ fontSize: "11px", color: T.textFaint, marginTop: "3px" }}>{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.read && <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.accent, flexShrink: 0, marginTop: "6px" }} />}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {/* Avatar / Account menu */}
          <div ref={accountRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowAccountMenu(!showAccountMenu); playClick(); }}
              aria-label="Menú de cuenta" aria-expanded={showAccountMenu} aria-haspopup="true"
              style={{
                width: "36px", height: "36px", borderRadius: "50%", border: `1.5px solid ${showAccountMenu ? T.accent : T.inputBorder}`,
                background: T.accent, color: dark ? "#1C1C1E" : "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 700,
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
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.inputBorder}`, marginBottom: "4px", overflow: "hidden" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getUserName(user)}</p>
                  <p style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                </div>
                {/* Menu items */}
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); setShowChangePass(true); setChangePassMsg(null); setNewPass(""); setNewPassConfirm(""); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Mi cuenta
                </button>
                <div style={{ height: "1px", background: T.inputBorder, margin: "4px 0" }} />
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); onLogout(); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.danger, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" style={{ maxWidth: "520px", margin: "0 auto", padding: "77px 20px 190px" }}>
        <p style={{ fontSize: "15px", color: T.textMuted, fontWeight: 500, marginBottom: "16px" }}>{greeting}, {getUserName(user)} <span aria-hidden="true" style={{ color: T.accent }}>✦</span></p>

        {!dbLoaded && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ width: "20px", height: "20px", border: `3px solid ${T.inputBorder}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {dbLoaded && dbError && (
          <div role="alert" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: "15px", color: T.danger, fontWeight: 600, marginBottom: "12px" }}>No se pudieron cargar las tareas</p>
            <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "16px", lineHeight: 1.5 }}>Revisá tu conexión e intentá de nuevo.</p>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: "12px", background: T.accent, color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
          </div>
        )}

        {dbLoaded && <>
        <KindStreak tasks={tasks} T={T} />

        {/* LIST SWITCHER */}
        {(lists.length > 0 || showAddList) && (
          <div style={{ marginBottom: "14px", position: "relative" }}>
            {!listAtStart && (
              <button className="list-arrow" onClick={() => listScrollRef.current?.scrollBy({ left: -160, behavior: "smooth" })} aria-label="Listas anteriores" style={{ left: "-10px" }}>‹</button>
            )}
            {!listAtEnd && (
              <button className="list-arrow" onClick={() => listScrollRef.current?.scrollBy({ left: 160, behavior: "smooth" })} aria-label="Más listas" style={{ right: "-10px" }}>›</button>
            )}
            <div ref={listScrollRef} onScroll={() => { const el = listScrollRef.current; if (!el) return; setListAtStart(el.scrollLeft <= 8); setListAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8); }}
              style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {/* "Todas" pill */}
              <button onClick={() => { setActiveListId(null); playClick(); }}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${activeListId === null ? T.danger : T.inputBorder}`, background: activeListId === null ? `${T.danger}1A` : T.overlay, color: activeListId === null ? T.danger : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Todas
              </button>
              {lists.map(l => (
                <div key={l.id} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <button onClick={() => { setActiveListId(l.id); playClick(); }}
                    style={{ padding: "6px 14px", paddingRight: "32px", borderRadius: "20px", border: `1.5px solid ${activeListId === l.id ? T.danger : T.inputBorder}`, background: activeListId === l.id ? `${T.danger}1A` : T.overlay, color: activeListId === l.id ? T.danger : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.name}
                  </button>
                  <button onClick={() => deleteList(l.id)} aria-label={`Eliminar lista ${l.name}`}
                    style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "13px", lineHeight: 1, padding: "2px" }}>×</button>
                </div>
              ))}
              {/* Add list */}
              {showAddList ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addList(); if (e.key === "Escape") { setShowAddList(false); setNewListName(""); } }}
                    onBlur={() => { if (!newListName.trim()) { setShowAddList(false); setNewListName(""); } }}
                    placeholder="Nombre..." maxLength={30}
                    style={{ fontSize: "13px", padding: "5px 10px", borderRadius: "20px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, width: "120px" }} />
                  <button onClick={addList} style={{ padding: "5px 10px", borderRadius: "20px", background: T.accent, color: "white", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
              ) : (
                <button onClick={() => { setShowAddList(true); playClick(); }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Lista
                </button>
              )}
            </div>
          </div>
        )}
        {!lists.length && !showAddList && (
          <div style={{ marginBottom: "10px" }}>
            <button onClick={() => { setShowAddList(true); playClick(); }}
              style={{ padding: "5px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              + Nueva lista
            </button>
          </div>
        )}

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
                      <p style={{ fontSize: "14px", color: T.textSec, lineHeight: 1.5, fontWeight: 500, flex: 1, overflowWrap: "break-word", wordBreak: "break-word", minWidth: 0 }}>{sugg.text}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {sugg.isAI ? <span style={{ fontSize: "10px", color: T.textFaint, fontWeight: 600, letterSpacing: "0.3px" }}><span style={{ color: T.accent }}>✦</span> ToDone</span> : <span />}
                      <div style={{ display: "flex", gap: "6px" }}>
                        {sugg.action && <button onClick={() => handleSuggAction(sugg)} aria-label="Aplicar sugerencia" style={{ background: sugg.color || T.accent, color: "white", border: "none", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Dale</button>}
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

        {todayTotalMin > 0 && <TodayCard total={todayTotalMin} done={todayDoneMin} taskCount={todayTasks.length + tasks.filter(t => t.done && t.scheduledFor === "hoy" && t.doneAt && t.doneAt >= todayStart.getTime()).length} T={T} />}

        {/* HOY */}
        <section aria-label="Tareas de hoy">
          {sectionH("☀️", "Hoy", todayTasks.length, 0)}
          <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
            {todayTasks.length === 0
              ? <p onClick={() => setShowAdd(true)} style={{ padding: "18px 4px 10px", color: T.textFaint, fontSize: "13px", fontStyle: "italic", lineHeight: 1.5, cursor: "pointer" }}>Día despejado. <span style={{ color: T.accent, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px", textDecorationColor: `${T.accent}66` }}>Agregá tu primera tarea del día</span> →</p>
              : renderList(todayTasks, true)}
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
                {renderList(despues, true)}
              </div>
            </section>
          );
        })()}

        {/* COMPLETADAS */}
        {doneTasks.length > 0 && (
          <section aria-label="Completadas" style={{ marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 8px" }}>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
              <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 600 }}><span style={{ color: T.success }}>✓</span> Completadas ({doneTasks.length})</span>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
            </div>
            <div style={{ maxHeight: "clamp(160px, 30vh, 400px)", overflowY: "auto", paddingRight: "2px" }}>
              {doneTasks.map((task, i) => <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * .02}s both` }}><TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onDelegate={delegateTask} onUnshare={unshareTask} onMoveToList={moveToList} isDragging={false} dragOver={false} T={T} lists={lists} activeListId={activeListId} isMobile={isMobile} /></div>)}
            </div>
          </section>
        )}
        </>}
      </main>

      {/* CANVAS SIDE PANEL — desktop sidebar / mobile fullscreen */}
      {(wideEnough || (!wideEnough && mobileView === "canvas")) && (
        <div style={wideEnough
          ? { position: "fixed", top: "57px", right: 0, bottom: "72px", width: showCanvas ? `${canvasWidth}px` : "48px", zIndex: 50, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", transition: isResizing ? "none" : "width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }
          : { position: "fixed", top: "57px", left: 0, right: 0, bottom: "72px", zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden" }
        }>
          {/* RESIZE HANDLE — desktop only */}
          {wideEnough && showCanvas && (
            <div
              aria-hidden="true"
              style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "6px", cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                canvasResizeRef.current = { active: true, startX: e.clientX, startW: canvasWidth, lastW: canvasWidth };
                setIsResizing(true);
              }}
              onPointerMove={(e) => {
                if (!canvasResizeRef.current.active) return;
                const delta = canvasResizeRef.current.startX - e.clientX;
                const newW = Math.max(280, Math.min(window.innerWidth - 320, canvasResizeRef.current.startW + delta));
                canvasResizeRef.current.lastW = newW;
                setCanvasWidth(newW);
              }}
              onPointerUp={(e) => {
                if (!canvasResizeRef.current.active) return;
                canvasResizeRef.current.active = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
                setIsResizing(false);
                localStorage.setItem("canvas_width", String(canvasResizeRef.current.lastW));
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,122,95,0.35)"; }}
              onMouseLeave={e => { if (!canvasResizeRef.current.active) e.currentTarget.style.background = "transparent"; }}
            />
          )}
          {(wideEnough && !showCanvas) ? (
            <div onClick={() => { setShowCanvas(true); playClick(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "18px", gap: "10px", background: T.surface, height: "100%", cursor: "pointer" }}>
              <span style={{ fontSize: "18px", color: T.textMuted }}>‹</span>
              <span aria-hidden="true" style={{ fontSize: "15px", color: T.textFaint }}>◫</span>
              <span style={{ fontSize: "9px", color: T.textFaint, writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Canvas</span>
            </div>
          ) : (
            <NoteCanvas notes={canvasNotes} setNotes={setCanvasNotes} T={T} dark={dark}
              onCollapse={() => { wideEnough ? setShowCanvas(false) : setMobileView("list"); playClick(); }} />
          )}
        </div>
      )}

      {/* FIXED FOOTER */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: T.panelBg, borderTop: `0.5px solid ${T.border}`, padding: "14px 20px 16px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, fontWeight: 500 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "13px", color: T.text }}>to <span style={{ color: T.accent }}>done</span></span> no tiene costos.
        </p>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, marginTop: "2px" }}>
          Si te ayuda a organizarte, podés bancarnos con un{" "}
          <a href="https://cafecito.app/todone" target="_blank" rel="noopener noreferrer"
            style={{ color: T.danger, fontWeight: 700, textDecoration: "none", borderBottom: `1.5px solid ${T.danger}4D`, paddingBottom: "1px" }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = T.danger}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = `${T.danger}4D`}>
            ☕ cafecito
          </a>
        </p>
      </footer>

      {/* DELETE LIST CONFIRMATION */}
      {deleteListTarget && (() => {
        const openCount = tasks.filter(t => t.listId === deleteListTarget.id && !t.done).length;
        const otherLists = lists.filter(l => l.id !== deleteListTarget.id);
        const pillSel = { fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "20px", border: `1.5px solid ${T.danger}`, background: `${T.danger}1F`, color: T.danger, cursor: "pointer" };
        const pillDef = { fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "20px", border: `1.5px solid ${T.inputBorder}`, background: T.overlay, color: T.textMuted, cursor: "pointer" };
        return (
          <div onClick={() => setDeleteListTarget(null)} onKeyDown={e => { if (e.key === "Escape") setDeleteListTarget(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirmar eliminación" tabIndex={-1} ref={el => el?.focus()}
              style={{ background: T.panelBg, borderRadius: "20px", padding: "24px", maxWidth: "360px", width: "100%", boxShadow: T.panelShadow, animation: "popIn 0.2s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>Eliminar lista</p>
              <p style={{ fontSize: "14px", color: T.textMuted, marginBottom: openCount > 0 ? "20px" : "24px", lineHeight: 1.5 }}>
                ¿Eliminar <strong style={{ color: T.text }}>"{deleteListTarget.name}"</strong>?
                {openCount === 0 && " Esta lista no tiene tareas abiertas."}
              </p>
              {openCount > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <p style={{ fontSize: "13px", color: T.textSec, marginBottom: "10px", fontWeight: 500 }}>
                    Tiene <strong>{openCount}</strong> tarea{openCount !== 1 ? "s" : ""} abierta{openCount !== 1 ? "s" : ""}. ¿A qué lista las movemos?
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <button onClick={() => setDeleteListReassignTo(null)} style={deleteListReassignTo === null ? pillSel : pillDef}>Sin lista</button>
                    {otherLists.map(l => (
                      <button key={l.id} onClick={() => setDeleteListReassignTo(l.id)} style={deleteListReassignTo === l.id ? pillSel : pillDef}>{l.name}</button>
                    ))}
                  </div>
                  <button onClick={() => setDeleteListReassignTo("__none__")}
                    style={{ fontSize: "12px", color: deleteListReassignTo === "__none__" ? T.danger : T.textFaint, background: "none", border: "none", cursor: "pointer", padding: "2px 0", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px", fontWeight: deleteListReassignTo === "__none__" ? 700 : 400 }}>
                    No deseo moverlas
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setDeleteListTarget(null)} style={{ padding: "9px 18px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: "transparent", color: T.textMuted, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                <button onClick={() => confirmDeleteList()} style={{ padding: "9px 18px", borderRadius: "12px", border: "none", background: T.accent, color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CHANGE PASSWORD PANEL */}
      {showChangePass && (<>
        <div onClick={() => setShowChangePass(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 109 }} />
        <div role="dialog" aria-label="Cambiar contraseña" aria-modal="true"
          onKeyDown={e => { if (e.key === "Escape") setShowChangePass(false); }}
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
              <p role="alert" style={{ fontSize: "12px", color: changePassMsg.type === "ok" ? T.success : T.danger, fontWeight: 600, marginTop: "10px" }}>
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
              style={{ width: "100%", marginTop: "16px", padding: "14px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, cursor: (changePassLoading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !changePassLoading) ? T.accent : T.inputBorder, color: (newPass && newPassConfirm && !changePassLoading) ? "white" : T.textFaint }}>
              {changePassLoading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </div>
      </>)}

      {/* ADD PANEL */}
      {showAdd ? (
        <div role="dialog" aria-label="Nueva tarea" aria-modal="true" style={{ position: "fixed", bottom: kbHeight, left: 0, right: wideEnough ? (showCanvas ? `${canvasWidth}px` : "48px") : 0, background: T.panelBg, borderRadius: kbHeight > 0 ? "0" : "24px 24px 0 0", padding: "16px 20px 24px", boxShadow: T.panelShadow, animation: kbHeight > 0 ? "none" : "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 100 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", background: T.overlay, borderRadius: "10px", padding: "3px", gap: "2px", flex: 1 }}>
                <button onClick={() => { setQuickDump(false); setNewTask(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: !quickDump ? T.surface : "transparent", color: !quickDump ? T.text : T.textFaint, boxShadow: !quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>Tarea</button>
                <button onClick={() => { setQuickDump(true); setQuickText(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: quickDump ? T.surface : "transparent", color: quickDump ? T.text : T.textFaint, boxShadow: quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>⚡ Volcado</button>
              </div>
              <button onClick={() => { setShowAdd(false); setAiResult(null); setNewTask(""); setQuickDump(false); setQuickText(""); }} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer", marginLeft: "10px" }}>✕</button>
            </div>
            {quickDump ? (
              <>
                <p style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", fontWeight: 600 }}>Una tarea por línea. La IA asigna día, prioridad y tiempo.</p>
                <textarea autoFocus value={quickText} onChange={e => setQuickText(e.target.value)} placeholder={"Llamar a Juan mañana\nPreparar presentación urgente 2h"} maxLength={5000} style={{ width: "100%", minHeight: "100px", fontSize: "14px", padding: "12px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, resize: "none", lineHeight: 1.6, boxSizing: "border-box" }} />
                <button onClick={quickDumpAdd} disabled={!quickText.trim() || addingTask} style={{ width: "100%", marginTop: "10px", padding: "13px", borderRadius: "12px", background: quickText.trim() && !addingTask ? T.accent : T.inputBorder, color: quickText.trim() && !addingTask ? "white" : T.textFaint, border: "none", fontSize: "14px", fontWeight: 700, cursor: quickText.trim() && !addingTask ? "pointer" : "default" }}>
                  Agregar {quickText.split("\n").filter(l => l.trim()).length || ""} tarea{quickText.split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""}
                </button>
              </>
            ) : (
            <>
            <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} aria-label="Texto de la tarea" placeholder="Ej: Preparar propuesta mañana 2h urgente..." maxLength={500} style={{ width: "100%", fontSize: "16px", padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }} />

            {newTask.trim().length > 3 && aiResult?.hasAny && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", animation: "fadeInUp 0.2s ease" }}>
                <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}><span style={{ color: T.accent }}>✦</span> ToDone sugiere</p>
                {aiResult?.hasAny && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {aiResult.priority && !aiAccepted.priority && <AIChip label="Prioridad" value={PRIORITIES[aiResult.priority]} reason={aiResult.priorityReason} color={aiResult.priority === "high" ? T.priorityHigh : aiResult.priority === "low" ? T.priorityLow : T.priorityMed} onAccept={() => setAiAccepted(p => ({ ...p, priority: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.priority && aiAccepted.priority && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: (aiResult.priority === "high" ? T.priorityHigh : T.priorityLow) + "18", color: aiResult.priority === "high" ? T.priorityHigh : T.priorityLow, fontWeight: 700 }}>✓ {PRIORITIES[aiResult.priority]}</span>}
                    {aiResult.scheduledFor && !aiAccepted.schedule && <AIChip label="Cuándo" value={aiResult.scheduledFor} reason={aiResult.scheduleReason} color={T.info} onAccept={() => setAiAccepted(p => ({ ...p, schedule: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.scheduledFor && aiAccepted.schedule && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: `${T.info}1F`, color: T.info, fontWeight: 700 }}>✓ 📅 {aiResult.scheduledFor}</span>}
                    {aiResult.minutes && !aiAccepted.minutes && <AIChip label="Tiempo" value={fmt(aiResult.minutes)} reason={aiResult.minutesReason} color={T.textMuted} onAccept={() => setAiAccepted(p => ({ ...p, minutes: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.minutes && aiAccepted.minutes && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: T.overlay, color: T.textMuted, fontWeight: 700 }}>✓ 🕐 {fmt(aiResult.minutes)}</span>}
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
                    return <button key={k} onClick={() => { setNewPriority(k); setAiAccepted(p => ({ ...p, priority: false })); }} aria-pressed={active} style={{ flex: 1, padding: "6px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, border: active ? "none" : `1.5px solid ${T.inputBorder}`, background: active ? (k === "high" ? T.priorityHigh : k === "medium" ? T.priorityMed : T.priorityLow) : T.inputBg, color: active ? "white" : T.textMuted, cursor: "pointer" }}>{l}</button>;
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
                  style={{ width: "100%", cursor: "pointer", accentColor: T.accent }}
                />
                <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {EFFORT_OPTIONS.map(m => <span key={m} style={{ fontSize: "9px", color: T.textFaint }}>{fmtS(m)}</span>)}
                </div>
              </fieldset>
            </div>

            <button onClick={addTask} disabled={!newTask.trim() || addingTask} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: newTask.trim() && !addingTask ? T.accent : T.inputBorder, color: newTask.trim() && !addingTask ? "white" : T.textFaint, border: "none", fontSize: "15px", fontWeight: 700, cursor: newTask.trim() && !addingTask ? "pointer" : "default" }}>Agregar tarea</button>
            </>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowAdd(true); playClick(); }}
          aria-label="Nueva tarea"
          onMouseEnter={() => setAddBtnHover(true)}
          onMouseLeave={() => setAddBtnHover(false)}
          style={{
            position: "fixed", bottom: "84px", right: wideEnough ? (showCanvas ? `calc(${canvasWidth}px + 20px)` : "68px") : "20px",
            height: "52px", borderRadius: "26px",
            width: addBtnHover ? "176px" : "52px",
            background: T.accent,
            color: dark ? "#1C1C1E" : "#FFFFFF", border: "none",
            padding: addBtnHover ? "0 22px 0 16px" : "0",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            gap: addBtnHover ? "8px" : "0",
            boxShadow: "none", zIndex: 100,
            fontSize: "16px", fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), padding 0.25s ease, gap 0.25s ease",
          }}>
          <span aria-hidden="true" style={{ fontSize: "28px", fontWeight: 300, lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px" }}>+</span>
          <span style={{ overflow: "hidden", maxWidth: addBtnHover ? "120px" : "0", opacity: addBtnHover ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.15s ease" }}>Nueva tarea</span>
        </button>
      )}
      {/* Mobile task detail sheet */}
      {mobileSheetTask && (() => {
        const liveTask = tasks.find(t => t.id === mobileSheetTask.id);
        if (!liveTask) return null;
        return <MobileTaskSheet task={liveTask} onClose={() => setMobileSheetTask(null)} onToggle={toggleTask} onDelete={deleteTask} onSchedule={scheduleTask} onDefer={deferTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onDelegate={delegateTask} onUnshare={unshareTask} onSplit={updateSubs} onAddSub={addSub} onMoveToList={moveToList} T={T} lists={lists} />;
      })()}
    </div>
  );
}
