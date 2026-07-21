# ピクセルサッカー

カルチョビット風の2Dドット絵サッカーシミュレーションゲーム（Web / TypeScript）。

## 遊び方

1. 自チームを1つ選択
2. シーズンの試合を1試合ずつ消化（他会場の試合は自動で結果が決まる）
3. 順位表を確認しながらシーズン終了まで進める

## 開発

```bash
npm install
npm run dev
```

## 技術構成

- Vite + TypeScript
- Canvas 2D によるドット絵ピッチ描画
- シードあり擬似乱数による試合シミュレーション（総当たりリーグ戦）
- 選手のポジショニングは、ボール位置からの相対位置を役割（GK/DF/MF/FW）ごとに線形回帰で学習したモデルにより決定

タイトル画面の「実データ再生モード」では、学習モデルを介さずMetrica Sportsの実トラッキングデータ（前半5分間）をそのまま再生できます。

## データ出典

選手ポジショニングの学習データ、および「実データ再生モード」の再生データは、いずれも [Metrica Sports](https://github.com/metrica-sports/sample-data) が公開している匿名化済みサンプルトラッキングデータ（Sample Game 1）から作成しています。生データ自体はこのリポジトリに含めていません。`scripts/buildPositioningData.mjs`（学習用データ）と `scripts/buildReplayData.mjs`（再生データ）で再生成できます。
