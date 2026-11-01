---
name: cafe-api
description: "Use only when a GitCafe operation has no typed cafe command (check cafe --help and the cafe-pr, cafe-issues, and cafe-admin skills first): call any REST endpoint with cafe api (authenticated, JSON body building, pagination), and discover endpoints from the host's live OpenAPI document. Do not use when a typed cafe command covers the operation, and not for non-GitCafe APIs."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:68d12739623869a0a01f5af0756e4bb72feaee285de9f34518812f886693fec7
  short-description: Raw GitCafe REST calls when no typed command exists
---

# GitCafe raw API access

Read the `cafe-cli` skill first (`cafe skills show cafe-cli`) for the base
contract. Prefer a typed command (`cafe pr ...`, `cafe repo ...`) when one
exists; this escape hatch is for everything else. `cafe api` sends the
stored credential (or `CAFE_TOKEN`) automatically.

## Shape

The endpoint is a path under the API root (or a same-origin absolute URL).
With the default host, `cafe api /repos/<owner>/<repo>` requests
`https://git.cafe/api/repos/...`.
Paths copied from the OpenAPI document, which include `/api`, work too. The
method defaults to GET, or POST once the request has a body. Responses
print as-is (the endpoint's own JSON, no envelope), so read or `jq` them
directly; adding `--json` wraps the response in the standard envelope under
`data`.

```sh
cafe api /auth/identity
cafe api /users/search --raw-field q=<handle>
cafe api /repos/<owner>/<repo>
```

## Bodies and headers

`--field` builds a typed JSON body field (numbers, booleans, null parsed);
`--raw-field` always sends a string. Both are repeatable, and with GET/HEAD
they become query parameters instead. `--input` sends a file (or `-` for
stdin) as the body.

```sh
cafe api /repos/<owner>/<repo>/issues --method POST --field title="From the raw API"
cafe api /repos/<owner>/<repo>/issues/<n> --method PATCH --field priority=2
cafe api /repos/<owner>/<repo>/pulls --method POST --input /tmp/pr.json
cafe api /repos/<owner>/<repo> --header "Accept: application/json"
```

## Pagination

`--paginate` follows the `Link: <…>; rel="next"` header every list sets, or a
`{ items, next }` body cursor (via `?after`), and prints one JSON body per page.
It warns when the first page has neither.

```sh
cafe api /repos/<owner>/<repo>/issues --paginate
```

## Discovering endpoints

The host serves its full OpenAPI document live; fetch it and search for the
resource you need. It is large, so filter with `jq` rather than reading it
whole.

```sh
cafe api /openapi/json > /tmp/openapi.json
jq '.paths | keys' /tmp/openapi.json
jq '.paths | keys[] | select(test("pulls"))' /tmp/openapi.json
```

## Gotchas

- `--response-headers` mirrors response headers to stderr.
- 401 means ask the user to run `cafe auth login`; 403 usually means the
  device grant or token lacks a scope for that endpoint.
- Endpoints and schemas are host-version specific: trust the live OpenAPI
  document over memory.
