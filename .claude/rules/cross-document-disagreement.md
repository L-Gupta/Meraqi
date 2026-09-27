# Cross-Document Disagreement Is a Signal, Never a Tiebreak

When two source documents disagree (GL vs. AR aging, GL-derived net debt
vs. contract-extracted debt terms), the existing pattern
(`_rule_cross_doc_tie_out_failures`,
`_rule_net_debt_reconciliation_mismatch`) is to surface the variance as a
Data Quality red flag, not to silently prefer one source over the other.

Any new cross-document logic follows this — never pick a "winner" between
two disagreeing source documents without surfacing that a disagreement
exists.
