import { buildSystemPrompt, getDefaultPromptText } from '../src/lib/advisor/system-prompt'

async function main() {
  const def = getDefaultPromptText()
  console.log('=== getDefaultPromptText ===')
  console.log('chars:', def.length)
  console.log('approx tokens (chars/3.5):', Math.round(def.length / 3.5))

  const r = await buildSystemPrompt({
    admin: { id: 1, name: 'test', role: 'admin' },
    sessionId: 'measure',
  })
  console.log('\n=== buildSystemPrompt ===')
  console.log('cachedPart chars:', r.cachedPart.length)
  console.log('approx tokens (chars/3.5):', Math.round(r.cachedPart.length / 3.5))
  console.log('dynamicPart chars:', r.dynamicPart.length)
}
main().catch(e => { console.error(e); process.exit(1) })
