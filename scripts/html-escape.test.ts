import assert from 'node:assert/strict'
import { escapeHtml } from '../lib/html/escape'

assert.equal(
  escapeHtml(`<script>alert("x")</script> & 'test'`),
  '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;'
)
assert.equal(escapeHtml(null), '')

console.log('html-escape.test.ts OK')
