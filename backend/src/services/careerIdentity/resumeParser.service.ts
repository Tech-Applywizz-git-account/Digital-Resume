import { environment } from '../../config/environment.js';

export interface AutoFillContext {
    profile?: {
        full_name?: string | null;
        first_name?: string | null;
        email?: string | null;
        phone?: string | null;
        location?: string | null;
        bio?: string | null;
    } | null;
    jobRequest?: {
        job_title?: string | null;
        job_description?: string | null;
    } | null;
    portfolioUrl?: string | null;
}

export function toTitleCase(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .trim();
}

/**
 * Strips generic ticket names (e.g. "New Digital Resume") and company suffixes
 * (e.g. "Full-Stack Developer Intern (Full-Time) - ApplyWizz" -> "Full-Stack Developer Intern")
 */
export function cleanJobTitle(title: string | null | undefined): string {
    if (!title) return '';
    let cleaned = title.trim();

    const genericTicketNames = [
        /^new digital resume$/i,
        /^digital resume$/i,
        /^applywizz digital resume$/i,
        /^career identity(?: request)?$/i,
        /^resume review$/i,
        /^resume$/i,
        /^n\/a$/i,
    ];
    for (const pattern of genericTicketNames) {
        if (pattern.test(cleaned)) return '';
    }

    // Strip company / employment suffixes from job titles
    cleaned = cleaned.replace(/\s*[-|–—]\s*[\w\s,.&]+$/i, '').trim();
    cleaned = cleaned.replace(/\s+(?:at|@)\s+[\w\s,.&]+$/i, '').trim();
    cleaned = cleaned.replace(/\s*\((?:full-time|part-time|contract|remote|hybrid)\)/i, '').trim();

    return cleaned;
}

/**
 * Validates and sanitizes geographic location, rejecting technical keywords mistakenly tagged as locations.
 */
export function cleanLocation(loc: string | null | undefined, fallback: string | null | undefined): string {
    if (!loc) return fallback || '';
    const trimmed = loc.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return fallback || '';

    // Rejection list: programming languages, technical skills, abnormal symbols
    const techWords = /\b(python|django|react|javascript|typescript|node|java|c\+\+|html|css|sql|aws|docker|kubernetes|developer|engineer|intern|frontend|backend|fullstack|programming|framework|git|database|api|rest)\b/i;
    if (techWords.test(trimmed)) return fallback || '';

    if (/[|;{}[\]<>=_#*]/.test(trimmed)) return fallback || '';

    return trimmed;
}

/**
 * Strips leading contact headers (phones, emails, links, pipes) from summary text.
 */
export function cleanSummaryText(text: string): string {
    if (!text) return '';

    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (/^(?:professional\s+)?summary\b/i.test(trimmed)) return false;
        if (/^(?:about\s+me|profile|objective)\b/i.test(trimmed)) return false;

        const hasEmail = /\S+@\S+\.\S+/.test(trimmed);
        const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/.test(trimmed);
        const hasPipes = (trimmed.match(/\|/g) || []).length >= 2;
        const hasUrls = /(?:linkedin|github|portfolio|http)/i.test(trimmed);

        if ((hasEmail || hasPhone || hasUrls) && hasPipes) return false;
        if (hasEmail && hasPhone) return false;

        return true;
    });

    let cleaned = filteredLines.join('\n');
    // Fix hyphenated line breaks (e.g. "digital-\nplatform" -> "digital-platform")
    cleaned = cleaned.replace(/([a-zA-Z]+)-\s*\n\s*([a-zA-Z]+)/g, '$1 $2');
    return cleaned.trim();
}

/**
 * Fits as many 100% complete sentences as possible under the character limit (max 400).
 * Strips bullet marks (•, -, *) and forms clean, continuous prose/sentences without mid-sentence truncation.
 */
