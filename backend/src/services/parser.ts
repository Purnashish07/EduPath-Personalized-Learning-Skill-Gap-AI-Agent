import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import type { DocumentAnalysis } from '../store.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
]);

export function isAllowedDocumentFile(originalname: string, mimetype: string): boolean {
  const name = originalname.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const mime = (mimetype || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIMES.has(mime);
}

function makeUploadError(message: string, status = 400): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export async function extract(file: Express.Multer.File): Promise<string> {
  const name = file.originalname.toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!isAllowedDocumentFile(name, mime)) {
    throw makeUploadError(
      'Unsupported file format. Please upload a PDF, DOCX, TXT, or MD file.'
    );
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw makeUploadError('Uploaded file is empty.');
  }

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const header = file.buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw makeUploadError('Invalid PDF file signature.');
    }
    const parsed = await pdf(file.buffer);
    return parsed.text || '';
  }

  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    name.endsWith('.docx')
  ) {
    if (file.buffer.length < 2 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
      throw makeUploadError('Invalid DOCX file signature.');
    }
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value || '';
  }

  if (file.buffer.includes(0)) {
    throw makeUploadError('Invalid text file (binary bytes detected).');
  }

  return file.buffer.toString('utf8');
}

const KNOWN_TECHNICAL_SKILLS = [
  'Python',
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'FastAPI',
  'Django',
  'Flask',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'CI/CD',
  'Git',
  'PyTorch',
  'TensorFlow',
  'Scikit-learn',
  'Machine Learning',
  'Deep Learning',
  'Transformers',
  'Hugging Face',
  'RAG',
  'LLM Evaluation',
  'MLOps',
  'LangChain',
  'Data Structures',
  'Algorithms',
  'System Design',
  'Tailwind CSS',
  'HTML',
  'CSS',
  'GraphQL',
  'REST API',
  'Java',
  'C++',
  'Go',
  'Rust',
  'Pandas',
  'NumPy',
];

const KNOWN_SOFT_SKILLS = [
  'Problem solving',
  'Communication',
  'Leadership',
  'Collaboration',
  'Mentoring',
  'Agile',
  'Technical writing',
];

export function extractEvidenceFromText(text: string): DocumentAnalysis {
  const lower = text.toLowerCase();

  const technicalSkills = KNOWN_TECHNICAL_SKILLS.filter((skill) => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    return regex.test(lower);
  });

  const softSkills = KNOWN_SOFT_SKILLS.filter((skill) =>
    lower.includes(skill.toLowerCase())
  );

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const projects = lines
    .filter((line) => /project|built|developed|implemented|designed/i.test(line))
    .slice(0, 4)
    .map((line) => line.slice(0, 120));

  const certifications = lines
    .filter((line) => /certif|aws certified|coursera|udemy|google cloud/i.test(line))
    .slice(0, 4)
    .map((line) => line.slice(0, 100));

  const educationLine =
    lines.find((line) =>
      /b\.?tech|b\.?s\.?|m\.?s\.?|bachelor|master|computer science|university|college|engineering/i.test(
        line
      )
    ) || 'Not explicitly specified in document';

  let experience = 'Entry / Student';
  if (/\b([5-9]|1\d)\+?\s*years?\b/i.test(lower) || /\bsenior\b/i.test(lower)) {
    experience = 'Senior';
  } else if (/\b([2-4])\+?\s*years?\b/i.test(lower) || /\bengineer\b/i.test(lower)) {
    experience = 'Intermediate';
  }

  return {
    technicalSkills:
      technicalSkills.length > 0 ? technicalSkills : ['General Programming'],
    softSkills: softSkills.length > 0 ? softSkills : ['Problem solving'],
    projects,
    experience,
    certifications,
    education: educationLine.slice(0, 140),
  };
}
