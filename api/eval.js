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

    const systemPrompt = messages[0].role === 'system' ? messages[0].content : `
      You are an English proficiency evaluator. Analyze the conversation and:
      1. Determine CEFR level (A1-C2)
      2. Evaluate all language skills
      3. Provide specific examples
      4. Suggest improvements
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(1)],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "text" }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Evaluation failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No evaluation generated';

    return new Response(JSON.stringify({ 
      message: this.formatCEFREvaluation(content) 
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

function formatCEFREvaluation(content) {
  // Add CEFR reference if not already present
  if (!content.includes('CEFR')) {
    return `${content}\n\n**CEFR Reference:**\nA1-A2: Basic User\nB1-B2: Independent User\nC1-C2: Proficient User`;
  }
  return content;
}
