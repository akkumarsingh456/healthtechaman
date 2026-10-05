# AGENTS.md

- Every printed document saves an exact HTML snapshot in `issued_documents` keyed by a random code; its QR points to the public site `/verify?code=…`, served read-only by the `verify-document` function. Why: QR scans must show the identical document to anyone without login.
