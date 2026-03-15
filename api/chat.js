import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ message: '' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { messages = [], taskContext = '', userName = '' } = req.body;

  // Separate system context messages from conversation
  const systemMsgs = messages.filter(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system').slice(-20);

  const extraContext = systemMsgs.map(m => m.content).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Sos el coach de productividad de "To Done", hablando con ${userName || 'el usuario'}. Tenés acceso a su estado actual de tareas.

Estado actual:
${taskContext}
${extraContext ? `\nContexto adicional:\n${extraContext}` : ''}

Reglas:
- Español rioplatense, tono directo y cálido
- Respuestas breves (máximo 3 oraciones)
- Sé específico: mencioná tareas por nombre cuando sea útil
- Podés sugerir reorganizar, dividir tareas, priorizar, o motivar
- Si te piden algo fuera de productividad, redirigí amablemente
- No uses emojis en el texto
- No repitas información que el usuario ya sabe`,
        },
        ...conversation,
      ],
    });

    const message = response.choices[0]?.message?.content?.trim() || '';
    return res.status(200).json({ message });
  } catch (err) {
    console.error('[chat] error:', err?.message);
    return res.status(200).json({ message: 'No pude procesar tu mensaje. Intentá de nuevo.' });
  }
}
