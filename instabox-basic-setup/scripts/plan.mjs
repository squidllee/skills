#!/usr/bin/env node
// Names-only approval plan for org Secrets and explicit sandbox config copies.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileContent } from './content.mjs';
import {
  SECRET_MAX_ITEMS,
  SECRET_MAX_TOTAL,
  FILE_MAX_VALUE,
  FILE_MAX_TOTAL,
  configPathOK,
  deliveryPolicy,
  human,
  isMain,
  sameSecret,
  secretIdentity,
  validID,
} from './lib.mjs';

export const MANIFEST = join(homedir(), '.config', 'instabox-basic-setup', 'pushed.json');
export function readManifest(path = MANIFEST) {
  try {
    const m = JSON.parse(readFileSync(path, 'utf8'));
    if (m.version === 3 && Array.isArray(m.secrets) && Array.isArray(m.files)) return m;
  } catch {}
  // Legacy names and file paths confer no ownership of an org Secret.
  return { version: 3, secrets: [], files: [] };
}

export function existingFor(it, secrets, manifest) {
  if (it.kind !== 'env') return [];
  return secrets
    .filter((s) => s.name === it.name)
    .map((item) => ({
      item,
      ours: (manifest.secrets || []).some((m) => sameSecret(m, item)),
    }));
}

export function planDigest(scan, secrets, manifest, orgId) {
  const rows = secrets.map(secretIdentity).sort((a, b) => a.name.localeCompare(b.name));
  const own = (manifest.secrets || [])
    .filter((s) => s.orgId === orgId)
    .map(secretIdentity)
    .sort((a, b) => a.name.localeCompare(b.name));
  return createHash('sha256')
    .update(JSON.stringify([scan, rows, own, orgId]))
    .digest('hex')
    .slice(0, 16);
}

export class PlanError extends Error {
  constructor(errors, code = 1) {
    super(errors.join('\n'));
    this.errors = errors;
    this.code = code;
  }
}

function checkContext(scan, secrets, orgId) {
  if (scan.version !== 3 || !Array.isArray(scan.items))
    throw new PlanError(['scan format changed; run scan.mjs again']);
  if (!validID(orgId)) throw new PlanError(['an explicit org ID is required']);
  if (!Array.isArray(secrets) || secrets.some((s) => s.orgId !== orgId || !s.id || !Number.isSafeInteger(s.version)))
    throw new PlanError(['Secret metadata must belong to the selected org and include IDs and versions']);
}

export function writePlan(
  scan,
  { secrets = [], manifest = { secrets: [] }, orgId, sandboxes = [], delivery = 'env', hosts = [] } = {},
) {
  checkContext(scan, secrets, orgId);
  if (sandboxes.some((id) => !validID(id) || !id.startsWith('m_')))
    throw new PlanError(['sandboxes must use stable m_ IDs']);
  const policy = deliveryPolicy(delivery, hosts);
  const out = [
    '# instabox basic setup: plan',
    '',
    'Check `[x]` the items to save or copy. Do not change IDs or delete lines.',
    'Tokens become encrypted org Secrets. Each Delivery line explicitly chooses env (real values) or proxy (HTTPS-header placeholders with allowed hosts).',
    'This run adds env grants only to the sandbox IDs below; an empty list adds no grants. Existing grants remain in force.',
    'Proxy Secrets also become available to other org sandboxes whose proxy selection is all, including future sandboxes.',
    'Replacing an existing Secret affects its other authorized sandboxes. Config files are copied once to the named running sandboxes and may overwrite those paths; they are not Secrets.',
    'Env values can be copied into files, processes or snapshots; removing a selection cannot recover those copies.',
    '',
    `Org: \`${orgId}\``,
    `Sandboxes: \`${[...new Set(sandboxes)].join(',') || '-'}\``,
    '',
    `<!-- plan ${planDigest(scan, secrets, manifest, orgId)}: scan and org metadata; regenerate if either changes -->`,
  ];
  for (const [section, title] of [
    ['tokens', 'Tokens'],
    ['git', 'Git config copies'],
    ['editor', 'Editor and terminal config copies'],
  ]) {
    out.push('', `## ${title}`, '');
    const rows = scan.items.filter((it) => it.section === section);
    if (!rows.length) out.push('_Nothing found._');
    for (const it of rows) {
      const ex = existingFor(it, secrets, manifest);
      const other = ex.some((e) => !e.ours);
      const checked = it.checked && !other && (it.kind === 'env' || sandboxes.length > 0);
      let description =
        it.kind === 'env'
          ? `${it.name} from ${it.from}`
          : `~/${it.path}: ${it.files.length} file(s), ${human(it.bytes)}`;
      if (it.reason) description += `; off by default: ${it.reason}`;
      if (it.note) description += `; ${it.note}`;
      if (other) description += '; already in this org, set or changed elsewhere: checking replaces it';
      else if (ex.length) description += '; replaces the unchanged Secret from your previous run';
      if (it.kind === 'file' && !sandboxes.length) description += '; select running sandbox IDs before checking this';
      out.push(`- [${checked ? 'x' : ' '}] \`${it.id}\` ${description}`);
      if (it.kind === 'env') {
        // Preserve an existing mode as a starting point; never silently change
        // a proxy credential into a real-value env credential on a repeat run.
        const p = ex.length ? deliveryPolicy(ex[0].item.delivery, ex[0].item.hosts || []) : policy;
        out.push(`Delivery \`${it.id}\`: \`${p.delivery}\` hosts \`${p.hosts.join(',') || '-'}\``);
      }
    }
  }
  out.push('', '## Manual setup', '', 'These entries have no checkbox; no credentials are read for them.', '');
  for (const m of scan.manual) out.push(`- ${m.what}: ${m.why}. ${m.todo}`);
  return out.join('\n') + '\n';
}

