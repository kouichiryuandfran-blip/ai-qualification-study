# 生成AI資格学習プログラム

GitHub Pages / Windows向け配布版です。

## 文字コード
- HTML / CSS / JavaScript / JSON / Markdown: UTF-8
- ZIP名と最上位フォルダ名は英数字に統一しています。
- AI01～AI15の日本語データ名はUTF-8のまま使用できます。

## 主なファイル
- index.html: トップ画面
- app.html / app.js: クイズ学習・苦手問題復習
- reader.html / reader.js / reader.css: 音声学習
- speech_dictionary.js: 読み上げ補正辞書
- all_menus.json: AI01～AI15メニュー
- consent.js: 利用同意
- manifest.json / service-worker.js: PWA
- start_server.bat: Windowsローカル確認用

## ローカル確認
1. このフォルダを展開します。
2. AI01～AI15のメニューJSONと、そこから参照される問題JSONを配置します。
3. start_server.bat をダブルクリックします。
4. ブラウザで http://localhost:8000/ を開きます。

## GitHub Pages
リポジトリ直下に index.html がある状態で登録してください。
GitHub Pages は main / (root) を指定します。

## 注意
各メニューJSON内の relative_path と実際の問題JSONの配置を一致させてください。
