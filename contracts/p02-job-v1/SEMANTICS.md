# P02 job v1 — semantics

Schema: `contracts/schemas/p02-job.v1.schema.json`. Vectors:
`contracts/fixtures/p02-job-v1/vectors.json`, checked by
`tools/quality/p02-job-v1.test.ts`. Owner and only consumer:
`libre-ai/personal-knowledge-workspace` (P02, information watch), which vendors
this schema byte-exact at a pinned commit of this authority.

## Scope

P02 runs two deployables over one PostgreSQL database: an API (Bun) that never
fetches a URL nor evaluates a rule, and a worker (Rust) that does both. A
`command` is what the API enqueues for the worker; a `result` is what the worker
records when a job ends. Nothing else crosses that boundary. The queue mechanics
(leases, attempts, dispatch) are storage, not contract.

v1 carries one operation, `fetch-source`. A new operation is a new accepted
payload: it follows `contracts/COMPATIBILITY.md` (coordinated change, all
consumers qualify first) or a new major.

## Trust

- Every string is untrusted data. A URL, a validator or a content type never
  becomes an instruction to an agent, a rule or a preference (P02 guarantee G7).
- The schema bounds shape only. The worker still applies its destination
  policy (public unicast only, ports 80/443, one DNS resolution per hop,
  re-validated redirects) to `operation.url`; a URL the schema accepts is not
  a URL the worker may reach.
- `url` and `finalUrl` refuse userinfo (no `@` before the first `/`), any
  scheme but `http`/`https`, whitespace and control characters, and more than
  2048 characters. Header values are printable ASCII, at most 1024 characters,
  so a validator cannot inject a header line.
- No body, title, content or credential is carried. A result records the size
  and BLAKE3 digest of the decoded body only.

## Commands

- `jobId` is unique per job. `tenantId` is the organization the job runs for;
  the worker reads the command under that tenant's row-level security context
  only.
- `idempotencyKey` is unique per tenant: enqueuing the same key twice yields one
  job (P02 guarantee G10).
- `validators` are the `ETag` / `Last-Modified` values of the previous fetch of
  the same URL, sent only on the first hop.

## Results

- `succeeded`: the HTTP exchange completed. `outcome` records the final hop,
  whatever its status: 304 sets `notModified`, a 429 or 404 is recorded as such
  (source health), and `body` (decoded size and BLAKE3 digest, both required)
  appears only when a body was read. `reasonCode` is absent.
- `refused`: the worker's policy refused the job (destination, scheme, port,
  credentials, redirect, size, encoding). `failed`: the attempt did not
  complete (DNS, connect, TLS, timeouts, protocol) or the job itself failed
  (`job.*`). Both carry a `reasonCode` and no `outcome`.
- `reasonCode` uses the worker's stable codes, `fetch.*` or `job.*`. It never
  carries a URL, a host or an address.
