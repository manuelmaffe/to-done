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
// LOCALE DETECTION & i18n
// ============================================================
const SPANISH_COUNTRIES = ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','GT','HN','MX','NI','PA','PY','PE','PR','ES','UY','VE'];
const detectLocale = () => {
  try {
    const stored = localStorage.getItem('locale');
    if (stored && ['ar','es','en'].includes(stored)) return stored;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('America/Argentina') || tz === 'America/Buenos_Aires') return 'ar';
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (lang.startsWith('es-ar')) return 'ar';
    if (lang.startsWith('es')) return 'es';
    // Check timezone for other Spanish-speaking countries
    const region = tz.split('/')[0];
    if (region === 'America' && lang.startsWith('es')) return 'es';
    if (lang.startsWith('es')) return 'es';
    return 'en';
  } catch { return 'es'; }
};
const _locale = detectLocale();
try { localStorage.setItem('locale', _locale); } catch {}

// ar = rioplatense, es = neutral Spanish, en = English
const _i18n = {
  // Priorities
  high:        { ar: "Alta", es: "Alta", en: "High" },
  medium:      { ar: "Media", es: "Media", en: "Medium" },
  low:         { ar: "Baja", es: "Baja", en: "Low" },
  // Greetings
  goodMorning: { ar: "Buenos días", es: "Buenos días", en: "Good morning" },
  goodAfternoon: { ar: "Buenas tardes", es: "Buenas tardes", en: "Good afternoon" },
  goodEvening: { ar: "Buenas noches", es: "Buenas noches", en: "Good evening" },
  // Sections
  todayPlan:   { ar: "Plan de hoy", es: "Plan de hoy", en: "Today's plan" },
  task:        { ar: "tarea", es: "tarea", en: "task" },
  tasks:       { ar: "tareas", es: "tareas", en: "tasks" },
  today:       { ar: "Hoy", es: "Hoy", en: "Today" },
  tasksToday:  { ar: "Tareas de hoy", es: "Tareas de hoy", en: "Today's tasks" },
  deferred:    { ar: "Pospuestas", es: "Pospuestas", en: "Deferred" },
  tasksDeferred: { ar: "Tareas pospuestas", es: "Tareas pospuestas", en: "Deferred tasks" },
  completed:   { ar: "Completadas", es: "Completadas", en: "Completed" },
  // Empty states
  clearDay:    { ar: "Día despejado.", es: "Día despejado.", en: "Clear day." },
  addFirstTask:{ ar: "Agregá tu primera tarea del día", es: "Agrega tu primera tarea del día", en: "Add your first task" },
  // Buttons & actions
  newTask:     { ar: "Nueva tarea", es: "Nueva tarea", en: "New task" },
  addTask:     { ar: "Agregar tarea", es: "Agregar tarea", en: "Add task" },
  newList:     { ar: "Nueva lista", es: "Nueva lista", en: "New list" },
  moreLists:   { ar: "Más listas", es: "Más listas", en: "More lists" },
  allLists:    { ar: "Todas", es: "Todas", en: "All" },
  postpone:    { ar: "Posponer", es: "Posponer", en: "Postpone" },
  prioritize:  { ar: "Priorizar", es: "Priorizar", en: "Prioritize" },
  toToday:     { ar: "→ Hoy", es: "→ Hoy", en: "→ Today" },
  delegate:    { ar: "Delegar", es: "Delegar", en: "Delegate" },
  delegateTo:  { ar: "Delegar a", es: "Delegar a", en: "Delegate to" },
  revoke:      { ar: "Revocar", es: "Revocar", en: "Revoke" },
  remove:      { ar: "Quitar", es: "Quitar", en: "Remove" },
  deleteStr:   { ar: "Eliminar", es: "Eliminar", en: "Delete" },
  send:        { ar: "Enviar", es: "Enviar", en: "Send" },
  cancel:      { ar: "Cancelar", es: "Cancelar", en: "Cancel" },
  close:       { ar: "Cerrar", es: "Cerrar", en: "Close" },
  understood:  { ar: "Entendido", es: "Entendido", en: "Got it" },
  retry:       { ar: "Reintentar", es: "Reintentar", en: "Retry" },
  choose:      { ar: "Elegir", es: "Elegir", en: "Choose" },
  save:        { ar: "Guardar", es: "Guardar", en: "Save" },
  // Task properties
  priority:    { ar: "Prioridad", es: "Prioridad", en: "Priority" },
  time:        { ar: "Tiempo", es: "Tiempo", en: "Time" },
  when:        { ar: "Cuándo", es: "Cuándo", en: "When" },
  list:        { ar: "Lista", es: "Lista", en: "List" },
  noList:      { ar: "Sin lista", es: "Sin lista", en: "No list" },
  dueDate:     { ar: "Vence", es: "Vence", en: "Due" },
  noDate:      { ar: "Sin fecha", es: "Sin fecha", en: "No date" },
  postponed:   { ar: "Pospuesta", es: "Pospuesta", en: "Deferred" },
  subtasks:    { ar: "Subtareas", es: "Subtareas", en: "Subtasks" },
  addSubPlaceholder: { ar: "+ subtarea...", es: "+ subtarea...", en: "+ subtask..." },
  addDesc:     { ar: "Agregar descripción…", es: "Agregar descripción…", en: "Add description…" },
  collapse:    { ar: "Colapsar", es: "Colapsar", en: "Collapse" },
  details:     { ar: "Ver detalles", es: "Ver detalles", en: "View details" },
  firstSubtask:{ ar: "Primera subtarea... (Enter · Esc para cerrar)", es: "Primera subtarea... (Enter · Esc para cerrar)", en: "First subtask... (Enter · Esc to close)" },
  // Delegate messages
  taskShared:  { ar: "Tarea compartida ✓", es: "Tarea compartida ✓", en: "Task shared ✓" },
  inviteSent:  { ar: "Invitación enviada ✓", es: "Invitación enviada ✓", en: "Invite sent ✓" },
  delegateError: { ar: "Error al delegar", es: "Error al delegar", en: "Delegation error" },
  noConnection:{ ar: "Sin conexión. Intentá de nuevo.", es: "Sin conexión. Intenta de nuevo.", en: "No connection. Try again." },
  // Auth
  welcomeBack: { ar: "Bienvenido de vuelta", es: "Bienvenido de vuelta", en: "Welcome back" },
  startOrganizing: { ar: "Empezá a organizarte sin culpa", es: "Empieza a organizarte sin culpa", en: "Start organizing without guilt" },
  recoverAccount: { ar: "Recuperá tu cuenta", es: "Recupera tu cuenta", en: "Recover your account" },
  lightMode:   { ar: "Modo claro", es: "Modo claro", en: "Light mode" },
  darkMode:    { ar: "Modo oscuro", es: "Modo oscuro", en: "Dark mode" },
  signIn:      { ar: "Iniciar sesión", es: "Iniciar sesión", en: "Sign in" },
  createAccount: { ar: "Crear cuenta", es: "Crear cuenta", en: "Create account" },
  sendLink:    { ar: "Enviar link", es: "Enviar link", en: "Send link" },
  name:        { ar: "Nombre", es: "Nombre", en: "Name" },
  yourName:    { ar: "Tu nombre", es: "Tu nombre", en: "Your name" },
  email:       { ar: "Email", es: "Email", en: "Email" },
  password:    { ar: "Contraseña", es: "Contraseña", en: "Password" },
  confirmPass: { ar: "Confirmar contraseña", es: "Confirmar contraseña", en: "Confirm password" },
  repeatPass:  { ar: "Repetí tu contraseña", es: "Repite tu contraseña", en: "Repeat your password" },
  min6chars:   { ar: "Mínimo 6 caracteres", es: "Mínimo 6 caracteres", en: "Minimum 6 characters" },
  yourPass:    { ar: "Tu contraseña", es: "Tu contraseña", en: "Your password" },
  showPass:    { ar: "Mostrar contraseña", es: "Mostrar contraseña", en: "Show password" },
  hidePass:    { ar: "Ocultar contraseña", es: "Ocultar contraseña", en: "Hide password" },
  forgotPass:  { ar: "¿Olvidaste tu contraseña?", es: "¿Olvidaste tu contraseña?", en: "Forgot password?" },
  noAccount:   { ar: "¿No tenés cuenta? ", es: "¿No tienes cuenta? ", en: "No account? " },
  haveAccount: { ar: "¿Ya tenés cuenta? ", es: "¿Ya tienes cuenta? ", en: "Already have an account? " },
  createOne:   { ar: "Creá una", es: "Crea una", en: "Create one" },
  goSignIn:    { ar: "Iniciá sesión", es: "Inicia sesión", en: "Sign in" },
  backToStart: { ar: "← Volver al inicio", es: "← Volver al inicio", en: "← Back to start" },
  backToLogin: { ar: "← Volver al login", es: "← Volver al login", en: "← Back to login" },
  termsText:   { ar: "Al crear tu cuenta aceptás los", es: "Al crear tu cuenta aceptas los", en: "By creating your account you accept the" },
  terms:       { ar: "términos", es: "términos", en: "terms" },
  andThe:      { ar: "y la", es: "y la", en: "and the" },
  privacyPolicy: { ar: "política de privacidad", es: "política de privacidad", en: "privacy policy" },
  enterName:   { ar: "Ingresá tu nombre", es: "Ingresa tu nombre", en: "Enter your name" },
  enterEmail:  { ar: "Ingresá tu email", es: "Ingresa tu email", en: "Enter your email" },
  invalidEmail:{ ar: "Email no válido", es: "Email no válido", en: "Invalid email" },
  enterPass:   { ar: "Ingresá tu contraseña", es: "Ingresa tu contraseña", en: "Enter your password" },
  passNoMatch: { ar: "Las contraseñas no coinciden", es: "Las contraseñas no coinciden", en: "Passwords don't match" },
  emailSentReset: { ar: "Te enviamos un email para restablecer tu contraseña", es: "Te enviamos un email para restablecer tu contraseña", en: "We sent you a password reset email" },
  existingAccount: { ar: "Ya existe una cuenta con este email. ¿Querés iniciar sesión?", es: "Ya existe una cuenta con este email. ¿Quieres iniciar sesión?", en: "An account already exists with this email. Sign in?" },
  signInArrow: { ar: "Iniciar sesión →", es: "Iniciar sesión →", en: "Sign in →" },
  // Verify screen
  checkEmail:  { ar: "Revisá tu email", es: "Revisa tu email", en: "Check your email" },
  confirmLinkSent: { ar: "Te enviamos un link de confirmación a", es: "Te enviamos un link de confirmación a", en: "We sent a confirmation link to" },
  clickLink:   { ar: "Hacé click en el enlace del email para activar tu cuenta.\nLa app se va a abrir automáticamente.", es: "Haz click en el enlace del email para activar tu cuenta.\nLa app se abrirá automáticamente.", en: "Click the link in the email to activate your account.\nThe app will open automatically." },
  emailResent: { ar: "✓ Email reenviado", es: "✓ Email reenviado", en: "✓ Email resent" },
  resendEmail: { ar: "¿No llegó? Reenviar email", es: "¿No llegó? Reenviar email", en: "Didn't arrive? Resend email" },
  resending:   { ar: "Reenviando…", es: "Reenviando…", en: "Resending…" },
  // Password reset
  createNewPass: { ar: "Creá tu nueva contraseña", es: "Crea tu nueva contraseña", en: "Create your new password" },
  newPassword: { ar: "Nueva contraseña", es: "Nueva contraseña", en: "New password" },
  repeatNewPass: { ar: "Repetir contraseña", es: "Repetir contraseña", en: "Repeat password" },
  repeatNewPassPlaceholder: { ar: "Repetí tu nueva contraseña", es: "Repite tu nueva contraseña", en: "Repeat your new password" },
  savePassword:{ ar: "Guardar contraseña", es: "Guardar contraseña", en: "Save password" },
  saving:      { ar: "Guardando…", es: "Guardando…", en: "Saving…" },
  passUpdated: { ar: "¡Contraseña actualizada! Ingresando…", es: "¡Contraseña actualizada! Ingresando…", en: "Password updated! Signing in…" },
  linkExpired: { ar: "El link expiró o ya fue usado. Solicitá uno nuevo desde la pantalla de login.", es: "El link expiró o ya fue usado. Solicita uno nuevo desde la pantalla de login.", en: "Link expired or already used. Request a new one from the login screen." },
  passUpdatedShort: { ar: "Contraseña actualizada", es: "Contraseña actualizada", en: "Password updated" },
  newPassLabel:{ ar: "Nueva contraseña (mín. 6 caracteres)", es: "Nueva contraseña (mín. 6 caracteres)", en: "New password (min. 6 characters)" },
  repeatNewPassLabel: { ar: "Repetir nueva contraseña", es: "Repetir nueva contraseña", en: "Repeat new password" },
  // Account menu
  myAccount:   { ar: "Mi cuenta", es: "Mi cuenta", en: "My account" },
  upgradePro:  { ar: "Upgrade a Pro — $2.99/mes", es: "Upgrade a Pro — $2.99/mes", en: "Upgrade to Pro — $2.99/mo" },
  planProActive: { ar: "Plan Pro activo", es: "Plan Pro activo", en: "Pro plan active" },
  planFree:    { ar: "Plan Free", es: "Plan Free", en: "Free plan" },
  manageSub:   { ar: "Gestionar suscripción", es: "Gestionar suscripción", en: "Manage subscription" },
  manageSubDesc: { ar: "Cambiar plan, método de pago o cancelar", es: "Cambiar plan, método de pago o cancelar", en: "Change plan, payment method, or cancel" },
  security:    { ar: "Seguridad", es: "Seguridad", en: "Security" },
  preferences: { ar: "Preferencias", es: "Preferencias", en: "Preferences" },
  plan:        { ar: "Plan", es: "Plan", en: "Plan" },
  viewMode:    { ar: "Vista", es: "Vista", en: "View" },
  viewSimple:  { ar: "Simple", es: "Simple", en: "Simple" },
  viewCalendar:{ ar: "Calendario", es: "Calendario", en: "Calendar" },
  signOut:     { ar: "Cerrar sesión", es: "Cerrar sesión", en: "Sign out" },
  accountMenu: { ar: "Menú de cuenta", es: "Menú de cuenta", en: "Account menu" },
  accountOptions: { ar: "Opciones de cuenta", es: "Opciones de cuenta", en: "Account options" },
  // Notifications
  notifications: { ar: "Notificaciones", es: "Notificaciones", en: "Notifications" },
  noNotifications: { ar: "Sin notificaciones", es: "Sin notificaciones", en: "No notifications" },
  unread:      { ar: "sin leer", es: "sin leer", en: "unread" },
  // Notification messages
  delegatedTo: { ar: "te delegó", es: "te delegó", en: "delegated to you" },
  completedTask: { ar: "completó", es: "completó", en: "completed" },
  modifiedTask: { ar: "modificó", es: "modificó", en: "modified" },
  someone:     { ar: "Alguien", es: "Alguien", en: "Someone" },
  // Time ago
  now:         { ar: "Ahora", es: "Ahora", en: "Now" },
  ago:         { ar: "Hace", es: "Hace", en: "" },
  minAgo:      { ar: "min", es: "min", en: "min ago" },
  hAgo:        { ar: "h", es: "h", en: "h ago" },
  yesterday:   { ar: "Ayer", es: "Ayer", en: "Yesterday" },
  daysAgo:     { ar: "días", es: "días", en: "days ago" },
  // Errors
  couldNotLoad:{ ar: "No se pudieron cargar las tareas", es: "No se pudieron cargar las tareas", en: "Could not load tasks" },
  checkConnection: { ar: "Revisá tu conexión e intentá de nuevo.", es: "Revisa tu conexión e intenta de nuevo.", en: "Check your connection and try again." },
  couldNotReply: { ar: "No pude responder. Intentá de nuevo.", es: "No pude responder. Intenta de nuevo.", en: "Could not reply. Try again." },
  // Install
  installApp:  { ar: "Instalar app", es: "Instalar app", en: "Install app" },
  installToDone: { ar: "Instalar To Done", es: "Instalar To Done", en: "Install To Done" },
  viewList:    { ar: "Ver lista", es: "Ver lista", en: "View list" },
  viewCanvas:  { ar: "Ver canvas", es: "Ver canvas", en: "View canvas" },
  silenceSounds: { ar: "Silenciar sonidos", es: "Silenciar sonidos", en: "Mute sounds" },
  enableSounds: { ar: "Activar sonidos", es: "Activar sonidos", en: "Enable sounds" },
  // Install guide
  iosStep1:    { ar: "Tocá el botón <strong>Compartir</strong> <span style=\"font-size:18px;vertical-align:middle\">↑</span> en Safari", es: "Toca el botón <strong>Compartir</strong> <span style=\"font-size:18px;vertical-align:middle\">↑</span> en Safari", en: "Tap the <strong>Share</strong> <span style=\"font-size:18px;vertical-align:middle\">↑</span> button in Safari" },
  iosStep2:    { ar: "Elegí <strong>\"Agregar a pantalla de inicio\"</strong>", es: "Elige <strong>\"Agregar a pantalla de inicio\"</strong>", en: "Choose <strong>\"Add to Home Screen\"</strong>" },
  iosStep3:    { ar: "Tocá <strong>\"Agregar\"</strong>", es: "Toca <strong>\"Agregar\"</strong>", en: "Tap <strong>\"Add\"</strong>" },
  macStep1:    { ar: "En Safari, andá a <strong>Archivo</strong> en la barra de menú", es: "En Safari, ve a <strong>Archivo</strong> en la barra de menú", en: "In Safari, go to <strong>File</strong> in the menu bar" },
  macStep2:    { ar: "Elegí <strong>\"Agregar al Dock\"</strong>", es: "Elige <strong>\"Agregar al Dock\"</strong>", en: "Choose <strong>\"Add to Dock\"</strong>" },
  openInChrome:{ ar: "Abrí esta página en <strong>Chrome</strong> o <strong>Edge</strong> para instalarla como app.", es: "Abre esta página en <strong>Chrome</strong> o <strong>Edge</strong> para instalarla como app.", en: "Open this page in <strong>Chrome</strong> or <strong>Edge</strong> to install it as an app." },
  // Canvas
  canvas:      { ar: "Canvas", es: "Canvas", en: "Canvas" },
  collapseCanvas: { ar: "Colapsar canvas", es: "Colapsar canvas", en: "Collapse canvas" },
  dblClickToAdd: { ar: "doble click para agregar", es: "doble click para agregar", en: "double-click to add" },
  distributeNotes: { ar: "Distribuir notas automáticamente", es: "Distribuir notas automáticamente", en: "Auto-distribute notes" },
  distribute:  { ar: "Distribuir", es: "Distribuir", en: "Distribute" },
  note:        { ar: "Nota", es: "Nota", en: "Note" },
  noteList:    { ar: "Lista", es: "Lista", en: "List" },
  noteLink:    { ar: "Enlace", es: "Enlace", en: "Link" },
  addNote:     { ar: "+ Nota", es: "+ Nota", en: "+ Note" },
  deleteNote:  { ar: "Eliminar nota", es: "Eliminar nota", en: "Delete note" },
  writeSomething: { ar: "Escribí algo...", es: "Escribe algo...", en: "Write something..." },
  pasteUrl:    { ar: "Pegá una URL…", es: "Pega una URL…", en: "Paste a URL…" },
  emptyCanvas: { ar: "Canvas vacío", es: "Canvas vacío", en: "Empty canvas" },
  emptyCanvasHint: { ar: "Doble click para agregar\no usá el botón", es: "Doble click para agregar\no usa el botón", en: "Double-click to add\nor use the button" },
  // Add task panel
  taskMode:    { ar: "Tarea", es: "Tarea", en: "Task" },
  dumpMode:    { ar: "⚡ Volcado", es: "⚡ Volcado", en: "⚡ Dump" },
  dumpHint:    { ar: "Una tarea por línea. La IA asigna día, prioridad y tiempo.", es: "Una tarea por línea. La IA asigna día, prioridad y tiempo.", en: "One task per line. AI assigns day, priority and time." },
  dumpPlaceholder: { ar: "Llamar a Juan mañana\nPreparar presentación urgente 2h", es: "Llamar a Juan mañana\nPreparar presentación urgente 2h", en: "Call Juan tomorrow\nPrepare urgent presentation 2h" },
  taskPlaceholder: { ar: "Ej: Preparar propuesta mañana 2h urgente...", es: "Ej: Preparar propuesta mañana 2h urgente...", en: "E.g.: Prepare proposal tomorrow 2h urgent..." },
  addCount:    { ar: "Agregar", es: "Agregar", en: "Add" },
  suggests:    { ar: "ToDone sugiere", es: "ToDone sugiere", en: "ToDone suggests" },
  estimatedTime: { ar: "Tiempo estimado", es: "Tiempo estimado", en: "Estimated time" },
  // Coach
  anotherTip:  { ar: "Otro consejo", es: "Otro consejo", en: "Another tip" },
  talkToCoach: { ar: "Hablar con coach", es: "Hablar con coach", en: "Talk to coach" },
  talkToYourCoach: { ar: "Hablar con tu coach", es: "Hablar con tu coach", en: "Talk to your coach" },
  coach:       { ar: "Coach", es: "Coach", en: "Coach" },
  openCoach:   { ar: "Abrir coach", es: "Abrir coach", en: "Open coach" },
  // Delete list dialog
  deleteList:  { ar: "Eliminar lista", es: "Eliminar lista", en: "Delete list" },
  deleteListQ: { ar: "¿Eliminar", es: "¿Eliminar", en: "Delete" },
  noOpenTasks: { ar: "Esta lista no tiene tareas abiertas.", es: "Esta lista no tiene tareas abiertas.", en: "This list has no open tasks." },
  hasOpenTasks:{ ar: "abierta", es: "abierta", en: "open" },
  hasOpenTasksP:{ ar: "abiertas", es: "abiertas", en: "open" },
  moveToWhich: { ar: "¿A qué lista las movemos?", es: "¿A qué lista las movemos?", en: "Move them to which list?" },
  dontMove:    { ar: "No deseo moverlas", es: "No deseo moverlas", en: "Don't move them" },
  // Chat
  chatPlaceholder: { ar: "Escribí tu mensaje...", es: "Escribe tu mensaje...", en: "Write your message..." },
  confirmDelete: { ar: "Confirmar eliminación", es: "Confirmar eliminación", en: "Confirm deletion" },
  // AI suggest reasons
  aiUrgent:    { ar: "Detecté urgencia", es: "Detecté urgencia", en: "Detected urgency" },
  aiImportant: { ar: "Contexto importante", es: "Contexto importante", en: "Important context" },
  aiNotUrgent: { ar: "No parece urgente", es: "No parece urgente", en: "Doesn't seem urgent" },
  aiToday:     { ar: "Mencionás hoy", es: "Mencionas hoy", en: "Mentions today" },
  aiTomorrow:  { ar: "Mencionás mañana", es: "Mencionas mañana", en: "Mentions tomorrow" },
  aiThisWeek:  { ar: "Esta semana", es: "Esta semana", en: "This week" },
  aiNextWeek:  { ar: "Próxima semana", es: "Próxima semana", en: "Next week" },
  aiUrgentToday: { ar: "Es urgente → hoy", es: "Es urgente → hoy", en: "Urgent → today" },
  aiQuickMsg:  { ar: "Mensaje rápido", es: "Mensaje rápido", en: "Quick message" },
  aiTypicalCall: { ar: "Llamada típica", es: "Llamada típica", en: "Typical call" },
  aiQuickTask: { ar: "Tarea rápida", es: "Tarea rápida", en: "Quick task" },
  aiComplexPres: { ar: "Presentación compleja", es: "Presentación compleja", en: "Complex presentation" },
  aiLongDoc:   { ar: "Documento largo", es: "Documento largo", en: "Long document" },
  aiTechWork:  { ar: "Trabajo técnico", es: "Trabajo técnico", en: "Technical work" },
  aiNeedsPrep: { ar: "Requiere preparación", es: "Requiere preparación", en: "Requires preparation" },
  aiStdMeeting:{ ar: "Reunión estándar", es: "Reunión estándar", en: "Standard meeting" },
  aiReview:    { ar: "Revisión/análisis", es: "Revisión/análisis", en: "Review/analysis" },
  aiMentionsH: { ar: "Mencionás", es: "Mencionas", en: "Mentions" },
  aiMentionsDay: { ar: "Mencionás", es: "Mencionas", en: "Mentions" },
  // Calendar
  dayMo: { ar: "Lu", es: "Lu", en: "Mo" }, dayTu: { ar: "Ma", es: "Ma", en: "Tu" },
  dayWe: { ar: "Mi", es: "Mi", en: "We" }, dayTh: { ar: "Ju", es: "Ju", en: "Th" },
  dayFr: { ar: "Vi", es: "Vi", en: "Fr" }, daySa: { ar: "Sá", es: "Sa", en: "Sa" },
  daySu: { ar: "Do", es: "Do", en: "Su" },
  monthJan: { ar: "Enero", es: "Enero", en: "January" }, monthFeb: { ar: "Febrero", es: "Febrero", en: "February" },
  monthMar: { ar: "Marzo", es: "Marzo", en: "March" }, monthApr: { ar: "Abril", es: "Abril", en: "April" },
  monthMay: { ar: "Mayo", es: "Mayo", en: "May" }, monthJun: { ar: "Junio", es: "Junio", en: "June" },
  monthJul: { ar: "Julio", es: "Julio", en: "July" }, monthAug: { ar: "Agosto", es: "Agosto", en: "August" },
  monthSep: { ar: "Septiembre", es: "Septiembre", en: "September" }, monthOct: { ar: "Octubre", es: "Octubre", en: "October" },
  monthNov: { ar: "Noviembre", es: "Noviembre", en: "November" }, monthDec: { ar: "Diciembre", es: "Diciembre", en: "December" },
  // Aging
  daysOverdue: { ar: "de retraso", es: "de retraso", en: "overdue" },
  daysNoComplete: { ar: "sin completar", es: "sin completar", en: "not completed" },
  // Accept/dismiss
  accept:      { ar: "Aceptar", es: "Aceptar", en: "Accept" },
  dismiss:     { ar: "Descartar", es: "Descartar", en: "Dismiss" },
  suggestion:  { ar: "Sugerencia", es: "Sugerencia", en: "Suggestion" },
  // Previous lists
  prevLists:   { ar: "Listas anteriores", es: "Listas anteriores", en: "Previous lists" },
  nextLists:   { ar: "Listas siguientes", es: "Listas siguientes", en: "Next lists" },
  // Freemium
  proFeature:  { ar: "Función Pro", es: "Función Pro", en: "Pro feature" },
  unlockPro:   { ar: "Desbloquear con Pro", es: "Desbloquear con Pro", en: "Unlock with Pro" },
  taskLimit:   { ar: "Llegaste al límite de tareas pendientes", es: "Llegaste al límite de tareas pendientes", en: "You've reached the pending tasks limit" },
  taskLimitSub:{ ar: "Pasá a Pro para tareas ilimitadas", es: "Pasa a Pro para tareas ilimitadas", en: "Upgrade to Pro for unlimited tasks" },
  listLimit:   { ar: "Llegaste al límite de listas", es: "Llegaste al límite de listas", en: "You've reached the lists limit" },
  listLimitSub:{ ar: "Pasá a Pro para listas ilimitadas", es: "Pasa a Pro para listas ilimitadas", en: "Upgrade to Pro for unlimited lists" },
  subLimit:    { ar: "Máximo de subtareas alcanzado", es: "Máximo de subtareas alcanzado", en: "Subtask limit reached" },
  subLimitSub: { ar: "Pasá a Pro para subtareas ilimitadas", es: "Pasa a Pro para subtareas ilimitadas", en: "Upgrade to Pro for unlimited subtasks" },
  canvasPro:   { ar: "Canvas es una función Pro", es: "Canvas es una función Pro", en: "Canvas is a Pro feature" },
  canvasProSub:{ ar: "Notas adhesivas, lluvia de ideas y más", es: "Notas adhesivas, lluvia de ideas y más", en: "Sticky notes, brainstorming and more" },
  coachPro:    { ar: "El coach interactivo es Pro", es: "El coach interactivo es Pro", en: "Interactive coach is Pro" },
  coachProSub: { ar: "Consejos ilimitados y chat personalizado", es: "Consejos ilimitados y chat personalizado", en: "Unlimited tips and personalized chat" },
  delegatePro: { ar: "Delegar es una función Pro", es: "Delegar es una función Pro", en: "Delegation is a Pro feature" },
  delegateProSub:{ ar: "Asigná tareas a otras personas", es: "Asigna tareas a otras personas", en: "Assign tasks to other people" },
  aiPro:       { ar: "Las sugerencias IA son Pro", es: "Las sugerencias IA son Pro", en: "AI suggestions are Pro" },
  aiProSub:    { ar: "Estimaciones inteligentes de prioridad y tiempo", es: "Estimaciones inteligentes de prioridad y tiempo", en: "Smart priority and time estimates" },
  upgrade:     { ar: "Mejorar plan", es: "Mejorar plan", en: "Upgrade" },
  pendingOf:   { ar: "pendientes", es: "pendientes", en: "pending" },
  proModalTitle: { ar: "Hacé más con Pro", es: "Haz más con Pro", en: "Do more with Pro" },
  proModalSub: { ar: "Desbloqueá todo el potencial de To Done", es: "Desbloquea todo el potencial de To Done", en: "Unlock the full potential of To Done" },
  proFeat1:    { ar: "Tareas, listas y subtareas ilimitadas", es: "Tareas, listas y subtareas ilimitadas", en: "Unlimited tasks, lists and subtasks" },
  proFeat2:    { ar: "Canvas para lluvia de ideas y notas", es: "Canvas para lluvia de ideas y notas", en: "Canvas for brainstorming and notes" },
  proFeat3:    { ar: "Coach interactivo con chat personalizado", es: "Coach interactivo con chat personalizado", en: "Interactive coach with personalized chat" },
  proFeat4:    { ar: "Sugerencias IA de prioridad y tiempo", es: "Sugerencias IA de prioridad y tiempo", en: "AI priority and time suggestions" },
  proFeat5:    { ar: "Delegá tareas a otras personas", es: "Delega tareas a otras personas", en: "Delegate tasks to other people" },
  proCtaBtn:   { ar: "Pro por solo US$2.99/mes", es: "Pro por solo US$2.99/mes", en: "Pro for just US$2.99/mo" },
  proCtaSub:   { ar: "Sin impuestos incluidos. Podés cancelar en cualquier momento.", es: "Sin impuestos incluidos. Puedes cancelar en cualquier momento.", en: "Taxes not included. Cancel anytime." },
  maybeLater:  { ar: "Ahora no", es: "Ahora no", en: "Maybe later" },
  upgradeSuccess: { ar: "Bienvenido a Pro", es: "Bienvenido a Pro", en: "Welcome to Pro" },
  upgradeSuccessSub: { ar: "Ya tenés acceso a todas las funciones", es: "Ya tienes acceso a todas las funciones", en: "You now have access to all features" },
  // Calendar mode
  viewMode:    { ar: "Modo de vista", es: "Modo de vista", en: "View mode" },
  simpleMode:  { ar: "Simple", es: "Simple", en: "Simple" },
  calendarMode:{ ar: "Calendario", es: "Calendario", en: "Calendar" },
  overdueTasks:{ ar: "tareas vencidas", es: "tareas vencidas", en: "overdue tasks" },
  overdueTitle:{ ar: "Tareas vencidas", es: "Tareas vencidas", en: "Overdue tasks" },
  moveToToday: { ar: "Mover a hoy", es: "Mover a hoy", en: "Move to today" },
  reschedule:  { ar: "Reprogramar", es: "Reprogramar", en: "Reschedule" },
  removeDate:  { ar: "Quitar fecha", es: "Quitar fecha", en: "Remove date" },
  noDateTasks: { ar: "Sin fecha", es: "Sin fecha", en: "No date" },
  tomorrow:    { ar: "Mañana", es: "Mañana", en: "Tomorrow" },
  calToday:    { ar: "Hoy", es: "Hoy", en: "Today" },
  overdueCount:{ ar: "vencidas", es: "vencidas", en: "overdue" },
  moveAll:     { ar: "Mover todas a hoy", es: "Mover todas a hoy", en: "Move all to today" },
};
const L = Object.fromEntries(Object.entries(_i18n).map(([k, v]) => [k, v[_locale] ?? v.en]));
const LOCALE = _locale;
const DATE_LOCALE = _locale === 'ar' ? 'es-AR' : _locale === 'es' ? 'es' : 'en';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================
const PRIORITIES = { high: L.high, medium: L.medium, low: L.low };
const EFFORT_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240];
const WORKDAY_MINUTES = 480;
const FREE = { tasks: 25, lists: 2, subs: 2 };
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
  if (/\b(urgente|importante|crítico|asap|ya|deadline|vence|expira|jefe|cliente|inversores?|board|urgent|important|critical|boss|client)\b/i.test(lo)) { pr = "high"; prR = L.aiUrgent; }
  else if (/\b(presentación|propuesta|contrato|factura|pago|emergencia|error|bug|caído|roto|presentation|proposal|contract|invoice|emergency)\b/i.test(lo)) { pr = "high"; prR = L.aiImportant; }
  else if (/\b(cuando pueda|algún día|eventualmente|no urge|tranqui|opcional|si puedo|whenever|someday|eventually|optional|no rush)\b/i.test(lo)) { pr = "low"; prR = L.aiNotUrgent; }
  if (/\b(hoy|today|ahora|ya mismo|esta tarde|esta mañana|now|this afternoon|this morning)\b/i.test(lo)) { sc = "hoy"; scR = L.aiToday; }
  else if (/\b(mañana|tomorrow)\b/i.test(lo)) { sc = "mañana"; scR = L.aiTomorrow; }
  else if (/\b(esta semana|this week|estos días|these days)\b/i.test(lo)) { sc = "semana"; scR = L.aiThisWeek; }
  else if (/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lo)) { const m = lo.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i); if (m) { sc = "semana"; scR = `${L.aiMentionsDay} ${m[1]}`; } }
  else if (/\b(semana que viene|próxima semana|next week)\b/i.test(lo)) { sc = "semana"; scR = L.aiNextWeek; }
  else if (pr === "high" && !sc) { sc = "hoy"; scR = L.aiUrgentToday; }
  if (/\b(llamar|contestar|responder|enviar|mandar|confirmar|comprar|chequear|call|reply|send|confirm|buy|check)\b/i.test(lo)) { if (/\b(email|mail|mensaje|whatsapp|message)\b/i.test(lo)) { mn = 5; mnR = L.aiQuickMsg; } else if (/\b(llamar|call)\b/i.test(lo)) { mn = 15; mnR = L.aiTypicalCall; } else { mn = 10; mnR = L.aiQuickTask; } }
  else if (/\b(presentación|informe|reporte|propuesta|proyecto|estrategia|auditoría|presentation|report|proposal|project|strategy|audit)\b/i.test(lo)) { mn = /\b(presentación|propuesta|presentation|proposal)\b/i.test(lo) ? 180 : 240; mnR = mn === 180 ? L.aiComplexPres : L.aiLongDoc; }
  else if (/\b(preparar|armar|escribir|diseñar|desarrollar|crear|investigar|programar|planificar|redactar|prepare|write|design|develop|create|research|code|plan|draft)\b/i.test(lo)) { mn = /\b(diseñar|desarrollar|programar|design|develop|code)\b/i.test(lo) ? 120 : 90; mnR = mn === 120 ? L.aiTechWork : L.aiNeedsPrep; }
  else if (/\b(revisar|leer|analizar|reunión|meeting|call|sync|entrevista|review|read|analyze|interview)\b/i.test(lo)) { mn = /\b(reunión|meeting|call|sync)\b/i.test(lo) ? 45 : 30; mnR = mn === 45 ? L.aiStdMeeting : L.aiReview; }
  const tm = lo.match(/(\d+)\s*(min(?:utos?)?|h(?:oras?)?|hora|hours?)/i);
  if (tm) { const v = parseInt(tm[1]); if (tm[2].toLowerCase().startsWith("h")) { mn = v * 60; mnR = `${L.aiMentionsH} ${v}h`; } else { mn = v; mnR = `${L.aiMentionsH} ${v} min`; } }
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


