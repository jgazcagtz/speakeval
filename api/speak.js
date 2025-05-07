export const config = {
  runtime: 'edge',
};

const validVoices = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, voice = "nova" } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid text input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const selectedVoice = validVoices.has(voice) ? voice : "nova";
    const maxLength = 4096;
    
    if (text.length > maxLength) {
      return new Response(JSON.stringify({ 
        error: `Text too long (max ${maxLength} characters)`,
        details: `Received ${text.length} characters`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: selectedVoice,
        input: text,
        response_format: "mp3"
      })
    });

    if (!ttsResponse.ok) {
      const error = await ttsResponse.json().catch(() => ({}));
      throw new Error(error.error?.message || 'TTS generation failed');
    }

    return new Response(ttsResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
        'X-Voice-Used': selectedVoice
      },
    });

  } catch (error) {
    console.error('TTS Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate speech',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
