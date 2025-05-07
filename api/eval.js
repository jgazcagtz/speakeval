export const config = {
  runtime: 'edge',
};

const CEFR_LEVELS = {
  A1: { min: 0, max: 20, desc: "Basic user (beginner)" },
  A2: { min: 21, max: 40, desc: "Basic user (elementary)" },
  B1: { min: 41, max: 60, desc: "Independent user (intermediate)" },
  B2: { min: 61, max: 80, desc: "Independent user (upper intermediate)" },
  C1: { min: 81, max: 90, desc: "Proficient user (advanced)" },
  C2: { min: 91, max: 100, desc: "Proficient user (mastery)" }
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

    // Validate input
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No evaluation generated';

    return new Response(JSON.stringify({ 
      message: content
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
