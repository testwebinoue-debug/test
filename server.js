const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// ミドルウェア設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'change-this-secret-key-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // HTTPS環境ではtrueに設定
}));
app.use(express.static('public'));

// データベースファイルパス
const DB_FOLDER = 'database';
const USERS_FILE = path.join(DB_FOLDER, 'users.json');
const INPUTS_FILE = path.join(DB_FOLDER, 'inputs.json');
const STRUCTURE_FILE = path.join(DB_FOLDER, 'structure.json');

// 必要なフォルダの作成
['database', 'uploads', 'pdf_output', 'public'].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// データベース初期化
function initDatabase() {
    if (!fs.existsSync(USERS_FILE)) {
        const users = {
            "main_admin": {
                "password": bcrypt.hashSync("admin123", 10),
                "role": "main_admin",
                "created_at": new Date().toISOString()
            }
        };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    if (!fs.existsSync(INPUTS_FILE)) {
        fs.writeFileSync(INPUTS_FILE, JSON.stringify([], null, 2));
    }
    
    if (!fs.existsSync(STRUCTURE_FILE)) {
        const structure = {
            "sheet_name": "入力シート",
            "items_a": [
                {"id": "A1", "name": "項目A1", "group": "B1"},
                {"id": "A2", "name": "項目A2", "group": "B1"},
                {"id": "A3", "name": "項目A3", "group": "B2"}
            ],
            "items_b": [
                {"id": "B1", "name": "中規模項目B1"},
                {"id": "B2", "name": "中規模項目B2"}
            ],
            "item_c": {"id": "C1", "name": "大規模項目C"},
            "items_d": [
                {"id": "D1", "label": "作業量", "type": "number", "required": true},
                {"id": "D2", "label": "コメント", "type": "text", "required": false},
                {"id": "D3", "label": "日付", "type": "date", "required": true}
            ]
        };
        fs.writeFileSync(STRUCTURE_FILE, JSON.stringify(structure, null, 2));
    }
}

initDatabase();

// ヘルパー関数
function loadJSON(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function saveJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
    if (!req.session.username) {
        return res.status(401).json({ error: "認証が必要です" });
    }
    next();
}

function requireMainAdmin(req, res, next) {
    if (!req.session.username || req.session.role !== 'main_admin') {
        return res.status(403).json({ error: "権限がありません" });
    }
    next();
}

// 認証API
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadJSON(USERS_FILE);
    
    if (users[username] && bcrypt.compareSync(password, users[username].password)) {
        req.session.username = username;
        req.session.role = users[username].role;
        res.json({
            status: "success",
            username: username,
            role: users[username].role
        });
    } else {
        res.status(401).json({ error: "ユーザー名またはパスワードが正しくありません" });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ status: "success" });
});

