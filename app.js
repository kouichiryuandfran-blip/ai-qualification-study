let menuData = {};
let allQuestions = [];
let questions = [];
let index = 0;
let correct = 0;
let total = 0;
let currentGroup = "";
let currentQuizTitle = "";
let currentMode = "normal"; // normal / weak / allrandom
let currentQuestionSource = null;

const WEAK_KEY = "ai_qualification_quiz_weak_questions_v1";
const REPORT_EMAIL = "kouichi.ryuandfran@gmail.com";

const GAS_LOG_URL = "https://script.google.com/macros/s/AKfycbwwnR4tW_bL90GRpTVu3jq_4EzJePLcqVqMRTW37KC8ZBArcsSH1kmxNVQWwJz4PgjTew/exec";
const USER_NAME_KEY = "ai_qualification_quiz_user_name_v1";

const params = new URLSearchParams(location.search);
const group = params.get("group");
const modeParam = params.get("mode");
const countParam = Math.max(1, Math.min(100, Number(params.get("count")) || 10));

if (modeParam === "allrandom") {
  currentMode = "allrandom";
  startAllThemeRandom(countParam);
} else if (!group) {
  document.body.innerHTML = `
    <div class="container">
      <div class="error-card">
        <h2>グループ指定がありません。</h2>
        <p><a href="index.html">トップへ戻る</a></p>
      </div>
    </div>
  `;
  throw new Error("group parameter is missing.");
}

