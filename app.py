from flask import Flask, request, jsonify, render_template
import csv
import os
import datetime
from whitenoise import WhiteNoise

app = Flask(__name__, static_url_path='/static', static_folder='static')

# WhiteNoiseを使用して静的ファイルを提供
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')

# 保存先のファイル名を設定
CSV_FILENAME = "Implic_Learning_results.csv"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/proxy', methods=['POST'])
def proxy():
    data = request.json
    
    if not data.get('results'):
        return jsonify({'error': 'No results provided'}), 400

    # CSVファイルにデータを追記
    csv_filename = append_to_csv(data['results'], data['participant'], data['condition'], data['testType'])

    return jsonify({'message': 'Data appended to CSV file'}), 200

def append_to_csv(results, participant, condition, test_type):
    file_exists = os.path.isfile(CSV_FILENAME)

    with open(CSV_FILENAME, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        
        # ヘッダーを最初の書き込み時のみ追加
        if not file_exists:
            writer.writerow(['Participant', 'Condition', 'TestType', 'TrialNumber', 'LayoutType', 'Result', 'ResponseTime(ms)'])

        # データ行を追加
        for result in results:
            writer.writerow([
                participant,           # 参加者の名前
                condition,             # Condition: 'Just Woke Up' or 'After Several Hours'
                test_type,             # Test Type: 'Implicit Learning' or 'Explicit Learning'
                result['trialNumber'], # Trial Number: 'Trial 1', 'Trial 2', ...
                result['layoutType'],  # Layout Type: 'repeated' or 'random'
                result['result'],      # Result: 'Correct' or 'Incorrect'
                result['responseTime'] # Response Time in milliseconds
            ])

    return CSV_FILENAME

# プロダクション環境ではGunicornがサーバーを管理するため、app.run()は不要です
# もしローカルでのテストが必要な場合は、以下のコードを使用してください

 # if __name__ == '__main__':
 #     port = int(os.environ.get("PORT", 5000))
 #     app.run(host='0.0.0.0', port=port, debug=True)
