/**
 * Extractive answer composer for DIRECT mode (no Claude).
 * Builds a short, speakable summary from raw search results and reports
 * the sources so the UI can show them. Honest by design: it quotes what
 * the web says instead of pretending to reason.
 */

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** First 1–2 sentences of a snippet, capped for speech. */
function leadSentences(text, maxChars = 340) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const parts = clean.split(/(?<=[.!?…])\s+/);
  let out = '';
  for (const p of parts) {
    if ((out + ' ' + p).trim().length > maxChars) break;
    out = `${out} ${p}`.trim();
    if (out.length >= maxChars * 0.6 && parts.length > 1) break;
  }
  return out || clean.slice(0, maxChars);
}

/**
 * @param {string} query
 * @param {{provider: string, results: Array<{title,url,snippet}>}} search
 * @param {'vi'|'en'} lang
 * @returns {{ answer: string, sources: Array<{title,url}> }}
 */
export function composeSearchAnswer(query, search, lang = 'vi') {
  const results = search.results.slice(0, 5);
  const sources = results.slice(0, 3).map((r) => ({ title: r.title, url: r.url }));

  const withSnippet = results.filter((r) => (r.snippet || '').trim().length > 40);
  const best = withSnippet[0] || results[0];
  const second = withSnippet[1];

  const pieces = [];
  if (best?.snippet) {
    pieces.push(leadSentences(best.snippet));
  } else if (best) {
    pieces.push(best.title);
  }
  if (second?.snippet) {
    const extra = leadSentences(second.snippet, 200);
    // Skip near-duplicate second snippets.
    if (extra && !pieces[0]?.includes(extra.slice(0, 60))) pieces.push(extra);
  }

  const doms = [...new Set(results.map((r) => domainOf(r.url)).filter(Boolean))].slice(0, 2);

  if (pieces.length === 0) {
    return {
      answer:
        lang === 'vi'
          ? `Tôi tìm thấy một số trang về "${query}" nhưng không trích xuất được nội dung. Bạn xem danh sách nguồn bên dưới nhé.`
          : `I found pages about "${query}" but could not extract a summary. Please check the sources below.`,
      sources,
    };
  }

  const cite =
    doms.length > 0
      ? lang === 'vi'
        ? ` (theo ${doms.join(' và ')})`
        : ` (according to ${doms.join(' and ')})`
      : '';

  return { answer: `${pieces.join(' ')}${cite}`, sources };
}

export function noInternetAnswer(lang = 'vi', detail = '') {
  const base =
    lang === 'vi'
      ? 'Xin lỗi, hiện tôi không truy cập được nguồn tìm kiếm nào trên internet nên chưa thể trả lời câu hỏi này.'
      : 'Sorry, I cannot reach any search source on the internet right now, so I cannot answer that.';
  return detail ? `${base} (${detail})` : base;
}
