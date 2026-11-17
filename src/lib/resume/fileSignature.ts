import { DOCX_MIME_TYPE, PDF_MIME_TYPE, type ResumeMimeType } from "./constants";

/**
 * The declared MIME type is user-controlled, so the parser also checks the
 * bytes. PDFs start with "%PDF-"; DOCX files are ZIP containers ("PK\x03\x04").
 */
export function hasExpectedSignature(
  bytes: Uint8Array,
  mimeType: ResumeMimeType,
): boolean {
  if (mimeType === PDF_MIME_TYPE) {
    const signature = "%PDF-";
    if (bytes.length < signature.length) return false;
    return signature
      .split("")
      .every((character, index) => bytes[index] === character.charCodeAt(0));
  }

  if (mimeType === DOCX_MIME_TYPE) {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  }

  return false;
}