export function extractFittingSentences(summaryText: string, maxLimit = 400): string {
    const cleanedText = cleanSummaryText(summaryText);
    if (!cleanedText) return '';

    // Extract all candidate sentence chunks (whether separated by bullets, newlines, or periods)
    let rawChunks: string[] = [];
    const hasBullets = /(?:^|\n)\s*[•▪*]\s+/.test(cleanedText) || /(?:^|\n)\s*-\s+/.test(cleanedText);

    if (hasBullets) {
        const rawBullets = cleanedText
            .split(/(?:^|\n)\s*[•▪*]\s+|(?:^|\n)\s*-\s+/)
            .map(b => b.replace(/\s+/g, ' ').trim())
            .filter(b => b.length > 0);

        for (const bullet of rawBullets) {
            const sentenceMatches = bullet.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
            if (sentenceMatches && sentenceMatches.length > 0) {
                rawChunks.push(...sentenceMatches.map(s => s.replace(/\s+/g, ' ').trim()));
            } else {
                rawChunks.push(bullet);
            }
        }
    } else {
        const sentenceMatches = cleanedText.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
        if (sentenceMatches && sentenceMatches.length > 0) {
            rawChunks = sentenceMatches
                .map(s => s.replace(/\s+/g, ' ').trim())
                .filter(s => s.length > 10);
        } else {
            rawChunks = [cleanedText.replace(/\s+/g, ' ').trim()];
        }
    }

    const fittedSentences: string[] = [];
    let currentLength = 0;

    for (const raw of rawChunks) {
        let sentence = raw.trim();
        sentence = sentence.replace(/^[•\-\*▪\s]+/, '').trim();
        if (!sentence) continue;

        if (!/[.!?]$/.test(sentence)) {
            sentence += '.';
        }

        const addedLength = sentence.length + (fittedSentences.length > 0 ? 1 : 0);

        if (currentLength + addedLength <= maxLimit) {
            fittedSentences.push(sentence);
            currentLength += addedLength;
        } else {
            break;
        }
    }

    // Fallback: If 1st sentence alone is > maxLimit, try to take its first complete clause
    if (fittedSentences.length === 0 && rawChunks.length > 0) {
        const first = rawChunks[0].replace(/^[•\-\*▪\s]+/, '').trim();
        const firstClause = first.split(/[,;:.]\s+/)[0];
        const trimmed = firstClause ? `${firstClause.trim()}.` : first;
        if (trimmed.length <= maxLimit) {
            return trimmed;
        }
        return `${trimmed.slice(0, maxLimit - 5).trim()}...`;
    }

    return fittedSentences.join(' ');
}

export const extractFittingBullets = extractFittingSentences;

const CATEGORY_PREFIX_REGEX = /^(?:(?:frontend|backend|full[\s-]?stack|web|mobile|cloud|database|databases)\s+(?:technologies|skills)?|programming\s+languages|(?:programming|languages|frameworks|libraries|databases|database|platforms|devops|technical(?:\s*skills)?|core(?:\s*(?:strengths|competencies|skills))?|methodologies|soft\s*skills|technologies|skills|tools(?:\s*&\s*(?:platforms|technologies))?))[\s:-]+/i;

const JUNK_SKILL_TOKENS = new Set([
    'skills',
    'technical skills',
    'core skills',
    'core competencies',
    'soft skills',
    'tools & platforms',
    'tools',
    'platforms',
    'technologies',
    'development',
    'management',
    'analysis',
    'customer',
    'segmentation',
    'risk',
    'growth',
    'strengths',
    'frameworks',
    'languages',
    'databases',
    'methodologies',
    'architecture',
    'responsibilities',
    'experience',
    'activities',
    'projects',
    'education',
]);

/**
 * Cleans extracted skills: removes category headers, short fragments, and duplicates.
 * Preserves up to maxLimit (default 50) clean skills.
 */
export function getCleanSkills(rawSkills: string[], maxLimit = 50): Array<{ id: string; name: string }> {
    const seen = new Set<string>();
    const cleaned: Array<{ id: string; name: string }> = [];

    for (const raw of rawSkills || []) {
        if (!raw) continue;
        const parts = raw.includes(',') ? raw.split(',') : [raw];

        for (let part of parts) {
            part = part.trim().replace(CATEGORY_PREFIX_REGEX, '').trim();
            part = part.replace(/^[:\-\s,]+|[:\-\s,]+$/g, '').trim();
            if (!part) continue;

            const lower = part.toLowerCase();
            if (part.length > 1 && !JUNK_SKILL_TOKENS.has(lower) && !seen.has(lower)) {
                seen.add(lower);
                cleaned.push({
                    id: `skill_${Date.now()}_${cleaned.length}`,
                    name: part,
                });
                if (cleaned.length >= maxLimit) break;
            }
        }
        if (cleaned.length >= maxLimit) break;
    }

    return cleaned;
}

/**
 * Extracts education graduation year or year range from parser fields or source text.
 */
