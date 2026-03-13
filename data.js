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
  const index = indexData.questionIndex.slice();
  let cursor = 0;

  return {
    total: index.length,
    next: async () => {
      if (cursor >= index.length) return null;
      const entry = index[cursor];
      cursor += 1;
      return loadQuestionByFile(entry.file);
    },
    reset: () => { cursor = 0; }
  };
}
