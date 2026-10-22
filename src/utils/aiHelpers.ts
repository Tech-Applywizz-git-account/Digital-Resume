export const buildSelectionPrompt = (resumeText: string) => `
Write a professional 250-word self-introduction script based on this resume:
${resumeText}
Instructions:
- Start with "Hello, my name is [Name]".
- Focus on key skills and strongest experience found in the text.
- Tone: Confident and natural.
- End with enthusiasm for contributing.
`;

/**
 * Generates a high-quality mock introduction script for local development and testing
 * when OpenAI/Azure API keys are not configured or quota is exceeded.
 */
export const generateMockIntroduction = (promptText?: string): string => {
  // Try to parse candidate name or job title from prompt if available
  let name = "Alex Morgan";
  let role = "Software Engineer";
  
  if (promptText) {
    const nameMatch = promptText.match(/(?:Name[:\s]+|I am\s+|Mr\.\s+|Ms\.\s+)([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (nameMatch && nameMatch[1]) name = nameMatch[1];

    if (/react|frontend|javascript|typescript|css|html/i.test(promptText)) {
      role = "Frontend & Full Stack Engineer";
    } else if (/python|data|machine learning|analytics/i.test(promptText)) {
      role = "Data & Machine Learning Engineer";
    } else if (/product manager|agile|scrum/i.test(promptText)) {
      role = "Product & Technical Program Manager";
    }
  }

  return `Hello, my name is ${name}. I am a passionate ${role} with extensive experience delivering robust, high-impact digital solutions.

Throughout my career, I have specialized in building modern architectures, collaborating with cross-functional teams, and transforming complex business requirements into intuitive, reliable products. I take pride in clean code, strong system design, and continuous optimization.

I am enthusiastic about bringing my dedication, technical problem-solving, and innovative mindset to your organization. Thank you for your time, and I look forward to contributing to your team's mission.`;
};

export const callOpenAI = async (
  prompt: string,
  ownerId?: string | null,
  ownerEmail?: string | null,
  taskType?: string | null
): Promise<string> => {
  // If explicitly configured for mock AI or running in local dev without OpenAI
  if (import.meta.env.VITE_USE_MOCK_AI === "true") {
    console.info("⚡ [DEV] VITE_USE_MOCK_AI is enabled. Using simulated AI introduction.");
    await new Promise((r) => setTimeout(r, 600)); // subtle delay to simulate generation
    return generateMockIntroduction(prompt);
  }

  try {
    const response = await fetch("/api/generate-introduction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        ownerId: ownerId || null,
        ownerEmail: ownerEmail || null,
        taskType: taskType || null,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.introduction && !data.introduction.includes("Please set AZURE_OPENAI_API_KEY")) {
        return data.introduction;
      }
      console.warn("⚠️ API returned mock/missing key message. Falling back to rich local mock.");
      return generateMockIntroduction(prompt);
    }
    
    console.warn(`⚠️ API responded with status ${response.status}. Using local mock fallback.`);
    return generateMockIntroduction(prompt);
  } catch (err) {
    console.warn("⚠️ Failed to reach /api/generate-introduction. Using local mock fallback for development:", err);
    return generateMockIntroduction(prompt);
  }
};