export function extractEducationYear(edu: any): string {
    if (edu.graduation_year) return String(edu.graduation_year);
    if (edu.passing_year) return String(edu.passing_year);
    if (edu.end_year) return String(edu.end_year);
    if (edu.field_of_study && /^(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|Present))?$/i.test(String(edu.field_of_study).trim())) {
        return String(edu.field_of_study).trim();
    }

    const textToSearch = [edu.end_date, edu.source_text, edu.start_date].filter(Boolean).join(' ');
    if (textToSearch) {
        // e.g. "Oct '23 — Sep '25" or "Jun '20 — Aug '23" or "2020 - 2023" or "2023 - Present"
        const rangeMatch = textToSearch.match(/(?:'(\d{2})|(19\d{2}|20\d{2}))[^\n\d]*[-—–][^\n\d]*(?:'(\d{2})|(19\d{2}|20\d{2})|(Present))/i);
        if (rangeMatch) {
            const startYear = rangeMatch[1] ? `20${rangeMatch[1]}` : rangeMatch[2];
            const endYear = rangeMatch[3] ? `20${rangeMatch[3]}` : (rangeMatch[4] || (rangeMatch[5] ? 'Present' : ''));
            if (startYear && endYear) {
                return `${startYear} - ${endYear}`;
            }
        }

        // Single 4-digit year like "May 2027" or "2025"
        const fourDigitYear = textToSearch.match(/\b(19\d{2}|20\d{2})\b/);
        if (fourDigitYear) return fourDigitYear[0];

        // Single 2-digit year like "'25"
        const twoDigitYear = textToSearch.match(/'(\d{2})\b/);
        if (twoDigitYear) return `20${twoDigitYear[1]}`;
    }

    return edu.field_of_study || '';
}

/**
 * Sends the resume PDF buffer to the internal ApplyWizard parser API.
 */
export async function callApplyWizardParser(fileBuffer: Buffer, fileName: string): Promise<any> {
    const parserUrl = environment.resumeParserApiUrl;
    console.log(`[ResumeParser] Calling parser at: ${parserUrl} for ${fileName} (${fileBuffer.length} bytes)`);

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, fileName || 'resume.pdf');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    try {
        const response = await fetch(parserUrl, {
            method: 'POST',
            headers: {
                accept: 'application/json',
            },
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Parser responded with status ${response.status}: ${errText}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Normalizes parser output into CareerIdentityContent format, with comprehensive sanitization & fallbacks.
 * NOTE: Avatar is deliberately untouched.
 */
export function adaptParserResponse(parsed: any, context: AutoFillContext): Record<string, unknown> {
    // 1. Identity
    const rawName = parsed?.personal?.name || context.profile?.full_name || context.profile?.first_name || '';
    const fullName = toTitleCase(rawName);

    // Headline: prioritize real headline or role over generic ticket titles
    const headline =
        cleanJobTitle(parsed?.personal?.headline) ||
        cleanJobTitle(parsed?.experience?.[0]?.job_title) ||
        cleanJobTitle(context.jobRequest?.job_title) ||
        'Professional';

    // 2. About Me (Fit complete bullets <= 400 chars, cleaned of contact headers)
    const summaryText = parsed?.summary || context.jobRequest?.job_description || context.profile?.bio || '';
    const about = extractFittingBullets(summaryText, 400);

    // 3. Core Skills (cleaned of category prefixes like "Frontend Technologies HTML5")
    const skills = getCleanSkills(parsed?.skills?.explicit || [], 50);

    // 4. Education (with extracted graduation year range for fieldOfStudy)
    const rawEducation = Array.isArray(parsed?.education) ? parsed.education : [];
    const education = rawEducation.slice(0, 3).map((edu: any, idx: number) => ({
        id: `edu_${Date.now()}_${idx}`,
        degree: edu.degree || (edu.level ? `${edu.level}'s Degree` : ''),
        institution: edu.institution || edu.university || edu.college || '',
        fieldOfStudy: extractEducationYear(edu),
    }));

    // 5. Contact Information
    let phone = parsed?.personal?.phones?.[0] || '';
    if (!phone && (parsed?.raw_text || parsed?.summary)) {
        const textForContact = `${parsed?.raw_text || ''}\n${parsed?.summary || ''}`;
        const phoneMatch = textForContact.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?91[-.\s]?\d{10}|\b\d{10}\b/);
        if (phoneMatch) phone = phoneMatch[0];
    }
    if (!phone) phone = context.profile?.phone || '';

    let linkedin = parsed?.personal?.linkedin?.[0] || '';
    if (!linkedin && (parsed?.raw_text || parsed?.summary)) {
        const textForContact = `${parsed?.raw_text || ''}\n${parsed?.summary || ''}`;
        const linkedinMatch = textForContact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
        if (linkedinMatch) linkedin = linkedinMatch[0];
    }

    const email = parsed?.personal?.emails?.[0] || context.profile?.email || '';
    const location = cleanLocation(parsed?.personal?.location, context.profile?.location);
    const website = context.portfolioUrl || parsed?.personal?.websites?.[0] || '';

    return {
        hero: {
            fullName,
            headline,
            verified: true,
            openToRelocate: true,
        },
        about,
        skills,
        education,
        contact: {
            email,
            phone,
            location,
            linkedin,
            website,
        },
    };
}
