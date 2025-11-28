
from flask import Flask, request, jsonify, send_file
import json, os, datetime

app = Flask(__name__)

# サンプルデータ
DATA_FILE = 'database/inputs.json'
os.makedirs('database', exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE,'w') as f:
        json.dump([],f)

@app.route('/api/items_a', methods=['GET'])
def get_items_a():
    # サンプル小規模項目
    items_a = [{"id":1,"name":"A1"},{"id":2,"name":"A2"},{"id":3,"name":"A3"}]
    return jsonify(items_a)

@app.route('/api/items_d', methods=['GET'])
def get_items_d():
    # サンプル横項目
    items_d = [{"id":1,"label":"作業量","type":"number"},
               {"id":2,"label":"コメント","type":"text"},
               {"id":3,"label":"日付","type":"date"}]
    return jsonify(items_d)

@app.route('/api/input/save', methods=['POST'])
def save_input():
    data = request.json
    with open(DATA_FILE,'r') as f:
        inputs = json.load(f)
    inputs.append(data)
    with open(DATA_FILE,'w') as f:
        json.dump(inputs,f, ensure_ascii=False, indent=2)
    return jsonify({"status":"ok"})

@app.route('/api/pdf/generate/<int:item_a_id>', methods=['GET'])
def generate_pdf(item_a_id):
    # ダミーPDF生成
    pdf_path = f"pdf_templates/output_{item_a_id}.pdf"
    with open(pdf_path,"wb") as f:
        f.write(b"%PDF-1.4 dummy PDF content")
    return send_file(pdf_path, as_attachment=True)

@app.route('/')
def index():
    return "Backend API running"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
