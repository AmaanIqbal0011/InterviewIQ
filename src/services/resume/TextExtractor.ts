import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { ExtractionError, UnsupportedFileError } from "@/lib/errors/ResumeError";
import { hasExpectedSignature } from "@/lib/resume/fileSignature";
import {
  DOCX_MIME_TYPE,
  MAX_STORED_RESUME_TEXT_CHARS,
  PDF_MIME_TYPE,
  isAcceptedResumeMimeType,
  type ResumeMimeType,
} from "@/lib/resume/constants";

/** A scanned or malformed PDF can yield a handful of whitespace characters. */
const MIN_EXTRACTED_TEXT_CHARS = 40;

export interface TextExtractor {
  readonly mimeType: ResumeMimeType;
  extract(bytes: Uint8Array): Promise<string>;
}

/** What ResumeService needs from extraction; the factory is one implementation. */
export interface ResumeTextExtractor {
  extract(bytes: Uint8Array, mimeType: string): Promise<string>;
}

export class PdfTextExtractor implements TextExtractor {
  readonly mimeType = PDF_MIME_TYPE;

  async extract(bytes: Uint8Array): Promise<string> {
    const document = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(document, { mergePages: true });
    return text;
  }
}

export class DocxTextExtractor implements TextExtractor {
  readonly mimeType = DOCX_MIME_TYPE;

  async extract(bytes: Uint8Array): Promise<string> {
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    });
    return value;
  }
}

/**
 * Picks the extractor for a MIME type, verifies the file signature, and
 * normalises the text. Empty output (common for scanned PDFs) becomes an
 * ExtractionError with a user-facing message.
 */
export class TextExtractorFactory implements ResumeTextExtractor {
  private readonly extractors: ReadonlyMap<string, TextExtractor>;

  constructor(extractors: readonly TextExtractor[] = [new PdfTextExtractor(), new DocxTextExtractor()]) {
    this.extractors = new Map(extractors.map((extractor) => [extractor.mimeType, extractor]));
  }

  async extract(bytes: Uint8Array, mimeType: string): Promise<string> {
    if (!isAcceptedResumeMimeType(mimeType)) {
      throw new UnsupportedFileError();
    }

    const extractor = this.extractors.get(mimeType);
    if (!extractor) {
      throw new UnsupportedFileError();
    }

    if (!hasExpectedSignature(bytes, mimeType)) {
      throw new UnsupportedFileError();
    }

    let rawText: string;
    try {
      rawText = await extractor.extract(bytes);
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError({ cause: error });
    }

    const text = normalizeExtractedText(rawText).slice(0, MAX_STORED_RESUME_TEXT_CHARS);
    if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
      throw new ExtractionError();
    }

    return text;
  }
}

export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u0000/g, "")
    .trim();
}
