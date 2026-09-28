/**
 * Drop processor-named payment paths and copy from published Pay and Books specs.
 * Runtime routes stay; Mintlify only sees what remains in the OpenAPI document.
 */

const PROVIDER_IN_SEGMENT = /flutterwave|stripe|ecobank/i;

const EXPLICIT_SCHEMA_RENAMES = {
  PrepareFlutterwaveInlineDto: "PrepareHostedCheckoutDto",
  CompleteFlutterwaveInlineDto: "CompleteHostedCheckoutDto",
};

const TEXT_KEYS = new Set(["description", "summary", "title"]);

const PHRASES = [
  [
    /Optional Flutterwave scenario key for sandbox testing\.?/gi,
    "Optional scenario key for sandbox testing.",
  ],
  [
    /Absolute redirect URL Flutterwave sends the user back to after authorization\.?/gi,
    "Absolute redirect URL the hosted checkout sends the user back to after authorization.",
  ],
  [
    /When true, include sanitized Flutterwave request\/response payloads for debugging\.?/gi,
    "When true, include sanitized processor request/response payloads for debugging.",
  ],
  [
    /Checkout app origin for Flutterwave return redirect/gi,
    "Checkout app origin for the hosted checkout return redirect",
  ],
  [
    /External provider customer id \(Stripe customer \/ Flutterwave customer\)/gi,
    "External provider customer id",
  ],
  [
    /External provider recurring contract id where applicable \(e\.g\. Stripe\)/gi,
    "External provider recurring contract id where applicable",
  ],
  [
    /Bank code \(e\.g\. Flutterwave bank id\) or MoMo network code \(MTN, ORANGE, …\)/g,
    "Bank code or mobile-money network code (MTN, ORANGE, …)",
  ],
  [/Customer email for Flutterwave customer creation/gi, "Customer email for checkout"],
  [/Plain card number \(Flutterwave card collect\)/gi, "Plain card number"],
  [
    /Create a hosted payment link for an invoice \(Stripe Checkout via FluidePay\)/gi,
    "Create a hosted payment link for an invoice",
  ],
  [
    /Create a hosted payment link for an invoice \(Stripe Checkout via Fluide…/gi,
    "Create a hosted payment link for an invoice",
  ],
  [
    /Create a hosted payment link for an invoice \(Stripe — created/g,
    "Create a hosted payment link for an invoice — created",
  ],
  [
    /Create a hosted payment link for an invoice \(Stripe\b[^)\n]*/g,
    "Create a hosted payment link for an invoice",
  ],
  [
    /initiates a Flutterwave v4 orchestrator charge\. Returns checkoutUrl when Flutterwave next_action is redirect_url\./g,
    "initiates a hosted checkout charge. Returns checkoutUrl when the next action is a redirect.",
  ],
  [
    /Create hosted checkout for Mobile Money \(Flutterwave v4 Orchestrator\)/g,
    "Create hosted checkout for mobile money",
  ],
  [/Optional Flutterwave v4 sender entity id/g, "Optional sender entity id"],
  [
    /Internal: ensure Flutterwave customer exists for org billing/gi,
    "Internal: ensure a billing customer exists for the organization",
  ],
  [
    /Receipt \/ Flutterwave customer email when gateway user context omits it\.?/gi,
    "Receipt email when gateway user context omits it.",
  ],
  [
    /Flutterwave charge type query param\. Inferred from currency when omitted\.?/gi,
    "Charge type query param. Inferred from currency when omitted.",
  ],
  [
    /Success URL \(Stripe will append \?session_id=\.\.\.\)/gi,
    "Success URL the hosted checkout returns the customer to",
  ],
  [
    /Opaque metadata to propagate to Stripe objects/gi,
    "Opaque metadata to propagate to the checkout session",
  ],
  [/Ecobank affiliate code/gi, "Banking affiliate code"],
  [
    /Checkout payment methods \(e\.g\. FLUTTERWAVE_CARD, STRIPE_CARD\)/g,
    "Checkout payment methods (e.g. card, mobile_money)",
  ],
  [
    /and payment provider integrations \(Ecobank, mobile money\)/gi,
    ", checkout sessions, payouts, and collections",
  ],
];

function pathNamesProvider(pathKey) {
  return pathKey
    .split("/")
    .filter(Boolean)
    .some((segment) => PROVIDER_IN_SEGMENT.test(segment.replace(/[{}]/g, "")));
}

function publicSchemaName(name) {
  if (EXPLICIT_SCHEMA_RENAMES[name]) return EXPLICIT_SCHEMA_RENAMES[name];
  if (!PROVIDER_IN_SEGMENT.test(name)) return name;
  return name
    .replace(/flutterwave/gi, "HostedCheckout")
    .replace(/stripe/gi, "Card")
    .replace(/ecobank/gi, "Bank");
}

function scrubString(value) {
  let out = value;
  for (const [pattern, replacement] of PHRASES) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/\ba Flutterwave\b/g, "a payment processor")
    .replace(/\ba Stripe\b/g, "a payment processor")
    .replace(/\ba Ecobank\b/g, "a payment processor")
    .replace(/\bFlutterwave\b/g, "the payment processor")
    .replace(/\bStripe\b/g, "the payment processor")
    .replace(/\bEcobank\b/g, "the payment processor")
    .replace(/\bflutterwave\b/g, "the payment processor")
    .replace(/\bstripe\b/g, "the payment processor")
    .replace(/\becobank\b/g, "the payment processor")
    .replace(/\bFLUTTERWAVE\b/g, "PROCESSOR")
    .replace(/\bSTRIPE\b/g, "PROCESSOR")
    .replace(/\bECOBANK\b/g, "PROCESSOR");
  return out
    .replace(/the payment processor the payment processor/g, "the payment processor")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function neutralOperationId(value) {
  return value
    .replace(/Flutterwave/g, "Hosted")
    .replace(/flutterwave/g, "Hosted")
    .replace(/Stripe/g, "Card")
    .replace(/stripe/g, "Card")
    .replace(/Ecobank/g, "Bank")
    .replace(/ecobank/g, "Bank");
}

function neutralTag(name) {
  if (!PROVIDER_IN_SEGMENT.test(name)) return name;
  return name
    .replace(/flutterwave/gi, "Payments")
    .replace(/stripe/gi, "Payments")
    .replace(/ecobank/gi, "Banking")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildSchemaRenameMap(schemas) {
  const renameMap = new Map();
  const used = new Set(Object.keys(schemas ?? {}));
  for (const name of Object.keys(schemas ?? {})) {
    let next = publicSchemaName(name);
    if (next === name) continue;
    if (used.has(next) && !renameMap.has(next)) {
      next = `${next}Doc`;
    }
    used.add(next);
    renameMap.set(name, next);
  }
  return renameMap;
}

function renameSchemas(doc) {
  const schemas = doc.components?.schemas;
  if (!schemas) return doc;
  const renameMap = buildSchemaRenameMap(schemas);
  if (renameMap.size === 0) return doc;

  const nextSchemas = {};
  for (const [name, schema] of Object.entries(schemas)) {
    nextSchemas[renameMap.get(name) ?? name] = schema;
  }
  doc.components = { ...doc.components, schemas: nextSchemas };
  return rewriteRefs(doc, renameMap);
}

function rewriteRefs(node, renameMap) {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, renameMap));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") {
      const prefix = "#/components/schemas/";
      if (value.startsWith(prefix)) {
        const name = value.slice(prefix.length);
        out[key] = renameMap.has(name) ? `${prefix}${renameMap.get(name)}` : value;
        continue;
      }
    }
    out[key] = rewriteRefs(value, renameMap);
  }
  return out;
}

