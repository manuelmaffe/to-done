import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured', suggestions: [] });
  }

  const { todayTasks = [], weekTasks = [], doneTodayCount = 0, todayMinutes = 0, workdayMinutes = 480, unscheduledCount = 0, hour = 12 } = req.body;

  const todayStr = todayTasks.length > 0
    ? todayTasks.map(t => `- "${t.text}" (${t.priority === 'high' ? 'alta' : t.priority === 'medium' ? 'media' : 'baja'}, ${t.minutes ?? '?'}min)`).join('\n')
    : 'Ninguna';

  const weekStr = weekTasks.length > 0
    ? weekTasks.slice(0, 4).map(t => `"${t.text}"`).join(', ')
    : 'ninguna';

  const prompt = `Son las ${hour}hs.

Tareas de hoy:
${todayStr}

Esta semana: ${weekStr}
Completadas hoy: ${doneTodayCount}
Tiempo planeado: ${todayMinutes}min de ${workdayMinutes}min disponibles
Sin agendar: ${unscheduledCount}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Sos un asistente de productividad para "To Done". Analizá el estado del día y generá entre 1 y 3 sugerencias breves, directas y útiles en español rioplatense.

Reglas:
- Máximo 18 palabras por sugerencia
- Sé específico: mencioná el nombre de la tarea si es relevante
- Priorizá lo más urgente o impactante para el usuario
- Tono directo y amigable, nada genérico
- Si no hay nada urgente, motivá o felicitá brevemente

Respondé ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones):
{"suggestions":[{"id":"s1","text":"...","icon":"emoji","color":"#hex"}]}

Íconos disponibles: ⚠️ urgente  🎯 foco  💪 motivación  🧩 dividir tarea  📅 planificar  ✅ bien encaminado  🔥 racha  🕐 tiempo
Colores: #E07A5F rojo/urgente · #81B29A verde/positivo · #E6AA68 naranja/equilibrio · #56CCF2 azul/planificación · #9B6DB5 violeta/insight`,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json({ suggestions: parsed.suggestions || [] });
  } catch (err) {
    console.error('[suggest] error:', err?.message);
    return res.status(200).json({ suggestions: [] });
  }
}
