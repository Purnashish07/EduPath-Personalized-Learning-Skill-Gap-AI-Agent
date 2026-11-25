import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function extract(file: Express.Multer.File): Promise<string> {
  const name = file.originalname.toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const parsed = await pdf(file.buffer);
    return parsed.text || '';
  }

  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml') ||
    name.endsWith('.docx')
  ) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value || '';
  }

  if (
    mime.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.json')
  ) {
    return file.buffer.toString('utf8');
  }

  const err = new Error('Unsupported file format. Please upload a PDF, DOCX, TXT, or MD file.') as Error & {
    status?: number;
  };
  err.status = 400;
  throw err;
}
