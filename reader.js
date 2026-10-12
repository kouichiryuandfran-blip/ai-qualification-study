// ======================================================
// 生成AI資格学習 音声学習アプリ reader.js
// display_id 完全対応版
// ======================================================

let allMenus = [];
let selectedMenu = null;
let selectedQuiz = null;
let questions = [];
let currentIndex = 0;
let isReading = false;
let isAutoReading = false;

const ALL_MENUS_PATH = "./all_menus.json";

document.addEventListener("DOMContentLoaded", () => {
  initReaderApp();
});

// ------------------------------------------------------
// 初期処理
// ------------------------------------------------------
function initReaderApp() {
  setupSpeedControl();
  loadAllMenus();
}

// ------------------------------------------------------
// all_menus.json 読み込み
// ------------------------------------------------------
function loadAllMenus() {
  fetch(ALL_MENUS_PATH)
    .then(res => {
      if (!res.ok) {
        throw new Error(`all_menus.json の読み込みに失敗しました: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      allMenus = normalizeMenus(data);
      renderMenuList();
    })
    .catch(err => {
      console.error(err);
      setHTML("menuList", `<p class="error">メニュー読込エラー<br>${escapeHtml(err.message)}</p>`);
    });
}

// all_menus.json の形式差を吸収
function normalizeMenus(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.menus)) return data.menus;
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

// ------------------------------------------------------
// メニュー一覧表示
// ------------------------------------------------------
function renderMenuList() {
  const menuList = document.getElementById("menuList");

  if (!allMenus.length) {
    menuList.innerHTML = "<p>メニューが見つかりません。</p>";
    return;
  }

  menuList.innerHTML = "";

  allMenus.forEach(menu => {
    const title = getMenuTitle(menu);
    const path = getMenuPath(menu);

    const btn = document.createElement("button");
    btn.className = "card-btn";
    btn.textContent = title;
    btn.onclick = () => selectMenu(menu, path, title);

    menuList.appendChild(btn);
  });
}

function getMenuTitle(menu) {
  return (
    menu.menu_name ||
    menu.title ||
    menu.name ||
    menu.group ||
    menu.label ||
    "無題メニュー"
  );
}

function getMenuPath(menu) {
  return (
    menu.output_file ||
    menu.relative_path ||
    menu.path ||
    menu.file ||
    menu.json ||
    menu.url ||
    menu.menu_name ||
    menu.title ||
    menu.name ||
    ""
  );
}

// ------------------------------------------------------
// メニュー選択 → グループJSON読込
// ------------------------------------------------------
function selectMenu(menu, path, title) {
  if (!path) {
    alert("このメニューにはJSONファイルのパスが設定されていません。");
    return;
  }

  selectedMenu = {
    raw: menu,
    title: title,
    path: path
  };

  const jsonPath = path.endsWith(".json") ? path : `${path}.json`;

  fetch(`./${jsonPath}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`メニューJSON読込失敗: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      selectedMenu.data = data;
      showQuizList(data);
    })
    .catch(err => {
      console.error(err);
      alert(`メニュー読込エラー\n${err.message}\n\n対象: ${jsonPath}`);
    });
}

// ------------------------------------------------------
// テーマ一覧表示
// ------------------------------------------------------
function showQuizList(menuData) {
  showArea("quizArea");
  setText("selectedMenuTitle", selectedMenu.title);

  const quizList = document.getElementById("quizList");
  quizList.innerHTML = "";

  const quizzes = Array.isArray(menuData.quizzes) ? menuData.quizzes : [];

  if (!quizzes.length) {
    quizList.innerHTML = "<p>このメニューにはテーマがありません。</p>";
    return;
  }

  quizzes.forEach(quiz => {
    const title = quiz.title || quiz.file_stem || "無題テーマ";
    const count = Number.isFinite(quiz.question_count) ? quiz.question_count : "";

    const btn = document.createElement("button");
    btn.className = "card-btn";
    btn.textContent = count ? `${title} (${count}問)` : title;
    btn.onclick = () => selectQuiz(quiz);

    quizList.appendChild(btn);
  });
}

// ------------------------------------------------------
// テーマ選択 → 問題JSON読込
// ------------------------------------------------------
function selectQuiz(quiz) {
  if (!quiz || !quiz.relative_path) {
    alert("クイズファイルのパスが設定されていません。");
    return;
  }

  selectedQuiz = quiz;

  fetch(`./${quiz.relative_path}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`問題JSON読込失敗: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      questions = normalizeQuestions(data);

      if (!questions.length) {
        throw new Error("問題データが0件です。");
      }

      shuffleArray(questions);
      currentIndex = 0;

      showReaderArea();
      displayCurrentQuestion();
    })
    .catch(err => {
      console.error(err);
      alert(`問題読込エラー\n${err.message}\n\n対象: ${quiz.relative_path}`);
    });
}

// 問題JSONの形式差を吸収
function normalizeQuestions(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.questions)) return data.questions;
  if (Array.isArray(data.quizzes)) return data.quizzes;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

// ------------------------------------------------------
// 音声学習画面表示
// ------------------------------------------------------
function showReaderArea() {
  showArea("readerArea");

  const title = selectedQuiz.title || selectedQuiz.file_stem || "音声学習";
  setText("readerTitle", title);
  setText("playStatus", "停止中");
}

function displayCurrentQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  const questionId = getQuestionDisplayId(q);
  const questionFormat = getQuestionField(q, ["question_type", "question_format", "format", "type", "問題形式", "形式"]);
  const question = getQuestionField(q, ["question", "問題", "問題文"]);
  const answer = getQuestionField(q, ["answer", "解答", "正解"]);
  const explanation1 = getQuestionField(q, ["explanation", "explanation1", "解説", "解説1"]);
  const explanation2 = getQuestionField(q, ["explanation2", "explanation_2", "解説2"]);

  setText("counter", `${currentIndex + 1} / ${questions.length}`);
  setText("questionId", questionId ? `問題番号: ${questionId}` : "");
  setText("questionFormat", questionFormat ? `問題形式: ${questionFormat}` : "");

  setHTML("questionText", escapeHtml(question).replace(/\n/g, "<br>"));
  setHTML("answerText", escapeHtml(answer).replace(/\n/g, "<br>"));
  setHTML("explanation1Text", escapeHtml(explanation1).replace(/\n/g, "<br>"));
  setHTML("explanation2Text", escapeHtml(explanation2).replace(/\n/g, "<br>"));
}

// ------------------------------------------------------
// 読み上げ制御
// ------------------------------------------------------
function startReading() {
  if (!questions.length) {
    alert("問題が読み込まれていません。");
    return;
  }

  stopReading();
  isAutoReading = true;
  isReading = true;
  setText("playStatus", "読み上げ中");

  readCurrentQuestion(true);
}

function readCurrentQuestion(autoNext = false) {
  if (!questions.length) {
    alert("問題が読み込まれていません。");
    return;
  }

  speechSynthesis.cancel();

  const q = questions[currentIndex];

  displayCurrentQuestion();

  const questionText = buildQuestionOnlyText(q);
  const afterText = buildAfterQuestionText(q);

  if (!questionText.trim()) {
    alert("読み上げる問題がありません。");
    return;
  }

  setText("playStatus", "問題読み上げ中");

  speakText(questionText, () => {
    setText("playStatus", "3秒待機中");

    setTimeout(() => {
      if (!isAutoReading && autoNext) return;

      if (afterText.trim()) {
        setText("playStatus", "解答読み上げ中");

        speakText(afterText, () => {
          isReading = false;

          if (autoNext && isAutoReading) {
            setTimeout(() => {
              moveToNextQuestionForAutoRead();
            }, 800);
          } else {
            setText("playStatus", "停止中");
          }
        });
      } else {
        if (autoNext && isAutoReading) {
          moveToNextQuestionForAutoRead();
        } else {
          setText("playStatus", "停止中");
        }
      }
    }, 3000);
  });
}

function speakText(text, onEndCallback) {
  const utterance = new SpeechSynthesisUtterance(normalizeSpeechText(text));

  utterance.lang = "ja-JP";
  utterance.rate = getSpeechRate();
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    isReading = true;
  };

  utterance.onend = () => {
    if (typeof onEndCallback === "function") {
      onEndCallback();
    }
  };

  utterance.onerror = () => {
    isReading = false;
    setText("playStatus", "読み上げエラー");
  };

  speechSynthesis.speak(utterance);
}

function buildQuestionOnlyText(q) {
  const questionId = getQuestionDisplayId(q);
  const questionFormat = getQuestionField(q, ["question_type", "question_format", "format", "type", "問題形式", "形式"]);
  const question = getQuestionField(q, ["question", "問題", "問題文"]);

  const parts = [];

  if (questionId) parts.push(`問題番号。${questionId}。`);
  if (questionFormat) parts.push(`問題形式。${questionFormat}。`);

  parts.push("問題。");
  parts.push(question);

  return parts
    .filter(Boolean)
    .join("。")
    .replace(/\s+/g, " ");
}

function buildAfterQuestionText(q) {
  const readMode = document.getElementById("readMode").value;

  const answer = getQuestionField(q, ["answer", "解答", "正解"]);
  const explanation1 = getQuestionField(q, ["explanation", "explanation1", "解説", "解説1"]);
  const explanation2 = getQuestionField(q, ["explanation2", "explanation_2", "解説2"]);

  const parts = [];

  if (readMode === "answer" || readMode === "explanation1" || readMode === "all") {
    parts.push("解答。");
    parts.push(answer);
  }

  if (readMode === "explanation1" || readMode === "all") {
    parts.push("解説1。");
    parts.push(explanation1);
  }

  if (readMode === "all") {
    parts.push("解説2。");
    parts.push(explanation2);
  }

  return parts
    .filter(Boolean)
    .join("。")
    .replace(/\s+/g, " ");
}

function pauseReading() {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    setText("playStatus", "一時停止中");
  }
}

function resumeReading() {
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
    setText("playStatus", "読み上げ中");
  }
}

function stopReading() {
  isAutoReading = false;
  isReading = false;
  speechSynthesis.cancel();
  setText("playStatus", "停止中");
}

function nextQuestion() {
  stopReading();

  if (!questions.length) return;

  currentIndex++;

  if (currentIndex >= questions.length) {
    alert("全問の読み上げが終了しました。最初に戻ります。");
    currentIndex = 0;
    shuffleArray(questions);
  }

  displayCurrentQuestion();
}

function moveToNextQuestionForAutoRead() {
  if (!isAutoReading) return;

  currentIndex++;

  if (currentIndex >= questions.length) {
    isAutoReading = false;
    setText("playStatus", "全問終了");
    alert("全問の読み上げが終了しました。");
    return;
  }

  displayCurrentQuestion();
  readCurrentQuestion(true);
}

// ------------------------------------------------------
// 読み上げ速度
// ------------------------------------------------------
function setupSpeedControl() {
  const speedRange = document.getElementById("speedRange");
  const speedValue = document.getElementById("speedValue");

  if (!speedRange || !speedValue) return;

  speedRange.addEventListener("input", () => {
    speedValue.textContent = Number(speedRange.value).toFixed(1);
  });
}

function getSpeechRate() {
  const speedRange = document.getElementById("speedRange");
  return speedRange ? Number(speedRange.value) : 1.0;
}

// ------------------------------------------------------
// 画面遷移
// ------------------------------------------------------
function backToMenu() {
  stopReading();
  showArea("menuArea");
}

function backToQuizList() {
  stopReading();
  showArea("quizArea");
}

function showArea(areaId) {
  const areas = ["menuArea", "quizArea", "readerArea"];

  areas.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === areaId) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

// ------------------------------------------------------
// 共通関数
// ------------------------------------------------------
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
    if (
      question[key] !== undefined &&
      question[key] !== null &&
      String(question[key]).trim() !== ""
    ) {
      return String(question[key]);
    }
  }

  return "";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`要素が見つかりません: ${id}`);
    return;
  }
  el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`要素が見つかりません: ${id}`);
    return;
  }
  el.innerHTML = html;
}

function normalizeSpeechText(text) {

  let result = String(text || "");

  // ======================================================
  // 読み上げ補正辞書を適用
  // ======================================================
  SPEECH_REPLACE_RULES.forEach(rule => {
    result = result.replace(rule[0], rule[1]);
  });

  return result

    // 穴埋めの空欄
    .replace(/[（(]\s*[　\s＿_ー－―-]*\s*[）)]/g, " かっこ")

    // ○×・〇×
    .replace(/[○〇]\s*[×✕✖xX☓]/g, " まるばつ ")
    .replace(/[×✕✖xX☓]\s*[○〇]/g, " ばつまる ")

    // 単独の○・〇・×
    .replace(/[○〇]/g, " まる ")
    .replace(/[×✕✖☓]/g, " ばつ ")

    // 空白整理
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}