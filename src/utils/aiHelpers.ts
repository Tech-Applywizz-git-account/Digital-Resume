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
  const response = await fetch("/api/generate-introduction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error("Failed to generate introduction");
  const data = await response.json();
  return data.introduction;
};