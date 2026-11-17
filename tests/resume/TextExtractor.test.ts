import { beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
  extractRawText: vi.fn(),
}));

vi.mock("unpdf", () => ({
  extractText: libs.extractText,
  getDocumentProxy: libs.getDocumentProxy,
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: libs.extractRawText },
}));

import { ExtractionError, UnsupportedFileError } from "@/lib/errors/ResumeError";
import { DOCX_MIME_TYPE, PDF_MIME_TYPE } from "@/lib/resume/constants";
import {
  DocxTextExtractor,
  PdfTextExtractor,
  TextExtractorFactory,
} from "@/services/resume/TextExtractor";

const LONG_TEXT = "Ada Lovelace built analytical engines and wrote the first algorithm.";

function pdfBytes(contents = LONG_TEXT): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.7\n${contents}`);
}

function docxBytes(): Uint8Array {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
}

describe("PdfTextExtractor", () => {
  beforeEach(() => {
    libs.getDocumentProxy.mockResolvedValue({ numPages: 1 });
    libs.extractText.mockResolvedValue({ totalPages: 1, text: LONG_TEXT });
  });

  it("reads merged page text from unpdf", async () => {
    const extractor = new PdfTextExtractor();

    await expect(extractor.extract(pdfBytes())).resolves.toBe(LONG_TEXT);
    expect(libs.getDocumentProxy).toHaveBeenCalledOnce();
    expect(libs.extractText).toHaveBeenCalledWith(
      expect.anything(),
      { mergePages: true },
    );
  });
});

describe("DocxTextExtractor", () => {
  beforeEach(() => {
    libs.extractRawText.mockResolvedValue({ value: LONG_TEXT, messages: [] });
  });

  it("reads raw text from mammoth", async () => {
    const extractor = new DocxTextExtractor();

    await expect(extractor.extract(docxBytes())).resolves.toBe(LONG_TEXT);
    expect(libs.extractRawText).toHaveBeenCalledOnce();
  });
});

describe("TextExtractorFactory", () => {
  beforeEach(() => {
    libs.getDocumentProxy.mockResolvedValue({ numPages: 1 });
    libs.extractText.mockResolvedValue({ totalPages: 1, text: LONG_TEXT });
    libs.extractRawText.mockResolvedValue({ value: LONG_TEXT, messages: [] });
  });

  it("selects the PDF extractor by MIME type", async () => {
    const factory = new TextExtractorFactory();

    await expect(factory.extract(pdfBytes(), PDF_MIME_TYPE)).resolves.toContain(
      "Ada Lovelace",
    );
    expect(libs.extractText).toHaveBeenCalledOnce();
    expect(libs.extractRawText).not.toHaveBeenCalled();
  });

  it("selects the DOCX extractor by MIME type", async () => {
    const factory = new TextExtractorFactory();

    await expect(factory.extract(docxBytes(), DOCX_MIME_TYPE)).resolves.toContain(
      "Ada Lovelace",
    );
    expect(libs.extractRawText).toHaveBeenCalledOnce();
  });

  it("normalises whitespace and line endings", async () => {
    libs.extractRawText.mockResolvedValue({
      value: `${LONG_TEXT}   \r\n\r\n\r\n\r\nSecond paragraph.`,
      messages: [],
    });
    const factory = new TextExtractorFactory();

    const text = await factory.extract(docxBytes(), DOCX_MIME_TYPE);

    expect(text).not.toContain("\r");
    expect(text).not.toContain("\n\n\n");
  });

  it("rejects unsupported MIME types", async () => {
    const factory = new TextExtractorFactory();

    await expect(
      factory.extract(new Uint8Array([1, 2, 3]), "text/plain"),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it("rejects files whose bytes do not match the declared type", async () => {
    const factory = new TextExtractorFactory();

    await expect(
      factory.extract(docxBytes(), PDF_MIME_TYPE),
    ).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it("reports empty or scanned PDFs as extraction failures", async () => {
    libs.extractText.mockResolvedValue({ totalPages: 2, text: "   \n  " });
    const factory = new TextExtractorFactory();

    await expect(
      factory.extract(pdfBytes(), PDF_MIME_TYPE),
    ).rejects.toBeInstanceOf(ExtractionError);
  });
});
