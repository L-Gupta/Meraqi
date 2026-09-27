# Data Room Scale Has No Tested Upper Bound

`BackgroundTasks`-based processing is documented as sufficient for
<50K-row files; a real ~20-document data room (`docs/PRD.md`'s MVP bar)
should fit comfortably, but don't assume arbitrary scale.

Flag it if a new feature's design implicitly depends on processing time or
memory bounds that haven't been tested.
