export interface Experience {
  role: string;
  company: string;
  duration: string;
  description: string;
  achievements: string[];
  active: boolean;
}

export interface Project {
  title: string;
  description: string;
  problem: string;
  impact: string;
  techStack: string[];
  status: "Active" | "Completed";
}

export interface BlogPost {
  category: string;
  tag: string;
  title: string;
  description: string;
  date: string;
}

export interface ParsedResumeData {
  name: string;
  title: string;
  location: string;
  education: string;
  yearsOfExperience: string;
  keyMetric: string;
  scaleAndReach: string;
  summary: string;
  skills: { category: string; items: string[] }[];
  experience: Experience[];
  projects: Project[];
  certifications: { title: string; issuer: string }[];
  blogs: BlogPost[];
  linkedin: string;
  github: string;
  email: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractBetween(text: string, starts: string[], ends: string[]): string {
  const lower = text.toLowerCase();
  let start = -1;
  for (const s of starts) {
    const idx = lower.indexOf(s.toLowerCase());
    if (idx !== -1) { start = idx; break; }
  }
  if (start === -1) return '';

  let end = text.length;
  for (const e of ends) {
    const idx = lower.indexOf(e.toLowerCase(), start + 10);
    if (idx !== -1 && idx < end) end = idx;
  }
  return text.slice(start, end).trim();
}

function extractName(text: string): string {
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'Professional';
  
  // Rule 1: First line in ALL CAPS is treat as name
  const firstLine = lines[0];
  if (firstLine === firstLine.toUpperCase() && firstLine.length > 5 && firstLine.length < 50 && !firstLine.includes('@')) {
    let clean = firstLine.replace(/[^a-zA-Z\s]/g, '').trim();
    return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  for (const line of lines.slice(0, 5)) {
    if (
      line.length > 5 &&
      line.length < 50 &&
      !line.includes('@') &&
      !line.match(/\d/) &&
      !line.match(/https?:\/\//i) &&
      !line.match(/linkedin|github|email|phone|experience|summary|skills/i) &&
      line.split(' ').length >= 2
    ) {
      let clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
      return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }
  return 'Professional';
}

function extractTitle(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const roles = ['Data Scientist', 'AI Engineer', 'Machine Learning Engineer', 'Software Engineer', 'Full Stack Developer', 'Data Analyst', 'Lead Engineer'];
  
  for (const line of lines.slice(0, 15)) {
    for (const role of roles) {
      if (line.toLowerCase().includes(role.toLowerCase())) {
        // Rule: Take words BEFORE "with", "having", "experienced in", ","
        const cleanLine = line.split(/with|having|experienced in|,|and/i)[0].trim();
        // If it looks like a full sentence, just return the role
        if (cleanLine.length > 40) return role;
        return cleanLine.replace(/[^a-zA-Z\s]/g, '').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }
  return '';
}

function extractLocation(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerLines = lines.slice(0, 8).join(' ');
  
  // Try to find common city patterns or text before contact info
  const contactMatch = headerLines.match(/([^|•,\n]{3,30})(?:\s+[|\d(]|\s+[a-zA-Z0-9._%+-]+@)/);
  if (contactMatch && !contactMatch[1].match(/linkedin|github|portfolio|http/i)) {
    const loc = contactMatch[1].trim();
    if (loc.length > 3 && loc.length < 30) return loc;
  }

  const match = text.match(
    /\b(San Francisco|New York|Los Angeles|Chicago|Austin|Seattle|Boston|Remote|Bengaluru|Hyderabad|Chennai|Mumbai|Pune|Delhi|London|Toronto|Sydney)[^,\n]{0,20}/i
  );
  return match ? match[0].trim() : '';
}

function extractEducation(text: string): string {
  const section = extractBetween(text, ['education', 'academic'], ['experience', 'skills', 'certification', 'project']);
  if (!section) return '';
  const lines = section.split('\n').map(l => l.trim()).filter(l => l.length > 10 && !l.toLowerCase().includes('education'));
  if (lines.length === 0) return '';
  
  // Rule: Extract full degree + university cleanly, abbreviate common degrees
  let firstLine = lines[0]
    .replace(/Master of Science/gi, 'MS')
    .replace(/Bachelor of Technology/gi, 'B.Tech')
    .replace(/Bachelor of Science/gi, 'BS')
    .replace(/Master of Technology/gi, 'M.Tech')
    .replace(/in\s+/gi, '')
    .trim();

  const parts = firstLine.split(/,|at|from/i);
  if (parts.length >= 2) {
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  }
  return firstLine;
}

function extractYearsExperience(text: string): string {
  const match = text.match(/(\d+\.?\d*)\s*\+?\s*years?(?:\s+of)?\s+(?:experience|professional|work|production)/i);
  if (match) return `${match[1]}+ Years Production`;
  return '';
}

function extractKeyMetric(text: string): string {
  const patterns = [
    /(\d+%\s+[^.|\n]{5,30})/i,
    /(?:reduced|improved|increased|boosted|cut|grew)\s+[^.|\n]{5,20}\bby\s+(\d+%|\d+x)/i,
    /(\d+x\s+[^.|\n]{5,30})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

const DEFAULT_BLOGS: BlogPost[] = [
  {
    category: "AI",
    tag: "RAG",
    title: "Optimizing RAG Pipelines for Enterprise Scale",
    description: "A deep dive into vector database sharding and retrieval strategies...",
    date: "Oct 12, 2023"
  },
  {
    category: "BACKEND",
    tag: "SPRING BOOT",
    title: "Building Scalable Microservices with Spring Boot",
    description: "Lessons learned from deploying high-throughput AI services in...",
    date: "Aug 24, 2023"
  },
  {
    category: "AI",
    tag: "LANGCHAIN",
    title: "The Future of LangChain in the Modern Stack",
    description: "Exploring the evolution of LLM orchestration and its impact on...",
    date: "Jun 05, 2023"
  }
];

function extractSummary(text: string): string {
  const section = extractBetween(
    text,
    ['professional summary', 'executive summary', 'profile summary', 'summary', 'about', 'objective'],
    ['experience', 'employment', 'education', 'skills', 'certification', 'project', 'background']
  );
  
  let rawText = '';
  if (section) {
    rawText = section.replace(/^(professional summary|executive summary|profile summary|summary|about|objective):?\s*/i, '').trim();
  } else {
    // If no explicit section, look for the first 2 long sentences after the header
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 30 && !l.includes('|') && !l.includes('@'));
    rawText = lines.slice(0, 2).join(' ');
  }

  // Rule: Remove bullets, limit to 2 lines
  let clean = rawText.replace(/^[•·*-]\s*/, '').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  if (sentences.length === 0) return '';
  
  return sentences.slice(0, 2).join('. ') + '.';
}


function extractSkills(text: string): { category: string; items: string[] }[] {
  const section = extractBetween(
    text,
    ['skills', 'technical skills', 'technologies', 'tech stack', 'competencies'],
    ['experience', 'employment', 'education', 'certification', 'project', 'achievements']
  );

  const raw = section || text;
  const techWords = raw.match(
    /\b(?:React|Angular|Vue|Node\.?js|Python|Java|C\+\+|Go|Rust|Ruby|PHP|Swift|Kotlin|TypeScript|JavaScript|SQL|NoSQL|PostgreSQL|MySQL|MongoDB|Redis|Docker|Kubernetes|AWS|Azure|GCP|Git|GitHub|REST|GraphQL|GRPC|Spring|Django|Flask|FastAPI|Express|Next\.?js|TensorFlow|PyTorch|OpenAI|LangChain|Pinecone|Supabase|Firebase|Linux|Bash|CI\/CD|DevOps|Agile|Scrum|R|MATLAB|Spark|Hadoop|Kafka|Elasticsearch|Terraform|Ansible|Jenkins|JIRA|Figma|Sketch|Tailwind|Bootstrap|HTML|CSS|Sass)\b/gi
  ) || [];

  const unique = Array.from(new Set(techWords.map(s => s.trim()))).slice(0, 20);

  if (unique.length === 0 && section) {
    const fallback = section.split(/[,\n•|\/]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
    unique.push(...fallback.slice(0, 20));
  }

  const chunkSize = Math.ceil(unique.length / 4);
  const categories = ['Core Technologies', 'Frameworks & Tools', 'Cloud & Infrastructure', 'Other Skills'];
  return categories.map((cat, i) => ({
    category: cat,
    items: unique.slice(i * chunkSize, (i + 1) * chunkSize).filter(Boolean)
  })).filter(g => g.items.length > 0);
}

function extractExperience(text: string): Experience[] {
  const section = extractBetween(
    text,
    ['experience', 'employment', 'work history', 'professional experience', 'experience summary', 'work experience', 'career history'],
    ['education', 'skills', 'certification', 'project', 'publication', 'reference', 'contact', 'other']
  );

  const raw = section || text;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const experiences: Experience[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const combinedMatch = line.match(/^([^|–-]+)\s*[|–-]\s*([^|–-]+)\s*[|–-]\s*(.+)$/);
    
    if (combinedMatch || (line.length > 5 && line.length < 80 && !line.match(/20\d{2}/))) {
      if (line.split(' ').length > 10 && !combinedMatch) continue;
      if (['skills', 'education', 'certifications', 'projects', 'summary'].includes(line.toLowerCase())) continue;

      let role = '';
      let company = '';
      let duration = '';
      let descStartIndex = i + 1;

      if (combinedMatch) {
        role = combinedMatch[1].trim();
        company = combinedMatch[2].trim();
        duration = combinedMatch[3].trim();
      } else {
        role = line;
        const nextLine = lines[i+1] || '';
        const thirdLine = lines[i+2] || '';
        const periodMatch = (line + ' ' + nextLine + ' ' + thirdLine).match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d{2}|19\d{2})[^•\n]{0,30}(?:Present|Current|–|-|to)[^•\n]{0,20}/i);
        
        if (periodMatch) {
          company = nextLine.includes('|') ? nextLine.split('|')[0].trim() : nextLine;
          duration = periodMatch[0].trim();
          descStartIndex = i + 2;
        } else {
          continue;
        }
      }

      const achievements: string[] = [];
      let description = '';
      
      for (let j = descStartIndex; j < Math.min(descStartIndex + 10, lines.length); j++) {
        const descLine = lines[j];
        if (descLine.startsWith('•') || descLine.startsWith('-') || descLine.startsWith('*')) {
          achievements.push(descLine.replace(/^[•\-\*]\s*/, '').trim());
        } else if (!description && descLine.length > 15) {
          description = descLine;
        } else if (descLine.match(/^([^|–-]+)\s*[|–-]\s*([^|–-]+)\s*[|–-]\s*(.+)$/) || descLine.match(/20\d{2}/)) {
          break;
        }
      }

      if (role && company && role.length < 100) {
        experiences.push({
          role,
          company,
          duration: duration.toUpperCase(),
          description: description || '',
          achievements: achievements.length > 0 ? achievements.slice(0, 5) : [],
          active: /present|current/i.test(duration) || experiences.length === 0
        });
        i = descStartIndex + (achievements.length || 1);
      }
    }
    if (experiences.length >= 3) break;
  }

  if (experiences.length > 0) experiences[0].active = true;
  return experiences;
}

function extractProjects(text: string): Project[] {
  const section = extractBetween(
    text,
    ['projects', 'personal projects', 'key projects', 'academic projects', 'portfolio', 'featured projects'],
    ['experience', 'employment', 'education', 'skills', 'certification', 'achievements', 'contact', 'references']
  );

  const raw = section || text;
  const projects: Project[] = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  let currentProject: any = null;

  for (const line of lines) {
    if (line.length > 5 && line.length < 80 && !line.includes(':') && /^[A-Z]/.test(line) && !line.match(/20\d{2}/) && !line.includes('@')) {
      if (currentProject) projects.push(currentProject);
      currentProject = {
        title: line,
        description: '',
        problem: '',
        impact: '',
        techStack: [],
        status: 'Completed'
      };
    } else if (currentProject) {
      if (line.toLowerCase().includes('tech') || line.toLowerCase().includes('stack')) {
        const techMatch = line.match(/\b(?:React|Node|Python|JS|TS|AWS|SQL|NoSQL|Docker|Java|Spring|Redis|Kafka|OpenAI|LangChain|Spring Boot|Next\.js)\b/gi);
        if (techMatch) {
          currentProject.techStack = Array.from(new Set([...currentProject.techStack, ...techMatch]));
        }
      } else if (!currentProject.description && line.length > 15) {
        currentProject.description = line;
      } else if (!currentProject.problem && line.length > 20) {
        currentProject.problem = line;
      } else if (!currentProject.impact && (line.length > 20 || line.includes('%'))) {
        currentProject.impact = line;
      }
    }
    if (projects.length >= 4) break;
  }
  if (currentProject && projects.length < 4) projects.push(currentProject);

  return projects.map(p => ({
    ...p,
    description: p.description || '',
    problem: p.problem || '',
    impact: p.impact || '',
    techStack: p.techStack.length > 0 ? Array.from(new Set(p.techStack)) : [],
    status: 'Completed'
  })) as Project[];
}

function extractCertifications(text: string): { title: string; issuer: string }[] {
  const section = extractBetween(
    text,
    ['certifications', 'licenses', 'courses', 'awards', 'certification history', 'credentials'],
    ['experience', 'education', 'skills', 'project', 'contact', 'other', 'reference', 'background']
  );

  const defaultCerts = [
    { title: "Machine Learning Specialization", issuer: "DeepLearning.AI | Coursera" },
    { title: "Generative AI Professional", issuer: "Google Cloud" },
    { title: "AWS Solutions Architect", issuer: "Amazon Web Services" }
  ];

  if (!section) return [];

  // Split by newline OR bullet points that might be merged onto one line
  const lines = section.split(/\n|•|·|\*|\r/).map(l => l.trim()).filter(Boolean);
  const certifications: { title: string; issuer: string }[] = [];

  for (const line of lines) {
    let cleanLine = line.replace(/^(?:certifications|licenses|courses|awards|credentials)[\s:•·*-]+/i, '').trim();
    if (!cleanLine || cleanLine.length < 5) continue;
    
    // Check if it's just a section header
    if (['certifications', 'licenses', 'courses', 'awards', 'credentials'].includes(cleanLine.toLowerCase())) continue;
    
    const parts = cleanLine.split(/[:|–-]/);
    if (parts.length >= 2) {
      certifications.push({
        title: parts[0].trim(),
        issuer: parts[parts.length - 1].trim()
      });
    } else {
      const issuers = ['Coursera', 'Udemy', 'Google', 'AWS', 'Amazon', 'Microsoft', 'LinkedIn', 'IBM', 'Stanford', 'DeepLearning.AI'];
      let foundIssuer = 'Verified Institution';
      for (const iss of issuers) {
        if (cleanLine.toLowerCase().includes(iss.toLowerCase())) {
          foundIssuer = iss;
          break;
        }
      }
      
      certifications.push({
        title: cleanLine,
        issuer: foundIssuer
      });
    }
  }

  return certifications;
}

function normalizeUrl(url: string, base: string): string {
  if (!url) return '';
  let clean = url.replace(/[\[\]\(\)]/g, '').trim();
  if (!clean.startsWith('http')) {
    clean = 'https://' + clean;
  }
  return clean;
}
export function extractLinkedin(text: string): string {
  if (!text) return '';

  const socialPatterns = [
    /linkedin\.com\/in\/([^\s|)]+)/i,
    /github\.com\/([^\s|)]+)/i,
  ];

  const linkedinMatch = text.match(/linkedin\.com\/in\/([^\s|)]+)/i);
  if (linkedinMatch) {
    return `https://linkedin.com/in/${linkedinMatch[1].replace(/[\[\]\(\)]/g, '')}`;
  }

  // Fallback for fragmented lines
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes('linkedin.com/in/')) {
       const m = line.match(/linkedin\.com\/in\/([^\s|)]+)/i);
       if (m) return `https://linkedin.com/in/${m[1].replace(/[\[\]\(\)]/g, '')}`;
    }
  }

  return '';
}

export function extractGithub(text: string): string {
  if (!text) return '';

  const urlMatch = text.match(/github\.com\/([^\s|)]+)/i);
  if (urlMatch) {
    return `https://github.com/${urlMatch[1].replace(/[\[\]\(\)]/g, '')}`;
  }

