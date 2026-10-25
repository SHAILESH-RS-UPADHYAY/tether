// Opens the destination assistant and holds the capsule until that tab's
// content script claims it. storage.session survives worker restarts.
const TTL = 2 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'board') {
    chrome.tabs.create({ url: msg.home }).then(async (tab) => {
      await chrome.storage.session.set({
        [`pending:${tab.id}`]: { markdown: msg.markdown, source: msg.source, title: msg.title, tokens: msg.tokens, at: Date.now() },
      });
      reply({ ok: true });
    });
    return true;
  }
  if (msg.type === 'claim' && sender.tab) {
    const key = `pending:${sender.tab.id}`;
    chrome.storage.session.get(key).then(async (got) => {
      const pass = got[key];
      if (pass) await chrome.storage.session.remove(key);
      reply(pass && Date.now() - pass.at < TTL ? pass : null);
    });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(`pending:${id}`));
