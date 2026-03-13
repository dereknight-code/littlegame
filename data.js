async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`無法載入資料：${url}`);
  }
  return response.json();
}

async function loadIndex() {
  const indexData = await fetchJson("index.json");
  if (!indexData || !Array.isArray(indexData.properties) || !Array.isArray(indexData.questionIndex)) {
    throw new Error("索引格式錯誤");
  }
  return indexData;
}

async function loadQuestionByFile(file) {
  const q = await fetchJson(file);
  if (!q || !q.id || !Array.isArray(q.choices) || !Array.isArray(q.answers)) {
    throw new Error(`題目格式錯誤：${file}`);
  }
  return q;
}

function createQuestionLoader(indexData) {
  const all = indexData.questionIndex.slice();
  const usedIds = new Set();
  const roundSize = 5;
  let round = [];
  let cursor = 0;

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildRound(loader) {
    const remaining = all.filter(entry => !usedIds.has(entry.id));
    let selection = shuffle(remaining);

    if (selection.length >= roundSize) {
      selection = selection.slice(0, roundSize);
    } else {
      const needed = roundSize - selection.length;
      usedIds.clear();
      let pool = all.filter(entry => !selection.some(pick => pick.id === entry.id));
      pool = shuffle(pool);
      while (selection.length < roundSize && pool.length) {
        selection.push(pool.shift());
      }
      while (selection.length < roundSize && all.length) {
        selection.push(shuffle(all)[0]);
      }
    }

    round = selection;
    cursor = 0;
    if (loader) {
      loader.total = round.length;
    }
    round.forEach(entry => usedIds.add(entry.id));
  }

  const loader = {
    total: 0,
    next: async () => {
      if (cursor >= round.length) return null;
      const entry = round[cursor];
      cursor += 1;
      return loadQuestionByFile(entry.file);
    },
    resetRound: () => buildRound(loader)
  };

  buildRound(loader);
  return loader;
}
