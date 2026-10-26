// Shared by the instabox-basic-setup scripts. Node >= 18, no dependencies.
//
// The one rule every function here keeps: a credential's value is never
// returned to the agent, stored in a file or printed. Code that looks at a
// secret returns names, places and sizes only.
import { isIP } from 'node:net';
import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Environment variable names that hold a credential, also with a rotation or environment
// qualifier after it (OPENAI_API_KEY_2, GITHUB_TOKEN_OLD). The qualifier needs its own `_`,
// so PATH is not PAT plus H.
export const SECRET_NAME =
  /(?:^|_)(?:API_?KEY|APIKEY|KEY_?SECRET|TOKEN|ACCESS_?TOKEN|AUTH_?TOKEN|REFRESH_?TOKEN|SECRET|SECRET_?KEY|CLIENT_?SECRET|ACCESS_?KEY|ACCESS_?KEY_?ID|PASSWORD|PASSWD|PASS|PAT|PRIVATE_?KEY|CREDENTIALS?)(?:_(?:\d+|V\d+|OLD|NEW|PREV|PREVIOUS|BAK|BACKUP|ALT|PROD|PRODUCTION|DEV|STAGING|STAGE|TEST|LOCAL|CI))?$/i;

// Values that are credentials whatever they are called: token prefixes of the common
// services, private keys, and URLs with a password in them.
export const SECRET_VALUE = new RegExp(
  [
    String.raw`\bgh[pousr]_[A-Za-z0-9]{20,}`,
    String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}`,
    String.raw`\bsk-[A-Za-z0-9_-]{20,}`,
    String.raw`\bAKIA[0-9A-Z]{16}\b`,
    String.raw`\bASIA[0-9A-Z]{16}\b`,
    String.raw`\bxox[abposr]-[A-Za-z0-9-]{10,}`,
    String.raw`\bglpat-[A-Za-z0-9_-]{20,}`,
    String.raw`\bnpm_[A-Za-z0-9]{30,}`,
    String.raw`\bAIza[0-9A-Za-z_-]{35}`,
    String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----`,
    String.raw`[a-z][a-z0-9+.-]*://[^/\s:@'"]+:[^@\s'"/]+@`,
  ].join('|'),
);

