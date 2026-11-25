import 'dotenv/config';
import type {
  DocumentAnalysis,
  LearningPathPhase,
  PracticeQuestion,
  ProjectIdea,
  SkillGap,
} from '../store.js';

export const fallback: {
  profile: DocumentAnalysis;
  gaps: SkillGap[];
  path: LearningPathPhase[];
  practice: PracticeQuestion[];
  projects: ProjectIdea[];
} = {
  profile: {
    technicalSkills: ['Python', 'Machine Learning', 'RAG', 'Git', 'FastAPI'],
    softSkills: ['Problem solving', 'Communication'],
    projects: ['Document QA System', 'Recommendation API'],
    experience: 'Intermediate',
    certifications: [],
    education: 'Computer Science',
  },
  gaps: [
    {
      skill: 'Transformers',
      currentLevel: 2,
      requiredLevel: 4,
      status: 'Missing',
      priority: 'High',
      reason: 'Core foundation for modern LLM systems.',
      action:
        'Learn self-attention, implement a small Transformer block, then practice with Hugging Face.',
    },
    {
      skill: 'MLOps',
      currentLevel: 2,
      requiredLevel: 4,
      status: 'Weak',
      priority: 'High',
      reason: 'Required to deploy and operate production ML systems.',
      action:
        'Learn experiment tracking, CI/CD, Docker containers, and model latency monitoring.',
    },
    {
      skill: 'LLM Evaluation',
      currentLevel: 2,
      requiredLevel: 4,
      status: 'In Progress',
      priority: 'Medium',
      reason: 'Needed to measure quality, groundedness, and reliability of RAG/LLM systems.',
      action:
        'Study golden evaluation datasets, retrieval metrics (Recall@k, MRR), and LLM-as-judge patterns.',
    },
    {
      skill: 'Python',
      currentLevel: 4,
      requiredLevel: 4,
      status: 'Mastered',
      priority: 'Low',
      reason: 'Strong existing evidence.',
      action: 'Use Python for implementation tasks rather than repeating fundamentals.',
    },
  ],
  path: [
    {
      phase: 'Foundation',
      weeks: 2,
      objectives: ['Async Python patterns', 'Structured testing and FastAPI services'],
    },
    {
      phase: 'Core AI',
      weeks: 3,
      objectives: ['Transformers architecture', 'Scaled dot-product attention', 'Hugging Face fine-tuning'],
    },
    {
      phase: 'Production LLMs',
      weeks: 3,
      objectives: ['LLM Evaluation harnesses', 'RAG retrieval tuning', 'Tracing & observability'],
    },
    {
      phase: 'MLOps',
      weeks: 3,
      objectives: ['Dockerized model serving', 'CI/CD pipelines', 'Model drift monitoring'],
    },
    {
      phase: 'Portfolio',
      weeks: 2,
      objectives: ['Production RAG capstone project', 'System design & interview readiness'],
    },
  ],
  practice: [
    {
      id: 'p1',
      question: 'Why does scaled dot-product attention divide QK^T by sqrt(d_k) before softmax?',
      type: 'mcq',
      options: [
        'To prevent large dot products from pushing softmax into tiny-gradient regions',
        'To remove positional encodings from token embeddings',
        'To reduce the vocabulary size during decoding',
        'To guarantee factual accuracy without retrieval',
      ],
      answer: 'To prevent large dot products from pushing softmax into tiny-gradient regions',
      explanation:
        'When d_k is large, dot products grow in magnitude and saturate softmax gradients; scaling by 1/sqrt(d_k) keeps variance stable.',
      skill: 'Transformers',
      difficulty: 'Intermediate',
    },
    {
      id: 'p2',
      question: 'Which metric best measures whether a RAG retriever surfaced the relevant chunk in its top-k results?',
      type: 'mcq',
      options: [
        'Recall@k',
        'BLEU score',
        'Perplexity',
        'Learning rate warmup',
      ],
      answer: 'Recall@k',
      explanation:
        'Recall@k directly measures the proportion of queries where relevant ground-truth context appears within the top k retrieved chunks.',
      skill: 'LLM Evaluation',
      difficulty: 'Intermediate',
    },
    {
      id: 'p3',
      question: 'What is the primary benefit of multi-stage Docker builds for an ML inference API?',
      type: 'mcq',
      options: [
        'Smaller, more secure runtime images by excluding build-time compilers and caches',
        'Automatic GPU driver installation inside any container',
        'Zero-latency vector similarity search',
        'Skipping unit tests in CI/CD',
      ],
      answer: 'Smaller, more secure runtime images by excluding build-time compilers and caches',
      explanation:
        'Multi-stage builds keep heavy build dependencies in a builder stage so the production image stays lean and fast to deploy.',
      skill: 'MLOps',
      difficulty: 'Intermediate',
    },
    {
      id: 'p4',
      question: 'Why is causal masking required in decoder-only Transformer training?',
      type: 'mcq',
      options: [
        'So token i cannot attend to future tokens > i during parallel training',
        'To double the context window length automatically',
        'To replace layer normalization',
        'To convert embeddings into sparse one-hot vectors',
      ],
      answer: 'So token i cannot attend to future tokens > i during parallel training',
      explanation:
        'Autoregressive language modeling requires predicting the next token using only past and current tokens.',
      skill: 'Transformers',
      difficulty: 'Intermediate',
    },
  ],
  projects: [
    {
      title: 'Production-Ready RAG Knowledge Assistant',
      problem:
        'Build, evaluate, and deploy a citation-grounded RAG assistant with automated retrieval and faithfulness scoring.',
      difficulty: 'Advanced',
      duration: '2 weeks',
      skills: ['RAG', 'LLM Evaluation', 'MLOps'],
      techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
      features: [
        'Hybrid chunk retrieval with citations',
        'Automated golden-set evaluation pipeline',
        'Latency & token usage monitoring',
      ],
      outcomes: ['Evaluation-driven RAG architecture', 'Containerized production API'],
      stretchGoals: ['GitHub Actions eval gate', 'OpenTelemetry tracing'],
    },
    {
      title: 'Mini-Transformer From Scratch & Fine-Tuning Lab',
      problem:
        'Close core Transformer gaps by implementing multi-head self-attention from scratch and benchmarking a fine-tuned classifier.',
      difficulty: 'Intermediate',
      duration: '1 week',
      skills: ['Transformers', 'Python', 'Machine Learning'],
      techStack: ['Python', 'PyTorch', 'Hugging Face', 'Weights & Biases'],
      features: [
        'Unit-tested multi-head attention module',
        'Training loss & attention weight visualizations',
        'Inference latency comparison',
      ],
      outcomes: ['Deep intuition for attention mechanics', 'Reproducible training scripts'],
      stretchGoals: ['LoRA parameter-efficient fine-tuning', 'ONNX export'],
    },
  ],
};

function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    const startCandidates = [firstObj, firstArr].filter((i) => i >= 0);
    if (startCandidates.length === 0) throw new Error('No JSON found in LLM response');
    const start = Math.min(...startCandidates);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (end <= start) throw new Error('Invalid JSON boundaries in LLM response');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

export async function ai<T>(
  prompt: string,
  schemaHint: string,
  fallbackValue: T
): Promise<T> {
  const key = process.env.LLM_API_KEY?.trim();
  const url =
    process.env.LLM_API_URL?.trim() ||
    'https://api.openai.com/v1/chat/completions';

  if (!key) return fallbackValue;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL?.trim() || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are EduPath, a personalized learning agent. Return ONLY valid JSON. ${schemaHint}`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content || '';
    if (!content) return fallbackValue;

    return extractJson(content) as T;
  } catch (err) {
    console.warn('AI call failed, using deterministic fallback:', err);
    return fallbackValue;
  }
}
