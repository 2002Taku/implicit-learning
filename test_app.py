# test_app.py

from flask import Flask, request, jsonify
import csv
import os

app = Flask(__name__)

@app.route('/proxy', methods=['POST'])
def proxy():
    print("Proxy endpoint has been called")
    data = request.get_json()
    print(f"Received data: {data}")

    participant = data.get('participant')
    condition = data.get('condition')
    testType = data.get('testType')
    results = data.get('results')

    print(f"Participant: {participant}, Condition: {condition}, TestType: {testType}, Results: {results}")

    os.makedirs('data', exist_ok=True)

    if not participant:
        print("Error: Participant name is missing.")
        return jsonify({'status': 'error', 'message': 'Participant name is missing.'}), 400

    filename = f"{participant}_results.csv"
    filepath = os.path.join('data', filename)
    print(f"Saving results to {filepath}")

    headers = ['participant', 'condition', 'testType', 'trialNumber', 'layoutId', 'layoutType', 'result', 'responseTime']

    write_header = not os.path.exists(filepath)
    print(f"Write header: {write_header}")

    try:
        with open(filepath, 'a', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)

            if write_header:
                writer.writeheader()
                print("Wrote header to CSV.")

            for result in results:
                writer.writerow({
                    'participant': participant,
                    'condition': condition,
                    'testType': testType,
                    'trialNumber': result.get('trialNumber'),
                    'layoutId': result.get('layoutId'),
                    'layoutType': result.get('layoutType'),
                    'result': result.get('result'),
                    'responseTime': result.get('responseTime')
                })
        print("Successfully wrote results to CSV.")
    except Exception as e:
        print(f"Error writing to CSV: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to write data.'}), 500

    return jsonify({'status': 'success'})

@app.route('/')
def index():
    return "Hello, this is the test index page."

if __name__ == '__main__':
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(rule)
    app.run(debug=True, port=5000)
