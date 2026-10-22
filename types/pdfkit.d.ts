/**
 * pdfkit ships no TypeScript types and @types/pdfkit is not a dependency here,
 * so every `PDFKit.PDFDocument` in lib/pdf-generator.ts was a type error
 * (19 of them) and the import itself a 20th. Declaring the shape the code
 * already assumes costs nothing at runtime and keeps the type-check output
 * readable, so a real error in that file is visible instead of buried.
 */
declare module 'pdfkit' {
  const PDFDocument: any;
  export default PDFDocument;
}

declare namespace PDFKit {
  type PDFDocument = any;
}
