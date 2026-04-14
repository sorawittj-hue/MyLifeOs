import axios from 'axios';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';
const MINIMAX_MODELS = ['abab6.5s-chat', 'MiniMax-Text-01', 'MiniMax-M2.5'];

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages, temperature = 0.7 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages array' });
  }

  if (!MINIMAX_API_KEY) {
    return res.status(503).json({ error: 'AI API key not configured on server' });
  }

  let lastError = '';

  for (const model of MINIMAX_MODELS) {
    try {
      const response = await axios.post(
        `${MINIMAX_BASE_URL}/chat/completions`,
        { model, messages, temperature, max_tokens: 1024 },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          },
          timeout: 25000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '';
      return res.status(200).json({ content });
    } catch (err: any) {
      lastError = err?.response?.data?.error?.message || err.message;
      const status = err?.response?.status;

      // Abort on auth or rate-limit errors
      if (status === 401 || status === 403 || status === 429) {
        console.error(`[AI] Fatal error ${status} on model ${model}:`, lastError);
        return res.status(status).json({ error: lastError });
      }

      console.warn(`[AI] Model ${model} failed: ${lastError}, trying next...`);
    }
  }

  console.error('[AI] All models failed:', lastError);
  return res.status(502).json({ error: lastError || 'AI service unavailable' });
}