function scrubNode(node, parentKey) {
  if (Array.isArray(node)) {
    if (parentKey === "enum") return node;
    return node.map((item) => scrubNode(item, parentKey));
  }
  if (!node || typeof node !== "object") return node;

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "enum") {
      out[key] = value;
      continue;
    }
    if (key === "tags" && Array.isArray(value)) {
      out[key] = value.map((tag) =>
        typeof tag === "string" ? neutralTag(tag) : scrubNode(tag, "tags"),
      );
      continue;
    }
    if (key === "name" && parentKey === "tags" && typeof value === "string") {
      out[key] = neutralTag(value);
      continue;
    }
    if ((TEXT_KEYS.has(key) || key === "example" || key === "source") && typeof value === "string") {
      if (key === "example" && PROVIDER_IN_SEGMENT.test(value) && value.trim().split(/\s+/).length === 1) {
        out[key] = "processor";
        continue;
      }
      out[key] = scrubString(value);
      continue;
    }
    if (key === "operationId" && typeof value === "string") {
      out[key] = neutralOperationId(value);
      continue;
    }
    out[key] = scrubNode(value, key);
  }
  return out;
}

function pruneTags(doc) {
  const used = new Set();
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== "object" || !Array.isArray(operation.tags)) continue;
      for (const tag of operation.tags) used.add(tag);
    }
  }
  if (Array.isArray(doc.tags)) {
    doc.tags = doc.tags.filter((tag) => tag && used.has(tag.name));
  }
  return doc;
}

function collectSchemaRefs(node, refs) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaRefs(item, refs);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string" && value.startsWith("#/components/schemas/")) {
      refs.add(value.slice("#/components/schemas/".length));
      continue;
    }
    collectSchemaRefs(value, refs);
  }
}

function pruneUnreferencedSchemas(doc) {
  const schemas = doc.components?.schemas;
  if (!schemas) return doc;

  const referenced = new Set();
  const root = { ...doc, components: { ...doc.components, schemas: undefined } };
  collectSchemaRefs(root, referenced);

  let grew = true;
  while (grew) {
    grew = false;
    for (const name of [...referenced]) {
      const before = referenced.size;
      collectSchemaRefs(schemas[name], referenced);
      if (referenced.size !== before) grew = true;
    }
  }

  const next = {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (referenced.has(name)) next[name] = schema;
  }
  doc.components = { ...doc.components, schemas: next };
  return doc;
}

/** Remove processor-named paths, tags, schemas, and description copy. */
export function stripThirdPartyPaymentSurfaces(doc) {
  if (!doc || typeof doc !== "object") return doc;

  const paths = {};
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    if (pathNamesProvider(pathKey)) continue;
    paths[pathKey] = pathItem;
  }

  let next = { ...doc, paths };
  next = renameSchemas(next);
  next = scrubNode(next);
  next = pruneTags(next);
  next = pruneUnreferencedSchemas(next);
  return next;
}
