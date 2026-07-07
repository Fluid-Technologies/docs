# Loom script: Fluide multi-tenancy for developers (~2 min)

**Target length:** ~2:00  
**Audience:** Engineers integrating via Fluide Connect  
**Sandbox:** `https://test.api.fluidehr.com`  
**Verified:** 2026-07-07 against sandbox dev account (SERVICE_PARTNER, 2 workspaces, 1 client company)

---

## Test account env (recording prep)

Set these before recording. **Do not show password or API secret on screen.**

```bash
export FLUIDE_BASE_URL="https://test.api.fluidehr.com"
export FLUIDE_EMAIL="ceyey84315@icotz.com"
export FLUIDE_PASSWORD="test1234"   # keep off-screen; use env only

# Populated after sign-in / authorize/current (verified values):
export FLUIDE_API_KEY="fl_dev_ARwhIMARpin9SAifD7LXba-g"
export FLUIDE_TENANT_ID="bbde8827-4f1a-4dfb-833d-98a49e8b3c9c"
export FLUIDE_WORKSPACE_ID="b03fa178-67bd-4378-a5aa-d169c01ccb6f"   # workspace "Hr"
export FLUIDE_COMPANY_ID="ab2df10a-c66c-4bef-b7d6-efda26cca494"     # client "Acme Corp"
export FLUIDE_API_SECRET="..."   # from Connect dashboard; never commit or show on camera
```

**Account snapshot (sandbox):**

| Field | Value |
| --- | --- |
| Org | Tanjiro Uchiha's organization |
| Kind | `PARTNER` / `SERVICE_PARTNER` |
| Workspaces | `Default workspace`, `Hr` (1 client: Acme Corp) |
| API plan | `api_business` |

---

## Before you record

**On screen:**

1. Fluide Connect docs → [Multi-tenancy](https://fluide.mintlify.app/getting-started/multi-tenancy)
2. Terminal with env vars loaded (blur password/secret in post)

---

## 0:00 — Hook (10 sec)

**[Screen: Multi-tenancy title + comparison table]**

> “Every Fluide API call is scoped to a tenant. Get that wrong and you hit the wrong customer’s data — or auth fails. There are only **two models** you need to know.”

---

## 0:10 — Two models (20 sec)

**[Screen: comparison table]**

> “**Organization tenancy** — one Fluide Business customer. Context is `tenantId` on your JWT.
>
> **Partner tenancy** — you’re a SaaS serving **many merchants**. One developer API key, but you pass **workspace** and **acting company** headers on every product call.
>
> A partner org is still an organization — it also owns workspaces and client companies underneath.”

---

## 0:30 — Get a token (20 sec)

**[Screen: terminal — sign-in or token exchange]**

> “First, authenticate. For server integrations, exchange your API key and secret. For demos, sign-in works too — both return a JWT with `tenantId`.”

### Option A — Machine token (production integrations)

```bash
curl -sS -X POST "$FLUIDE_BASE_URL/api/v1/authorize/token" \
  -H "X-Fluide-Api-Key: $FLUIDE_API_KEY" \
  -H "X-Fluide-Api-Secret: $FLUIDE_API_SECRET" \
  -H "X-Fluide-Client-Id: fluide-developer" | jq .
```

**Verified response shape:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "tenantId": "bbde8827-4f1a-4dfb-833d-98a49e8b3c9c",
    "fluideClientId": "fluide-developer",
    "exp": 1783389038
  }
}
```

```javascript
const res = await fetch(`${process.env.FLUIDE_BASE_URL}/api/v1/authorize/token`, {
  method: 'POST',
  headers: {
    'X-Fluide-Api-Key': process.env.FLUIDE_API_KEY,
    'X-Fluide-Api-Secret': process.env.FLUIDE_API_SECRET,
    'X-Fluide-Client-Id': 'fluide-developer',
  },
});
const { data } = await res.json();
const accessToken = data.accessToken;
const tenantId = data.tenantId; // bbde8827-4f1a-4dfb-833d-98a49e8b3c9c
```

### Option B — Sign-in (Connect dashboard / quick demo)

```bash
curl -sS -X POST "$FLUIDE_BASE_URL/api/v1/auth/sign-in" \
  -H "Content-Type: application/json" \
  -H "X-Fluide-Client-Id: fluide-developer" \
  -d "{\"email\":\"$FLUIDE_EMAIL\",\"password\":\"$FLUIDE_PASSWORD\",\"fluideClientId\":\"fluide-developer\"}" \
  | jq -r '.data.accessToken.accessToken' > /tmp/fluide_token.txt

export FLUIDE_ACCESS_TOKEN="$(cat /tmp/fluide_token.txt)"
```

```javascript
const signIn = await fetch(`${process.env.FLUIDE_BASE_URL}/api/v1/auth/sign-in`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Fluide-Client-Id': 'fluide-developer',
  },
  body: JSON.stringify({
    email: process.env.FLUIDE_EMAIL,
    password: process.env.FLUIDE_PASSWORD,
    fluideClientId: 'fluide-developer',
  }),
});
const { data } = await signIn.json();
const accessToken = data.accessToken.accessToken;
const tenantId = data.accessToken.tenantId;
```

> “Point at **`tenantId`** — that’s the active organization. Ours is the partner org `bbde8827-…`.”

---

## 0:50 — Direct org call (15 sec)

**[Screen: curl — HR health, no acting headers]**

> “For a **single org**, product calls need Bearer, API key, and client id. No extra headers.”

```bash
curl -sS "$FLUIDE_BASE_URL/api/v1/hr/health" \
  -H "Authorization: Bearer $FLUIDE_ACCESS_TOKEN" \
  -H "X-Fluide-Api-Key: $FLUIDE_API_KEY" \
  -H "X-Fluide-Client-Id: fluide-developer"
