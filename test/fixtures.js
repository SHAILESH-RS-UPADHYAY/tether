// Trimmed copies of each assistant's message markup, keeping the attributes
// and wrappers the adapters depend on (plus the UI chrome they must ignore).

export const claude = `
<main><div class="overflow-y-auto">
  <div data-testid="transcript-row" data-index="0">
    <div data-testid="user-message"><p class="whitespace-pre-wrap">Refactor my FastAPI auth.
It must keep the existing JWT format.</p></div>
    <div data-testid="message-actions"><button aria-label="Edit">Edit</button></div>
  </div>
  <div data-testid="transcript-row" data-index="1">
    <div data-is-streaming="false"><div class="font-claude-response">
      <p>Here is the <strong>plan</strong>:</p>
      <ol><li>Move token checks into a dependency</li><li>Add refresh tokens<ul><li>rotate on use</li></ul></li></ol>
      <div class="code-wrapper"><div class="code-block-decoration">python</div>
        <pre><code class="language-python">def get_user(token: str = Depends(oauth2)):
    return decode(token)


# end</code></pre></div>
    </div></div>
    <div data-testid="action-bar-copy"><button aria-label="Copy">Copy</button><svg></svg></div>
  </div>
</div></main>`;

export const chatgptNew = `
<div data-turn-key="t1"><div data-content-search-unit-key="conv:0:user">
  <div data-user-message-bubble="true"><div class="whitespace-pre-wrap">Compare SQLite and Postgres
for a small SaaS. Don't suggest MySQL.</div></div>
</div></div>
<div data-turn-key="t2"><div data-content-search-unit-key="conv:1:assistant">
  <div class="markdown prose"><h3>Short answer</h3><p>Start with <code>SQLite</code>, move when you need concurrency.</p>
  <table><thead><tr><th>DB</th><th>Writes</th></tr></thead><tbody><tr><td>SQLite</td><td>one writer</td></tr><tr><td>Postgres</td><td>many | MVCC</td></tr></tbody></table>
  <pre><div class="flex">sql<button>Copy code</button></div><div><code class="hljs language-sql">SELECT 1;</code></div></pre>
  <blockquote><p>Measure before migrating.</p></blockquote></div>
</div></div>`;

export const chatgptLegacy = `
<article data-testid="conversation-turn-1"><div data-message-author-role="user" data-message-id="u1"><div class="whitespace-pre-wrap">hello there</div></div></article>
<article data-testid="conversation-turn-2"><div data-message-author-role="assistant" data-message-id="a1"><div class="markdown"><p>Hi! <a href="https://example.com/docs">Docs</a> and <em>more</em>.</p></div></div></article>
<article><div data-message-author-role="tool"><div>ignored</div></div></article>`;

export const gemini = `
<infinite-scroller><div class="conversation-container">
  <user-query><span class="cdk-visually-hidden">You said</span><div class="query-text"><p class="query-text-line">Explain Bayes rule</p><p class="query-text-line">with one example</p></div></user-query>
  <model-response><model-thoughts>thinking...</model-thoughts><message-content><div class="markdown">
    <p>The rule is <span data-math="P(A|B)=\\frac{P(B|A)P(A)}{P(B)}"></span>.</p>
    <div class="math-block" data-math="P(A)=0.01"></div>
    <code-block><div class="code-block-decoration"><span>Python</span><button>copy</button></div><pre><code class="code-container">print(0.01)</code></pre></code-block>
  </div></message-content></model-response>
</div></infinite-scroller>`;
