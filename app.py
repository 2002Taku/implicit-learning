# app.py

from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from models import User
import os
import redis
from rq import Queue
from tasks import analyze_data
from config.config import Config
import csv

print("app.py is being executed")

app = Flask(__name__)
app.config.from_object(Config)

# Redis接続とキューの初期化
try:
    print(f"REDIS_URL: {app.config['REDIS_URL']}")
    redis_conn = redis.from_url(app.config['REDIS_URL'])
    q = Queue(connection=redis_conn)
    print("Redis connection and queue initialized successfully.")
except Exception as e:
    print(f"Failed to initialize Redis connection or queue: {e}")
    # エラー内容を詳細に表示
    import traceback
    traceback.print_exc()
    q = None  # Queueの初期化に失敗した場合はNoneを設定

# Flask-Loginの設定
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ユーザーデータの仮定（実際にはデータベースを使用）
users = {
    'admin': User(id=1, username='admin', password='adminpass', is_admin=True),
    'user1': User(id=2, username='user1', password='user1pass', is_admin=False),
    # 他のユーザーを追加可能
}

@login_manager.user_loader
def load_user(user_id):
    for user in users.values():
        if user.id == int(user_id):
            return user
    return None

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/index')
def index():
    return render_template('index.html')

# /proxy エンドポイントの追加
@app.route('/proxy', methods=['POST'])
def proxy():
    print("Proxy endpoint has been called")
    data = request.get_json()
    print(f"Received data: {data}")  # 受信データのログ出力

    participant = data.get('participant')
    condition = data.get('condition')
    testType = data.get('testType')
    results = data.get('results')

    # データを保存する処理を実装します
    # 全体の結果ファイル
    overall_filename = "Implic_Learning_results.csv"
    overall_filepath = os.path.join('data', overall_filename)

    # 個別の結果ファイル
    individual_filename = f"{participant}_results.csv"
    individual_filepath = os.path.join('data', individual_filename)

    # ヘッダー（'responseTime(ms)' から 'responseTime' に変更）
    headers = ['participant', 'condition', 'testType', 'trialNumber', 'layoutId', 'layoutType', 'result', 'responseTime']

    try:
        # 全体ファイルへの書き込み
        write_header_overall = not os.path.exists(overall_filepath)
        with open(overall_filepath, 'a', newline='', encoding='utf-8') as overall_csvfile:
            overall_writer = csv.DictWriter(overall_csvfile, fieldnames=headers)
            if write_header_overall:
                overall_writer.writeheader()
                print(f"Wrote header to {overall_filename}.")
            for result in results:
                overall_writer.writerow({
                    'participant': participant,
                    'condition': condition,
                    'testType': testType,
                    'trialNumber': result.get('trialNumber'),
                    'layoutId': result.get('layoutId'),
                    'layoutType': result.get('layoutType'),
                    'result': result.get('result'),
                    'responseTime': result.get('responseTime(ms)')
                })
        print(f"Successfully wrote results to {overall_filename}.")

        # 個別ファイルへの書き込み
        write_header_individual = not os.path.exists(individual_filepath)
        with open(individual_filepath, 'a', newline='', encoding='utf-8') as individual_csvfile:
            individual_writer = csv.DictWriter(individual_csvfile, fieldnames=headers)
            if write_header_individual:
                individual_writer.writeheader()
                print(f"Wrote header to {individual_filename}.")
            for result in results:
                individual_writer.writerow({
                    'participant': participant,
                    'condition': condition,
                    'testType': testType,
                    'trialNumber': result.get('trialNumber'),
                    'layoutId': result.get('layoutId'),
                    'layoutType': result.get('layoutType'),
                    'result': result.get('result'),
                    'responseTime': result.get('responseTime(ms)')
                })
        print(f"Successfully wrote results to {individual_filename}.")

    except Exception as e:
        print(f"Error writing to CSV files: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': 'Failed to write data.'}), 500

    return jsonify({'status': 'success'})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = users.get(username)
        if user and user.check_password(password):
            login_user(user)
            flash('ログインに成功しました。')
            return redirect(url_for('admin'))
        else:
            flash('ユーザー名またはパスワードが正しくありません。')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('ログアウトしました。')
    return redirect(url_for('index'))

@app.route('/admin', methods=['GET', 'POST'])
@login_required
def admin():
    print("Entered admin function")
    # 管理者のみアクセス可能とする条件
    if not getattr(current_user, 'is_admin', False):
        flash('管理者のみアクセスできます。')
        return redirect(url_for('index'))

    if request.method == 'POST':
        participant = request.form.get('participant')
        analysis_type = request.form.get('analysis_type')  # 新たに追加するフォーム項目
        if participant and analysis_type == 'individual':
            # 特定の回答者の分析を実行
            if q is not None:
                individual_filename = f"{participant}_results.csv"
                job = q.enqueue(analyze_data, filename=individual_filename)
                flash(f'{participant} のデータ分析をバックグラウンドで実行中です。ジョブID: {job.id}')
                # デバッグ用のprint文を追加
                print(f"Enqueued job ID: {job.id} for file: {individual_filename}")
                print(f"Job Status: {job.get_status()}")
            else:
                flash('ジョブキューが初期化されていません。')
                print("Queue is not initialized.")
        elif not participant and analysis_type == 'overall':
            # 全体の分析を実行
            if q is not None:
                overall_filename = "Implic_Learning_results.csv"
                job = q.enqueue(analyze_data, filename=overall_filename)
                flash(f'全体のデータ分析をバックグラウンドで実行中です。ジョブID: {job.id}')
                # デバッグ用のprint文を追加
                print(f"Enqueued job ID: {job.id} for file: {overall_filename}")
                print(f"Job Status: {job.get_status()}")
            else:
                flash('ジョブキューが初期化されていません。')
                print("Queue is not initialized.")
        else:
            flash('分析タイプと参加者の選択が正しくありません。')
            print("Invalid analysis request.")

        return redirect(url_for('admin'))

    # 現在キューに入っているジョブを取得
    if q is not None:
        jobs = q.jobs
        job_status = []
        for j in jobs:
            status = j.get_status()
            job_status.append({'id': j.id, 'status': status, 'description': j.func_name})
    else:
        jobs = []
        job_status = []
        flash('ジョブキューが初期化されていません。')
        print("Queue is not initialized.")

    return render_template('admin.html', jobs=job_status)

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    # 管理者のみアクセス可能とする条件
    if not getattr(current_user, 'is_admin', False):
        flash('管理者のみアクセスできます。')
        return redirect(url_for('index'))

    # ファイルのパスを安全に確認
    safe_path = os.path.join(os.getcwd(), 'data', filename)
    if os.path.exists(safe_path):
        return send_file(safe_path, as_attachment=True)
    else:
        flash('指定されたファイルが存在しません。')
        return redirect(url_for('admin'))

# ジョブ詳細ページのルートを追加（admin.htmlにリンクがありますが、ルートが未定義）
@app.route('/job/<job_id>')
@login_required
def job_detail(job_id):
    if not getattr(current_user, 'is_admin', False):
        flash('管理者のみアクセスできます。')
        return redirect(url_for('index'))
    if q is not None:
        job = q.fetch_job(job_id)
        if job:
            return render_template('job_detail.html', job=job)
    flash('ジョブが見つかりません。')
    return redirect(url_for('admin'))

if __name__ == '__main__':
    # ルート一覧を表示
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(rule)
    app.run(debug=True, port=5000)
