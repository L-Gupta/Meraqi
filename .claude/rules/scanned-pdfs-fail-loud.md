# Scanned PDFs Fail Loudly, Per Document

The contract parser handles digital/text-extractable PDFs only
(`pdfplumber`). Per `docs/PRD.md` §3.2, when it hits a scanned/image-only
PDF it must surface a clear, visible error identifying that specific file
as unparseable:

- not skip it silently,
- not block the rest of the pipeline,
- never fabricate contract terms from an empty/near-empty extraction.

Any change to contract parsing must preserve this fail-loud behavior.
