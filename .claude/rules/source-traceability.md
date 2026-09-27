# Every Number Must Trace to a Source

**Every number must answer "where did this come from" — enforce this at the
schema level, not just by convention.**

- Never persist a `QoEAdjustment` or `RedFlag` without a real
  `source_gl_line_ids` or `source_document`.
- One with an empty `source_gl_line_ids` and no `source_document` is not a
  partial success to degrade gracefully into; it's a bug.
- If a new detection rule or agent can't cite a source, it shouldn't
  produce output at all rather than producing an untraceable one.
