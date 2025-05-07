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
    const { messages, model = 'gpt-4-turbo' } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const evaluationCriteria = `You are SpeakEval Pro, an AI English speaking assessment tool. Evaluate the user's spoken English based on:
    1. Pronunciation (0-10)
    2. Fluency (0-10)
    3. Grammar Accuracy (0-10)
    4. Vocabulary Range (0-10)
    5. Comprehension (0-10)
    
    Provide:
    - Immediate feedback on each response
    - Overall score (0-50)
    - Detailed analysis
    - Suggestions for improvement
    
    Evaluation language: English
    Be professional but encouraging`;

    const conversationHistory = [
      {
        role: 'system',
        content: `${evaluationCriteria}\nCurrent time: ${new Date().toLocaleString()}`
      },
      ...messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: conversationHistory,
        temperature: 0.5,
        max_tokens: 300,
        frequency_penalty: 0.3,
        presence_penalty: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'Evaluation failed');
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No evaluation response');
    }

    return new Response(JSON.stringify({ 
      message: aiMessage,
      evaluationData: aiMessage // Will be expanded with structured data later
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Evaluation Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Evaluation failed',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
