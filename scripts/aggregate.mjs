// Aggregator: read per-repo noumenal.json manifests (+ extras), optionally pull
// live proof code for PUBLIC repos, regenerate the PROJECTS_BY_SECTION block in
// index.html between the GEN sentinels. Runs locally and in CI (cron + manual).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { genProjectsBlock, validateManifest } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const MAN = path.join(SITE, 'data', 'manifests');
const LIVE = process.argv.includes('--live');     // fetch repo manifests + pull live proof code
const ORGS = ['noumenal-ai', 'Zetetic-Dhruv', 'ayushmi'];

const shells = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'section-shells.json'), 'utf8'));
const sectionIds = shells.map(s => s.id);

// ---- collect staged manifests + extras ----
const manifests = new Map(); // repo slug -> manifest
for (const f of fs.readdirSync(MAN).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(fs.readFileSync(path.join(MAN, f), 'utf8'));
  manifests.set(m.repo, m);
}
const extras = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'extra-cards.json'), 'utf8'));

const log = [];

// ---- LIVE: discover opt-in repos + pull validated proof code (public only) ----
function gh(args) { return execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
function repoVisibility(slug) {
  try { return JSON.parse(gh(`repo view ${slug} --json visibility`)).visibility; } catch { return null; }
}
function fetchFile(slug, p) {
  try { return Buffer.from(JSON.parse(gh(`api repos/${slug}/contents/${encodeURIComponent(p)}`)).content, 'base64').toString('utf8'); }
  catch { return null; }
}

if (LIVE) {
  // 1) opt-in discovery: any repo in ORGS with a noumenal.json {noumenal:true} publishes its OWN manifest (overrides staged)
  for (const org of ORGS) {
    let repos = [];
    try { repos = JSON.parse(gh(`repo list ${org} --limit 200 --json nameWithOwner --jq '[.[].nameWithOwner]'`)); } catch {}
    for (const slug of repos) {
      const raw = fetchFile(slug, 'noumenal.json');
      if (!raw) continue;
      let m; try { m = JSON.parse(raw); } catch { log.push(`SKIP ${slug}: noumenal.json invalid JSON`); continue; }
      if (m.noumenal !== true) { log.push(`SKIP ${slug}: noumenal:true not set`); continue; }
      const errs = validateManifest(m, slug);
      if (errs.length) { log.push(`REJECT ${slug}: ${errs.join('; ')}`); continue; }
      m.repo = m.repo || slug;
      manifests.set(m.repo, m);
      log.push(`OPT-IN ${slug}: published manifest adopted (${(m.cards||[]).length} cards)`);
    }
  }
  // 2) for PUBLIC repos, replace each proof witness whose `source` names a real lean decl with the LIVE code
  for (const m of manifests.values()) {
    const pub = repoVisibility(m.repo) === 'PUBLIC';
    for (const c of (m.cards || [])) {
      for (const w of (c.witnesses || [])) {
        if (w.type !== 'proof') continue;
        // prefer explicit file/name; else parse "<path>.lean ∷ <name>" from source
        let file = w.file, name = w.name;
        if (!file || !name) {
          const mm = (w.source || '').match(/([^\s·]+\.lean)\s*(?:∷|::)\s*([A-Za-z0-9_'.]+)/);
          if (!mm) continue;
          file = file || mm[1]; name = name || mm[2];
        }
        if (!pub) { w.private = true; continue; }            // private: keep curated snippet, mark private
        const code = fetchFile(m.repo, file);
        if (code == null) { log.push(`WARN ${m.repo}: ${file} not found on default branch (keeping snippet)`); continue; }
        if (!new RegExp(`\\b(theorem|lemma|def)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(code)) {
          log.push(`WARN ${m.repo}: ${name} not a declaration in ${file} (keeping snippet)`); continue;
        }
        // pull the declaration text (from `theorem name` up to `:=` or blank line)
        const re = new RegExp(`((?:theorem|lemma|def)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?)(?::=|\\n\\n)`);
        const got = code.match(re);
        if (got) { w.code = got[1].trim(); w.live = true; log.push(`LIVE ${m.repo}: pulled ${name} from ${file}`); }
      }
    }
  }
}

// ---- assemble ordered card list ----
const cards = [];
for (const m of manifests.values()) for (const c of (m.cards || [])) cards.push(c);
for (const e of extras) cards.push(e);

// ---- codegen + inject between sentinels ----
const block = genProjectsBlock(cards, sectionIds);
const idx = path.join(SITE, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const BEGIN = '    // <<<GEN-PROJECTS — produced by scripts/aggregate.mjs; do not edit by hand';
const END = '    // GEN-PROJECTS>>>';
const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
if (!re.test(html)) throw new Error('GEN-PROJECTS sentinels not found in index.html (run the refactor first)');
html = html.replace(re, BEGIN + '\n' + block + '\n' + END);
fs.writeFileSync(idx, html);

console.log(`aggregated ${manifests.size} manifests + ${extras.length} extras -> ${cards.length} cards across ${sectionIds.length} sections`);
if (log.length) console.log('live log:\n  ' + log.join('\n  '));