// key = value / key: value pairs whose key says it is a secret (config files); numbers and
// booleans are not secrets (max_tokens = 100).
export const SECRET_KEY_LINE =
  /(?:^|[\s{,;:])["']?[\w.-]*(?:token|password|passwd|secret|api[_-]?key|apikey|_auth|authorization|extraheader|private[_-]?key)[\w.-]*["']?\s*[=:]\s*["']?(?![0-9.]+\b|true\b|false\b)[^\s"',}]/i;

// Model-provider and developer-service tokens: moved by default when found. Any other
// credential-looking variable exported in a shell file is listed unchecked.
export const WELL_KNOWN = new Set([
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'XAI_API_KEY',
  'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY',
  'PERPLEXITY_API_KEY',
  'COHERE_API_KEY',
  'VOYAGE_API_KEY',
  'REPLICATE_API_TOKEN',
  'ELEVENLABS_API_KEY',
  'TAVILY_API_KEY',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
  'BRAVE_API_KEY',
  'PINECONE_API_KEY',
  'HF_TOKEN',
  'HUGGING_FACE_HUB_TOKEN',
  'NPM_TOKEN',
  'VERCEL_TOKEN',
  'NETLIFY_AUTH_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
  'FLY_API_TOKEN',
  'RAILWAY_TOKEN',
  'RENDER_API_KEY',
  'NEON_API_KEY',
  'SENTRY_AUTH_TOKEN',
  'LINEAR_API_KEY',
  'GITLAB_TOKEN',
  'DIGITALOCEAN_ACCESS_TOKEN',
]);

// Reserved Secret variable names (internal/secrets/validate.go).
const RESERVED = new Set([
  'HOME',
  'PATH',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'NODE_EXTRA_CA_CERTS',
]);
export function secretNameOK(name) {
  return (
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) &&
    name.length <= 128 &&
    !RESERVED.has(name) &&
    !name.startsWith('INSTABOX_') &&
    !name.startsWith('SSH_')
  );
}

export const isSecretName = (name) => SECRET_NAME.test(name);

// Lines in macOS configs that mean nothing on the Linux box.
export const MACOS_ONLY =
  /\/opt\/homebrew|\/usr\/local\/Cellar|\/usr\/local\/Homebrew|\/Applications\/|\/Library\/|\bosxkeychain\b|\bUseKeychain\b|\bpbcopy\b|\bpbpaste\b|\bosascript\b|\breattach-to-user-namespace\b|\bterminal-notifier\b|\bafplay\b|\/System\/|\.orbstack\/|1password.*agent\.sock|\bsecurity (?:find|add)-[a-z-]*password\b/i;

// Org Secret limits; the server may override these in .limits.vault (legacy wire name).
export const SECRET_MAX_VALUE = 64 * 1024;
export const SECRET_MAX_TOTAL = 256 * 1024;
export const SECRET_MAX_ITEMS = 100;

export const FILE_MAX_VALUE = 64 * 1024;
export const FILE_MAX_TOTAL = 512 * 1024;
export const BOX_HOME = '/data/home';

// Runs a command without a shell; never throws. stdout is returned to the caller only:
// callers that run credential tools (gh auth token) must not keep or print it.
export function run(argv, { cwd, env, input, timeout = 30_000 } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd,
    env,
    input,
    timeout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  return { ok: r.status === 0 && !r.error, status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

export function hasCommand(name, env) {
  for (const dir of (env?.PATH || '').split(':')) {
    if (!dir) continue;
    try {
      const st = lstatSync(join(dir, name));
      if (st.isFile() || st.isSymbolicLink()) return true;
    } catch {}
  }
  return false;
}

// stat, following symlinks (dotfiles are often links into a dotfiles repo), or null.
export function statOrNull(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

// Every regular file under dir (symlinks followed), as paths relative to it, sorted.
export function listFiles(dir, skip = () => false, rel = '', depth = 0) {
  const out = [];
  if (depth > 8) return out;
  let names = [];
  try {
    names = readdirSync(join(dir, rel)).sort();
  } catch {
    return out;
  }
  for (const n of names) {
    if (skip(n)) continue;
    const r = rel ? `${rel}/${n}` : n;
    const st = statOrNull(join(dir, r));
    if (!st) continue;
    if (st.isDirectory()) out.push(...listFiles(dir, skip, r, depth + 1));
    else if (st.isFile()) out.push(r);
  }
  return out;
}

export function readText(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const u = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

// Paths are relative to the guest home. Config copying never follows symlinks.
export function configPathOK(p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.length > 255 || /[\x00-\x1f\x7f\\]/.test(p)) return false;
  return p.split('/').every((c) => c !== '' && c !== '.' && !c.startsWith('..'));
}

export function deliveryPolicy(delivery, hosts = []) {
  if (!['env', 'proxy'].includes(delivery) || !Array.isArray(hosts)) throw new Error('delivery must be env or proxy');
  if (delivery === 'env' && hosts.length) throw new Error('env delivery cannot enforce hosts; use -');
  if (delivery === 'proxy' && (!hosts.length || hosts.length > 32))
    throw new Error('proxy delivery requires 1-32 exact hosts');
  const normalized = hosts.map((name) => {
    if (typeof name !== 'string') throw new Error('hosts must be exact public DNS names');
    const h = name.toLowerCase().replace(/\.$/, '');
    if (
      h.length > 253 ||
      !h.includes('.') ||
      isIP(h) ||
      /(?:^|\.)(?:local|localhost)$/.test(h) ||
      h.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ) {
      throw new Error('hosts must be exact public DNS names without a scheme, port, path, IP address or wildcard');
    }
    return h;
  });
  return { delivery, hosts: [...new Set(normalized)].sort() };
}

export function validID(s) {
  return typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s);
}
export function secretIdentity(s) {
  return {
    id: s.id,
    name: s.name,
    orgId: s.orgId,
    version: s.version,
    delivery: s.delivery,
    hosts: [...(s.hosts || [])].sort(),
  };
}
export function sameSecret(a, b) {
  return !!a && !!b && JSON.stringify(secretIdentity(a)) === JSON.stringify(secretIdentity(b));
}

// True when the module is the script node was started with (not imported by a test).
export function isMain(meta) {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(meta.url));
  } catch {
    return false;
  }
}
