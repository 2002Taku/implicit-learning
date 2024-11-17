# Flask アプリケーション

## 概要

このアプリケーションは、潜在学習課題のデータを収集し、管理者が CSV ファイルとしてダウンロードできるようにするためのものです。以前は Azure Redis Cache と RQ を使用してバックグラウンドジョブでデータ分析を行っていましたが、現在はこれらを廃止し、直接 CSV ファイルのダウンロード機能のみを提供しています。

## 変更点

- **Azure Redis Cache と RQ の削除**
  - Redis Cache を使用しなくなりました。
  - バックグラウンドジョブの処理を廃止しました。
  
- **管理者ページの更新**
  - 管理者ページでの分析実行機能を削除し、`data` ディレクトリ内の CSV ファイルのダウンロードリンクのみを表示するように変更しました。
  
- **依存関係の変更**
  - `redis` と `rq` パッケージを削除しました。

## セットアップ

### 必要条件

- Python 3.12
- Microsoft Azure アカウント

### インストール

1. **依存関係のインストール**

    ```bash
    pip install -r requirements.txt
    ```

2. **環境変数の設定**

    `.env` ファイルまたは Azure App Service の設定で `SECRET_KEY` を設定してください。

3. **アプリケーションの起動**

    ```bash
    python app.py
    ```

## デプロイメント

このアプリケーションは GitHub Actions を使用して Azure App Service にデプロイされています。変更を GitHub リポジトリにプッシュすると、自動的にデプロイがトリガーされます。

### デプロイ手順

1. **ローカルでの変更をコミット**

    ```bash
    git add .
    git commit -m "Remove Azure Redis Cache and analysis jobs; enable CSV download on admin page"
    git push origin main
    ```

2. **GitHub Actions の確認**

    GitHub リポジトリの「Actions」タブでワークフローのステータスを確認します。

3. **Azure App Service の確認**

    デプロイが成功したら、Azure App Service 上でアプリケーションが正しく動作していることを確認します。

## セキュリティ

- 管理者ページは認証された管理者のみがアクセス可能です。
- ファイルダウンロード時にセキュリティ対策を講じています。

## ライセンス

MIT License