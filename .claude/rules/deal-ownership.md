# Deal Ownership and IDOR Defense

- **Never bypass `require_deal_owner` on a deal-scoped route**, and never
  reimplement the ownership check inline instead of using the shared
  dependency (`app/api/v1/deps.py`).
- **Ownership failures are always `404`, never `403`.** `require_deal_owner`
  deliberately returns `404` for both "deal doesn't exist" and "deal exists
  but isn't yours" — don't add a `403` path anywhere in deal-scoped code;
  doing so would leak which `deal_id`s are valid to a caller who doesn't
  own them. This is the app's core IDOR defense.
- **Every new deal-scoped endpoint gets added to the IDOR regression
  suite** — `test_authorization.py`'s `_DEAL_SCOPED_GET_ENDPOINTS` list (or
  the equivalent POST/PATCH coverage). This is not optional coverage; a new
  endpoint that isn't in it is untested for the one vulnerability class
  this app is most exposed to.
- **Multi-tenant boundary is currently single-owner-per-deal — treat that
  as a hard boundary, not a POC shortcut to casually erode.** Per
  `docs/PRD.md` §2/§4, TAM's target users are multi-analyst teams at
  advisory firms, but the current auth model has no team/sharing concept —
  every deal belongs to exactly one user, enforced by `require_deal_owner`.
  Do not add a workaround (e.g. a shared service account, a
  deal-visible-to-all flag) to simulate team access; that would be building
  unreviewed multi-tenancy through the back door. Real multi-analyst access
  is a deliberate future design (PRD.md §3.2/§8), not something to
  approximate ad hoc.
