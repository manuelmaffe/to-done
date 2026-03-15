import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ message: '' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const {
    todayTasks = [], weekTasks = [], deferredTasks = [],
    doneTodayCount = 0, todayMinutes = 0, workdayMinutes = 480,
    unscheduledCount = 0, streak = 0, hour = 12, userName = '',
    overdueTasks = [],
  } = req.body;

  const todayStr = todayTasks.length > 0
    ? todayTasks.map(t => `- "${t.text}" (${t.priority || '?'}, ${t.minutes ?? '?'}min${t.overdueDays > 0 ? `, ${t.overdueDays}d demorada` : ''})`).join('\n')
    : 'Ninguna';

  const weekStr = weekTasks.length > 0
    ? weekTasks.slice(0, 5).map(t => `"${t.text}"`).join(', ')
    : 'ninguna';

  const deferredStr = deferredTasks.length > 0
    ? deferredTasks.slice(0, 5).map(t => `"${t.text}" (${t.overdueDays || 0}d pospuesta)`).join(', ')
    : 'ninguna';

  const overdueStr = overdueTasks.length > 0
    ? overdueTasks.map(t => `"${t.text}" (${t.overdueDays}d demorada)`).join(', ')
    : 'ninguna';

  const prompt = `Son las ${hour}hs. Usuario: ${userName || 'usuario'}.

Racha actual: ${streak} día${streak !== 1 ? 's' : ''} seguidos completando tareas.

Tareas de hoy:
${todayStr}

Esta semana: ${weekStr}
Pospuestas: ${deferredStr}
Demoradas: ${overdueStr}
Completadas hoy: ${doneTodayCount}
Tiempo planeado: ${todayMinutes}min de ${workdayMinutes}min disponibles
Sin agendar: ${unscheduledCount}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `Sos el coach personal de productividad de "To Done". Generás UN mensaje breve y personalizado basado en el estado actual del usuario.

Reglas:
- Máximo 2 oraciones (30 palabras total)
- Español rioplatense, tono directo y cálido (no cursi)
- Sé específico: mencioná tareas por nombre si es relevante
- Priorizá lo más importante según contexto:
  · Si hay racha ≥3 días: felicitá brevemente
  · Si hay tareas demoradas: avisá con nombre, sugerí dividirla o moverla
  · Si está sobrecargado (>480min): sugerí mover algo
  · Si completó varias hoy: reconocelo
  · Si no tiene tareas para hoy: sugerí agendar
  · Si tiene pospuestas recurrentes: señalalo con tacto
- No uses emojis en el texto
- No saludes (nada de "¡Hola!")
- Respondé SOLO el mensaje, sin comillas ni formato

Ejemplos buenos:
"Llevas 5 días seguidos, imparable. Hoy tenés 3 tareas bien equilibradas."
"'Revisar propuesta' lleva 4 días demorada. ¿La dividimos en pasos más chicos?"
"Ya completaste 4 hoy, excelente ritmo. Quedan 2 para cerrar el día."
"Tenés 7hs planeadas para hoy, es mucho. Considerá mover algo a mañana."`,
        },
        { role: 'user', content: prompt },
      ],
    });

    const message = response.choices[0]?.message?.content?.trim() || '';
    return res.status(200).json({ message });
  } catch (err) {
    console.error('[coach] error:', err?.message);
    return res.status(200).json({ message: '' });
  }
}
