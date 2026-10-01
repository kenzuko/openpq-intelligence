# R2 revocation proof amendment: HTTP 401

Concrete counterexample: isolated deny run 36854890531 on commit 8b176ccc59be997d737077474216323a6bc901c6 confirmed removal of the disposable token through the account API, then observed HTTP 401 from the signed GET. The original proof accepted only recognized HTTP 403 responses and failed with R2_DENIAL_NOT_ESTABLISHED. This failed run is not a PASS. Baseline run 36853905022 had verified the same credential and immutable object with HTTP 200.

The probe now accepts HTTP 401 only after token removal/disablement is independently confirmed, the unchanged credential matches the successful baseline, and an independent Runtime credential reads the exact same object with HTTP 200 and the baseline digest. HTTP 403 continues to require AccessDenied or InvalidAccessKeyId. Missing objects, network failures, and unrecognized HTTP 403 remain failures. Reports retain the actual HTTP status.

Regression tests cover empty-body HTTP 401, missing removal confirmation, unavailable witnesses, and changed witness bytes. No production capability or worker deployment is introduced. The immutable V2.1 snapshot is unchanged. Full G1 remains NOT_PASSED.