export function parsePlan(scan, text, { secrets = [], manifest = { secrets: [] }, orgId, limits = {} } = {}) {
  checkContext(scan, secrets, orgId);
  const errors = [];
  const byId = new Map(scan.items.map((it) => [it.id, it]));
  const states = new Map(),
    policies = new Map();
  let planOrg, sandboxes, digest;
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.replace(/\r$/, ''),
      n = index + 1;
    if (/^(Org|Sandboxes):/.test(line)) {
      const m = line.match(/^(Org|Sandboxes): `([^`]*)`$/);
      if (!m) {
        errors.push(`line ${n}: invalid Org or Sandboxes line`);
        continue;
      }
      if (m[1] === 'Org') {
        if (planOrg !== undefined) errors.push(`line ${n}: duplicate Org line`);
        planOrg = m[2];
      } else {
        if (sandboxes !== undefined) errors.push(`line ${n}: duplicate Sandboxes line`);
        sandboxes = m[2] === '-' ? [] : m[2].split(',').map((s) => s.trim());
        if (
          sandboxes.some((id) => !validID(id) || !id.startsWith('m_')) ||
          new Set(sandboxes).size !== sandboxes.length
        )
          errors.push(`line ${n}: use distinct stable sandbox IDs, comma-separated, or -`);
      }
      continue;
    }
    if (/^Delivery\b/.test(line)) {
      const m = line.match(/^Delivery `([^`]+)`: `([^`]+)` hosts `([^`]*)`$/);
      if (!m || byId.get(m[1])?.kind !== 'env') {
        errors.push(`line ${n}: invalid Delivery line`);
        continue;
      }
      if (policies.has(m[1])) errors.push(`line ${n}: duplicate delivery for ${m[1]}`);
      try {
        policies.set(m[1], deliveryPolicy(m[2], m[3] === '-' ? [] : m[3].split(',').map((h) => h.trim())));
      } catch (e) {
        errors.push(`line ${n}: ${e.message}`);
      }
      continue;
    }
    if (/^Selector:/.test(line)) errors.push(`line ${n}: legacy selectors are retired`);
    const d = line.match(/^<!-- plan ([0-9a-f]+):/);
    if (d) {
      if (digest) errors.push(`line ${n}: duplicate plan fingerprint`);
      digest = d[1];
    }
    if (!/^\s*(?:[-*+]|\d+[.)])\s*\[/.test(line) && !/^\s*[-*+]\s*`(?:env|file|files):/.test(line)) continue;
    const m = line.match(/^- \[([ xX])\] `([^`]+)`(?: .*)?$/);
    if (!m) {
      errors.push(`line ${n}: not a checkbox line; use - [x] or - [ ] with the original ID`);
      continue;
    }
    if (!byId.has(m[2])) {
      errors.push(`line ${n}: unknown id \`${m[2]}\``);
      continue;
    }
    if (states.has(m[2])) errors.push(`line ${n}: \`${m[2]}\` appears twice`);
    states.set(m[2], m[1] !== ' ');
  }
  if (planOrg !== orgId) errors.push('Org must match the metadata used to write this plan; regenerate for another org');
  if (sandboxes === undefined)
    errors.push('Sandboxes line is required; use - to save Secrets without adding sandbox grants');
  if (digest !== planDigest(scan, secrets, manifest, orgId))
    errors.push('different scan or org Secret state; scan, list Secrets and write a new plan');
  for (const it of scan.items) {
    if (!states.has(it.id)) errors.push(`\`${it.id}\` is missing from the plan`);
    if (it.kind === 'env' && !policies.has(it.id))
      errors.push(`\`${it.id}\` needs an explicit delivery mode and hosts line`);
  }
  if (errors.length) throw new PlanError(errors);

  const picked = scan.items.filter((it) => states.get(it.id));
  const ghToken = picked.some(
    (it) => it.kind === 'env' && it.name === 'GH_TOKEN' && policies.get(it.id).delivery === 'env',
  );
  const items = picked.map((it) => {
    const item = { ...it };
    delete item.checked;
    if (it.kind === 'env') {
      Object.assign(item, policies.get(it.id));
      item.expected = secrets.find((s) => s.name === it.name);
      item.expected = item.expected ? secretIdentity(item.expected) : null;
    } else {
      if (!sandboxes.length) errors.push(`\`${it.id}\`: config copying requires explicit running sandbox IDs`);
      item.files = it.files.map((f) => {
        if (!configPathOK(f.path)) errors.push(`\`${it.id}\`: invalid config path`);
        const c = fileContent(f, { home: scan.home, ghToken });
        if (c.error) errors.push(`\`${it.id}\`: ${c.error}`);
        const bytes = c.error ? 0 : Buffer.byteLength(c.text);
        if (bytes > FILE_MAX_VALUE) errors.push(`\`${it.id}\`: file exceeds the config-copy limit of 64 KiB`);
        return { ...f, bytes };
      });
      item.bytes = item.files.reduce((sum, f) => sum + f.bytes, 0);
    }
    return item;
  });
  if (errors.length) throw new PlanError(errors);
  const tokens = items.filter((it) => it.kind === 'env');
  const names = new Set(tokens.map((it) => it.name));
  const staying = secrets.filter((it) => !names.has(it.name));
  const maxItems = limits.maxItems || SECRET_MAX_ITEMS,
    maxBytes = limits.maxBytes || SECRET_MAX_TOTAL;
  const totals = {
    items: staying.length + tokens.length,
    maxItems,
    stayingBytes: staying.reduce((sum, s) => sum + (s.size || 0), 0),
    maxBytes,
  };
  if (totals.items > maxItems || totals.stayingBytes > maxBytes)
    throw new PlanError(
      [
        `over the org Secret limits: ${totals.items} items of ${maxItems}; ${human(totals.stayingBytes)} of ${human(maxBytes)} already staying (selected values measured before push)`,
        'Uncheck tokens or remove unused org Secrets; config files do not consume Secret quota.',
      ],
      3,
    );
  const fileBytes = items.filter((it) => it.kind === 'file').reduce((sum, it) => sum + it.bytes, 0);
  if (fileBytes > FILE_MAX_TOTAL)
    throw new PlanError(['config copies exceed 512 KiB; uncheck files or transfer them separately'], 3);
  return {
    version: 3,
    home: scan.home,
    orgId,
    sandboxes,
    ghToken,
    items,
    manual: scan.manual,
    skipped: scan.items.filter((it) => !states.get(it.id)).map((it) => it.id),
    leftover: (manifest.secrets || [])
      .filter((m) => m.orgId === orgId && !names.has(m.name) && secrets.some((s) => sameSecret(m, s)))
      .map((m) => m.name),
    secrets: totals,
    fileBytes,
  };
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
  };
  const scanFile = opt('--scan'),
    secretsFile = opt('--secrets'),
    orgId = opt('--org');
  const manifest = readManifest(opt('--manifest') || MANIFEST);
  try {
    if (!scanFile || !secretsFile || !orgId)
      throw new Error('use --scan scan.json --secrets secrets.json --org ORG_ID');
    const scan = JSON.parse(readFileSync(scanFile, 'utf8'));
    const secrets = JSON.parse(readFileSync(secretsFile, 'utf8')).items;
    if (!Array.isArray(secrets)) throw new Error('metadata must be instabox secrets ls --json output');
    if (command === 'write') {
      const sandboxes = [],
        hosts = [];
      let value;
      while ((value = opt('--sandbox')) !== undefined) sandboxes.push(value);
      while ((value = opt('--host')) !== undefined) hosts.push(value);
      const delivery = opt('--delivery') || 'env';
      if (args.length) throw new Error('unknown write arguments');
      process.stdout.write(writePlan(scan, { secrets, orgId, manifest, sandboxes, delivery, hosts }));
    } else if (command === 'parse') {
      const limitFile = opt('--limits');
      const limits = limitFile ? JSON.parse(readFileSync(limitFile, 'utf8')) : {};
      if (args.length !== 1) throw new Error('parse requires one plan.md path');
      const selection = parsePlan(scan, readFileSync(args[0], 'utf8'), {
        secrets,
        orgId,
        manifest,
        limits: limits || {},
      });
      process.stdout.write(JSON.stringify(selection, null, 2) + '\n');
    } else throw new Error('command must be write or parse');
  } catch (e) {
    process.stderr.write(e.message + '\n');
    process.exit(e instanceof PlanError ? e.code : 1);
  }
}
if (isMain(import.meta)) main();