app.get('/api/auth/check', (req, res) => {
    if (req.session.username) {
        res.json({
            authenticated: true,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ユーザー管理API
app.get('/api/users', requireMainAdmin, (req, res) => {
    const users = loadJSON(USERS_FILE);
    const userList = Object.keys(users).map(username => ({
        username: username,
        role: users[username].role,
        created_at: users[username].created_at
    }));
    res.json(userList);
});

app.post('/api/users/create', requireMainAdmin, (req, res) => {
    const { username, password, role = 'sub_admin' } = req.body;
    const users = loadJSON(USERS_FILE);
    
    if (users[username]) {
        return res.status(400).json({ error: "ユーザー名は既に存在します" });
    }
    
    users[username] = {
        password: bcrypt.hashSync(password, 10),
        role: role,
        created_at: new Date().toISOString()
    };
    
    saveJSON(USERS_FILE, users);
    res.json({ status: "success" });
});

app.delete('/api/users/:username', requireMainAdmin, (req, res) => {
    const { username } = req.params;
    
    if (username === 'main_admin') {
        return res.status(400).json({ error: "メイン管理者は削除できません" });
    }
    
    const users = loadJSON(USERS_FILE);
    if (users[username]) {
        delete users[username];
        saveJSON(USERS_FILE, users);
        res.json({ status: "success" });
    } else {
        res.status(404).json({ error: "ユーザーが見つかりません" });
    }
});

app.put('/api/users/:username/password', requireMainAdmin, (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    const users = loadJSON(USERS_FILE);
    
    if (users[username]) {
        users[username].password = bcrypt.hashSync(password, 10);
        saveJSON(USERS_FILE, users);
        res.json({ status: "success" });
    } else {
        res.status(404).json({ error: "ユーザーが見つかりません" });
    }
});

// 構造管理API
app.get('/api/structure', (req, res) => {
    res.json(loadJSON(STRUCTURE_FILE));
});

app.post('/api/structure/upload', requireMainAdmin, upload.single('file'), (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const structure = {
            sheet_name: sheetName,
            items_a: [],
            items_b: [{"id": "B1", "name": "中規模項目B1"}],
            item_c: {"id": "C1", "name": "大規模項目C"},
            items_d: []
        };
        
        // 横列項目（D項目）を抽出
        if (data[0]) {
            for (let i = 1; i < data[0].length; i++) {
                if (data[0][i]) {
                    structure.items_d.push({
                        id: `D${i}`,
                        label: data[0][i].toString(),
                        type: "text",
                        required: false
                    });
                }
            }
        }
        
        // 縦列項目（A項目）を抽出
        for (let i = 1; i < data.length; i++) {
            if (data[i] && data[i][0]) {
                structure.items_a.push({
                    id: `A${i}`,
                    name: data[i][0].toString(),
                    group: "B1"
                });
            }
        }
        
        saveJSON(STRUCTURE_FILE, structure);
        
        // アップロードファイルを削除
        fs.unlinkSync(req.file.path);
        
        res.json({ status: "success", structure: structure });
    } catch (error) {
        res.status(500).json({ error: `ファイルの処理に失敗しました: ${error.message}` });
    }
});

// 入力API
app.get('/api/items_a', (req, res) => {
    const structure = loadJSON(STRUCTURE_FILE);
    res.json(structure.items_a);
});

app.get('/api/items_d', (req, res) => {
    const structure = loadJSON(STRUCTURE_FILE);
    res.json(structure.items_d);
});

app.post('/api/input/save', (req, res) => {
    const data = req.body;
    
    // バリデーション
    const structure = loadJSON(STRUCTURE_FILE);
    for (const item_d of structure.items_d) {
        if (item_d.required) {
            const inputValue = data.inputs.find(inp => inp.id === `d_${item_d.id}`);
            if (!inputValue || !inputValue.value) {
                return res.status(400).json({ error: `${item_d.label}は必須項目です` });
            }
        }
    }
    
    data.created_at = new Date().toISOString();
    data.id = Date.now().toString();
    
    const inputs = loadJSON(INPUTS_FILE);
    inputs.push(data);
    saveJSON(INPUTS_FILE, inputs);
    
    res.json({ status: "success", input_id: data.id });
});

app.get('/api/inputs', requireAuth, (req, res) => {
    res.json(loadJSON(INPUTS_FILE));
});

app.get('/api/inputs/:item_a_id', (req, res) => {
    const inputs = loadJSON(INPUTS_FILE);
    const filtered = inputs.filter(inp => inp.item_a_id === req.params.item_a_id);
    res.json(filtered);
});

// PDF生成API
app.get('/api/pdf/generate/:item_a_id', (req, res) => {
    try {
        const structure = loadJSON(STRUCTURE_FILE);
        const inputs = loadJSON(INPUTS_FILE);
        const item_a_id = req.params.item_a_id;
        
        const itemInputs = inputs.filter(inp => inp.item_a_id === item_a_id);
        
        if (itemInputs.length === 0) {
            return res.status(404).json({ error: "入力データが見つかりません" });
        }
        
        const latestInput = itemInputs[itemInputs.length - 1];
        
        // PDFの生成
        const doc = new PDFDocument();
        const filename = `input_${item_a_id}.pdf`;
        const filepath = path.join('pdf_output', filename);
        
        doc.pipe(fs.createWriteStream(filepath));
        
        // タイトル
        doc.fontSize(20).text(structure.sheet_name, 50, 50);
        
        // 項目名
        const itemA = structure.items_a.find(item => item.id === item_a_id);
        if (itemA) {
            doc.fontSize(14).text(`Item: ${itemA.name}`, 50, 80);
        }
        
        // 入力内容
        let yPosition = 120;
        doc.fontSize(12);
        
        latestInput.inputs.forEach(inp => {
            const itemD = structure.items_d.find(d => `d_${d.id}` === inp.id);
            if (itemD) {
                doc.text(`${itemD.label}: ${inp.value}`, 50, yPosition);
                yPosition += 25;
            }
        });
        
        // 作成日時
        doc.text(`Created: ${new Date(latestInput.created_at).toLocaleString('ja-JP')}`, 50, yPosition + 20);
        
        doc.end();
        
        // PDFが生成されるまで待機
        doc.on('finish', () => {
            res.download(filepath, filename);
        });
        
    } catch (error) {
        res.status(500).json({ error: `PDF生成に失敗しました: ${error.message}` });
    }
});

app.get('/api/pdf/generate-all', requireAuth, (req, res) => {
    try {
        const structure = loadJSON(STRUCTURE_FILE);
        const inputs = loadJSON(INPUTS_FILE);
        
        const doc = new PDFDocument();
        const filename = 'all_inputs.pdf';
        const filepath = path.join('pdf_output', filename);
        
        doc.pipe(fs.createWriteStream(filepath));
        
        // タイトル
        doc.fontSize(20).text(`${structure.sheet_name} - 統合版`, 50, 50);
        
        let yPosition = 100;
        
        // 各項目Aごとにデータを表示
        structure.items_a.forEach(itemA => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }
            
            doc.fontSize(14).text(`【${itemA.name}】`, 50, yPosition);
            yPosition += 25;
            
            const itemInputs = inputs.filter(inp => inp.item_a_id === itemA.id);
            
            if (itemInputs.length > 0) {
                const latest = itemInputs[itemInputs.length - 1];
                doc.fontSize(11);
                
                latest.inputs.forEach(inp => {
                    const itemD = structure.items_d.find(d => `d_${d.id}` === inp.id);
                    if (itemD) {
                        if (yPosition > 700) {
                            doc.addPage();
                            yPosition = 50;
                        }
                        doc.text(`  ${itemD.label}: ${inp.value}`, 70, yPosition);
                        yPosition += 20;
                    }
                });
            } else {
                doc.fontSize(11).text('  (入力データなし)', 70, yPosition);
                yPosition += 20;
            }
            
            yPosition += 15;
        });
        
        doc.end();
        
        doc.on('finish', () => {
            res.download(filepath, filename);
        });
        
    } catch (error) {
        res.status(500).json({ error: `PDF生成に失敗しました: ${error.message}` });
    }
});

// 静的ページ配信
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/sub-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sub_admin.html'));
});

// サーバー起動
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    console.log(`ユーザー画面: http://localhost:${PORT}/`);
    console.log(`管理者画面: http://localhost:${PORT}/admin`);
    console.log(`サブ管理者画面: http://localhost:${PORT}/sub-admin`);
});
