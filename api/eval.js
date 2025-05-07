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
    const { messages, evaluationStep, totalSteps } = await req.json();

    // Validate input
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine if this is the final evaluation or mid-conversation
    const isFinalEvaluation = evaluationStep >= totalSteps - 1;

    // System prompt for mid-conversation
    let systemPrompt = `You are conducting an English evaluation. Respond conversationally to continue the assessment. 
      Guidelines:
      1. Keep responses under 20 words
      2. Do NOT evaluate yet
      3. Just acknowledge and ask the next question
      4. Maintain professional tone`;

    // System prompt for final evaluation
    if (isFinalEvaluation) {
      systemPrompt = `Generate a comprehensive CEFR-aligned English evaluation report based on the conversation.
        
      Requirements:
      1. Determine CEFR level (A1-C2) with confidence percentage
      2. Evaluate these skills:
         - Pronunciation
         - Fluency
         - Grammar
         - Vocabulary
         - Discourse
      3. Provide specific examples from the responses
      4. Suggest 3 improvement areas
      5. Format with markdown headings`;
    }

    // Prepare the messages for OpenAI API
    const apiMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages.filter(msg => msg.role === 'user' || msg.role === 'assistant')
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: apiMessages,
        temperature: isFinalEvaluation ? 0.3 : 0.7,
        max_tokens: isFinalEvaluation ? 800 : 150
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No response generated';

    return new Response(JSON.stringify({ 
      message: content,
      isFinal: isFinalEvaluation
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
