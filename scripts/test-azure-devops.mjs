// Offline checks for backend/azureDevOps.js. Run: node scripts/test-azure-devops.mjs
import { parseOrganizationUrl, detectSpec, syncAzureSource } from '../backend/azureDevOps.js'

let failed = 0
async function check(name, fn, expect) {
  try {
    const result = await fn()
    const pass = typeof expect === 'function' ? expect(result) : expect === 'ok'
    if (!pass) failed += 1
    console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(result)?.slice(0, 100))
  } catch (error) {
    const pass = error.status === expect
    if (!pass) failed += 1
    console.log(pass ? 'PASS' : 'FAIL', name, error.status, error.message)
  }
}

await check('org dev.azure.com', () => parseOrganizationUrl('https://dev.azure.com/coaction/'), (r) => r === 'https://dev.azure.com/coaction')
await check('org visualstudio', () => parseOrganizationUrl('https://coaction.visualstudio.com'), (r) => r === 'https://coaction.visualstudio.com')
await check('org http rejected', () => parseOrganizationUrl('http://dev.azure.com/x'), 400)
await check('org foreign host rejected', () => parseOrganizationUrl('https://evil.example.com/x'), 400)
await check('org missing name', () => parseOrganizationUrl('https://dev.azure.com/'), 400)
await check('json openapi', () => detectSpec('a.json', JSON.stringify({ openapi: '3.0.1', info: { title: 'Claims', version: '1.2' } })), (r) => r?.format === 'OpenAPI' && r.title === 'Claims')
await check('json swagger', () => detectSpec('a.json', JSON.stringify({ swagger: '2.0', info: { title: 'Old' } })), (r) => r?.format === 'Swagger')
await check('json non-spec', () => detectSpec('package.json', JSON.stringify({ name: 'x' })), (r) => r === null)
await check('yaml openapi', () => detectSpec('a.yaml', 'openapi: 3.1.0\ninfo:\n  title: Policy API\n  version: 2.0\n'), (r) => r?.format === 'OpenAPI' && r.title === 'Policy API')
await check('yaml non-spec', () => detectSpec('ci.yml', 'trigger:\n  - main\n'), (r) => r === null)

const source = { organizationUrl: 'https://dev.azure.com/coaction', project: 'P', repository: 'R', branch: 'main', catalogPath: '/catalog', authMode: 'Personal access token' }
const savedPat = process.env.AZURE_DEVOPS_PAT
delete process.env.AZURE_DEVOPS_PAT
await check('missing field', () => syncAzureSource({ ...source, repository: '' }), 400)
await check('path traversal', () => syncAzureSource({ ...source, catalogPath: '/a/../b' }), 400)
await check('unsupported auth mode', () => syncAzureSource({ ...source, authMode: 'Managed identity' }), 501)
await check('no PAT fails, no fake success', () => syncAzureSource(source), 503)
if (savedPat) process.env.AZURE_DEVOPS_PAT = savedPat

console.log(failed ? `${failed} failed` : 'All passed')
process.exit(failed ? 1 : 0)