function TodayCard({ total, done, taskCount, T }) {
  const r = 22, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = taskCount > 0 && pct >= 1;
  return (
    <div style={{ background: T.card, borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", border: `0.5px solid ${T.border}`, borderTop: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: T.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{L.todayPlan}</p>
        <p style={{ fontSize: "34px", fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(total) || "—"}</p>
        <p style={{ fontSize: "13px", color: T.textMuted, marginTop: "6px", fontWeight: 500 }}>
          {done > 0 ? <><span style={{ color: T.accent, fontWeight: 700 }}>{fmt(done)}</span> · </> : ""}{taskCount} {taskCount !== 1 ? L.tasks : L.task}
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
    <div role="group" aria-label={`${L.suggestion}: ${label} ${value}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: `${color}10`, border: `1px solid ${color}20`, borderRadius: "20px", padding: "3px 5px 3px 10px", fontSize: "11px", animation: "fadeInUp 0.25s ease" }}>
      <span style={{ color: T.textFaint, fontWeight: 500 }}>✨ {label}:</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
      <span style={{ color: T.textFaint, fontSize: "9px", fontStyle: "italic" }}>({reason})</span>
      <button onClick={() => { onAccept(); playClick(); }} aria-label={`${L.accept}: ${label} ${value}`} style={{ background: color, color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</button>
      <button onClick={() => { setGone(true); onDismiss(); playClick(); }} aria-label={`${L.dismiss}: ${label}`} style={{ background: T.overlay, color: T.textMuted, border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ============================================================
// MINI CALENDAR
// ============================================================
function MiniCalendar({ value, onChange, onClose, T }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const sel = value ? new Date(value + "T12:00:00") : null;
  const [viewYear, setViewYear] = useState(sel ? sel.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel ? sel.getMonth() : today.getMonth());

  const DAYS = [L.dayMo,L.dayTu,L.dayWe,L.dayTh,L.dayFr,L.daySa,L.daySu];
  const MONTHS = [L.monthJan,L.monthFeb,L.monthMar,L.monthApr,L.monthMay,L.monthJun,L.monthJul,L.monthAug,L.monthSep,L.monthOct,L.monthNov,L.monthDec];

  const first = new Date(viewYear, viewMonth, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const pick = (d) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    onClose();
  };

  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSel = (d) => sel && d === sel.getDate() && viewMonth === sel.getMonth() && viewYear === sel.getFullYear();

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "12px", width: "260px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", animation: "slideDown 0.15s ease", zIndex: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <button onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, fontSize: "16px", padding: "4px 8px", borderRadius: "8px" }}>‹</button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={next} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, fontSize: "16px", padding: "4px 8px", borderRadius: "8px" }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
        {DAYS.map(d => <span key={d} style={{ fontSize: "10px", fontWeight: 600, color: T.textMuted, textAlign: "center", padding: "2px 0" }}>{d}</span>)}
      </div>
      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((d, i) => d ? (
          <button key={i} onClick={() => pick(d)}
            style={{ width: "32px", height: "32px", borderRadius: "50%", border: isToday(d) ? `1.5px solid ${T.accent}` : "1.5px solid transparent", background: isSel(d) ? T.accent : "transparent", color: isSel(d) ? "white" : isToday(d) ? T.accent : T.text, fontSize: "12px", fontWeight: isSel(d) || isToday(d) ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s", margin: "0 auto" }}
            onMouseEnter={e => { if (!isSel(d)) e.currentTarget.style.background = T.overlay; }}
            onMouseLeave={e => { if (!isSel(d)) e.currentTarget.style.background = "transparent"; }}>
            {d}
          </button>
        ) : <span key={i} />)}
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR STRIP (week view for calendar mode)
// ============================================================
function CalendarStrip({ selectedDate, onSelectDate, onTogglePicker, taskCountByDate, T }) {
  const DAYS = [L.dayMo,L.dayTu,L.dayWe,L.dayTh,L.dayFr,L.daySa,L.daySu];
  const MONTHS = [L.monthJan,L.monthFeb,L.monthMar,L.monthApr,L.monthMay,L.monthJun,L.monthJul,L.monthAug,L.monthSep,L.monthOct,L.monthNov,L.monthDec];

  const sel = new Date(selectedDate + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Compute the week (Mon-Sun) that contains the selected date
  const getWeekDays = (refDate) => {
    const d = new Date(refDate);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // Monday offset
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(mon);
      dd.setDate(mon.getDate() + i);
      days.push(dd);
    }
    return days;
  };

  const weekDays = getWeekDays(sel);

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const prevWeek = () => {
    const d = new Date(sel);
    d.setDate(d.getDate() - 7);
    onSelectDate(fmt(d));
  };
  const nextWeek = () => {
    const d = new Date(sel);
    d.setDate(d.getDate() + 7);
    onSelectDate(fmt(d));
  };

  return (
    <div style={{ background: T.surface, borderRadius: "16px", border: `0.5px solid ${T.border}`, padding: "12px 8px 8px", marginBottom: "14px" }}>
      {/* Month/Year header with dropdown toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "0 4px" }}>
        <button onClick={prevWeek} aria-label="Previous week" style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, fontSize: "18px", padding: "4px 8px", borderRadius: "8px", lineHeight: 1 }}>‹</button>
        <button onClick={onTogglePicker} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: "4px" }}>
          {MONTHS[sel.getMonth()]} {sel.getFullYear()} <span style={{ fontSize: "10px", color: T.textMuted }}>▼</span>
        </button>
        <button onClick={nextWeek} aria-label="Next week" style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, fontSize: "18px", padding: "4px 8px", borderRadius: "8px", lineHeight: 1 }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
        {DAYS.map(d => <span key={d} style={{ fontSize: "10px", fontWeight: 600, color: T.textMuted, textAlign: "center" }}>{d}</span>)}
      </div>
      {/* Day buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {weekDays.map((d, i) => {
          const ds = fmt(d);
          const isToday = ds === todayStr;
          const isSel = ds === selectedDate;
          const count = taskCountByDate[ds] || 0;
          return (
            <button key={i} onClick={() => onSelectDate(ds)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "6px 0 4px", borderRadius: "12px", border: "none", cursor: "pointer",
                background: isSel ? T.accent : "transparent",
                transition: "all 0.15s" }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = T.overlay; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ fontSize: "14px", fontWeight: isSel || isToday ? 700 : 500, color: isSel ? "white" : isToday ? T.accent : T.text, lineHeight: 1.3 }}>
                {d.getDate()}
              </span>
              {/* Dot indicator for tasks */}
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: count > 0 ? (isSel ? "rgba(255,255,255,0.7)" : T.accent) : "transparent" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MOBILE TASK SHEET (bottom sheet for task details on mobile)
// ============================================================
function MobileTaskSheet({ task, onClose, onToggle, onDelete, onSchedule, onDefer, onUpdateText, onUpdateDescription, onUpdatePriority, onUpdateMinutes, onUpdateDueDate, onDelegate, onUnshare, onSplit, onAddSub, onMoveToList, T, lists, isPro, onUpgrade }) {
  const [localText, setLocalText] = useState(task.text);
  const [localDesc, setLocalDesc] = useState(task.description ?? "");
  const [splitText, setSplitText] = useState("");
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState(null);
  const [openProp, setOpenProp] = useState(null);
  const pc = task.priority === "high" ? T.priorityHigh : task.priority === "medium" ? T.priorityMed : T.priorityLow;
  const PRIOS = [{ key: "high", label: L.high, color: T.priorityHigh }, { key: "medium", label: L.medium, color: T.priorityMed }, { key: "low", label: L.low, color: T.priorityLow }];
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
          <button onClick={onClose} aria-label={L.close} style={{ position: "absolute", top: "8px", right: "14px", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "22px", lineHeight: 1, padding: "4px 8px" }}>×</button>
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
            placeholder={L.addDesc} rows={2} maxLength={2000}
            style={{ width: "100%", fontSize: "14px", padding: "10px 12px", borderRadius: "12px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.textSec, resize: "none", boxSizing: "border-box", marginBottom: "16px" }} />
          {/* Collapsible property pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {/* Priority */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>{L.priority}</span>
              {openProp === "priority"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    {PRIOS.map(p => <button key={p.key} onClick={() => { onUpdatePriority(task.id, p.key); setOpenProp(null); }} style={task.priority === p.key ? selPill(p.color) : mutedPill}>{p.label}</button>)}
                  </div>
                : <button onClick={() => setOpenProp("priority")} style={selPill(currP.color)}>{currP.label} ›</button>
              }
            </div>
            {/* Time */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>{L.time}</span>
              {openProp === "time"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    {TIME_OPTIONS.map(o => <button key={o.min} onClick={() => { onUpdateMinutes(task.id, o.min); setOpenProp(null); }} style={task.minutes === o.min ? selPill(T.accent) : mutedPill}>{o.label}</button>)}
                  </div>
                : <button onClick={() => setOpenProp("time")} style={currT ? selPill(T.accent) : mutedPill}>{currT ? `${currT.label} ›` : `${L.choose} ›`}</button>
              }
            </div>
            {/* Schedule */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>{L.when}</span>
              {openProp === "schedule"
                ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                    <button onClick={() => { onSchedule(task.id, "hoy"); setOpenProp(null); }} style={task.scheduledFor === "hoy" ? selPill(T.priorityMed) : mutedPill}>{L.today}</button>
                    <button onClick={() => { onDefer(task.id); setOpenProp(null); }} style={task.scheduledFor === "semana" ? selPill(T.info) : mutedPill}>{L.postpone}</button>
                    {task.scheduledFor && <button onClick={() => { onSchedule(task.id, null); setOpenProp(null); }} style={mutedPill}>{L.remove}</button>}
                  </div>
                : <button onClick={() => setOpenProp("schedule")} style={task.scheduledFor === "hoy" ? selPill(T.priorityMed) : task.scheduledFor === "semana" ? selPill(T.info) : mutedPill}>{task.scheduledFor === "hoy" ? `${L.today} ›` : task.scheduledFor === "semana" ? `${L.postponed} ›` : `${L.noDate} ›`}</button>
              }
            </div>
            {/* List */}
            {lists?.length > 0 && onMoveToList && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px" }}>{L.list}</span>
                {openProp === "list"
                  ? <div style={{ display: "flex", gap: "6px", overflow: "auto" }}>
                      <button onClick={() => { onMoveToList(task.id, null); setOpenProp(null); }} style={!task.listId ? selPill(T.accent) : mutedPill}>{L.noList}</button>
                      {lists.map(l => <button key={l.id} onClick={() => { onMoveToList(task.id, l.id); setOpenProp(null); }} style={task.listId === l.id ? selPill(T.accent) : mutedPill}>{l.name}</button>)}
                    </div>
                  : <button onClick={() => setOpenProp("list")} style={selPill(T.accent)}>{currL ? `${currL.name} ›` : `${L.noList} ›`}</button>
                }
              </div>
            )}
            {/* Due date */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, flexShrink: 0, width: "70px", marginTop: "6px" }}>{L.dueDate}</span>
              <div style={{ position: "relative", flex: 1 }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {(() => { const isOverdue = task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date(); const col = task.dueDate ? (isOverdue ? T.danger : T.accent) : T.textMuted; const d = task.dueDate ? new Date(task.dueDate + "T12:00:00") : null; const label = d ? d.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" }) : L.noDate; return (
                    <button onClick={() => setOpenProp(openProp === "dueDate" ? null : "dueDate")} style={{ ...pillBase, color: col, background: task.dueDate ? `${col}18` : T.overlay, border: `1.5px solid ${task.dueDate ? col + "55" : T.inputBorder}` }}>📅 {label} ›</button>
                  ); })()}
                  {task.dueDate && <button onClick={() => onUpdateDueDate(task.id, null)} style={{ ...mutedPill, padding: "4px 10px", fontSize: "11px" }}>✕</button>}
                </div>
                {openProp === "dueDate" && (
                  <div style={{ marginTop: "8px" }}>
                    <MiniCalendar value={task.dueDate} onChange={v => onUpdateDueDate(task.id, v)} onClose={() => setOpenProp(null)} T={T} />
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Subtasks */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "8px" }}>{L.subtasks} {task.subtasks.length > 0 && `(${task.subtasks.filter(s => s.done).length}/${task.subtasks.length})`}</span>
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
              onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { if (!isPro && (task.subtasks?.length || 0) >= FREE.subs) { onUpgrade(); return; } onAddSub(task.id, splitText.trim()); setSplitText(""); } }}
              placeholder={L.addSubPlaceholder} maxLength={300}
              style={{ width: "100%", fontSize: "14px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px", boxSizing: "border-box" }} />
          </div>
          {/* Actions row: Delegate + Delete at same level */}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", paddingTop: "14px", borderTop: `1px solid ${T.inputBorder}` }}>
            {!task.isShared && (
              onDelegate ? (
                <button onClick={() => setOpenProp(openProp === "delegate" ? null : "delegate")}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1px solid ${T.accent}33`, background: `${T.accent}0A`, color: T.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <span>↗</span> {L.delegate}
                </button>
              ) : (
                <button onClick={onUpgrade}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1px dashed ${T.accent}40`, background: `${T.accent}0A`, color: T.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <span>✦</span> {L.delegate}
                </button>
              )
            )}
            <button onClick={() => { task.isShared ? onUnshare(task.id) : onDelete(task.id); onClose(); }}
              style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `1px solid ${T.danger}33`, background: `${T.danger}0A`, color: T.danger, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              {task.isShared ? L.remove : L.deleteStr}
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
                  onClick={async () => { setDelegateLoading(true); const res = await onDelegate(task.id, delegateEmail); setDelegateLoading(false); setDelegateMsg({ ok: res.ok, text: res.msg || res.error || (res.ok ? "OK" : "Error") }); if (res.ok) setTimeout(onClose, 800); }}
                  style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: T.accent, color: "white", fontWeight: 700, fontSize: "13px", cursor: delegateEmail.includes("@") ? "pointer" : "default", opacity: delegateEmail.includes("@") ? 1 : 0.5 }}>
                  {delegateLoading ? "…" : L.send}
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
// PRO GATE — inline paywall CTA
// ============================================================
function ProGate({ title, subtitle, onUpgrade, T, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "12px", background: `${T.accent}0A`, border: `1px dashed ${T.accent}40`, ...style }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: T.text, margin: 0 }}>✦ {title}</p>
        {subtitle && <p style={{ fontSize: "12px", color: T.textMuted, margin: "2px 0 0", lineHeight: 1.4 }}>{subtitle}</p>}
      </div>
      <button onClick={onUpgrade} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "10px", background: T.accent, color: "white", border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{L.upgrade}</button>
    </div>
  );
}

// ============================================================
// TASK ITEM
// ============================================================
function TaskItem({ task, onToggle, onDelete, onSplit, onAddSub, onSchedule, onDefer, onMove, onUpdateText, onUpdateDescription, onUpdatePriority, onUpdateMinutes, onUpdateDueDate, onDelegate, onUnshare, onMoveToList, isDragging, dragOver, T, autoSplit, lists, activeListId, showAging, isMobile, onOpenSheet, isPro, onUpgrade }) {
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
  const [showCal, setShowCal] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverDelegate, setHoverDelegate] = useState(false);

  const [hoverExpand, setHoverExpand] = useState(false);
  const editRef = useRef(null);
  const ref = useRef(null);
  const pc = task.priority === "high" ? T.priorityHigh : task.priority === "medium" ? T.priorityMed : T.priorityLow;

  const overdueDays = (() => {
    if (!showAging || task.done) return 0;
    const ref = task.scheduledAt || task.createdAt;
    if (!ref) return 0;
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const refMidnight = new Date(ref); refMidnight.setHours(0, 0, 0, 0);
    return Math.floor((todayMidnight - refMidnight) / 86400000);
  })();

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
        borderRadius: isMobile ? "14px" : "16px", padding: task.done ? (isMobile ? "8px 14px" : "8px 14px") : (isMobile ? "10px 14px" : "10px 16px"), marginBottom: isMobile ? "4px" : "4px",
        border: `0.5px solid ${isDragging ? T.accent : task.done ? T.borderDone : T.border}`,
        transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: justDone ? "scale(1.02)" : isDragging ? "scale(1.03)" : "scale(1)",
        boxShadow: T.cardShadow || "none",
        opacity: task.done ? .5 : 1, cursor: task.done ? "default" : isMobile ? "pointer" : "grab", userSelect: "none",
        borderTop: dragOver ? `2px solid ${T.accent}` : undefined, outline: "none",
      }}>
      {justDone && <div aria-hidden="true" style={{ position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)", fontSize: "26px", animation: "popIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>{celeb}</div>}
      {overdueDays > 0 && (
        <span aria-label={`${overdueDays} ${overdueDays !== 1 ? L.daysAgo : "d"} ${L.daysOverdue}`} title={`${overdueDays}d ${L.daysNoComplete}`}
          style={{ position: "absolute", top: isMobile ? "6px" : "8px", right: isMobile ? "6px" : "8px", display: "flex", alignItems: "center", gap: "4px", userSelect: "none",
            fontSize: "10px", fontWeight: 700, color: overdueDays >= 4 ? T.danger : T.textMuted, letterSpacing: "-0.02em" }}>
          {overdueDays}d
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: overdueDays >= 4 ? T.danger : overdueDays >= 2 ? T.priorityMed : T.textFaint }} />
        </span>
      )}
      <div style={{ display: "flex", alignItems: expanded ? "flex-start" : "center", gap: task.done ? "8px" : "10px" }}>
        <button role="checkbox" aria-checked={task.done} onClick={e => { if (isMobile) e.stopPropagation(); handleToggle(); }}
          style={{ width: task.done ? "16px" : "20px", height: task.done ? "16px" : "20px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${task.done ? T.success : pc}`, background: task.done ? T.success : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: expanded ? "2px" : 0 }}>
          {task.done && <svg aria-hidden="true" width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={e => { if (isMobile || task.done || editingText) return; e.stopPropagation(); setExpanded(v => !v); }} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: task.done ? "default" : "pointer" }}>
            {editingText && !isMobile ? (
              <input ref={editRef} value={localEditText} onChange={e => setLocalEditText(e.target.value)} maxLength={500}
                onClick={e => e.stopPropagation()}
                onBlur={() => { const v = localEditText.trim(); if (v && v !== task.text) onUpdateText(task.id, v); else setLocalEditText(task.text); setEditingText(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setLocalEditText(task.text); setEditingText(false); } }}
                style={{ fontSize: "14px", fontWeight: 500, color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", padding: "2px 8px", outline: "none", flex: 1, fontFamily: "'DM Sans', sans-serif", minWidth: 0 }} />
            ) : (
              <span onClick={e => { if (isMobile || task.done) return; if (expanded) { e.stopPropagation(); setEditingText(true); setLocalEditText(task.text); setTimeout(() => editRef.current?.focus(), 0); } }}
                style={{ fontSize: task.done ? "13px" : "14px", fontWeight: 500, color: task.done ? T.textFaint : T.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, flex: 1, cursor: task.done ? "default" : "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.text}</span>
            )}
            {!task.done && task.subtasks.length > 0 && !expanded && (
              <span style={{ fontSize: "10px", color: T.textFaint, background: T.overlay, padding: "1px 7px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}>
                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
              </span>
            )}
            {!activeListId && task.listId && !expanded && (() => { const l = lists?.find(x => x.id === task.listId); return l ? <span style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "1px 7px", borderRadius: "6px", flexShrink: 0, whiteSpace: "nowrap", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "middle" }}>{l.name}</span> : null; })()}
            {!expanded && task.dueDate && !task.done && (() => { const isOverdue = new Date(task.dueDate + "T23:59:59") < new Date(); const d = new Date(task.dueDate + "T12:00:00"); const label = d.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" }); return <span style={{ fontSize: "10px", fontWeight: 700, color: isOverdue ? T.danger : T.textMuted, background: isOverdue ? `${T.danger}14` : T.overlay, border: `1px solid ${isOverdue ? T.danger + "33" : T.inputBorder}`, padding: "1px 7px", borderRadius: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>{label}</span>; })()}
            {!task.done && !isMobile && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                onMouseEnter={() => setHoverExpand(true)} onMouseLeave={() => setHoverExpand(false)}
                title={expanded ? L.collapse : L.details}
                style={{ background: (cardHovered || hoverExpand || expanded) ? T.overlay : "none", border: "none", cursor: "pointer", padding: "4px 10px", color: expanded ? T.text : (cardHovered || hoverExpand) ? T.textSec : T.textMuted, fontSize: "13px", lineHeight: 1, borderRadius: "8px", transition: "all 0.15s", flexShrink: 0 }}>
                {expanded ? "▴" : "▾"}
              </button>
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
                placeholder={L.addDesc}
                rows={2}
                maxLength={2000}
                style={{ width: "100%", fontSize: "13px", padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${localDesc ? T.accent + "44" : T.inputBorder}`, background: T.surface, outline: "none", color: T.text, resize: "vertical", boxSizing: "border-box", marginBottom: "12px", lineHeight: 1.5 }}
              />
              {/* Properties */}
              {(() => {
                const PRIOS = [{ key: "high", label: L.high, color: T.priorityHigh }, { key: "medium", label: L.medium, color: T.priorityMed }, { key: "low", label: L.low, color: T.priorityLow }];
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
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>{L.priority}</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {openProp === "priority"
                          ? PRIOS.map(p => <button key={p.key} onClick={() => { onUpdatePriority(task.id, p.key); setOpenProp(null); }} style={task.priority === p.key ? selPill(p.color) : mutedPill}>{p.label}</button>)
                          : <button onClick={() => setOpenProp("priority")} style={selPill(currP.color)}>{currP.label} ▾</button>
                        }
                      </div>
                    </div>
                    {/* Time */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>{L.time}</span>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {openProp === "time"
                          ? TIME_OPTIONS.map(o => <button key={o.min} onClick={() => { onUpdateMinutes(task.id, o.min); setOpenProp(null); }} style={task.minutes === o.min ? selPill(T.accent) : mutedPill}>{o.label}</button>)
                          : <button onClick={() => setOpenProp("time")} style={currT ? selPill(T.accent) : mutedPill}>{currT ? `${currT.label} ▾` : `${L.choose} ▾`}</button>
                        }
                      </div>
                    </div>
                    {/* Lista */}
                    {lists?.length > 0 && onMoveToList && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0 }}>{L.list}</span>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {openProp === "list"
                            ? <>
                                <button onClick={() => { onMoveToList(task.id, null); setOpenProp(null); }} style={!task.listId ? selPill(T.accent) : mutedPill}>{L.noList}</button>
                                {lists.map(l => <button key={l.id} onClick={() => { onMoveToList(task.id, l.id); setOpenProp(null); }} style={task.listId === l.id ? selPill(T.accent) : mutedPill}>{l.name}</button>)}
                              </>
                            : <button onClick={() => setOpenProp("list")} style={selPill(T.accent)}>{currL ? `${currL.name} ▾` : `${L.noList} ▾`}</button>
                          }
                        </div>
                      </div>
                    )}
                    {/* Due date */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, width: "72px", flexShrink: 0, marginTop: "4px" }}>{L.dueDate}</span>
                      <div>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          {(() => { const isOverdue = task.dueDate && new Date(task.dueDate + "T23:59:59") < new Date(); const col = task.dueDate ? (isOverdue ? T.danger : T.accent) : T.textMuted; const d = task.dueDate ? new Date(task.dueDate + "T12:00:00") : null; const label = d ? d.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" }) : L.noDate; return (
                            <button onClick={() => setShowCal(v => !v)} style={{ ...pillBase, color: col, background: task.dueDate ? `${col}18` : T.overlay, border: `1.5px solid ${task.dueDate ? col + "55" : T.inputBorder}` }}>📅 {label} ▾</button>
                          ); })()}
                          {task.dueDate && <button onClick={() => onUpdateDueDate(task.id, null)} style={{ ...mutedPill, padding: "3px 8px", fontSize: "10px" }}>✕</button>}
                        </div>
                        {showCal && (
                          <div style={{ marginTop: "8px" }}>
                            <MiniCalendar value={task.dueDate} onChange={v => onUpdateDueDate(task.id, v)} onClose={() => setShowCal(false)} T={T} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Subtasks */}
              <div style={{ borderTop: `1px solid ${T.inputBorder}`, paddingTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted }}>{L.subtasks}</span>
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
                    <li style={{ listStyle: "none" }}><input ref={ref} aria-label={`Agregar subtarea a ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { if (!isPro && task.subtasks.length >= FREE.subs) { onUpgrade(); return; } onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); } }} placeholder={L.addSubPlaceholder} maxLength={300} style={{ width: "100%", fontSize: "13px", padding: "5px 8px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px" }} /></li>
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
                      placeholder={L.firstSubtask} style={{ width: "100%", fontSize: "14px", padding: "7px 10px", borderRadius: "10px", border: `1.5px solid ${T.split}33`, background: `${T.split}08`, outline: "none", color: T.text, boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
              {/* Action row */}
              <div style={{ display: "flex", gap: "6px", marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${T.inputBorder}`, flexWrap: "wrap" }}>
                {onSchedule && !task.scheduledFor && (
                  <button onClick={e => { e.stopPropagation(); onSchedule(task.id); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.accent, background: `${T.accent}14`, border: `1.5px solid ${T.accent}33` }}>{L.toToday}</button>
                )}
                {onDefer && task.scheduledFor === "hoy" && (
                  <button onClick={e => { e.stopPropagation(); onDefer(task.id); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.textMuted, background: T.overlay, border: `1.5px solid ${T.inputBorder}` }}>{L.postpone}</button>
                )}
                {onSchedule && (task.scheduledFor === "semana" || !task.scheduledFor) && (
                  <button onClick={e => { e.stopPropagation(); onSchedule(task.id, "hoy"); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.accent, background: `${T.accent}14`, border: `1.5px solid ${T.accent}33` }}>{L.prioritize}</button>
                )}
                {!task.isShared && (onDelegate ? (
                  <button onClick={e => { e.stopPropagation(); setShowDelegate(!showDelegate); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.shared || T.info, background: `${T.shared || T.info}14`, border: `1.5px solid ${T.shared || T.info}33` }}>{L.delegate}</button>
                ) : onUpgrade && (
                  <button onClick={e => { e.stopPropagation(); onUpgrade(); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.accent, background: `${T.accent}0A`, border: `1.5px dashed ${T.accent}40` }}>✦ {L.delegate}</button>
                ))}
                {task.assigneeEmail && !task.isShared && onUnshare && (
                  <button onClick={e => { e.stopPropagation(); onUnshare(task.id); }}
                    style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.danger, background: `${T.danger}14`, border: `1.5px solid ${T.danger}33` }}>{L.revoke}</button>
                )}
                <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                  style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", cursor: "pointer", color: T.danger, background: `${T.danger}14`, border: `1.5px solid ${T.danger}33`, marginLeft: "auto" }}>{L.deleteStr}</button>
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
          <p style={{ fontSize: "12px", color: T.textMuted, fontWeight: 600, marginBottom: "8px" }}>{L.delegateTo}</p>
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
                  setDelegateMsg({ type: "ok", text: result.status === "shared" ? L.taskShared : L.inviteSent });
                  setTimeout(() => { setShowDelegate(false); setDelegateMsg(null); }, 2000);
                } else {
                  setDelegateMsg({ type: "err", text: result.error || L.delegateError });
                }
              }}
              style={{ padding: "7px 14px", borderRadius: "10px", border: "none", background: delegateEmail.includes("@") && !delegateLoading ? T.accent : T.inputBorder, color: delegateEmail.includes("@") && !delegateLoading ? "white" : T.textFaint, fontSize: "13px", fontWeight: 700, cursor: delegateEmail.includes("@") && !delegateLoading ? "pointer" : "default", whiteSpace: "nowrap" }}>
              {delegateLoading ? "…" : L.send}
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
  const [existingEmail, setExistingEmail] = useState(false);
  const T = dark ? themes.dark : themes.light;

  const handleResend = async () => {
    setResendLoading(true);
    try { await resendConfirmation(email); setResendSent(true); }
    catch (e) { /* silently ignore */ }
    finally { setResendLoading(false); }
  };

  const validate = () => {
    const e = {};
    if (mode === "register" && !name.trim()) e.name = L.enterName;
    if (!email.trim()) e.email = L.enterEmail;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = L.invalidEmail;
    if (mode !== "forgot") {
      if (!pass) e.pass = L.enterPass;
      else if (pass.length < 6) e.pass = L.min6chars;
    }
    if (mode === "register" && pass !== passConfirm) e.passConfirm = L.passNoMatch;
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
        setSuccess(L.emailSentReset);
      } else if (mode === "login") {
        const { data, error } = await signIn(email, pass);
        if (error) throw error;
        onLogin(data.user);
      } else {
        const { data, error } = await signUp(email, pass, name || email.split("@")[0]);
        if (error) throw error;
        // Supabase returns empty identities when email already exists
        if (data.user && data.user.identities?.length === 0) {
          setErrors({ general: L.existingAccount });
          setExistingEmail(true);
          setLoading(false);
          return;
        }
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
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>{L.checkEmail}</h2>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "6px" }}>{L.confirmLinkSent}</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "16px", wordBreak: "break-all" }}>{email}</p>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "28px", whiteSpace: "pre-line" }}>
              {L.clickLink}
            </p>
            {resendSent ? (
              <p role="alert" style={{ fontSize: "13px", color: T.success, fontWeight: 600, marginBottom: "16px" }}>{L.emailResent}</p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendLoading}
                style={{ width: "100%", background: T.overlay, border: `1px solid ${T.inputBorder}`, borderRadius: "12px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, color: T.textMuted, cursor: resendLoading ? "wait" : "pointer", marginBottom: "12px", fontFamily: "'DM Sans', sans-serif" }}>
                {resendLoading ? L.resending : L.resendEmail}
              </button>
            )}
            <button type="button" onClick={() => { setMode("login"); setSuccess(""); setResendSent(false); }}
              style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              {L.backToLogin}
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
            {mode === "login" ? L.welcomeBack : mode === "register" ? L.startOrganizing : L.recoverAccount}
          </p>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <button onClick={() => setDark(!dark)} aria-label={dark ? L.lightMode : L.darkMode} aria-pressed={dark}
            style={{ background: T.overlay, border: "none", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            {dark ? "☀️" : "🌙"} {dark ? L.lightMode : L.darkMode}
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div role="alert" style={{ background: `${T.success}1A`, border: `1px solid ${T.success}4D`, borderRadius: "14px", padding: "14px 16px", marginBottom: "16px", fontSize: "13px", color: T.success, fontWeight: 600, textAlign: "center" }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate aria-label={mode === "login" ? L.signIn : mode === "register" ? L.createAccount : L.recoverAccount}
          style={{ background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {mode === "register" && (
              <div>
                <label htmlFor="auth-name" style={labelStyle}>{L.name}</label>
                <input id="auth-name" type="text" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} placeholder={L.yourName} autoComplete="given-name" style={inputStyle("name")} />
                {errors.name && <p role="alert" style={errorStyle}>{errors.name}</p>}
              </div>
            )}
            <div>
              <label htmlFor="auth-email" style={labelStyle}>{L.email}</label>
              <input id="auth-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); setSuccess(""); }} placeholder="tu@email.com" autoComplete="email" style={inputStyle("email")} />
              {errors.email && <p role="alert" style={errorStyle}>{errors.email}</p>}
            </div>
            {mode !== "forgot" && (
              <div>
                <label htmlFor="auth-pass" style={labelStyle}>{L.password}</label>
                <div style={{ position: "relative" }}>
                  <input id="auth-pass" type={showPass ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setErrors(p => ({ ...p, pass: undefined })); }}
                    placeholder={mode === "register" ? L.min6chars : L.yourPass} autoComplete={mode === "login" ? "current-password" : "new-password"} style={{ ...inputStyle("pass"), paddingRight: "48px" }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? L.hidePass : L.showPass}
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
                <label htmlFor="auth-pass-confirm" style={labelStyle}>{L.confirmPass}</label>
                <input id="auth-pass-confirm" type="password" value={passConfirm} onChange={e => { setPassConfirm(e.target.value); setErrors(p => ({ ...p, passConfirm: undefined })); }} placeholder={L.repeatPass} autoComplete="new-password" style={inputStyle("passConfirm")} />
                {errors.passConfirm && <p role="alert" style={errorStyle}>{errors.passConfirm}</p>}
              </div>
            )}
          </div>

          {/* Forgot password link */}
          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", fontSize: "12px", color: T.danger, fontWeight: 600, cursor: "pointer", marginTop: "8px", padding: 0 }}>
              {L.forgotPass}
            </button>
          )}

          {/* General API error */}
          {errors.general && (
            <div role="alert" style={{ background: `${T.danger}1A`, border: `1px solid ${T.danger}4D`, borderRadius: "12px", padding: "12px 14px", marginTop: "12px", fontSize: "13px", color: T.danger, fontWeight: 500 }}>
              {errors.general}
              {existingEmail && (
                <button onClick={() => { setMode("login"); setErrors({}); setExistingEmail(false); }}
                  style={{ display: "block", marginTop: "8px", background: "none", border: "none", color: T.accent, fontSize: "13px", fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: "3px" }}>
                  {L.signInArrow}
                </button>
              )}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", background: loading ? T.inputBorder : T.accent, color: "white", border: "none", fontSize: "15px", fontWeight: 700, cursor: loading ? "wait" : "pointer", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {mode === "login" ? L.signIn : mode === "register" ? L.createAccount : L.sendLink}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textMuted }}>
          {mode === "login" ? L.noAccount : mode === "register" ? L.haveAccount : ""}
          {mode === "forgot" ? (
            <button type="button" onClick={() => { setMode("login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>{L.backToStart}</button>
          ) : (
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              {mode === "login" ? L.createOne : L.goSignIn}
            </button>
          )}
        </p>

        {/* Terms */}
        {mode === "register" && (
          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: T.textFaint, lineHeight: 1.5 }}>
            {L.termsText} <button type="button" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>{L.terms}</button> {L.andThe} <button type="button" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>{L.privacyPolicy}</button>
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

const NOTE_TYPE_LABELS = { note: L.note, list: L.noteList, media: L.noteLink };

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
        <button onClick={e => { e.stopPropagation(); onDelete(note.id); }} aria-label={L.deleteNote}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "18px",
            padding: "0 2px", lineHeight: 1, opacity: hov ? .7 : 0, transition: "opacity 0.15s ease" }}>×</button>
      </div>

      {/* ── Note ── */}
      {type === "note" && (
        <textarea ref={taRef} value={note.text || ""} onChange={e => onChange({ ...note, text: e.target.value })}
          placeholder={L.writeSomething} onPointerDown={e => e.stopPropagation()}
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
            placeholder={L.pasteUrl}
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
        <button onClick={onCollapse} aria-label={L.collapseCanvas}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "18px", padding: "4px 6px", lineHeight: 1, borderRadius: "8px" }}>›</button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}><span style={{ color: T.accent }}>✦</span> {L.canvas}</span>
        <span style={{ fontSize: "11px", color: T.textFaint }}>{L.dblClickToAdd}</span>
        {notes.length > 0 && <span style={{ fontSize: "11px", color: T.textFaint, background: T.overlay, padding: "3px 9px", borderRadius: "7px" }}>{notes.length}</span>}
        {notes.length > 1 && (
          <button onClick={autoDistribute} title={L.distributeNotes} aria-label={L.distributeNotes}
            onMouseEnter={() => setHovDist(true)} onMouseLeave={() => setHovDist(false)}
            style={{ marginLeft: "auto", background: hovDist ? T.overlay : "transparent", color: hovDist ? T.text : T.textMuted, border: `1px solid ${hovDist ? T.border : T.inputBorder}`, borderRadius: "10px", padding: "7px 10px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="1" width="4" height="4" rx="1"/><rect x="9" y="1" width="4" height="4" rx="1"/>
              <rect x="1" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/>
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 600, maxWidth: hovDist ? "80px" : "0", overflow: "hidden", whiteSpace: "nowrap", transition: "max-width 0.2s" }}>{L.distribute}</span>
          </button>
        )}
        <button onClick={addBtn} style={{ marginLeft: notes.length > 1 ? "6px" : "auto", background: T.accent, color: dark ? "#1C1C1E" : "white", border: "none", borderRadius: "10px", padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{L.addNote}</button>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {notes.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "34px", marginBottom: "10px", opacity: .5 }}>📝</div>
              <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 600 }}>{L.emptyCanvas}</p>
              <p style={{ fontSize: "12px", color: T.textFaint, marginTop: "4px", lineHeight: 1.5 }}>{L.emptyCanvasHint} <span style={{ color: T.accent, fontWeight: 600 }}>{L.addNote}</span></p>
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
    if (newPass.length < 6) { setMsg({ type: "err", text: L.min6chars }); return; }
    if (newPass !== newPassConfirm) { setMsg({ type: "err", text: L.passNoMatch }); return; }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setMsg({ type: "err", text: L.linkExpired });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);
    if (error) { setMsg({ type: "err", text: error.message }); return; }
    setMsg({ type: "ok", text: L.passUpdated });
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
          <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 500 }}>{L.createNewPass}</p>
        </div>
        <form onSubmit={handleSubmit} noValidate
          style={{ background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={lbl}>{L.newPassword}</label>
              <input type="password" value={newPass} onChange={e => { setNewPass(e.target.value); setMsg(null); }}
                placeholder={L.min6chars} autoComplete="new-password" autoFocus style={inp} />
            </div>
            <div>
              <label style={lbl}>{L.repeatNewPass}</label>
              <input type="password" value={newPassConfirm} onChange={e => { setNewPassConfirm(e.target.value); setMsg(null); }}
                placeholder={L.repeatNewPassPlaceholder} autoComplete="new-password" style={inp} />
            </div>
          </div>
          {msg && (
            <p role="alert" style={{ fontSize: "12px", color: msg.type === "ok" ? T.success : T.danger, fontWeight: 600, marginTop: "12px" }}>{msg.text}</p>
          )}
          <button type="submit" disabled={loading || !newPass || !newPassConfirm} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: (loading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !loading) ? T.accent : T.inputBorder, color: (newPass && newPassConfirm && !loading) ? "white" : T.textFaint }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {loading ? L.saving : L.savePassword}
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
    scheduledAt: t.scheduled_at ? new Date(t.scheduled_at).getTime() : null,
    description: t.description ?? "",
    dueDate: t.due_date ?? null,
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
    scheduled_at: t.scheduledAt ? new Date(t.scheduledAt).toISOString() : null,
    description: t.description ?? null,
    due_date: t.dueDate ?? null,
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
  const [coachMsg, setCoachMsg] = useState('');
  const [coachDisplayed, setCoachDisplayed] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatBubble, setChatBubble] = useState(false); // show floating bubble after first chat
  const [coachBubbleHover, setCoachBubbleHover] = useState(false);
  const chatEndRef = useRef(null);

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
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState(null); // { type: "ok"|"err", text }
  const accountRef = useRef(null);
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
  // Subscription
  const [subscription, setSubscription] = useState(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing';
  // PWA install
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const showUpgrade = () => setShowProModal(true);
  // Calendar mode
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('todone_viewMode') || 'calendar'; } catch { return 'calendar'; }
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [overdueRescheduleId, setOverdueRescheduleId] = useState(null);
  const isCalendarMode = viewMode === 'calendar';
  const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafariMac = typeof navigator !== "undefined" && /Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
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
  const totalPendingAll = tasks.filter(t => !t.done).length; // global count for freemium gate

  // Calendar mode derived data
  const todayDateStr = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);
  const fmtDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  // Compute 7 days of the selected week (Mon-Sun)
  const calendarWeekDays = useMemo(() => {
    if (!isCalendarMode) return [];
    const sel = new Date(selectedDate + "T12:00:00");
    const day = sel.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(sel); mon.setDate(sel.getDate() + diff);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(mon); dd.setDate(mon.getDate() + i);
      days.push(fmtDateStr(dd));
    }
    return days;
  }, [selectedDate, isCalendarMode]);
  // Tasks grouped by date for the week
  const calendarWeekTasksMap = useMemo(() => {
    if (!isCalendarMode) return {};
    const map = {};
    calendarWeekDays.forEach(ds => {
      map[ds] = visibleTasks.filter(t => !t.done && t.dueDate === ds).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return map;
  }, [visibleTasks, calendarWeekDays, isCalendarMode]);
  const calendarNoDateTasks = useMemo(() => {
    if (!isCalendarMode) return [];
    return visibleTasks.filter(t => !t.done && !t.dueDate).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [visibleTasks, isCalendarMode]);
  const overdueTasks = useMemo(() => {
    return visibleTasks.filter(t => !t.done && t.dueDate && t.dueDate < todayDateStr).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
  }, [visibleTasks, todayDateStr]);
  // Count tasks per date for calendar dots
  const taskCountByDate = useMemo(() => {
    if (!isCalendarMode) return {};
    const counts = {};
    visibleTasks.filter(t => !t.done && t.dueDate).forEach(t => { counts[t.dueDate] = (counts[t.dueDate] || 0) + 1; });
    return counts;
  }, [visibleTasks, isCalendarMode]);
  const overloaded = todayMin > WORKDAY_MINUTES;


  // Keep tasksRef in sync so fetchAiSuggestions always has current data
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

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

  const fetchCoach = async () => {
    const currentTasks = tasksRef.current;
    setCoachLoading(true);
    try {
      const todayT = currentTasks.filter(t => !t.done && t.scheduledFor === 'hoy');
      const weekT = currentTasks.filter(t => !t.done && t.scheduledFor === 'semana');
      const deferredT = currentTasks.filter(t => !t.done && !t.scheduledFor);
      const doneToday = currentTasks.filter(t => t.done && t.doneAt && Date.now() - t.doneAt < 86400000).length;
      const unscheduledN = deferredT.length;
      const todayMin = todayT.reduce((s, t) => s + (t.minutes || 0), 0);

      const getOverdueDays = (t) => {
        const ref = t.scheduledAt || t.createdAt;
        if (!ref) return 0;
        const now = new Date(); now.setHours(0,0,0,0);
        const r = new Date(ref); r.setHours(0,0,0,0);
        return Math.floor((now - r) / 86400000);
      };

      const overdueTasks = todayT.filter(t => getOverdueDays(t) >= 2).map(t => ({
        text: t.text, overdueDays: getOverdueDays(t),
      }));

      // Richer stats
      const allDone = currentTasks.filter(t => t.done);
      const last7days = allDone.filter(t => t.doneAt && Date.now() - t.doneAt < 7 * 86400000);
      const avgPerDay = last7days.length > 0 ? Math.round(last7days.length / 7 * 10) / 10 : 0;
      const delegated = currentTasks.filter(t => t.sharedWith || t.sharedBy);
      const withDueDate = currentTasks.filter(t => !t.done && t.dueDate);
      const overdueDue = withDueDate.filter(t => t.dueDate < Date.now());
      const hasSubtasks = currentTasks.filter(t => !t.done && t.subtasks?.length > 0);
      const oldestPending = [...todayT, ...weekT, ...deferredT].sort((a, b) => (a.createdAt || Infinity) - (b.createdAt || Infinity))[0];

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTasks: todayT.slice(0, 8).map(t => ({ text: t.text, priority: t.priority, minutes: t.minutes, overdueDays: getOverdueDays(t), hasSubs: t.subtasks?.length > 0, dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString(DATE_LOCALE) : null })),
          weekTasks: weekT.slice(0, 5).map(t => ({ text: t.text, priority: t.priority })),
          deferredTasks: deferredT.slice(0, 5).map(t => ({ text: t.text, overdueDays: getOverdueDays(t) })),
          overdueTasks,
          doneTodayCount: doneToday,
          todayMinutes: todayMin,
          workdayMinutes: WORKDAY_MINUTES,
          unscheduledCount: unscheduledN,
          streak,
          hour: new Date().getHours(),
          userName: getUserName(user),
          // Enriched stats
          avgCompletedPerDay: avgPerDay,
          completedLast7Days: last7days.length,
          totalPending: currentTasks.filter(t => !t.done).length,
          delegatedCount: delegated.length,
          overdueByDueDate: overdueDue.map(t => ({ text: t.text, dueDate: new Date(t.dueDate).toLocaleDateString(DATE_LOCALE) })),
          tasksWithSubtasks: hasSubtasks.length,
          oldestPendingTask: oldestPending ? { text: oldestPending.text, daysOld: getOverdueDays(oldestPending) } : null,
          locale: LOCALE,
        }),
      });
      if (!res.ok) { setCoachLoading(false); return; }
      const data = await res.json();
      if (data.message) {
        setCoachMsg(data.message);
        setCoachDisplayed('');
      }
    } catch (e) {
      console.error('[coach] error:', e);
    } finally {
      setCoachLoading(false);
    }
  };

  const getTaskContext = () => {
    const currentTasks = tasksRef.current;
    const todayT = currentTasks.filter(t => !t.done && t.scheduledFor === 'hoy');
    const weekT = currentTasks.filter(t => !t.done && t.scheduledFor === 'semana');
    const deferredT = currentTasks.filter(t => !t.done && !t.scheduledFor);
    const doneToday = currentTasks.filter(t => t.done && t.doneAt && Date.now() - t.doneAt < 86400000).length;
    return `Hora: ${new Date().getHours()}hs. Racha: ${streak} días.
Hoy: ${todayT.length > 0 ? todayT.map(t => `"${t.text}"`).join(', ') : 'ninguna'} (${todayT.reduce((s, t) => s + (t.minutes || 0), 0)}min)
Semana: ${weekT.length > 0 ? weekT.slice(0, 5).map(t => `"${t.text}"`).join(', ') : 'ninguna'}
Pospuestas: ${deferredT.length}. Completadas hoy: ${doneToday}.`;
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          taskContext: getTaskContext(),
          userName: getUserName(user),
          locale: LOCALE,
        }),
      });
      if (!res.ok) throw new Error('Chat error');
      const data = await res.json();
      if (data.message) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (e) {
      console.error('[chat]', e);
      setChatMessages(prev => [...prev, { role: 'assistant', content: L.couldNotReply }]);
    } finally {
      setChatLoading(false);
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

  // Fetch coach message on load and when tasks change meaningfully
  useEffect(() => {
    if (!dbLoaded) return;
    const delay = coachMsg ? 15000 : 1200;
    const timer = setTimeout(fetchCoach, delay);
    return () => clearTimeout(timer);
  }, [dbLoaded, pendingCount, completedToday]); // eslint-disable-line react-hooks/exhaustive-deps

  // Typing animation for coach message
  useEffect(() => {
    if (!coachMsg) return;
    setCoachDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setCoachDisplayed(coachMsg.slice(0, i));
      if (i >= coachMsg.length) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [coachMsg]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

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

  // Fetch subscription status
  useEffect(() => {
    supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setSubscription(data); setSubLoaded(true); });
  }, [user.id]);

  // Handle upgrade success from Stripe redirect
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setShowUpgradeSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
      // Poll subscription status until active (webhook may take a few seconds)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
        if (data?.status === 'active' || data?.status === 'trialing') {
          setSubscription(data); setSubLoaded(true);
          clearInterval(poll);
        }
        if (attempts >= 10) clearInterval(poll);
      }, 2000);
      setTimeout(() => setShowUpgradeSuccess(false), 6000);
      return () => clearInterval(poll);
    }
  }, [user.id]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
    const name = n.from_name || n.from_email || L.someone;
    const text = n.task_text.length > 40 ? n.task_text.slice(0, 40) + '…' : n.task_text;
    switch (n.type) {
      case 'task_delegated': return `${name} ${L.delegatedTo}: "${text}"`;
      case 'task_completed': return `${name} ${L.completedTask}: "${text}"`;
      case 'task_modified': return `${name} ${L.modifiedTask}: "${text}"`;
      default: return `${name}: "${text}"`;
    }
  };

  const timeAgo = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return L.now;
    if (mins < 60) return LOCALE === 'en' ? `${mins} ${L.minAgo}` : `${L.ago} ${mins} ${L.minAgo}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return LOCALE === 'en' ? `${hours}${L.hAgo}` : `${L.ago} ${hours}${L.hAgo}`;
    const days = Math.floor(hours / 24);
    if (days === 1) return L.yesterday;
    if (days < 7) return LOCALE === 'en' ? `${days} ${L.daysAgo}` : `${L.ago} ${days} ${L.daysAgo}`;
    return new Date(isoStr).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });
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
    // Debounce AI upgrade — Pro only
    if (!isPro) return;
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

  const startCheckout = async () => {
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { console.error('Checkout error:', err); }
  };

  const addTask = () => {
    if (!newTask.trim() || addingTask) return;
    if (!isPro && totalPendingAll >= FREE.tasks) { showUpgrade(); return; }
    setAddingTask(true);
    const ai = aiResult || aiSuggest(newTask);
    const sched = aiAccepted.schedule && ai.scheduledFor ? ai.scheduledFor : newSchedule || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana");
    const calDueDate = isCalendarMode ? selectedDate : null;
    const calSched = isCalendarMode ? (selectedDate === todayDateStr ? "hoy" : "semana") : sched;
    const t = { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: aiAccepted.priority && ai.priority ? ai.priority : newPriority, minutes: aiAccepted.minutes && ai.minutes ? ai.minutes : newMinutes, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: calSched, scheduledAt: calSched === "hoy" ? Date.now() : null, dueDate: calDueDate, order: -1 };
    setTasks(prev => { const p = [t, ...prev.filter(x => !x.done)].map((x, i) => ({ ...x, order: i })); return [...p, ...prev.filter(x => x.done)]; });
    dbInsert(t);
    setAnnounce(`Tarea "${ai.cleanText}" agregada`);
    setNewTask(""); setNewPriority("medium"); setNewMinutes(30); setNewSchedule(null); setAiResult(null); setAiAccepted({ priority: false, schedule: false, minutes: false }); setShowAdd(false); setAddingTask(false); playAdd();
  };
  const quickDumpAdd = () => {
    if (!quickText.trim() || addingTask) return;
    const lines = quickText.split("\n").filter(l => l.trim());
    if (!isPro && totalPendingAll + lines.length > FREE.tasks) { showUpgrade(); return; }
    setAddingTask(true);
    const nt = lines.map((line, i) => { const ai = aiSuggest(line); const s = ai.scheduledFor || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"); return { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: ai.priority || "medium", minutes: ai.minutes || 30, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: s, scheduledAt: s === "hoy" ? Date.now() : null, order: i }; });
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
    const existing = tasks.find(t => t.id === id)?.subtasks || [];
    if (!isPro && existing.length >= FREE.subs) { showUpgrade(); return; }
    const newSubs = [...existing, { text, done: false }];
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
  const updateDueDate = (id, dueDate) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, dueDate } : t));
    dbUpdate(id, { due_date: dueDate });
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
      return { ok: false, error: L.noConnection };
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
    if (!isPro && lists.length >= FREE.lists) { setShowAddList(false); setNewListName(""); showUpgrade(); return; }
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
    const now = when === "hoy" ? Date.now() : null;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: when, scheduledAt: when === "hoy" ? (t.scheduledAt || now) : null } : t));
    const existing = tasks.find(x => x.id === id);
    dbUpdate(id, { scheduled_for: when ?? null, scheduled_at: when === "hoy" ? (existing?.scheduledAt ? new Date(existing.scheduledAt).toISOString() : new Date(now).toISOString()) : null });
    if (existing) notifyModified(existing);
    playClick();
  };
  const deferTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: "semana", scheduledAt: null } : t));
    dbUpdate(id, { scheduled_for: "semana", scheduled_at: null });
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
  const greeting = hour < 12 ? L.goodMorning : hour < 18 ? L.goodAfternoon : L.goodEvening;

  const renderList = (list, showAging = false) => list.map((task, i) => (
    <div key={task.id} draggable={!task.done && !isMobile} onDragStart={e => dStart(e, task.id)} onDragOver={e => dOver(e, task.id)} onDrop={e => dDrop(e, task.id)} onDragEnd={dEnd} style={{ animation: `fadeInUp 0.3s ease ${i * .03}s both` }}>
      <TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onUpdateDueDate={updateDueDate} onDelegate={isPro ? delegateTask : null} onUnshare={unshareTask} onMoveToList={moveToList} isDragging={dragId === task.id} dragOver={dragOverId === task.id && dragId !== task.id} T={T} autoSplit={splitTargetId === task.id} lists={lists} activeListId={activeListId} showAging={showAging} isMobile={isMobile} onOpenSheet={setMobileSheetTask} isPro={isPro} onUpgrade={showUpgrade} />
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
        @keyframes popInCenter{0%{transform:translate(-50%,-50%) scale(0);opacity:0}60%{transform:translate(-50%,-50%) scale(1.05)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
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
        .list-scroll::-webkit-scrollbar{display:none}
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
            <button onClick={() => { if (!isPro && mobileView === "list") { showUpgrade(); return; } setMobileView(v => v === "list" ? "canvas" : "list"); playClick(); }} aria-label={mobileView === "canvas" ? L.viewList : L.viewCanvas} style={{ background: mobileView === "canvas" ? T.accent : T.overlay, color: mobileView === "canvas" ? (dark ? "#1C1C1E" : "#fff") : T.textFaint, border: "none", borderRadius: "10px", padding: "8px 10px", fontSize: "14px", cursor: "pointer" }}>
              <span aria-hidden="true">{mobileView === "canvas" ? "☰" : "◫"}</span>
            </button>
          )}
          {/* Sound toggle */}
          <button onClick={toggleSound} aria-label={soundOn ? L.silenceSounds : L.enableSounds} aria-pressed={soundOn}
            style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: soundOn ? T.textMuted : T.textFaint, opacity: soundOn ? 1 : 0.45, transition: "opacity 0.2s" }}>
            {soundOn
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h2l4-4v12L4 10H2z"/><path d="M11 5a4 4 0 0 1 0 6"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h2l4-4v12L4 10H2z"/><line x1="13" y1="5" x2="9" y2="11"/></svg>
            }
          </button>
          {/* Theme toggle */}
          <button onClick={() => { setDark(d => !d); }} aria-label={dark ? L.lightMode : L.darkMode} aria-pressed={dark}
            style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "color 0.2s" }}>
            {dark
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3.5"/><line x1="8" y1="1" x2="8" y2="2.5"/><line x1="8" y1="13.5" x2="8" y2="15"/><line x1="1" y1="8" x2="2.5" y2="8"/><line x1="13.5" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.1" y2="4.1"/><line x1="11.9" y1="11.9" x2="12.95" y2="12.95"/><line x1="12.95" y1="3.05" x2="11.9" y2="4.1"/><line x1="4.1" y1="11.9" x2="3.05" y2="12.95"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z"/></svg>
            }
          </button>
          {/* Notification bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowNotifications(v => !v); if (!showNotifications && unreadCount > 0) markAllNotificationsRead(); playClick(); }}
              aria-label={`${L.notifications}${unreadCount > 0 ? ` (${unreadCount} ${L.unread})` : ""}`} aria-expanded={showNotifications} aria-haspopup="true"
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
              <div role="menu" aria-label={L.notifications}
                style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "320px", maxHeight: "400px", overflowY: "auto", background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "8px", zIndex: 200, animation: "slideDown 0.2s ease", scrollbarWidth: "thin" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${T.inputBorder}`, marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{L.notifications}</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: T.textFaint, fontSize: "13px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.4 }}>🔔</div>
                    {L.noNotifications}
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
              aria-label={L.accountMenu} aria-expanded={showAccountMenu} aria-haspopup="true"
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
              <div role="menu" aria-label={L.accountOptions}
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
                  {isPro && <p style={{ fontSize: "11px", color: T.accent, fontWeight: 600, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><span>✦</span> Pro</p>}
                </div>
                {/* My account — opens full profile panel */}
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); setShowChangePass(true); setChangePassMsg(null); setNewPass(""); setNewPassConfirm(""); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {L.myAccount}
                </button>
                {!isPro && (
                  <button role="menuitem" onClick={() => { setShowAccountMenu(false); showUpgrade(); }}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                      background: `${T.accent}12`, cursor: "pointer", fontSize: "13px", color: T.accent, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: "10px" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${T.accent}20`}
                    onMouseLeave={e => e.currentTarget.style.background = `${T.accent}12`}>
                    <span style={{ fontSize: "14px" }}>✦</span> {L.upgradePro}
                  </button>
                )}
                {/* Install app */}
                {!isStandalone && (
                  <button role="menuitem" onClick={async () => {
                    setShowAccountMenu(false);
                    if (installPrompt) {
                      installPrompt.prompt();
                      const { outcome } = await installPrompt.userChoice;
                      if (outcome === "accepted") setInstallPrompt(null);
                    } else {
                      setShowInstallGuide(true);
                    }
                    playClick();
                  }}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                      background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                      display: "flex", alignItems: "center", gap: "10px" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/></svg>
                    {L.installApp}
                  </button>
                )}
                <div style={{ height: "1px", background: T.inputBorder, margin: "4px 0" }} />
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); onLogout(); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.danger, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {L.signOut}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" style={{ maxWidth: "520px", margin: "0 auto", padding: "77px 20px 190px" }}>
        <p style={{ fontSize: "15px", color: T.textMuted, fontWeight: 500, marginBottom: "16px" }}>{greeting}, {getUserName(user)} <span aria-hidden="true" style={{ color: T.accent }}>✦</span></p>

        {showUpgradeSuccess && (
          <div style={{ background: `${T.accent}12`, border: `1px solid ${T.accent}30`, borderRadius: "16px", padding: "16px 20px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "14px", animation: "slideDown 0.3s ease" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "white", fontWeight: 700, flexShrink: 0 }}>✦</div>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: T.text, margin: 0 }}>{L.upgradeSuccess}</p>
              <p style={{ fontSize: "13px", color: T.textMuted, margin: "2px 0 0" }}>{L.upgradeSuccessSub}</p>
            </div>
          </div>
        )}

        {!dbLoaded && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ width: "20px", height: "20px", border: `3px solid ${T.inputBorder}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}
        {dbLoaded && dbError && (
          <div role="alert" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: "15px", color: T.danger, fontWeight: 600, marginBottom: "12px" }}>{L.couldNotLoad}</p>
            <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "16px", lineHeight: 1.5 }}>{L.checkConnection}</p>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: "12px", background: T.accent, color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>{L.retry}</button>
          </div>
        )}

        {dbLoaded && <>
        {/* Coach Card — AI-powered dynamic insights */}
        {(coachDisplayed || coachLoading) && (
          <div style={{
            background: T.surface, borderRadius: "16px", padding: "14px 18px",
            marginBottom: "14px", border: `0.5px solid ${T.border}`,
            borderLeft: `3px solid ${T.accent}`, minHeight: "48px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ color: T.accent, fontSize: "14px", fontWeight: 700, flexShrink: 0 }}>✦</span>
              <p style={{ fontSize: "14px", color: T.textSec, lineHeight: 1.5, fontWeight: 500, flex: 1, margin: 0 }}>
                {coachLoading && !coachDisplayed ? (
                  <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out infinite" }} />
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out 0.2s infinite" }} />
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out 0.4s infinite" }} />
                  </span>
                ) : (
                  <>
                    {coachDisplayed}
                    {coachDisplayed.length < coachMsg.length && (
                      <span style={{ display: "inline-block", width: "2px", height: "14px", background: T.accent, marginLeft: "1px", verticalAlign: "text-bottom", animation: "pulse 0.8s ease-in-out infinite" }} />
                    )}
                  </>
                )}
              </p>
              {streak >= 2 && (
                <span style={{ fontSize: "11px", color: T.success, fontWeight: 700, flexShrink: 0, background: `${T.success}15`, padding: "3px 8px", borderRadius: "8px" }}>
                  {streak}d
                </span>
              )}
            </div>
            {/* Action buttons */}
            {!coachLoading && coachDisplayed && coachDisplayed.length >= coachMsg.length && (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", paddingLeft: "26px" }}>
                {isPro ? (
                  <button onClick={() => { setCoachDisplayed(''); setCoachMsg(''); fetchCoach(); playClick(); }}
                    style={{ background: T.overlay, border: "none", borderRadius: "8px", padding: "5px 12px",
                      fontSize: "12px", color: T.textMuted, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.inputBg}
                    onMouseLeave={e => e.currentTarget.style.background = T.overlay}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 8a6 6 0 0111.3-2.8M14 8a6 6 0 01-11.3 2.8"/><path d="M14 2v4h-4M2 14v-4h4"/></svg>
                    {L.anotherTip}
                  </button>
                ) : (
                  <button onClick={() => { showUpgrade(); playClick(); }}
                    style={{ background: `${T.accent}0A`, border: `1px dashed ${T.accent}40`, borderRadius: "8px", padding: "5px 12px",
                      fontSize: "12px", color: T.accent, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px" }}>
                    ✦ {L.anotherTip}
                  </button>
                )}
                {isPro ? (
                  <button onClick={() => {
                    setShowChat(true); setChatBubble(true);
                    setChatMessages([
                      { role: 'assistant', content: coachMsg },
                      { role: 'system', content: `El usuario abrió el chat desde este consejo: "${coachMsg}". Profundizá en ese tema específico, ofrecé pasos concretos o preguntale qué necesita.` },
                    ]);
                    playClick();
                  }}
                    style={{ background: `${T.accent}15`, border: "none", borderRadius: "8px", padding: "5px 12px",
                      fontSize: "12px", color: T.accent, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${T.accent}25`}
                    onMouseLeave={e => e.currentTarget.style.background = `${T.accent}15`}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2h12v9H5l-3 3V2z"/></svg>
                    {L.talkToCoach}
                  </button>
                ) : (
                  <button onClick={() => { showUpgrade(); playClick(); }}
                    style={{ background: `${T.accent}0A`, border: `1px dashed ${T.accent}40`, borderRadius: "8px", padding: "5px 12px",
                      fontSize: "12px", color: T.accent, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px" }}>
                    ✦ {L.talkToCoach}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* LIST SWITCHER */}
        {(lists.length > 0 || showAddList) && (
          <div style={{ marginBottom: "14px", position: "relative" }}>
            {!listAtStart && (
              <button className="list-arrow" onClick={() => listScrollRef.current?.scrollBy({ left: -160, behavior: "smooth" })} aria-label={L.prevLists} style={{ left: "-10px" }}>‹</button>
            )}
            {!listAtEnd && (
              <button className="list-arrow" onClick={() => listScrollRef.current?.scrollBy({ left: 160, behavior: "smooth" })} aria-label={L.moreLists} style={{ right: "-10px" }}>›</button>
            )}
            <div ref={listScrollRef} onScroll={() => { const el = listScrollRef.current; if (!el) return; setListAtStart(el.scrollLeft <= 8); setListAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8); }}
              style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {/* "Todas" pill */}
              <button onClick={() => { setActiveListId(null); playClick(); }}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${activeListId === null ? T.danger : T.inputBorder}`, background: activeListId === null ? `${T.danger}1A` : T.overlay, color: activeListId === null ? T.danger : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                {L.allLists}
              </button>
              {lists.map(l => (
                <div key={l.id} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <button onClick={() => { setActiveListId(l.id); playClick(); }}
                    style={{ padding: "6px 14px", paddingRight: "32px", borderRadius: "20px", border: `1.5px solid ${activeListId === l.id ? T.danger : T.inputBorder}`, background: activeListId === l.id ? `${T.danger}1A` : T.overlay, color: activeListId === l.id ? T.danger : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.name}
                  </button>
                  <button onClick={() => deleteList(l.id)} aria-label={`${L.deleteList} ${l.name}`}
                    style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "13px", lineHeight: 1, padding: "2px" }}>×</button>
                </div>
              ))}
              {/* Add list */}
              {showAddList ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addList(); if (e.key === "Escape") { setShowAddList(false); setNewListName(""); } }}
                    onBlur={() => { if (!newListName.trim()) { setShowAddList(false); setNewListName(""); } }}
                    placeholder={LOCALE === 'en' ? "Name..." : "Nombre..."} maxLength={30}
                    style={{ fontSize: "13px", padding: "5px 10px", borderRadius: "20px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, width: "120px" }} />
                  <button onClick={addList} style={{ padding: "5px 10px", borderRadius: "20px", background: T.accent, color: "white", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
              ) : !isPro && lists.length >= FREE.lists ? (
                <button onClick={() => { showUpgrade(); playClick(); }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px dashed ${T.accent}60`, background: `${T.accent}0A`, color: T.accent, fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  ✦ Pro
                </button>
              ) : (
                <button onClick={() => { setShowAddList(true); playClick(); }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + {L.list}
                </button>
              )}
            </div>
          </div>
        )}
        {!lists.length && !showAddList && (
          <div style={{ marginBottom: "10px" }}>
            <button onClick={() => { setShowAddList(true); playClick(); }}
              style={{ padding: "5px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              + {L.newList}
            </button>
          </div>
        )}


        {/* ====== SIMPLE MODE ====== */}
        {!isCalendarMode && <>
        {todayTotalMin > 0 && <TodayCard total={todayTotalMin} done={todayDoneMin} taskCount={todayTasks.length + tasks.filter(t => t.done && t.scheduledFor === "hoy" && t.doneAt && t.doneAt >= todayStart.getTime()).length} T={T} />}

        {/* HOY */}
        <section aria-label={L.tasksToday}>
          {sectionH("☀️", L.today, todayTasks.length, 0)}
          <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
            {todayTasks.length === 0
              ? <p onClick={() => { setNewSchedule("hoy"); setShowAdd(true); }} style={{ padding: "18px 4px 10px", color: T.textFaint, fontSize: "13px", fontStyle: "italic", lineHeight: 1.5, cursor: "pointer" }}>{L.clearDay} <span style={{ color: T.accent, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px", textDecorationColor: `${T.accent}66` }}>{L.addFirstTask}</span> →</p>
              : renderList(todayTasks, true)}
          </div>
          {!isPro && totalPendingAll >= FREE.tasks ? (
            <ProGate title={L.taskLimit} subtitle={L.taskLimitSub} onUpgrade={showUpgrade} T={T} style={{ marginTop: "8px" }} />
          ) : (
            <button onClick={() => { setNewSchedule("hoy"); setShowAdd(true); playClick(); }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
                padding: "8px 4px", cursor: "pointer", color: T.textFaint, fontSize: "13px", fontWeight: 500,
                transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = T.accent}
              onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
              <span style={{ fontSize: "16px", fontWeight: 300, lineHeight: 1 }}>+</span> {L.newTask}
              {!isPro && totalPendingAll >= FREE.tasks - 5 && <span style={{ fontSize: "11px", color: T.textFaint, marginLeft: "4px" }}>({totalPendingAll}/{FREE.tasks})</span>}
            </button>
          )}
        </section>

        {/* DESPUÉS */}
        {(weekTasks.length > 0 || unscheduled.length > 0) && (() => {
          const despues = [...weekTasks, ...unscheduled];
          const despuesMin = despues.reduce((s, t) => s + (t.minutes || 0), 0);
          return (
            <section aria-label={L.tasksDeferred} style={{ marginTop: "8px" }}>
              {sectionH("📅", L.deferred, despues.length, despuesMin)}
              <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
                {renderList(despues, true)}
              </div>
              {!isPro && totalPendingAll >= FREE.tasks ? (
                <ProGate title={L.taskLimit} subtitle={L.taskLimitSub} onUpgrade={showUpgrade} T={T} style={{ marginTop: "8px" }} />
              ) : (
                <button onClick={() => { setNewSchedule("semana"); setShowAdd(true); playClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
                    padding: "8px 4px", cursor: "pointer", color: T.textFaint, fontSize: "13px", fontWeight: 500,
                    transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = T.accent}
                  onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
                  <span style={{ fontSize: "16px", fontWeight: 300, lineHeight: 1 }}>+</span> {L.newTask}
                  {!isPro && totalPendingAll >= FREE.tasks - 5 && <span style={{ fontSize: "11px", color: T.textFaint, marginLeft: "4px" }}>({totalPendingAll}/{FREE.tasks})</span>}
                </button>
              )}
            </section>
          );
        })()}

        {/* COMPLETADAS */}
        {doneTasks.length > 0 && (
          <section aria-label={L.completed} style={{ marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 8px" }}>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
              <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 600 }}><span style={{ color: T.success }}>✓</span> {L.completed} ({doneTasks.length})</span>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
            </div>
            <div style={{ maxHeight: "clamp(160px, 30vh, 400px)", overflowY: "auto", paddingRight: "2px" }}>
              {doneTasks.map((task, i) => <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * .02}s both` }}><TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onUpdateDueDate={updateDueDate} onDelegate={isPro ? delegateTask : null} onUnshare={unshareTask} onMoveToList={moveToList} isDragging={false} dragOver={false} T={T} lists={lists} activeListId={activeListId} isMobile={isMobile} isPro={isPro} onUpgrade={showUpgrade} /></div>)}
            </div>
          </section>
        )}
        </>}

        {/* ====== CALENDAR MODE ====== */}
        {isCalendarMode && <>
        {/* Calendar Strip */}
        <CalendarStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} onTogglePicker={() => setShowCalendarPicker(p => !p)} taskCountByDate={taskCountByDate} T={T} />

        {/* Calendar Picker dropdown */}
        {showCalendarPicker && (
          <div style={{ position: "relative", zIndex: 10, marginBottom: "14px", display: "flex", justifyContent: "center" }}>
            <MiniCalendar value={selectedDate} onChange={(d) => { setSelectedDate(d); setShowCalendarPicker(false); }} onClose={() => setShowCalendarPicker(false)} T={T} />
          </div>
        )}

        {/* Overdue Banner */}
        {overdueTasks.length > 0 && (
          <button onClick={() => setShowOverdueModal(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "14px", border: `1px solid ${T.danger}30`, background: `${T.danger}0A`, cursor: "pointer", marginBottom: "14px", textAlign: "left" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.danger, flex: 1 }}>
              {overdueTasks.length} {L.overdueTasks}
            </span>
            <span style={{ fontSize: "12px", color: T.textMuted }}>›</span>
          </button>
        )}

        {/* Overdue Resolution Modal */}
        {showOverdueModal && (
          <>
          <div onClick={() => { setShowOverdueModal(false); setOverdueRescheduleId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, animation: "fadeIn 0.2s ease" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 380px)", maxHeight: "70vh", overflow: "auto", background: T.surface, borderRadius: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", zIndex: 301, padding: "20px", animation: "slideDown 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text, margin: 0 }}>{L.overdueTitle}</h3>
              <button onClick={() => { setShowOverdueModal(false); setOverdueRescheduleId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "18px" }}>×</button>
            </div>
            {/* Move all button */}
            <button onClick={() => {
              overdueTasks.forEach(t => updateDueDate(t.id, todayDateStr));
              setShowOverdueModal(false);
            }} style={{ width: "100%", padding: "10px", borderRadius: "12px", border: `1px solid ${T.accent}40`, background: `${T.accent}10`, color: T.accent, fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "14px" }}>
              {L.moveAll}
            </button>
            {/* Task list */}
            {overdueTasks.map(task => (
              <div key={task.id} style={{ padding: "12px", borderRadius: "12px", border: `0.5px solid ${T.border}`, marginBottom: "8px", background: T.bg }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: T.text, marginBottom: "6px" }}>{task.text}</p>
                <p style={{ fontSize: "11px", color: T.textMuted, marginBottom: "10px" }}>
                  {L.dueDate}: {new Date(task.dueDate + "T12:00:00").toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" })}
                </p>
                {overdueRescheduleId === task.id ? (
                  <div style={{ marginTop: "4px" }}>
                    <MiniCalendar value={task.dueDate} onChange={(d) => { updateDueDate(task.id, d); setOverdueRescheduleId(null); }} onClose={() => setOverdueRescheduleId(null)} T={T} />
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button onClick={() => updateDueDate(task.id, todayDateStr)}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: T.accent, color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      {L.moveToToday}
                    </button>
                    <button onClick={() => setOverdueRescheduleId(task.id)}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.overlay, color: T.textSec, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      {L.reschedule}
                    </button>
                    <button onClick={() => updateDueDate(task.id, null)}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.overlay, color: T.textMuted, fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                      {L.removeDate}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
        )}

        {/* All days of the week */}
        {calendarWeekDays.map(dateStr => {
          const dayTasks = calendarWeekTasksMap[dateStr] || [];
          const dayDate = new Date(dateStr + "T12:00:00");
          const todayD = new Date(); todayD.setHours(0,0,0,0);
          const tomorrowD = new Date(todayD); tomorrowD.setDate(tomorrowD.getDate() + 1);
          const yesterdayD = new Date(todayD); yesterdayD.setDate(yesterdayD.getDate() - 1);
          const dayNorm = new Date(dayDate); dayNorm.setHours(0,0,0,0);
          const isToday = dayNorm.getTime() === todayD.getTime();
          let dayLabel;
          if (isToday) dayLabel = L.calToday;
          else if (dayNorm.getTime() === tomorrowD.getTime()) dayLabel = L.tomorrow;
          else if (dayNorm.getTime() === yesterdayD.getTime()) dayLabel = L.yesterday;
          else dayLabel = dayDate.toLocaleDateString(DATE_LOCALE, { weekday: "long", day: "numeric", month: "short" });
          const dayMin = dayTasks.reduce((s, t) => s + (t.minutes || 0), 0);
          return (
            <section key={dateStr} style={{ marginTop: "4px" }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", marginTop: "14px", padding: "0 2px", fontSize: isToday ? "16px" : "14px", fontWeight: isToday ? 700 : 600, color: isToday ? T.text : T.textSec }}>
                {dayLabel}
                {dayTasks.length > 0 && <span style={{ fontSize: "12px", color: T.textMuted, fontWeight: 600 }}>({dayTasks.length})</span>}
                {dayMin > 0 && <span style={{ fontSize: "11px", color: T.accent, marginLeft: "auto", background: `${T.accent}12`, padding: "2px 8px", borderRadius: "6px", fontWeight: 600 }}>{fmt(dayMin)}</span>}
              </h2>
              {dayTasks.length > 0 ? renderList(dayTasks, false) : (
                <div style={{ padding: "2px 0 4px", borderBottom: `0.5px solid ${T.border}` }} />
              )}
              {!isPro && totalPendingAll >= FREE.tasks ? (
                <ProGate title={L.taskLimit} subtitle={L.taskLimitSub} onUpgrade={showUpgrade} T={T} style={{ marginTop: "4px" }} />
              ) : (
                <button onClick={() => { setSelectedDate(dateStr); setShowAdd(true); playClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
                    padding: "6px 4px", cursor: "pointer", color: T.textFaint, fontSize: "12px", fontWeight: 500,
                    transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = T.accent}
                  onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
                  <span style={{ fontSize: "14px", fontWeight: 300, lineHeight: 1 }}>+</span> {L.newTask}
                </button>
              )}
            </section>
          );
        })}

        {/* No-date tasks (backlog) */}
        <section style={{ marginTop: "8px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", marginTop: "14px", padding: "0 2px", fontSize: "14px", fontWeight: 600, color: T.textSec }}>
            {L.noDateTasks} {calendarNoDateTasks.length > 0 && <span style={{ fontSize: "12px", color: T.textMuted, fontWeight: 600 }}>({calendarNoDateTasks.length})</span>}
          </h2>
          {calendarNoDateTasks.length > 0 && renderList(calendarNoDateTasks, false)}
          {!isPro && totalPendingAll >= FREE.tasks ? (
            <ProGate title={L.taskLimit} subtitle={L.taskLimitSub} onUpgrade={showUpgrade} T={T} style={{ marginTop: "4px" }} />
          ) : (
            <button onClick={() => { setSelectedDate(null); setShowAdd(true); playClick(); }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
                padding: "6px 4px", cursor: "pointer", color: T.textFaint, fontSize: "12px", fontWeight: 500,
                transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = T.accent}
              onMouseLeave={e => e.currentTarget.style.color = T.textFaint}>
              <span style={{ fontSize: "14px", fontWeight: 300, lineHeight: 1 }}>+</span> {L.newTask}
            </button>
          )}
        </section>
        </>}
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
            <div onClick={() => { if (!isPro) { showUpgrade(); return; } setShowCanvas(true); playClick(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "18px", gap: "10px", background: T.surface, height: "100%", cursor: "pointer" }}>
              <span style={{ fontSize: "18px", color: T.textMuted }}>‹</span>
              <span aria-hidden="true" style={{ fontSize: "15px", color: isPro ? T.textFaint : T.accent }}>◫</span>
              <span style={{ fontSize: "9px", color: isPro ? T.textFaint : T.accent, writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{isPro ? "Canvas" : "Pro ✦"}</span>
            </div>
          ) : !isPro ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: T.surface, padding: "40px 24px", textAlign: "center" }}>
              <span style={{ fontSize: "32px", marginBottom: "16px" }}>◫</span>
              <p style={{ fontSize: "16px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>{L.canvasPro}</p>
              <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "20px", lineHeight: 1.5 }}>{L.canvasProSub}</p>
              <button onClick={showUpgrade} style={{ padding: "10px 24px", borderRadius: "12px", background: T.accent, color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>✦ {L.upgrade}</button>
              <button onClick={() => { wideEnough ? setShowCanvas(false) : setMobileView("list"); playClick(); }} style={{ marginTop: "12px", background: "none", border: "none", color: T.textFaint, fontSize: "13px", cursor: "pointer" }}>{L.close}</button>
            </div>
          ) : (
            <NoteCanvas notes={canvasNotes} setNotes={setCanvasNotes} T={T} dark={dark}
              onCollapse={() => { wideEnough ? setShowCanvas(false) : setMobileView("list"); playClick(); }} />
          )}
        </div>
      )}

      {/* FIXED FOOTER */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: T.panelBg, borderTop: `0.5px solid ${T.border}`, padding: "10px 20px 12px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", color: T.textFaint, fontWeight: 500 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "12px", color: T.textMuted }}>to <span style={{ color: T.accent }}>done</span></span>
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
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={L.confirmDelete} tabIndex={-1} ref={el => el?.focus()}
              style={{ background: T.panelBg, borderRadius: "20px", padding: "24px", maxWidth: "360px", width: "100%", boxShadow: T.panelShadow, animation: "popIn 0.2s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>{L.deleteList}</p>
              <p style={{ fontSize: "14px", color: T.textMuted, marginBottom: openCount > 0 ? "20px" : "24px", lineHeight: 1.5 }}>
                {L.deleteListQ} <strong style={{ color: T.text }}>"{deleteListTarget.name}"</strong>?
                {openCount === 0 && ` ${L.noOpenTasks}`}
              </p>
              {openCount > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <p style={{ fontSize: "13px", color: T.textSec, marginBottom: "10px", fontWeight: 500 }}>
                    {LOCALE === 'en' ? `Has ${openCount} open task${openCount !== 1 ? "s" : ""}. ${L.moveToWhich}` : `Tiene ${openCount} ${openCount !== 1 ? L.tasks : L.task} ${openCount !== 1 ? L.hasOpenTasksP : L.hasOpenTasks}. ${L.moveToWhich}`}
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <button onClick={() => setDeleteListReassignTo(null)} style={deleteListReassignTo === null ? pillSel : pillDef}>{L.noList}</button>
                    {otherLists.map(l => (
                      <button key={l.id} onClick={() => setDeleteListReassignTo(l.id)} style={deleteListReassignTo === l.id ? pillSel : pillDef}>{l.name}</button>
                    ))}
                  </div>
                  <button onClick={() => setDeleteListReassignTo("__none__")}
                    style={{ fontSize: "12px", color: deleteListReassignTo === "__none__" ? T.danger : T.textFaint, background: "none", border: "none", cursor: "pointer", padding: "2px 0", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px", fontWeight: deleteListReassignTo === "__none__" ? 700 : 400 }}>
                    {L.dontMove}
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setDeleteListTarget(null)} style={{ padding: "9px 18px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: "transparent", color: T.textMuted, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>{L.cancel}</button>
                <button onClick={() => confirmDeleteList()} style={{ padding: "9px 18px", borderRadius: "12px", border: "none", background: T.accent, color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>{L.delete}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PROFILE / ACCOUNT PANEL */}
      {showChangePass && (<>
        <div onClick={() => setShowChangePass(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 109 }} />
        <div role="dialog" aria-label={L.myAccount} aria-modal="true"
          onKeyDown={e => { if (e.key === "Escape") setShowChangePass(false); }}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.panelBg, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", boxShadow: T.panelShadow, animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 110, maxHeight: "85vh", overflowY: "auto" }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>{L.myAccount}</h3>
                <p style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>{user.email}</p>
              </div>
              <button onClick={() => setShowChangePass(false)} aria-label={L.close}
                style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer" }}>✕</button>
            </div>

            {/* PLAN SECTION */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>{L.plan}</p>
            <div style={{ background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`, padding: "14px 16px", marginBottom: "20px" }}>
              {isPro ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "16px", color: T.accent }}>✦</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{L.planProActive}</span>
                  </div>
                  <button onClick={async () => {
                    try {
                      const res = await fetch('/api/create-portal', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userEmail: user.email }),
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch (err) { console.error('Portal error:', err); }
                  }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500, textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ fontWeight: 600 }}>{L.manageSub}</div>
                    <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>{L.manageSubDesc}</div>
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{L.planFree}</span>
                  </div>
                  <button onClick={() => { setShowChangePass(false); showUpgrade(); }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", background: T.accent, border: "none", cursor: "pointer", fontSize: "13px", color: "white", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                    <span>✦</span> {L.upgradePro}
                  </button>
                </>
              )}
            </div>

            {/* PREFERENCES SECTION */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>{L.preferences}</p>
            <div style={{ background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`, padding: "4px 4px", marginBottom: "20px" }}>
              {/* View mode toggle */}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 12px" }}>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: T.text }}>{L.viewMode}</span>
                <div style={{ display: "flex", borderRadius: "8px", border: `1px solid ${T.border}`, overflow: "hidden" }}>
                  <button onClick={() => { setViewMode('simple'); try { localStorage.setItem('todone_viewMode', 'simple'); } catch {} }}
                    style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                      background: viewMode === 'simple' ? T.accent : "transparent",
                      color: viewMode === 'simple' ? "white" : T.textMuted }}>
                    {L.viewSimple}
                  </button>
                  <button onClick={() => { setViewMode('calendar'); try { localStorage.setItem('todone_viewMode', 'calendar'); } catch {} }}
                    style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                      background: viewMode === 'calendar' ? T.accent : "transparent",
                      color: viewMode === 'calendar' ? "white" : T.textMuted }}>
                    {L.viewCalendar}
                  </button>
                </div>
              </div>
            </div>

            {/* SECURITY SECTION */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>{L.security}</p>
            <div style={{ background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`, padding: "14px 16px", marginBottom: "20px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: T.text, marginBottom: "10px" }}>{L.newPassword}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="password" value={newPass} onChange={e => { setNewPass(e.target.value); setChangePassMsg(null); }}
                  placeholder={L.newPassLabel}
                  aria-label={L.newPassword}
                  style={{ width: "100%", fontSize: "15px", padding: "13px 16px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }}
                />
                <input
                  type="password" value={newPassConfirm} onChange={e => { setNewPassConfirm(e.target.value); setChangePassMsg(null); }}
                  placeholder={L.repeatNewPassLabel}
                  aria-label={L.repeatNewPassLabel}
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
                  if (newPass.length < 6) { setChangePassMsg({ type: "err", text: L.min6chars }); return; }
                  if (newPass !== newPassConfirm) { setChangePassMsg({ type: "err", text: L.passNoMatch }); return; }
                  setChangePassLoading(true);
                  const { error } = await supabase.auth.updateUser({ password: newPass });
                  setChangePassLoading(false);
                  if (error) setChangePassMsg({ type: "err", text: error.message });
                  else { setChangePassMsg({ type: "ok", text: L.passUpdatedShort }); setNewPass(""); setNewPassConfirm(""); }
                }}
                style={{ width: "100%", marginTop: "12px", padding: "12px", borderRadius: "12px", border: "none", fontSize: "14px", fontWeight: 700, cursor: (changePassLoading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !changePassLoading) ? T.accent : T.inputBorder, color: (newPass && newPassConfirm && !changePassLoading) ? "white" : T.textFaint }}>
                {changePassLoading ? L.saving : L.savePassword}
              </button>
            </div>

            {/* SIGN OUT */}
            <button onClick={() => { setShowChangePass(false); onLogout(); }}
              style={{ width: "100%", padding: "14px", borderRadius: "14px", border: `1px solid ${T.danger}30`, background: "transparent", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: T.danger }}>
              {L.signOut}
            </button>
          </div>
        </div>
      </>)}

      {/* Floating Coach Bubble — Pro only */}
      {dbLoaded && !showChat && isPro && (
        <button onClick={() => { setShowChat(true); playClick(); }}
          aria-label={L.talkToYourCoach}
          onMouseEnter={() => setCoachBubbleHover(true)}
          onMouseLeave={() => setCoachBubbleHover(false)}
          style={{
            position: "fixed", bottom: isMobile ? "80px" : "24px",
            right: "20px",
            height: "48px", borderRadius: "24px",
            width: coachBubbleHover ? "210px" : "48px",
            background: T.accent, color: dark ? "#1C1C1E" : "#fff",
            border: "none", cursor: "pointer", zIndex: 90,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: coachBubbleHover ? "0 18px 0 14px" : "0",
            gap: coachBubbleHover ? "8px" : "0",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            fontSize: "15px", fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), padding 0.25s ease, gap 0.25s ease, transform 0.2s, box-shadow 0.2s",
          }}>
          <span style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px" }}>✦</span>
          <span style={{ overflow: "hidden", maxWidth: coachBubbleHover ? "160px" : "0", opacity: coachBubbleHover ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.15s ease", fontSize: "14px" }}>{L.talkToYourCoach}</span>
        </button>
      )}

      {/* Coach Chat Widget */}
      {showChat && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 0 : "80px", right: isMobile ? 0 : "20px",
          width: isMobile ? "100%" : "380px",
          height: isMobile ? "100vh" : "500px",
          background: T.surface, zIndex: 300,
          borderRadius: isMobile ? 0 : "20px",
          border: isMobile ? "none" : `0.5px solid ${T.border}`,
          boxShadow: isMobile ? "none" : "0 8px 40px rgba(0,0,0,0.2)",
          display: "flex", flexDirection: "column",
          animation: isMobile ? "sheetUp 0.3s ease" : "slideUp 0.25s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: T.accent, fontWeight: 700, fontSize: "15px" }}>✦</span>
              <span style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>{L.coach}</span>
            </div>
            <button onClick={() => setShowChat(false)}
              style={{ background: "none", border: "none", fontSize: "18px", color: T.textFaint, cursor: "pointer", padding: "4px", lineHeight: 1 }}>✕</button>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px", scrollbarWidth: "thin" }}>
            {chatMessages.filter(m => m.role !== 'system').map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: "85%",
                background: msg.role === 'user' ? T.accent : T.overlay,
                color: msg.role === 'user' ? (dark ? "#1C1C1E" : "#fff") : T.text,
                borderRadius: msg.role === 'user' ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "10px 14px", fontSize: "13px", lineHeight: 1.5, fontWeight: 500,
              }}>
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: "flex-start", display: "inline-flex", gap: "4px", padding: "10px 14px",
                background: T.overlay, borderRadius: "14px 14px 14px 4px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out infinite" }} />
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out 0.2s infinite" }} />
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out 0.4s infinite" }} />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {/* Input */}
          <div style={{ padding: "10px 14px", borderTop: `0.5px solid ${T.border}`, flexShrink: 0,
            display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              autoFocus
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder={L.chatPlaceholder}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                color: T.text, fontSize: "13px", outline: "none",
              }}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
              style={{
                width: "36px", height: "36px", borderRadius: "10px", border: "none",
                background: chatInput.trim() ? T.accent : T.overlay,
                color: chatInput.trim() ? (dark ? "#1C1C1E" : "#fff") : T.textFaint,
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s", flexShrink: 0,
              }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2L7 9"/><path d="M14 2l-4 12-3-5-5-3z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Pro Upgrade Modal */}
      {showProModal && (
        <>
          <div onClick={() => setShowProModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 310, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div role="dialog" aria-modal="true" aria-label={L.proModalTitle}
            onKeyDown={e => { if (e.key === "Escape") setShowProModal(false); }}
            tabIndex={-1} ref={el => el?.focus()}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: T.panelBg, borderRadius: "24px", padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", zIndex: 311, maxWidth: "380px", width: "90%", animation: "popInCenter 0.3s ease", textAlign: "center" }}>
            <button onClick={() => setShowProModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", fontSize: "18px", color: T.textFaint, cursor: "pointer", lineHeight: 1 }}>✕</button>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: `${T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "22px", color: T.accent, fontWeight: 700 }}>✦</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: T.text, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{L.proModalTitle}</h2>
            <p style={{ fontSize: "14px", color: T.textMuted, margin: "0 0 24px", lineHeight: 1.5 }}>{L.proModalSub}</p>
            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
              {[L.proFeat1, L.proFeat2, L.proFeat3, L.proFeat4, L.proFeat5].map((feat, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${T.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: T.accent, fontSize: "13px", fontWeight: 700 }}>✓</span>
                  </span>
                  <span style={{ fontSize: "14px", color: T.text, fontWeight: 500, lineHeight: 1.4 }}>{feat}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowProModal(false); startCheckout(); }}
              style={{ width: "100%", padding: "15px", borderRadius: "14px", background: T.accent, color: "white", border: "none", fontSize: "16px", fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: `0 4px 16px ${T.accent}40` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = `0 6px 24px ${T.accent}50`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 16px ${T.accent}40`; }}>
              ✦ {L.proCtaBtn}
            </button>
            <p style={{ fontSize: "12px", color: T.textFaint, marginTop: "10px" }}>{L.proCtaSub}</p>
            <button onClick={() => setShowProModal(false)}
              style={{ marginTop: "8px", background: "none", border: "none", color: T.textFaint, fontSize: "13px", cursor: "pointer", fontWeight: 500, padding: "4px" }}>{L.maybeLater}</button>
          </div>
        </>
      )}

      {/* Install guide (Safari) */}
      {showInstallGuide && (
        <>
          <div onClick={() => setShowInstallGuide(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 109 }} />
          <div role="dialog" aria-label={L.installApp} aria-modal="true"
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 16px 48px rgba(0,0,0,0.2)", zIndex: 110, maxWidth: "340px", width: "90%", animation: "slideDown 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: T.text }}>{L.installToDone}</h3>
              <button onClick={() => setShowInstallGuide(false)} style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer" }}>✕</button>
            </div>
            {isIOS ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>1</span>
                  <span style={{ fontSize: "14px", color: T.text }} dangerouslySetInnerHTML={{ __html: L.iosStep1 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>2</span>
                  <span style={{ fontSize: "14px", color: T.text }} dangerouslySetInnerHTML={{ __html: L.iosStep2 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>3</span>
                  <span style={{ fontSize: "14px", color: T.text }} dangerouslySetInnerHTML={{ __html: L.iosStep3 }} />
                </div>
              </div>
            ) : isSafariMac ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>1</span>
                  <span style={{ fontSize: "14px", color: T.text }} dangerouslySetInnerHTML={{ __html: L.macStep1 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>2</span>
                  <span style={{ fontSize: "14px", color: T.text }} dangerouslySetInnerHTML={{ __html: L.macStep2 }} />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "14px", color: T.textSec }} dangerouslySetInnerHTML={{ __html: L.openInChrome }} />
            )}
            <button onClick={() => setShowInstallGuide(false)}
              style={{ width: "100%", marginTop: "20px", padding: "12px", borderRadius: "12px", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: T.accent, color: "white" }}>
              {L.understood}
            </button>
          </div>
        </>
      )}

      {/* ADD PANEL */}
      {showAdd ? (
        <div role="dialog" aria-label={L.newTask} aria-modal="true" style={{ position: "fixed", bottom: kbHeight, left: 0, right: wideEnough ? (showCanvas ? `${canvasWidth}px` : "48px") : 0, background: T.panelBg, borderRadius: kbHeight > 0 ? "0" : "24px 24px 0 0", padding: "16px 20px 24px", boxShadow: T.panelShadow, animation: kbHeight > 0 ? "none" : "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 100 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", background: T.overlay, borderRadius: "10px", padding: "3px", gap: "2px", flex: 1 }}>
                <button onClick={() => { setQuickDump(false); setNewTask(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: !quickDump ? T.surface : "transparent", color: !quickDump ? T.text : T.textFaint, boxShadow: !quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>{L.taskMode}</button>
                <button onClick={() => { setQuickDump(true); setQuickText(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: quickDump ? T.surface : "transparent", color: quickDump ? T.text : T.textFaint, boxShadow: quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>{L.dumpMode}</button>
              </div>
              <button onClick={() => { setShowAdd(false); setAiResult(null); setNewTask(""); setQuickDump(false); setQuickText(""); }} aria-label={L.close} style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer", marginLeft: "10px" }}>✕</button>
            </div>
            {quickDump ? (
              <>
                <p style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", fontWeight: 600 }}>{L.dumpHint}</p>
                <textarea autoFocus value={quickText} onChange={e => setQuickText(e.target.value)} placeholder={L.dumpPlaceholder} maxLength={5000} style={{ width: "100%", minHeight: "100px", fontSize: "14px", padding: "12px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, resize: "none", lineHeight: 1.6, boxSizing: "border-box" }} />
                <button onClick={quickDumpAdd} disabled={!quickText.trim() || addingTask} style={{ width: "100%", marginTop: "10px", padding: "13px", borderRadius: "12px", background: quickText.trim() && !addingTask ? T.accent : T.inputBorder, color: quickText.trim() && !addingTask ? "white" : T.textFaint, border: "none", fontSize: "14px", fontWeight: 700, cursor: quickText.trim() && !addingTask ? "pointer" : "default" }}>
                  {L.addCount} {quickText.split("\n").filter(l => l.trim()).length || ""} {quickText.split("\n").filter(l => l.trim()).length !== 1 ? L.tasks : L.task}
                </button>
              </>
            ) : (
            <>
            <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} aria-label={L.task} placeholder={L.taskPlaceholder} maxLength={500} style={{ width: "100%", fontSize: "16px", padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }} />

            {newTask.trim().length > 3 && aiResult?.hasAny && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", animation: "fadeInUp 0.2s ease" }}>
                <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}><span style={{ color: T.accent }}>✦</span> {L.suggests}</p>
                {aiResult?.hasAny && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {aiResult.priority && !aiAccepted.priority && <AIChip label={L.priority} value={PRIORITIES[aiResult.priority]} reason={aiResult.priorityReason} color={aiResult.priority === "high" ? T.priorityHigh : aiResult.priority === "low" ? T.priorityLow : T.priorityMed} onAccept={() => setAiAccepted(p => ({ ...p, priority: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.priority && aiAccepted.priority && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: (aiResult.priority === "high" ? T.priorityHigh : T.priorityLow) + "18", color: aiResult.priority === "high" ? T.priorityHigh : T.priorityLow, fontWeight: 700 }}>✓ {PRIORITIES[aiResult.priority]}</span>}
                    {aiResult.scheduledFor && !aiAccepted.schedule && <AIChip label={L.when} value={aiResult.scheduledFor} reason={aiResult.scheduleReason} color={T.info} onAccept={() => setAiAccepted(p => ({ ...p, schedule: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.scheduledFor && aiAccepted.schedule && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: `${T.info}1F`, color: T.info, fontWeight: 700 }}>✓ 📅 {aiResult.scheduledFor}</span>}
                    {aiResult.minutes && !aiAccepted.minutes && <AIChip label={L.time} value={fmt(aiResult.minutes)} reason={aiResult.minutesReason} color={T.textMuted} onAccept={() => setAiAccepted(p => ({ ...p, minutes: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.minutes && aiAccepted.minutes && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: T.overlay, color: T.textMuted, fontWeight: 700 }}>✓ 🕐 {fmt(aiResult.minutes)}</span>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "14px", marginBottom: "14px" }}>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{L.priority}</legend>
                <div style={{ display: "flex", gap: "4px" }}>
                  {Object.entries(PRIORITIES).map(([k, l]) => {
                    const active = (aiAccepted.priority && aiResult?.priority === k) || (!aiAccepted.priority && newPriority === k);
                    return <button key={k} onClick={() => { setNewPriority(k); setAiAccepted(p => ({ ...p, priority: false })); }} aria-pressed={active} style={{ flex: 1, padding: "6px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, border: active ? "none" : `1.5px solid ${T.inputBorder}`, background: active ? (k === "high" ? T.priorityHigh : k === "medium" ? T.priorityMed : T.priorityLow) : T.inputBg, color: active ? "white" : T.textMuted, cursor: "pointer" }}>{l}</button>;
                  })}
                </div>
              </fieldset>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{L.time}</legend>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>{fmt((aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes)}</span>
                </div>
                <input
                  type="range" min={0} max={EFFORT_OPTIONS.length - 1} step={1}
                  value={(() => { const cur = (aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes; return EFFORT_OPTIONS.reduce((ci, m, i) => Math.abs(m - cur) < Math.abs(EFFORT_OPTIONS[ci] - cur) ? i : ci, 0); })()}
                  onChange={e => { setNewMinutes(EFFORT_OPTIONS[+e.target.value]); setAiAccepted(p => ({ ...p, minutes: false })); }}
                  aria-label={`${L.estimatedTime}: ${fmt(newMinutes)}`}
                  style={{ width: "100%", cursor: "pointer", accentColor: T.accent }}
                />
                <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {EFFORT_OPTIONS.map((m, i) => <span key={m} style={{ fontSize: "9px", color: T.textFaint, visibility: (i === 0 || i === EFFORT_OPTIONS.length - 1) ? "visible" : "hidden" }}>{fmtS(m)}</span>)}
                </div>
              </fieldset>
            </div>

            <button onClick={addTask} disabled={!newTask.trim() || addingTask} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: newTask.trim() && !addingTask ? T.accent : T.inputBorder, color: newTask.trim() && !addingTask ? "white" : T.textFaint, border: "none", fontSize: "15px", fontWeight: 700, cursor: newTask.trim() && !addingTask ? "pointer" : "default" }}>{L.addTask}</button>
            </>
            )}
          </div>
        </div>
      ) : null}
      {/* Mobile task detail sheet */}
      {mobileSheetTask && (() => {
        const liveTask = tasks.find(t => t.id === mobileSheetTask.id);
        if (!liveTask) return null;
        return <MobileTaskSheet task={liveTask} onClose={() => setMobileSheetTask(null)} onToggle={toggleTask} onDelete={deleteTask} onSchedule={scheduleTask} onDefer={deferTask} onUpdateText={updateText} onUpdateDescription={updateDescription} onUpdatePriority={updatePriority} onUpdateMinutes={updateMinutes} onUpdateDueDate={updateDueDate} onDelegate={isPro ? delegateTask : null} onUnshare={unshareTask} onSplit={updateSubs} onAddSub={addSub} onMoveToList={moveToList} T={T} lists={lists} isPro={isPro} onUpgrade={showUpgrade} />;
      })()}
    </div>
  );
}
