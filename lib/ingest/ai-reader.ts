/**
 * Whether this server can read PDFs and text documents (safety data sheets,
 * EPDs, a routing as a PDF). That reading needs a Hugging Face key; without
 * one, spreadsheets and CSV files still read, and nothing else does.
 */
export const aiReaderOn = (): boolean => Boolean((process.env.HF_TOKEN ?? '').trim())

/** What a person sees when they send a PDF or text document to a server without the reader. */
export const NO_AI_READER =
  'Reading PDFs and text documents is not on in this beta. Upload the spreadsheet or CSV version, or add the lines to the case by hand.'