  // Fallback for fragmented lines
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes('github.com/')) {
       const m = line.match(/github\.com\/([^\s|)]+)/i);
       if (m) return `https://github.com/${m[1].replace(/[\[\]\(\)]/g, '')}`;
    }
  }

  return '';
}

function extractEmail(text: string): string {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractSummaryDirect(text: string): string {
  return extractSummary(text);
}

// ─── Main Parser ─────────────────────────────────────────────────────────────
export function parseResumeText(text: string, fallbackName = '', fallbackEmail = ''): ParsedResumeData {
  if (!text || text.length < 50) {
    return {
      name: fallbackName || 'Professional',
      title: 'Full Stack Engineer',
      location: 'Remote',
      education: 'Bachelor of Technology, Computer Science',
      yearsOfExperience: '5+ Years Production',
      keyMetric: '99.9% System Availability',
      scaleAndReach: 'Scaling applications for 1M+ active users globally',
      summary: `${fallbackName || 'A'} high-impact professional with a focus on building scalable, user-centric digital experiences and robust technical architectures.`,
      skills: [
        { category: 'Core Technologies', items: ['React', 'Node.js', 'Typescript', 'SQL'] },
        { category: 'Frameworks & Tools', items: ['Next.js', 'Tailwind CSS', 'Docker', 'Git'] }
      ],
      experience: [
        {
          role: 'Senior Software Engineer',
          company: 'Global Solutions Tech',
          duration: 'Jan 2021 - Present',
          description: 'Leading the development of high-performance web applications and optimizing system performance.',
          achievements: ['Improved rendering speed by 40%', 'Managed a team of 4 developers'],
          active: true
        }
      ],
      projects: [
        {
          title: 'Infrastructure Modernization',
          description: 'Refactoring monolithic legacy code into microservices architecture.',
          problem: 'System downtime and slow deployment cycles.',
          impact: 'Reduced deployment time by 75%.',
          techStack: ['Node.js', 'Kubernetes', 'Docker'],
          status: 'Active'
        }
      ],
      certifications: [
        { title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services' }
      ],
      blogs: DEFAULT_BLOGS.map(b => ({ ...b, date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) })),
      linkedin: '',
      github: '',
      email: fallbackEmail,
    };
  }

  const experience = extractExperience(text);
  const projects = extractProjects(text);
  const achievements = experience.flatMap(e => e.achievements);
  const keyMetric = extractKeyMetric(text) || '10+ High Impact Contributions';
  const scaleAndReach = achievements.length > 1 ? achievements[1] : 'Driving innovation across cross-functional teams';

  const linkedin = extractLinkedin(text);
  const github = extractGithub(text);

  return {
    name: extractName(text) || fallbackName || 'Professional',
    title: extractTitle(text) || 'Software Engineer',
    location: extractLocation(text) || 'Remote',
    education: extractEducation(text) || 'University Degree',
    yearsOfExperience: extractYearsExperience(text) || '5+ Years Experience',
    keyMetric,
    scaleAndReach,
    summary: extractSummary(text) || 'Experienced software professional specialized in building modern web applications.',
    skills: extractSkills(text).length > 0 ? extractSkills(text) : [
      { category: 'General Skills', items: ['Software Development', 'Architecture', 'Problem Solving'] }
    ],
    experience,
    projects,
    certifications: extractCertifications(text).length > 0 ? extractCertifications(text) : [
      { title: 'Verified Professional', issuer: 'Verified Institution' }
    ],
    blogs: DEFAULT_BLOGS.map(b => ({ ...b, date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) })),
    linkedin,
    github,
    email: extractEmail(text) || fallbackEmail,
  };
}
