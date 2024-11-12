# myflaskapp

## 概要

Flaskを使用したデータ分析アプリケーション。管理者のみがデータ分析を実行し、結果を閲覧できます。

## セットアップ手順

1. **仮想環境の作成とアクティブ化**

    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

2. **依存関係のインストール**

    ```bash
    pip install -r requirements.txt
    ```

3. **Redisサーバーの起動**

    Redisがインストールされていない場合は、以下のコマンドでインストールします（例: Ubuntuの場合）。

    ```bash
    sudo apt-get install redis-server
    sudo service redis-server start
    ```

4. **RQワーカーの起動**

    別のターミナルで以下を実行します。

    ```bash
    bash workers/rqworker.sh
    ```

5. **Flaskアプリケーションの起動**

    ```bash
    python app.py
    ```

6. **ブラウザでアクセス**

    `http://127.0.0.1:5000` にアクセスし、ログインページから管理者としてログインします。

## 管理者アカウント

- **ユーザー名**: `admin`
- **パスワード**: `adminpass`

（セキュリティ上、実際のプロジェクトではパスワードをハッシュ化し、環境変数で管理してください。）

## ディレクトリ構成
myflaskapp/
├── app.py
├── analysis.py
├── tasks.py
├── config/
│   └── config.py
├── data/
│   ├── Implic_Learning_results.csv
│   ├── mean_response_time_sorted_by_participant.csv
│   ├── experiment_anova_statistics_all_participants.csv
│   ├── experiment_anova_statistics_per_participant.csv
│   └── [その他のデータファイル].csv
├── logs/
│   ├── rqworker.err.log
│   └── rqworker.out.log
├── workers/
│   └── rqworker.sh
├── static/
│   ├── incorrect.mp3
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── script.js
│   └── [その他の静的ファイル]
├── templates/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   └── job_detail.html
├── models.py
├── requirements.txt
├── Procfile
├── README.md
└── .gitignore

## 注意事項

- **セキュリティ**: 本番環境では、パスワードのハッシュ化や環境変数の使用を必ず実施してください。
- **ログの管理**: `logs/` ディレクトリ内のログファイルを定期的に確認し、問題がないかチェックしてください。
- **デプロイメント**: HerokuなどのPaaSにデプロイする場合は、`Procfile` を使用してプロセスを定義してください。