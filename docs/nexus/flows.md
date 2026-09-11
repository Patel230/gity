# Nexus flows

Flows describe real use cases, not arbitrary graph paths. A flow contains a
name, purpose, ordered steps, participants, connections, and sanitized data
movement summaries.

The player contract is:

- Previous
- Next
- Play / Pause
- Restart
- current step and progress

Playback should highlight the active nodes and edges in the same 2D graph and
explain why each connection is present. Payloads are summarized by shape or
meaning only; raw credentials, private values, and production records are
never displayed.

Initial flows may be explicitly authored from confirmed edges. Later versions
can suggest flows from normalized graph paths, but suggestions must be labeled
inferred and remain reviewable.
