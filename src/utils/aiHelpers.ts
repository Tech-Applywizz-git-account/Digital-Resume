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