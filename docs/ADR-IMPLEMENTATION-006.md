# ADR-IMPLEMENTATION-006: Bind preparation to local authority admission

Status: local native integration; cloud semantic/live-domain gates remain closed.

Problem: M4 preparation output was disconnected from the Coordinator wire path. A producer-supplied preparation claim must not become trusted simply by attaching JSON to a candidate. A checksum-only backup must not establish its own signing trust.

Decision: activated synthetic local datasets pin an exact semantic profile in locator/control. Coordinator validates its own binding-backed registry/policies and reconstructs candidate payload/inputs/proof before immutable storage and again at commit. Only ABSTAIN facts are accepted; Runtime checks profile pins but remains a readonly serving layer. Changes to an activated profile require explicit authority migration. Portable signature verification requires separate trusted configuration.

Counterexamples: future assertion issue time was not quarantined; control/commit shared command IDs could return the wrong result kind. Both now have independent native regression cases. These are implementation findings, not an overwrite of V2.1 or M4.

Validation: native Coordinator/R2/Runtime; expiry while prepared; zero-write rejection; DO eviction/idempotency; export-only native alarm; signed cold fallback; independent-trust signed backup and tamper rejection; typed command dedup. Exact local/cloud regression evidence and commit pins are recorded separately. Domain rules, authenticated operational identity, restore/offsite and production acceptance are not inferred from these results.
