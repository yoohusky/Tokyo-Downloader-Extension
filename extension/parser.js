(() => {
  const TYPES = ['episode', 'ova', 'special', 'movie'];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dec = x => { try { return decodeURIComponent(x); } catch (e) { return x; } };
  const PAT = /^(.*)\/(episode|ova|special|movie)\/([^\/]+)$/i;
  const SUF = '(?:\\s+[:\\-\u2013]\\s.*)?';   /* optional " : Episode title" after the number; ranges like "7-5 - missing" don't match */
  const LINE = new RegExp('^(.+?)\\s+(episode|ova|special|movie)\\s+(\\d+(?:\\.\\d+)?)' + SUF + '$', 'i');   /* "Chainsaw Man episode 12 : Title" */
  const TXT = new RegExp('\\b(episode|ova|special|movie)\\s+(\\d+(?:\\.\\d+)?)' + SUF + '$', 'i');
  const numKey = n => (isNaN(parseFloat(n)) ? [1, 0, n] : [0, parseFloat(n), n]);
  const cmp = (a, b) => { const x = numKey(a.number), y = numKey(b.number); return x[0] - y[0] || x[1] - y[1] || String(x[2]).localeCompare(y[2]); };

  /* ---- find the episode list in a document (the live page, a fetched page, or a rendered iframe) ---- */
  const detect = (doc, pathname, live) => {
    let base = dec(pathname).replace(/\/+$/, '').toLowerCase();
    const here = base.match(PAT);
    if (here) base = here[1];
    const origin = location.origin, seen = new Set(), all = [];
    const add = (type, number, key) => { if (!seen.has(key)) { seen.add(key); all.push({ type, number, page_url: key }); } };
    doc.querySelectorAll('a').forEach(a => {
      const label = a.textContent.replace(/\s+/g, ' ').trim(), t = label.match(TXT);
      const href = a.getAttribute('href');
      if (!href || /^(#|javascript:)/i.test(href)) return;
      let u; try { u = new URL(href, origin + pathname); } catch (e) { return; }
      if (!/(^|\.)tokyoinsider\.com$/.test(u.hostname)) return;
      const m = dec(u.pathname).replace(/\/+$/, '').match(PAT);
      if (m && m[1].toLowerCase() === base) add(m[2].toLowerCase(), m[3], u.origin + u.pathname + u.search);   /* URL form, this anime only */
      else if (t && !m) add(t[1].toLowerCase(), t[2], u.origin + u.pathname + u.search);                          /* text form */
    });
    if (!all.length && base.includes('/anime/')) {
      /* the list may be plain clickable text rather than links: read the lines, build each URL from the anime address */
      const animePath = pathname.replace(/\/+$/, '').replace(/\/(episode|ova|special|movie)\/[^\/]+$/i, '');
      const addLine = (txt) => { const m = txt.match(LINE); if (m) add(m[2].toLowerCase(), m[3], origin + animePath + '/' + m[2].toLowerCase() + '/' + m[3]); };
      if (live) doc.body.innerText.split('\n').forEach(l => addLine(l.replace(/\s+/g, ' ').trim()));
      /* also (and for fetched pages, where there is no layout) look at each small element's own text */
      const norm = el => el.textContent.replace(/\s+/g, ' ').trim();
      doc.body.querySelectorAll('div,li,tr,td,p,span,a,b,strong,h3,h4').forEach(el => {
        const t = norm(el);
        if (t.length > 160 || !LINE.test(t)) return;
        if ([...el.children].some(c => LINE.test(norm(c)))) return;   /* take the innermost element only */
        addLine(t);
      });
    }
    const title = ((doc.title || '').split(' @')[0] || '').replace(/^Download\s+/i, '').trim();
    return { title, all: all.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || cmp(a, b)) };
  };

  const r13 = t => t.replace(/[a-zA-Z]/g, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); });
  const decDlk = (t, key) => { const bin = atob(r13(t.split('').reverse().join(''))); let o = ''; for (let i = 0; i < bin.length; i++) o += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length)); return o; };
  /* read this page's key from its inline script:  var K = r13("....".split('').reverse().join(''));  */
  const pageKey = doc => {
    for (const sc of doc.querySelectorAll('script:not([src])')) {
      const t = sc.textContent;
      if (!/data-a/.test(t)) continue;
      const m = t.match(/\bK\s*=\s*r13\(\s*(["'])([^"']+)\1\s*\.split\(\s*(?:""|'')\s*\)\s*\.reverse\(\)\s*\.join\(\s*(?:""|'')\s*\)\s*\)/);
      if (m) return r13(m[2].split('').reverse().join(''));
    }
    return null;
  };
  const FILE_EXT = /\.(mkv|mp4|avi|ogm|ogv|m4v|webm|mov|wmv|flv|ts|zip|rar|7z|srt|ass|ssa|mp3|flac)$/i;
  const parseFiles = html => {
    const doc = new DOMParser().parseFromString(html, 'text/html'), out = [], seenU = new Set();
    let diag = 'html ' + html.length + ' bytes, ' + doc.querySelectorAll('a[href]').length + ' links, "Size:" x' + ((html.match(/Size:/g) || []).length) + ', title "' + (doc.title || '').slice(0, 40) + '"';
    /* candidates: normal links, and the site's encoded buttons <span class="dlk" data-a data-b> (decoded the way the page's own click handler does) */
    const cands = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.endsWith('/comment')) return;
      let u; try { u = new URL(href, location.href); } catch (e) { return; }
      if (FILE_EXT.test(dec(u.pathname)) || /\/dl\//.test(u.pathname) || FILE_EXT.test(a.textContent.trim())) cands.push({ el: a, url: u.href, name: a.textContent.trim() });
    });
    const key = pageKey(doc);
    doc.querySelectorAll('span.dlk[data-a][data-b]').forEach(sp => {
      try {
        if (!key) throw new Error('Page decoding key missing; refusing to guess');
        const raw = decDlk(sp.getAttribute('data-a') + sp.getAttribute('data-b'), key);
        if (!/^https?:\/\//i.test(raw)) throw new Error('did not decode to a URL (key ' + (pageKey(doc) ? 'from page' : 'none found') + ')');
        const u = new URL(raw);
        if (!/^https?:$/.test(u.protocol) || !/(^|\.)tokyoinsider\.com$/.test(u.hostname) || u.username || u.password) throw new Error('Unexpected download host');
        const c = sp.cloneNode(true); c.querySelectorAll('i[aria-hidden="true"]').forEach(x => x.remove());   /* decoy characters */
        cands.push({ el: sp, url: u.href, name: c.textContent.replace(/\s+/g, ' ').trim() || dec(u.pathname.split('/').pop()) });
      } catch (e) { diag += '; dlk decode failed: ' + e; }
    });
    cands.forEach(({ el: start, url, name }) => {
      if (seenU.has(url)) return;
      /* climb to the entry that holds "Size: .. Downloads: .. Uploader: .." */
      let el = start, txt = '';
      for (let i = 0; i < 6 && el.parentElement; i++) { el = el.parentElement; txt = el.textContent.replace(/\s+/g, ' '); if (/Size:/i.test(txt)) break; }
      const g = re => { const m = txt.match(re); return m ? m[1].trim() : ''; };
      const size = g(/Size:\s*([\d.,]+\s*[KMGT]?B)/i);
      if (!size) { diag += '; link without size: ' + url.slice(-40); return; }
      seenU.add(url);
      out.push({ name, url, size, downloads: g(/Downloads:\s*([\d,]+)/i) || '0',
                 uploader: g(/Uploader:\s*([^\u2022\u00b7|]+?)\s*(?:[\u2022\u00b7|]|Added On:|$)/i), date: g(/Added On:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) });
    });
    const dlk = doc.querySelectorAll('span.dlk, [data-a][data-b]').length;
    if (!out.length && dlk) diag += '; ' + dlk + ' encoded download buttons (span.dlk) - the page layout may have changed';
    if (!out.length) {
      const hints = [...doc.querySelectorAll('a[href]')].filter(a => /download|\.(mkv|mp4|avi)|\/dl\//i.test(a.getAttribute('href'))).slice(0, 2).map(a => a.getAttribute('href').slice(0, 90));
      diag += '; sample links: ' + (hints.join(' | ') || 'none');
    }
    return { files: out, diag, dlk, doc };
  };

globalThis.TokyoParser = { detect, parseFiles, scan() {
 if (/just a moment|attention required/i.test(document.title) || document.querySelector('#challenge-running, #challenge-form')) throw new Error('Site verification required. Complete it in the reader tab, then retry.');
 const result = detect(document, location.pathname, true);
 const parsed = parseFiles(document.documentElement.outerHTML);
 return {title: result.title, episodes: result.all, files: parsed.files.filter(f => {try {const u=new URL(f.url); return /^https?:$/.test(u.protocol) && /(^|\.)tokyoinsider\.com$/.test(u.hostname) && !u.username && !u.password;} catch {return false;}}), diagnostic: parsed.diag};
}};
})();