```

**Verified response:** `{"success":true,"data":{"status":"ok","service":"fluide-hr"}}`

```javascript
const res = await fetch(`${process.env.FLUIDE_BASE_URL}/api/v1/hr/health`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Fluide-Api-Key': process.env.FLUIDE_API_KEY,
    'X-Fluide-Client-Id': 'fluide-developer',
  },
});
```

---

## 1:05 — Partner tenancy: list workspace + company (20 sec)

**[Screen: Connect docs acting-client table, then terminal]**

> “For **many merchants**, list workspaces and client companies under your partner org.”

```bash
# Workspaces (verified: "Default workspace" + "Hr")
curl -sS "$FLUIDE_BASE_URL/api/v1/workspaces" \
  -H "Authorization: Bearer $FLUIDE_ACCESS_TOKEN" \
  -H "X-Fluide-Client-Id: fluide-developer" | jq '.data.workspaces[] | {id, name, clientCount}'

# Client companies in workspace "Hr"
curl -sS "$FLUIDE_BASE_URL/api/v1/workspaces/$FLUIDE_WORKSPACE_ID/companies" \
  -H "Authorization: Bearer $FLUIDE_ACCESS_TOKEN" \
  -H "X-Fluide-Client-Id: fluide-developer" | jq '.data.companies[] | {id, name, countryCode}'
```

**Verified company:** `Acme Corp` — `ab2df10a-c66c-4bef-b7d6-efda26cca494` (CM / XAF)

```javascript
const wsRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
  headers: { Authorization: `Bearer ${accessToken}`, 'X-Fluide-Client-Id': 'fluide-developer' },
});
const { data: { workspaces } } = await wsRes.json();
// Hr workspace: b03fa178-67bd-4378-a5aa-d169c01ccb6f

const coRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/companies`, {
  headers: { Authorization: `Bearer ${accessToken}`, 'X-Fluide-Client-Id': 'fluide-developer' },
});
const { data: { companies } } = await coRes.json();
// Acme Corp: ab2df10a-c66c-4bef-b7d6-efda26cca494
```

---

## 1:25 — Acting-client product call (30 sec)

**[Screen: highlight `X-Workspace-Id` and `X-Acting-Company-Id`]**

> “Same token and API key — scope to a merchant with two headers on **every** product request.”

```bash
curl -sS "$FLUIDE_BASE_URL/api/v1/hr/employees?limit=3" \
  -H "Authorization: Bearer $FLUIDE_ACCESS_TOKEN" \
  -H "X-Fluide-Api-Key: $FLUIDE_API_KEY" \
  -H "X-Fluide-Client-Id: fluide-developer" \
  -H "X-Workspace-Id: $FLUIDE_WORKSPACE_ID" \
  -H "X-Acting-Company-Id: $FLUIDE_COMPANY_ID"
```

**Verified response:** HTTP 200 — `{ "items": [], "total": 0 }` (empty roster for Acme Corp; still proves correct tenant scoping)

```javascript
const res = await fetch(`${baseUrl}/api/v1/hr/employees?limit=3`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Fluide-Api-Key': process.env.FLUIDE_API_KEY,
    'X-Fluide-Client-Id': 'fluide-developer',
    'X-Workspace-Id': 'b03fa178-67bd-4378-a5aa-d169c01ccb6f',
    'X-Acting-Company-Id': 'ab2df10a-c66c-4bef-b7d6-efda26cca494',
  },
});
const { data } = await res.json();
// data.items → employees for Acme Corp only
```

> “Swap `X-Acting-Company-Id` for another merchant — same endpoint, different customer data. Store both IDs in your integration layer.”

---

## 1:55 — Close (5 sec)

**[Screen: “Choosing a model” table]**

> “One org → `tenantId` only. Many merchants → workspace plus acting company headers. Docs linked below.”

---

## Loom title & description

**Title:** `Fluide multi-tenancy in 2 minutes — org vs partner (ISV)`

**Description:**

```
How Fluide scopes API requests to the right customer.

• Organization tenancy → JWT tenantId
• Partner / ISV → X-Workspace-Id + X-Acting-Company-Id
• Live demo on sandbox (test.api.fluidehr.com)

Docs:
https://fluide.mintlify.app/getting-started/multi-tenancy
https://fluide.mintlify.app/getting-started/authorization

Sandbox: https://test.api.fluidehr.com
```

---

## Recording tips

- Blur `FLUIDE_PASSWORD` and `FLUIDE_API_SECRET` in post; use env vars on screen.
- Cursor-highlight `tenantId`, then `X-Workspace-Id` + `X-Acting-Company-Id`.
- Empty `employees` list is fine — mention “Acme Corp has no employees yet; the 200 confirms tenant scoping works.”
