# worker-email-inbound

LMTP front-end that receives mail for custom domains with inbound receiving
enabled. Fully decoupled from the existing SSH-managed outbound Postfix box
(`MAIL_SERVER_HOST`, used by `mail-server-ssh.ts` / `mail-alias.service.ts`) -
this worker only ever receives mail, it never sends.

## How mail reaches this worker

A dedicated Postfix host (separate from the outbound box) is provisioned once
and left alone - enabling inbound for a new domain never requires touching
this host, because its `virtual_mailbox_domains` map queries Postgres live.

`/etc/postfix/main.cf` on that host:

```
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-domains.cf
virtual_alias_maps = pgsql:/etc/postfix/pgsql-thread-reply.cf
virtual_transport = lmtp:inet:worker-email-inbound:2525
```

`/etc/postfix/pgsql-virtual-domains.cf` (accept mail only for domains the
platform has verified for inbound receiving):

```
hosts = <postgres host>
user = <db user>
password = <db password>
dbname = <db name>
query = SELECT 1 FROM email_domains WHERE domain='%s' AND inbound_enabled = true AND mx_verified = true
```

`/etc/postfix/pgsql-thread-reply.cf` accepts any `thread+<uuid>@domain`
local part in addition to real mailbox addresses, so VERP-style reply
addresses (see `ingest-processor.ts`) are routed the same way as normal mail:

```
query = SELECT '%u@%d' FROM email_domains WHERE domain='%d' AND inbound_enabled = true AND mx_verified = true
```

Domain owners point their MX record at this host's public hostname
(`INBOUND_MX_HOST` env var on the `api` service, checked by
`dns-verify.service.ts#verifyMX`).

## What this worker does

1. `onRcptTo` (in `lmtp-server.ts`) rejects (550) any recipient whose domain
   isn't `inbound_enabled && mx_verified` - defense in depth behind the
   Postfix-level filter above.
2. `onData` parses the full MIME message with `mailparser`, then hands it to
   `IngestProcessor.ingest()` once per accepted recipient.
3. `ingest-processor.ts` resolves the thread (VERP reply address, then
   `References`/`In-Reply-To` header match, then find-or-create by
   `(app_id, domain_id, contact_email)`), writes the `EmailMessage` row
   (idempotent on `message_id_header`), uploads attachments via the existing
   `AssetsClient`, and bumps `EmailThread.last_message_at`.

## Provisioning the mail host (outside this repo)

DNS delegation, firewall rules, and a TLS certificate for the inbound MX host
are an ops task, not covered by this worker's code - see the main
implementation plan for what is and isn't verifiable from a dev environment.
