import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const tracked = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)

const textExtensions = new Set([
  '.env', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md',
  '.sql', '.toml', '.yaml', '.yml', '.sh', '.txt', '.html', '.css', '.mcp',
])

const patterns = [
  { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Resend live key', regex: /\bre_[A-Za-z0-9_-]{24,}\b/ },
  { name: 'Stripe live key', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'GitHub token', regex: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  {
    name: 'committed Transbank secret',
    regex: /TRANSBANK_API_KEY_SECRET\s*=\s*(?![<"']?(?:CHANGE_ME|example|placeholder)?[>"']?\s*$)[A-Za-z0-9_-]{20,}/m,
  },
  {
    name: 'committed Supabase service key',
    regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9._-]{40,}/,
  },
]

const findings = []
for (const path of tracked) {
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.')) : ''
  if (!textExtensions.has(extension) && !path.startsWith('.env')) continue
  let content
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    continue
  }
  if (content.includes('\u0000')) continue
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) findings.push(`${path}: ${pattern.name}`)
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Secret scan passed (${tracked.length} tracked files).`)
