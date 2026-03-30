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

export const parseResumeWithGPT = async (resumeText: string): Promise<any> => {
  const prompt = `
  Extract resume details from the provided text into a strictly formatted JSON object.
  If a field is not found, return an empty string or empty array. DO NOT create fake data.
  
  RESUME TEXT:
  ${resumeText}

  JSON STRUCTURE:
  {
    "name": "Full Name",
    "title": "Professional Title (e.g. AI Engineer)",
    "location": "City, Country",
    "education": "Recent Degree, University",
    "yearsOfExperience": "Number of years (e.g. 5+ years)",
    "keyMetric": "A single impressive metric (e.g. 70% accuracy boost)",
    "scaleAndReach": "A high-level impact statement",
    "summary": "2-sentence professional summary",
    "skills": [
      { "category": "Category Name", "items": ["Include", "exhaustive", "list", "of", "all", "skills", "tools", "and", "frameworks"] }
    ],
    "experience": [
      {
        "role": "Role Name",
        "company": "Company Name",
        "duration": "Jan 2020 - Present",
        "description": "A comprehensive 3 to 4 sentence paragraph describing core responsibilities and primary impact",
        "achievements": ["Achievement 1", "Achievement 2", "Achievement 3", "Achievement 4", "Achievement 5", "Achievement 6"],
        "active": boolean
      }
    ],
    "projects": [
      {
        "title": "Project Title",
        "description": "Detailed multi-sentence project description explaining the scope, context, and architecture",
        "problem": "Detailed explanation of the problem that was solved, including technical challenges",
        "impact": "Detailed explanation of the impact and results, including technical and business metrics",
        "techStack": ["List", "all", "involved", "technologies", "languages", "cloud services", "and", "frameworks"],
        "status": "Active" or "Completed"
      }
    ],
    "certifications": [
      { "title": "Cert Name", "issuer": "Issuer" }
    ],
    "blogs": [
      {
        "category": "Topic",
        "tag": "Tag",
        "title": "Blog Title",
        "description": "Short description",
        "date": "Date"
      }
    ],
    "linkedin": "https://linkedin.com/in/username (or empty string if not found)",
    "github": "https://github.com/username (or empty string if not found)",
    "email": "user@example.com (or empty string if not found)"
  }
  
  RESPONSE RULES:
  - Return ONLY valid JSON.
  - No markdown formatting (no \`\`\`json).
  - No explanations.
  - If data missing for standard fields, use "" or [].
  - projects.status must be exactly "Active" or "Completed".
  - For 'blogs', GENERATE 2-3 realistic technical blog entries based ONLY on the projects, experience, and skills mentioned. Focus on real-world use cases (dashboards, analysis, automation). Do NOT invent unrelated content. Keep concise.
  - For 'experience.achievements', provide a MAXIMUM of 6 points. Each point MUST be detailed, comprehensive, and elaborative (2 to 3 sentences per bullet), fully explaining what was done, the technologies used, and the specific impact. Do NOT keep them short.
  - For 'projects.techStack', you MUST provide AT LEAST 5 distinct technologies or tools per project. Break down compound technologies (e.g., separate 'Python (Pandas, NumPy)' into 'Python', 'Pandas', 'NumPy'). If fewer than 5 are explicitly mentioned, reasonably infer closely related standard tools to reach a minimum of 5 items.
  `;

  if (import.meta.env.PROD) {
    const response = await fetch("/api/parse-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error("Failed to parse resume");
    const data = await response.json();
    return data.parsed;
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
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });
    if (!response.ok) throw new Error("Failed to reach OpenAI API");
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }
};

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
