const KEYWORDS = {
  Technology:  ['tech', 'software', 'developer', 'devops', 'cloud', 'cyber', 'iot', 'blockchain', 'saas', 'digital transformation', 'computing', 'web3', 'engineering', 'code', 'programming', 'hackathon', 'open source'],
  AI:          ['artificial intelligence', ' ai ', 'machine learning', 'deep learning', 'llm', 'generative ai', 'chatgpt', 'data science', 'neural', 'nlp', 'computer vision', 'prompt engineering', 'langchain', 'rag '],
  Startup:     ['startup', 'start-up', 'venture', 'entrepreneurship', 'incubator', 'accelerator', 'founder', 'pitch', 'demo day', 'seed', 'series a', 'bootstrapp', 'yc ', 'y combinator', 'indie hacker'],
  Finance:     ['finance', 'fintech', 'banking', 'investment', 'wealth', 'capital', 'trading', 'insurance', 'fund', 'asset management', 'crypto', 'defi', 'payments', 'lending', 'wall street'],
  Marketing:   ['marketing', 'advertising', 'brand', 'social media', 'seo', 'content', 'pr ', 'public relations', 'growth', 'demand gen', 'b2b marketing', 'product marketing', 'copywriting', 'analytics'],
  Healthcare:  ['medical', 'healthcare', 'health care', 'clinical', 'physician', 'nursing', 'nurse', 'pharma', 'cme', 'continuing medical', 'hospital', 'patient', 'cardiology', 'oncology', 'pediatric', 'orthopedic', 'dermatology', 'radiology', 'surgery', 'dental', 'mental health', 'therapy', 'biotech', 'medtech', 'telemedicine', 'primary care', 'internal medicine', 'emergency medicine', 'public health', 'epidemiology'],
  Legal:       ['legal', 'law ', 'lawyer', 'attorney', 'litigation', 'compliance', 'regulatory', 'contract', 'intellectual property', 'patent', 'trademark', 'legal tech', 'legaltech', 'paralegal', 'bar association', 'court', 'arbitration', 'mediation', 'corporate counsel', 'in-house counsel', 'cle ', 'continuing legal'],
};

/**
 * Classify text into an industry based on keyword matching.
 * Returns the best match or the provided default.
 */
function classifyIndustry(text, defaultIndustry = null) {
  if (!text) return defaultIndustry;
  const lower = ` ${text.toLowerCase()} `;

  let best = null;
  let bestCount = 0;

  for (const [industry, keywords] of Object.entries(KEYWORDS)) {
    const count = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
    if (count > bestCount) {
      bestCount = count;
      best = industry;
    }
  }

  return best || defaultIndustry;
}

module.exports = { classifyIndustry };