if (modeParam !== "allrandom") {
  currentGroup = group;

  const groupTitleEl = document.getElementById("groupTitle");
  if (groupTitleEl) groupTitleEl.textContent = currentGroup;

  const groupJsonPath = `./${group}.json`;
  fetch(groupJsonPath)
    .then(res => {
      if (!res.ok) throw new Error(`JSON読込失敗: ${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(data => { menuData = data; initMenu(); })
    .catch(err => showFatalError(err, groupJsonPath));
}

async function startAllThemeRandom(count) {
  try {
    setText("groupTitle", "全テーマ ランダム出題");
    const menuEl = document.getElementById("menu");
    menuEl.innerHTML = `<h2 class="menu-title">全テーマ ランダム出題</h2><p class="subtext">AI01～AI15の全テーマから問題を準備しています...</p>`;

    const allMenuRes = await fetch("./all_menus.json");
    if (!allMenuRes.ok) throw new Error(`all_menus.json 読込失敗: ${allMenuRes.status}`);
    const allMenuData = await allMenuRes.json();
    const menus = Array.isArray(allMenuData.menus) ? allMenuData.menus : [];
    if (!menus.length) throw new Error("分類メニューが見つかりません。");

    const pool = [];
    for (const menu of menus) {
      const groupFile = menu.output_file || `${menu.menu_name}.json`;
      const groupRes = await fetch(`./${groupFile}`);
      if (!groupRes.ok) throw new Error(`${groupFile} 読込失敗: ${groupRes.status}`);
      const groupData = await groupRes.json();
      const quizzes = Array.isArray(groupData.quizzes) ? groupData.quizzes : [];

      for (const quiz of quizzes) {
        if (!quiz.relative_path) continue;
        const quizRes = await fetch(`./${quiz.relative_path}`);
        if (!quizRes.ok) throw new Error(`${quiz.relative_path} 読込失敗: ${quizRes.status}`);
        const quizData = await quizRes.json();
        const list = normalizeQuestions(quizData);
        list.forEach(q => pool.push({
          ...q,
          __sourceGroup: groupData.menu_name || menu.menu_name || "",
          __sourceQuizTitle: quiz.title || quiz.file_stem || "",
          __sourceQuizPath: quiz.relative_path
        }));
      }
    }

    if (!pool.length) throw new Error("ランダム出題に使用できる問題がありません。");
    shuffleArray(pool);
    questions = pool.slice(0, Math.min(count, pool.length));
    allQuestions = pool;
    currentGroup = "全テーマ";
    currentQuizTitle = `全テーマ ランダム ${questions.length}問`;
    menuData = { menu_name: "全テーマ" };
    index = 0; correct = 0; total = 0;

    menuEl.classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    restoreUserName();
    setText("groupTitle", `全テーマ / ランダム出題 (${questions.length}問)`);
    setText("stats", "今回の成績: 0% (0/0)");
    loadQuestion();
  } catch (err) {
    console.error(err);
    showFatalError(err, "全テーマ ランダム出題");
  }
}

function showFatalError(err, target) {
  document.body.innerHTML = `
    <div class="container"><div class="error-card">
      <h2>読込エラー</h2><p>${escapeHtml(err.message)}</p>
      <p>読込先: ${escapeHtml(target)}</p><p><a href="index.html">戻る</a></p>
    </div></div>`;
}

function initMenu() {
  const menu = document.getElementById("menu");
  if (!menu) {
    throw new Error("app.html に id='menu' がありません。");
  }

  const quizzes = Array.isArray(menuData.quizzes) ? menuData.quizzes : [];

  if (quizzes.length === 0) {
    menu.innerHTML = "<p>この分類には問題がありません。</p>";
    return;
  }

  let html = `<h2 class="menu-title">${escapeHtml(menuData.menu_name || currentGroup)}</h2>`;
  html += `<p class="subtext">テーマを選択してください</p>`;
  menu.innerHTML = html;

  quizzes.forEach(quiz => {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "12px";

    const title = quiz.title || quiz.file_stem || "無題";
    const count = Number.isFinite(quiz.question_count) ? quiz.question_count : 0;
    const weakCount = getWeakCountForQuiz(quiz);

    const normalBtn = document.createElement("button");
    normalBtn.className = "card-btn";
    normalBtn.textContent = `${title} (${count}問)`;
    normalBtn.onclick = () => loadQuizFile(quiz, "normal");

    wrapper.appendChild(normalBtn);

    const weakBtn = document.createElement("button");
    weakBtn.className = "small-btn";
    weakBtn.style.width = "100%";
    weakBtn.style.marginTop = "6px";
    weakBtn.textContent = `苦手問題を復習 (${weakCount}問)`;
    weakBtn.onclick = () => loadQuizFile(quiz, "weak");

    wrapper.appendChild(weakBtn);

    menu.appendChild(wrapper);
  });
}

function loadQuizFile(quiz, mode = "normal") {
  if (!quiz || !quiz.relative_path) {
    alert("クイズファイル情報が不足しています。");
    return;
  }

  currentQuizTitle = quiz.title || quiz.file_stem || "";
  currentMode = mode;

  fetch(`./${quiz.relative_path}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`クイズJSON読込失敗: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      allQuestions = normalizeQuestions(data);

      if (!allQuestions.length) {
        throw new Error("問題データが0件です。");
      }

      if (mode === "weak") {
        questions = filterWeakQuestions(allQuestions, quiz.relative_path);

        if (!questions.length) {
          alert("このテーマには保存された苦手問題がありません。");
          return;
        }
        shuffleArray(questions);
      } else {
        questions = [...allQuestions];
      }

      index = 0;
      correct = 0;
      total = 0;

      const menuEl = document.getElementById("menu");
      const quizEl = document.getElementById("quiz");

      if (menuEl) menuEl.classList.add("hidden");
      if (quizEl) quizEl.classList.remove("hidden");

      restoreUserName();

      const titleEl = document.getElementById("groupTitle");
      if (titleEl) {
        const modeLabel = mode === "weak" ? "苦手問題復習" : "通常学習";
        titleEl.textContent = `${menuData.menu_name || currentGroup} / ${currentQuizTitle} / ${modeLabel}`;
      }

      setText("stats", "今回の成績: 0% (0/0)");
      loadQuestion();
    })
    .catch(err => {
      console.error(err);
      alert(`読込エラー\n${err.message}\n\n対象: ${quiz.relative_path}`);
    });
}

function normalizeQuestions(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.questions)) return data.questions;
  if (Array.isArray(data.quizzes)) return data.quizzes;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function loadQuestion() {
  const q = questions[index];
  currentQuestionSource = q ? {
    group: q.__sourceGroup || menuData.menu_name || currentGroup,
    quizTitle: q.__sourceQuizTitle || currentQuizTitle,
    quizPath: q.__sourceQuizPath || getCurrentQuizPath()
  } : null;
  if (!q) {
    throw new Error("問題データが見つかりません。");
  }

  const grade = getQuestionField(q, ["grade", "グレード"]);
  const category = getQuestionField(q, ["category", "表示カテゴリー", "カテゴリー"]);
  const displayId = getQuestionDisplayId(q);
  const questionFormat = getQuestionField(q, ["question_type", "question_format", "format", "type", "問題形式", "形式"]);

  let label = "";
  if (category && grade) {
    label = `【${category} / ${grade}】`;
  } else if (category) {
    label = `【${category}】`;
  } else if (grade) {
    label = `【${grade}】`;
  } else {
    label = "【問題】";
  }

  setText("counter", `${index + 1} / ${questions.length}`);
  if (currentMode === "allrandom" && currentQuestionSource) {
    label = `${label}\n${currentQuestionSource.group} / ${currentQuestionSource.quizTitle}`;
  }
  setText("type", label);
  setText("questionId", displayId ? `問題番号: ${displayId}` : "");
  setText("questionFormat", questionFormat ? `問題形式: ${questionFormat}` : "");
  setText("question", getQuestionField(q, ["question", "問題", "問題文"]));

  const answerText = getQuestionField(q, ["answer", "解答", "正解"]);
  const explanationText = getQuestionField(q, ["explanation", "explanation1", "解説", "解説1"]);
  const explanation2Text = getQuestionField(q, ["explanation2", "explanation_2", "解説2"]);
  const explanationImagePath = getExplanationImagePath(q);

  const answerHtml =
    `<b>解答</b><br>${escapeHtml(answerText).replace(/\n/g, "<br>")}` +
    `<br><br><b>解説1</b><br>${escapeHtml(explanationText).replace(/\n/g, "<br>")}`;

  const explanation2Html =
    `<b>解説2</b><br>${escapeHtml(explanation2Text).replace(/\n/g, "<br>")}`;

  setHTML("answer", answerHtml);
  setHTML("explanation2", explanation2Html);
  setHTML("explanationImage", explanationImagePath
    ? `<img src="${escapeHtml(explanationImagePath)}" alt="解説画像" class="explanation-image" loading="lazy">`
    : "");

  document.getElementById("answer").classList.add("hidden");
  document.getElementById("explanationImage").classList.add("hidden");
  document.getElementById("showExplanationImageBtn").classList.add("hidden");
  document.getElementById("explanation2").classList.add("hidden");
  document.getElementById("showExplanation2Btn").classList.add("hidden");
  document.getElementById("judge").classList.add("hidden");
  document.getElementById("nextBtn").classList.add("hidden");
  document.getElementById("reportArea").classList.remove("hidden");
  document.getElementById("showAnswerBtn").classList.remove("hidden");
}

function showAnswer() {
  const q = questions[index];
  const explanation2Text = q ? getQuestionField(q, ["explanation2", "explanation_2", "解説2"]) : "";
  const explanationImagePath = q ? getExplanationImagePath(q) : "";

  document.getElementById("answer").classList.remove("hidden");
  document.getElementById("judge").classList.remove("hidden");
  document.getElementById("showAnswerBtn").classList.add("hidden");

  if (explanationImagePath) {
    document.getElementById("showExplanationImageBtn").classList.remove("hidden");
  }

  if (explanation2Text) {
    document.getElementById("showExplanation2Btn").classList.remove("hidden");
  }
}

function showExplanationImage() {
  document.getElementById("explanationImage").classList.remove("hidden");
  document.getElementById("showExplanationImageBtn").classList.add("hidden");
}

function getExplanationImagePath(question) {
  const raw = getQuestionField(question, [
    "explanation_image", "explanationImage", "image", "image_path",
    "解説画像", "解説画像パス", "画像", "画像パス"
  ]);
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/") ? raw : `./${raw}`;
}

function showExplanation2() {
  document.getElementById("explanation2").classList.remove("hidden");
  document.getElementById("showExplanation2Btn").classList.add("hidden");
}

function mark(ok) {
  const q = questions[index];

  total++;
  if (ok) {
    correct++;
    removeWeakQuestion(q, currentQuestionSource?.quizPath || getCurrentQuizPath());
  } else {
    saveWeakQuestion(q, currentQuestionSource?.quizPath || getCurrentQuizPath());
  }

  const rate = Math.round((correct / total) * 100);
  setText("stats", `今回の成績: ${rate}% (${correct}/${total})`);

  const questionType = getQuestionField(q, ["question_type", "question_format", "format", "type", "問題形式", "形式"]);
  const category = getQuestionField(q, ["category", "表示カテゴリー", "カテゴリー"]);
  const grade = getQuestionField(q, ["grade", "グレード"]);
  const questionId = getQuestionDisplayId(q);

  sendLearningLog({
    userName: getUserName(),
    groupName: currentQuestionSource?.group || menuData.menu_name || currentGroup,
    quizTitle: currentQuestionSource?.quizTitle || currentQuizTitle,
    questionId: questionId,
    questionType: questionType,
    category: category,
    grade: grade,
    isCorrect: ok,
    correctCount: correct,
    totalCount: total,
    rate: rate
  });

  document.getElementById("judge").classList.add("hidden");
  document.getElementById("nextBtn").classList.remove("hidden");
}

function nextQuestion() {
  index++;

  if (index >= questions.length) {
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    alert(`全問終了しました\n正解率: ${rate}% (${correct}/${total})`);

    if (currentMode === "allrandom") {
      location.href = "index.html";
      return;
    }

    document.getElementById("quiz").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    const titleEl = document.getElementById("groupTitle");
    if (titleEl) titleEl.textContent = menuData.menu_name || currentGroup;
    initMenu();
    return;
  }

  loadQuestion();
}

function reportIssue() {
  const q = questions[index];
  if (!q) return;

  const displayId = getQuestionDisplayId(q);

  const subject = `[生成AI資格学習 誤り報告] ${displayId || currentQuizTitle}`;
  const body = [
    "下記問題について確認をお願いします。",
    "",
    `分類: ${currentQuestionSource?.group || menuData.menu_name || currentGroup}`,
    `テーマ: ${currentQuestionSource?.quizTitle || currentQuizTitle}`,
    `問題番号: ${displayId || ""}`,
    `カテゴリー: ${getQuestionField(q, ["category", "表示カテゴリー", "カテゴリー"])}`,
    `グレード: ${getQuestionField(q, ["grade", "グレード"])}`,
    "",
    "問題文:",
    getQuestionField(q, ["question", "問題", "問題文"]),
    "",
    "解答:",
    getQuestionField(q, ["answer", "解答", "正解"]),
    "",
    "解説:",
    getQuestionField(q, ["explanation", "explanation1", "解説", "解説1"]),
    "",
    "報告内容:",
    "（ここに入力してください）"
  ].join("\n");

  const mailto = `mailto:${encodeURIComponent(REPORT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  location.href = mailto;
}

function getWeakStorage() {
  try {
    return JSON.parse(localStorage.getItem(WEAK_KEY) || "{}");
  } catch {
    return {};
  }
}

function setWeakStorage(data) {
  localStorage.setItem(WEAK_KEY, JSON.stringify(data));
}

function makeWeakKey(quizPath, question) {
  const id = getQuestionDisplayId(question);
  const text = getQuestionField(question, ["question", "問題", "問題文"]);
  return `${quizPath}__${id}__${text}`;
}

function saveWeakQuestion(question, quizPath) {
  const storage = getWeakStorage();
  const key = makeWeakKey(quizPath, question);

  storage[key] = {
    quizPath: quizPath,
    id: getQuestionDisplayId(question),
    question: getQuestionField(question, ["question", "問題", "問題文"])
  };

  setWeakStorage(storage);
}

function removeWeakQuestion(question, quizPath) {
  const storage = getWeakStorage();
  const key = makeWeakKey(quizPath, question);

  if (storage[key]) {
    delete storage[key];
    setWeakStorage(storage);
  }
}

function filterWeakQuestions(questionList, quizPath) {
  const storage = getWeakStorage();
  return questionList.filter(q => storage[makeWeakKey(quizPath, q)]);
}

function getWeakCountForQuiz(quiz) {
  if (!quiz || !quiz.relative_path) return 0;

  const storage = getWeakStorage();
  let count = 0;

  Object.values(storage).forEach(item => {
    if (item && item.quizPath === quiz.relative_path) {
      count++;
    }
  });

  return count;
}

function getCurrentQuizPath() {
  const quizzes = Array.isArray(menuData.quizzes) ? menuData.quizzes : [];
  const target = quizzes.find(q => (q.title || q.file_stem || "") === currentQuizTitle);
  return target ? target.relative_path : "";
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getQuestionDisplayId(question) {
  return getQuestionField(question, [
    "display_id",
    "displayId",
    "表示管理番号",
    "id",
    "ID",
    "問題番号"
  ]);
}

function getQuestionField(question, keys) {
  if (!question || !Array.isArray(keys)) return "";

  for (const key of keys) {
    if (question[key] !== undefined && question[key] !== null && String(question[key]).trim() !== "") {
      return String(question[key]);
    }
  }

  return "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`app.html に id='${id}' がありません。`);
  el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`app.html に id='${id}' がありません。`);
  el.innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getUserName() {
  const el = document.getElementById("userName");
  if (!el) return localStorage.getItem(USER_NAME_KEY) || "";

  const name = el.value.trim();
  if (name) {
    localStorage.setItem(USER_NAME_KEY, name);
    return name;
  }

  return localStorage.getItem(USER_NAME_KEY) || "";
}

function restoreUserName() {
  const el = document.getElementById("userName");
  if (!el) return;

  const saved = localStorage.getItem(USER_NAME_KEY) || "";
  if (saved) {
    el.value = saved;
  }

  el.addEventListener("change", () => {
    localStorage.setItem(USER_NAME_KEY, el.value.trim());
  });
}

function sendLearningLog(data) {
  if (!GAS_LOG_URL) return;

  fetch(GAS_LOG_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(data)
  }).catch(() => {});
}