---
description: "Install and configure the New API console to manage relay-site balances and daily check-ins in DSH Web."
kind: "package-bundle"
---

# @winterhuan/dsh-new-api

English | [中文](README.zh.md)

## Summary

Manage New API / One API relay sites from Settings → New API console in DSH Web. View account balances, separate check-in wallets and daily check-in status. Add sites with an access token or a session cookie, then check in manually or on a daily schedule. Release `1.0.0-winter.1` targets DSH `0.2.2-rc.1`; site credentials are stored in plaintext on the Host.

## Table of Contents

- [Use this package](#use-this-package)
- [Authentication and check-ins](#authentication-and-check-ins)
- [Data and access](#data-and-access)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Install the fixed Git release into a DSH `0.2.2-rc.1` profile:

```sh
dsh plugin --profile web add github:winterhuan/dsh-new-api#v1.0.0-winter.1
```

Restart the profile's Host and hard-refresh the browser, then open Settings → New API console. Remove the profile layer with `dsh plugin --profile web remove @winterhuan/dsh-new-api`; removal retains stored site data.

For local development, use Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`. Build the bundle in the plugin repository:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

Set `DSH_HOME` to an empty temporary directory before creating the development profile:

```sh
dsh --profile new-api-dev --from-default-profile web --dump-config > /dev/null
dsh plugin --profile new-api-dev add "$PWD"
```

Create a temporary documents directory before opening the browser. Replace the empty `[]` in `$DSH_HOME/profiles/new-api-dev/cordis.patch.yml` with this override, substituting the directory's absolute path:

```yaml
- id: workspace-controller
  config:
    documentsDirectory: /absolute/path/to/temporary/documents
```

Start the development server and open its printed URL:

```sh
dsh --profile new-api-dev --host 127.0.0.1 --port 0 --no-open
```

Open Settings → New API console. Add a site to see its balance and check-in status; the form also controls participation in automatic check-ins. Build again, restart this development process and hard-refresh the browser after source changes. Remove the development layer with `dsh plugin --profile new-api-dev remove @winterhuan/dsh-new-api`.

-----

<a id="authentication-and-check-ins"></a>
## Authentication and check-ins

Choose the authentication mode supported by each site. The plugin stores credentials supplied by you and does not log into sites.

| Mode | Credentials | Typical sites |
|---|---|---|
| `bearer` | Access token / PAT created in the site's account settings | New API `v1.0.0-rc.x` |
| `cookie` | Session cookie and numeric user ID for `New-Api-User` | Older New API / One API and some forks |

The plugin reads `/api/status` for capabilities and quota conversion, then `/api/user/self` for balances. It detects independent check-in wallets in the account response or supported wallet endpoints. A zero wallet balance remains visible; unsupported wallets are omitted. Each site's billing rules determine which balance a token consumes.

Automatic check-in defaults to 09:00 in the Host's local timezone with a per-site daily delay of 0–30 minutes. The global switch and each site's participation switch must both be enabled. A running Host checks due sites once per minute; failed attempts are limited to three per day, separated by at least 15 minutes. Successful, already-completed, unsupported and manual-verification results stop automatic attempts for that day.

The plugin checks today's status before posting to `/api/user/checkin`. It can fall back to `/api/user/sign_in` or `/api/user/check_in`; the site form accepts a custom check-in path. Turnstile or CAPTCHA requires manual verification in the site's browser.

-----

<a id="data-and-access"></a>
## Data and access

Sites, schedule settings and check-in results are stored in `$DSH_HOME/dsh-new-api/sites.json`, defaulting to `~/.dsh/dsh-new-api/sites.json`. This directory is shared by profiles using the same `DSH_HOME`. Tokens and cookies are stored in plaintext; browser and tool results expose masked values.

If this file is unreadable or invalid JSON, the console refuses reads and writes until you repair or restore it; it does not replace the file with an empty state.

The browser calls `POST /dsh-new-api/api` with `X-DSH-New-API: 1`. The route delegates Host/Origin checks and browser-session authentication to DSH's connection service, so anonymous and cross-site requests are rejected. Network and reverse-proxy deployments must still configure DSH for the public authority they expose.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The [bundle patch](cordis.patch.yml) mounts the Host plugin. The [Host entry](src/index.js) owns the JSON store, HTTP operations and scheduler, requiring `webServer`, `timer` and `connection`. It registers `newapi_sites` when its mounting context provides the optional `tools` service. The [Client entry](src/client.js) registers a localized settings section and sends operations to the Host route.

The source is imported from `newapi-manager.zip`, package `@local/newapi-manager@1.0.0`. The archive contains self-contained JavaScript, an icon and locale metadata; it supplies no TypeScript source or source maps. Maintain JavaScript under `src/`. `typecheck` checks syntax only. The build copies the browser module to committed `dist/client.js`, so an installable Git checkout requires no lifecycle build.

Tests use private temporary data directories and loopback fixtures. They exercise storage failures, authenticated request admission, quota refresh, account-switch races and core site operations without contacting real relay sites.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Repository development and profile isolation](https://github.com/winterhuan/dsh-creative/blob/develop/HANDOFF.md)

-----

<a id="model-experience"></a>
## Model Experience

### Site operations

#### What the model sees

When the mounting context supplies `tools`, the model can call `newapi_sites` to list, add, update, remove, refresh and check in sites, or read and save schedule settings. Results contain masked credentials and supported `quota.wallet` balances. The package adds no system instructions; settings-page activity alone does not submit model input.

#### Token effect

Tool declarations and returned site records consume model context when the tool is available and invoked. Credentials supplied in tool arguments enter the conversation; use the browser form when entering secrets.

#### KV Cache effect

The package adds no stable prompt prefix. Tool availability and returned site state can change the model request; cache reuse depends on the active preset and provider.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Turnstile, CAPTCHA and Cloudflare/WAF challenges require manual handling; the plugin does not bypass them.
- Site forks can differ in authentication, check-in endpoints and wallet fields. Restricted PATs may reject check-in routes; use credentials that the site authorizes for those operations.
- Automatic check-in requires a running Host. Profiles sharing a data directory must not run separate plugin instances concurrently.
- Agent tools require a mounting context with `tools`; ordinary Web loading does not guarantee that a Session receives `newapi_sites`.
- The import has JavaScript syntax checks and deterministic fixture tests. Real-site authentication and daily scheduled execution have not been validated.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
