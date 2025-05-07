export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages } = await req.json();

    // Validate messages structure
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate each message
    for (const [i, msg] of messages.entries()) {
      if (!msg || typeof msg !== 'object' || 
          typeof msg.role !== 'string' || 
          typeof msg.content !== 'string') {
        return new Response(JSON.stringify({ 
          error: `Invalid message at index ${i}`,
          details: 'Each message must have role (string) and content (string)'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 300,
        frequency_penalty: 0.5,
        presence_penalty: 0.5
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || 'No response generated';

    return new Response(JSON.stringify({ 
      message: aiMessage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Evaluation Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Evaluation failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
