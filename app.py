# app.py

from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from models import User
import os
import csv
from config.config import Config

app = Flask(__name__)
app.config.from_object(Config)

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

# /proxy エンドポイントの修正（ジョブキュー関連のロジックを削除）
@app.route('/proxy', methods=['POST'])
def proxy():
    print("Proxy endpoint has been called")
    data = request.get_json()
    print(f"Received data: {data}")  # 受信データのログ出力

    participant = data.get('participant')
    condition = data.get('condition')
    testType = data.get('testType')
    results = data.get('results')

    # データを保存する処理
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

@app.route('/admin', methods=['GET'])
@login_required
def admin():
    print("Entered admin function")
    # 管理者のみアクセス可能とする条件
    if not getattr(current_user, 'is_admin', False):
        flash('管理者のみアクセスできます。')
        return redirect(url_for('index'))

    # data ディレクトリ内の CSV ファイルをリストアップ
    data_dir = os.path.join(os.getcwd(), 'data')
    try:
        csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
    except Exception as e:
        flash('データディレクトリの読み込みに失敗しました。')
        print(f"Failed to list CSV files: {e}")
        csv_files = []

    return render_template('admin.html', csv_files=csv_files)

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    from werkzeug.utils import secure_filename

    # 管理者のみアクセス可能とする条件
    if not getattr(current_user, 'is_admin', False):
        flash('管理者のみアクセスできます。')
        return redirect(url_for('index'))

    # ファイル名をセキュアにする
    filename = secure_filename(filename)
    # ファイルのパスを安全に確認
    safe_path = os.path.join(os.getcwd(), 'data', filename)
    if os.path.exists(safe_path):
        return send_file(safe_path, as_attachment=True)
    else:
        flash('指定されたファイルが存在しません。')
        return redirect(url_for('admin'))

# ジョブ詳細ページのルートを削除

if __name__ == '__main__':
    # ルート一覧を表示
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(rule)
    app.run(debug=True, port=5000)
