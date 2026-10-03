# Signed domain archive dependency closure

`verifyDomainRecoveryClosure` verifies a signed native authority snapshot against independently supplied public trust, the pinned semantic profile, the exact rule/config/policy/schema hash preimages, every prepared generation object read from R2, and the signed active publication. Missing, duplicated, extra or substituted dependencies fail closed. Artifact document builders are shared with admission so existing artifact hashes remain unchanged.

The verifier returns the original legacy JSON after signature and source digest verification, plus the verified projection and field freshness at an explicitly supplied evaluation time. Display lease expiry remains visible. This is archive readback, not a Runtime route, a new publication or permission to resume writers. It imports no executable commands or old positive authority into a recovery target.

Run `node scripts/rehearse-domain-recovery-closure.js`. It captures ten owned producer datasets through real Miniflare authority and R2, disposes each source, writes public archive bytes, then verifies in a fresh child process. Captured replay clocks are explicit; the rehearsal does not prove current live source health, cloud restore RPO/RTO or consumer cutover.

The included closure covers native control/audit/commands/outbox, the semantic profile, four semantic artifact documents, all prepared generation objects, and the active signed publication. It does not cover deployment code, scheduler state, storage credentials, other dataset authorities, retention or complete system recovery. Frozen recovery's resume gate remains closed.
