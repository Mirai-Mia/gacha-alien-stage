const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

// Middleware pour gérer le JSON et les fichiers statiques
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const DATA_FILE = './database.json';

// Configuration des Pity
const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

// --- GESTION BASE DE DONNÉES ---
function readDB() {
    if (!fs.existsSync(DATA_FILE)) {
        return { users: [], cards: [], trades: [], banners: [], achievements: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- ROUTES ---

// Inscription
app.post('/api/auth/register', (req, res) => {
    const { id, pass } = req.body;
    const data = readDB();
    if (data.users.find(u => u.id === id)) {
        return res.status(400).json({ error: "Cet identifiant est déjà utilisé." });
    }
    const newUser = {
        id: id, pass: pass, role: "user", vows: 10, xp: 0, level: 1,
        inventory: {}, pity: { "2": 0, "3": 0, "4": 0, "5": 0 },
        avatarCardId: null, achievements: []
    };
    data.users.push(newUser);
    saveDB(data);
    res.json({ success: true });
});

// Récupérer les données
app.get('/api/data', (req, res) => {
    res.json(readDB());
});

// Tirage Gacha
app.post('/api/gacha/roll', (req, res) => {
    const { userId, count } = req.body;
    const data = readDB();
    const user = data.users.find(u => u.id === userId);
    if (!user || user.vows < count) return res.status(400).json({ error: "Vœux insuffisants" });

    const banner = data.banners.find(b => b.id === 'standard') || { cards: [] };
    let obtainedCards = [];

    for (let i = 0; i < count; i++) {
        user.vows--;
        user.xp = (user.xp || 0) + 10;
        let nextLevelXP = (user.level || 1) * 100;
        if (user.xp >= nextLevelXP) {
            user.xp -= nextLevelXP;
            user.level = (user.level || 1) + 1;
            user.vows += 5;
        }

        Object.keys(user.pity).forEach(r => user.pity[r]++);
        let resultRarity = 1;
        if (user.pity[5] >= raritiesConfig[5].pity) resultRarity = 5;
        else if (user.pity[4] >= raritiesConfig[4].pity) resultRarity = 4;
        else if (user.pity[3] >= raritiesConfig[3].pity) resultRarity = 3;
        else if (user.pity[2] >= raritiesConfig[2].pity) resultRarity = 2;
        else {
            const roll = Math.random();
            if (roll <= 0.005) resultRarity = 5;
            else if (roll <= 0.035) resultRarity = 4;
            else if (roll <= 0.135) resultRarity = 3;
            else if (roll <= 0.535) resultRarity = 2;
        }
        if (resultRarity > 1) user.pity[resultRarity] = 0;

        const possibleCards = data.cards.filter(c => c.rarity === resultRarity && banner.cards.includes(c.id));
        if (possibleCards.length > 0) {
            const wonCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
            user.inventory[wonCard.id] = (user.inventory[wonCard.id] || 0) + 1;
            obtainedCards.push(wonCard);
        }
    }
    saveDB(data);
    res.json({ success: true, obtainedCards });
});

// Créer une carte (Admin)
app.post('/api/cards', (req, res) => {
    const data = readDB();
    data.cards.push(req.body);
    saveDB(data);
    res.json({ success: true });
});

// Changer d'Avatar
app.post('/api/user/set-avatar', (req, res) => {
    const { userId, cardId } = req.body;
    const data = readDB();
    const user = data.users.find(u => u.id === userId);
    if (user && user.inventory[cardId] > 0) {
        user.avatarCardId = cardId;
        saveDB(data);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Action impossible" });
    }
});

// Cadeaux (Admin)
app.post('/api/admin/gift-all', (req, res) => {
    const { adminId, amount } = req.body;
    const data = readDB();
    const admin = data.users.find(u => u.id === adminId);
    if (!admin || admin.role !== 'admin') return res.status(403).json({ error: "Refusé" });
    data.users.forEach(u => u.vows += parseInt(amount));
    saveDB(data);
    res.json({ success: true });
});

// Config Bannière (Admin)
app.post('/api/admin/update-banner', (req, res) => {
    const { adminId, cardIds } = req.body;
    const data = readDB();
    const admin = data.users.find(u => u.id === adminId);
    if (!admin || admin.role !== 'admin') return res.status(403).json({ error: "Refusé" });
    let banner = data.banners.find(b => b.id === 'standard');
    if (!banner) { banner = { id: 'standard', cards: [] }; data.banners.push(banner); }
    banner.cards = cardIds.map(id => parseInt(id));
    saveDB(data);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
