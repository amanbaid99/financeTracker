import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Public-source inspection only. No environment variables or application records are read. */
export async function fetchFilingSample(
  /** @type {{name: string, url: string, expectedIsin: string}} */ target,
  /** @type {string} */ observedAt,
  /** @type {typeof fetch} */ request = fetch,
) {
  const url = new URL(target.url);
  if (!/^[a-z0-9-]{1,80}$/.test(target.name) || !/^IN[A-Z0-9]{10}$/.test(target.expectedIsin) ||
      url.protocol !== 'https:' || url.hostname !== 'nsearchives.nseindia.com' || url.port || url.username || url.password || url.search || url.hash ||
      !/^\/corporate\/ixbrl\/INTEGRATED_FILING_INDAS_\d{1,12}_\d{14}_iXBRL_WEB\.html$/.test(url.pathname))
    throw new Error('The public filing target is outside the approved source format.');
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('A valid observation time is required.');
  let response;
  try {
    response = await request(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'text/html, application/xhtml+xml' } });
  } catch { throw new Error('The public filing source could not be reached.'); }
  if (!response.ok) throw new Error(`The public filing source returned HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(contentType)) throw new Error('The source did not return an HTML filing.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The public filing response was empty.');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4_000_000) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } catch { throw new Error('The public filing exceeded its read limits.'); }
  const bytes = Buffer.concat(chunks), html = bytes.toString('utf8');
  if (!html.includes(target.expectedIsin)) throw new Error('The document did not contain the expected security identifier.');
  return { html, body: bytes, metadata: { name: target.name, source: url.href, expectedIsin: target.expectedIsin,
    observedAt, bytes: size, sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType, publicationTimeVerified: false, parserVerified: false } };
}

async function main() {
  const targets = JSON.parse(await readFile(new URL('./source-samples.json', import.meta.url), 'utf8'));
  const output = resolve(process.argv[2] ?? 'artifacts/filings');
  await mkdir(output, { recursive: true });
  const results = [];
  for (const target of targets) {
    try {
      const sample = await fetchFilingSample(target, new Date().toISOString());
      await writeFile(resolve(output, `${target.name}.html`), sample.body);
      results.push({ ok: true, ...sample.metadata });
    } catch (error) {
      results.push({ ok: false, name: target.name, error: error instanceof Error ? error.message : 'The source probe failed.' });
    }
  }
  await writeFile(resolve(output, 'probe-result.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
