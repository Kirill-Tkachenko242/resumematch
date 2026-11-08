const WEIGHTS = { skills: 0.5, experience: 0.3, keywords: 0.2 };
const DEFAULT_SKILL_WEIGHT = 10;

const ALIASES = {
  js: 'javascript', ts: 'typescript', k8s: 'kubernetes',
  node: 'node.js', nodejs: 'node.js',
  postgres: 'postgresql', reactjs: 'react', 'react.js': 'react',
  'rest api': 'rest apis', 'restful api': 'rest apis', 'restful apis': 'rest apis',
};
const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'in', 'at', 'to', 'a', 'an']);

const round1 = (n) => Math.round(n * 10) / 10;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function norm(s) {
  const t = String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return ALIASES[t] || t;
}

// whole-word search, so "java" does not match "javascript"
function inText(term, text) {
  const variants = [term];
  if (term.includes(' ') && term.endsWith('s')) variants.push(term.slice(0, -1));
  return variants.some((v) =>
    new RegExp(`(?<![a-z0-9])${escapeRegex(v)}(?![a-z0-9])`, 'i').test(text)
  );
}

function scoreSkills(resume, job, weights = {}) {
  const have = new Set((resume.skills || []).map(norm));
  const text = (resume.text || '').toLowerCase();
  const w = {};
  for (const [k, v] of Object.entries(weights || {})) w[norm(k)] = Number(v) || 0;

  const required = [...new Set((job.required_skills || []).map(norm))].filter(Boolean);
  if (!required.length) return { score: null, matched: [], missing: [] };

  let total = 0;
  let got = 0;
  const matched = [];
  const missing = [];
  for (const s of required) {
    const weight = s in w ? w[s] : DEFAULT_SKILL_WEIGHT;
    total += weight;
    if (have.has(s) || inText(s, text)) {
      got += weight;
      matched.push(s);
    } else {
      missing.push(s);
    }
  }
  if (total === 0) return { score: null, matched, missing };
  return { score: round1((got / total) * 100), matched, missing };
}

function scoreExperience(resume, job, category = {}) {
  const minYears = Number(job.min_years_experience) || 0;
  const years = Number(resume.years_of_experience) || 0;
  const yearsScore = minYears > 0 ? Math.min(1, years / minYears) * 100 : 100;

  const accepted = [
    ...(category.accepted_degrees || []),
    ...(job.accepted_fields_of_study || []),
  ].map((x) => String(x).toLowerCase().trim()).filter(Boolean);

  let educationScore = 100;
  let educationMatch = null;
  if (accepted.length) {
    const edu = (resume.education || []).map((e) =>
      `${e.degree || ''} ${e.field || ''}`.toLowerCase()
    );
    educationMatch = edu.some((t) => accepted.some((a) => t.includes(a)));
    educationScore = educationMatch ? 100 : 0;
  }

  return {
    score: round1(0.7 * yearsScore + 0.3 * educationScore),
    years_have: years,
    years_needed: minYears,
    education_match: educationMatch,
  };
}

function scoreKeywords(resume, job) {
  const text = (resume.text || '').toLowerCase();
  const titleWords = String(job.title || '')
    .toLowerCase().split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  const keywords = [...new Set([...(job.nice_to_have_skills || []).map(norm), ...titleWords])]
    .filter(Boolean);
  if (!keywords.length) return { score: null, found: [], missing: [] };

  const found = keywords.filter((k) => inText(k, text));
  const missing = keywords.filter((k) => !found.includes(k));
  return { score: round1((found.length / keywords.length) * 100), found, missing };
}

function scoreMatch(resume, job, category = {}) {
  const parts = {
    skills: scoreSkills(resume, job, category.skill_weights),
    experience: scoreExperience(resume, job, category),
    keywords: scoreKeywords(resume, job),
  };

  let sum = 0;
  let wsum = 0;
  for (const [name, p] of Object.entries(parts)) {
    if (p.score === null) continue;
    sum += p.score * WEIGHTS[name];
    wsum += WEIGHTS[name];
  }

  return {
    overall: wsum ? round1(sum / wsum) : null,
    categories: {
      skills: parts.skills.score,
      experience: parts.experience.score,
      keywords: parts.keywords.score,
    },
    details: parts,
  };
}

module.exports = { scoreMatch, scoreSkills, scoreExperience, scoreKeywords };