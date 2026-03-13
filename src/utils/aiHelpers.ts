export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const buildSelectionPrompt = (resumeText: string) => `
Write a professional 250-word self-introduction script based on this resume:
${resumeText}
Instructions:
- Start with "Hello, my name is [Name]".
- Focus on key skills and strongest experience found in the text.
- Tone: Confident and natural.
- End with enthusiasm for contributing.
`;

export const callOpenAI = async (prompt: string): Promise<string> => {
  if (import.meta.env.PROD) {
    const response = await fetch("/api/generate-introduction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error("Failed to generate introduction");
    const data = await response.json();
    return data.introduction;
  } else {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 350,
      }),
    });
    if (!response.ok) throw new Error("Failed to reach OpenAI API");
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
};
