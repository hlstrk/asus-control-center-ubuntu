# Optional desktop statistics

No registration or report is attempted until the user chooses **Allow statistics**.
The choice persists in the user config directory. Turning it off clears pending
errors and local credentials. A request already in flight may finish; reports
already received remain until retention expires.

## Payload

Only schema version, random event UUID, app version, heartbeat/error kind,
Ubuntu/Linux category and numeric OS version, GNOME/KDE/other desktop,
X11/Wayland/unknown session, AMD/Intel/other CPU vendor, GPU vendor categories,
a fixed component category and a fixed error code are accepted. Error codes are
`operation_failed`, `shortcut_unavailable`, `app_panic`, `daemon_unavailable`.
No exception text, stack trace, hostname, account name, serial number, physical
hardware fingerprint, location, temperature history or recording is included.

The server issues a random installation UUID and a 256-bit opaque credential;
the client stores these with file mode 0600 and directory mode 0700. Reports are
pseudonymous: the same random installation can be counted across reports. This
is not a claim that Cloudflare or ordinary HTTP access logs never see an IP.
The feature’s database does not store IP addresses.

## Schedule and limits

Client: at most three normal attempts per UTC day, at least eight hours apart;
at most five error attempts per day, at least 60 seconds apart. The pending error
queue is bounded to five. Enrollment retries use persisted backoff; requests
have a six-second timeout and are not automatically retried by curl.

The service validates report fields, limits requests and rejects duplicates.
Server deployment and security configuration are not published in this repository.

Daily report counters and event deduplication records expire after approximately
30 calendar days; inactive installation credentials expire after 180 days.
Cleanup runs daily. Turning sharing off does not delete previously received data.

TLS validation is enabled. The development service produces aggregate counts.
Its deployment credentials are not shipped with the application.
