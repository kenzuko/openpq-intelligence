# Disposable R2 credential revocation proof

This workflow performs only signed GET and read-only account API calls. It never deploys, writes/deletes R2 objects, creates/revokes tokens, or changes Runtime bindings. Current Runtime credentials must remain unchanged.

## Create the disposable credential

In Cloudflare, select **OpenPQ Intelligence**, account c61a28455fe22f30619b35dd80c2d495. Open R2 Object Storage > Overview > Account Details > API Tokens > Manage > Create Account API token.

Name: **openpq-r2-revoke-probe**. Permission: **Object Read only**. Scope: only **openpq-intelligence-canonical-isolated-test**. Copy the Access Key ID and Secret Access Key directly into GitHub environment **intelligence-test** as:

- R2_REVOKE_PROBE_ACCESS_KEY_ID
- R2_REVOKE_PROBE_SECRET_ACCESS_KEY

Keep R2_TEST_READ_ACCESS_KEY_ID and R2_TEST_READ_SECRET_ACCESS_KEY unchanged. Do not post secrets in chat, issues or logs.

Official creation reference: https://developers.cloudflare.com/r2/api/tokens/

## Baseline

Open Actions > **Isolated R2 credential revocation proof** > Run workflow > main. Choose **baseline**, leaving baseline_run_id empty. The runner verifies exact isolated scope, different probe/Runtime credentials, and real signed GET/hash equality for both credentials. Require BASELINE_PASS before proceeding. Record the successful run ID from its URL. The baseline artifact binds the credential fingerprint, account, bucket, exact immutable object and digest.

## Revoke, then prove denial

After baseline PASS, manually revoke only **openpq-r2-revoke-probe** in the same Cloudflare account. Leave both new GitHub secrets as their original values so the runner tests the old credential. Do not rotate them or revoke the Runtime credential.

Run the same workflow on main, choose **deny**, and enter the successful baseline run ID. The runner downloads that baseline from this repository, checks the unchanged credential fingerprint, confirms token removal/disablement via the account API, and probes signed GET. An accepted 403 must include AccessDenied or InvalidAccessKeyId; a separate Runtime GET must still return the same object/digest. A 404, signature error, timeout, network failure, changed secret or failed Runtime witness blocks the proof.

Only R2_DENIAL_OBSERVED completes this subset. Polling is bounded; rerun after control-plane propagation if token removal is not yet confirmed. Reported time starts when the probe starts, not at the owner's manual revoke, and does not prove global convergence. No writer/trust migration is resumed by this workflow. Full G1 remains incomplete.

After evidence is pinned in a new snapshot directory, remove the two disposable GitHub secrets. Keep the existing Runtime/deploy secrets.
