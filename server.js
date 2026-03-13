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

// Créer un compte manuellement (Admin)
app.post('/api/admin/create-user', (req, res) => {
    const { adminId, newUser } = req.body;
    const data = readDB();
    const admin = data.users.find(u => u.id === adminId);

    if (!admin || admin.role !== 'admin') return res.status(403).json({ error: "Refusé" });
    if (data.users.find(u => u.id === newUser.id)) return res.status(400).json({ error: "L'utilisateur existe déjà" });

    const userToAdd = {
        id: newUser.id,
        pass: newUser.pass,
        role: newUser.role || "user",
        vows: parseInt(newUser.vows) || 0,
        xp: 0,
        level: 1,
        inventory: {},
        pity: { "2": 0, "3": 0, "4": 0, "5": 0 },
        avatarCardId: null,
        achievements: []
    };

    data.users.push(userToAdd);
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

    const banner = data.banners.find(b => b.id === 'standard');
    // Vérification : Si la bannière n'existe pas ou est vide, on ne peut pas tirer
    if (!banner || !banner.cards || banner.cards.length === 0) {
        return res.status(400).json({ error: "La bannière est vide. L'admin doit configurer les cartes." });
    }

    let obtainedCards = [];

    for (let i = 0; i < count; i++) {
        user.vows--;
        
        // Gestion de l'XP et du niveau
        user.xp = (user.xp || 0) + 10;
        let nextLevelXP = (user.level || 1) * 100;
        if (user.xp >= nextLevelXP) {
            user.xp -= nextLevelXP;
            user.level = (user.level || 1) + 1;
            user.vows += 5;
        }

        // 1. Déterminer la rareté cible via la Pity ou la chance
        let resultRarity = 2; 
        const roll = Math.random();
        if (user.pity[5] >= raritiesConfig[5].pity || roll <= 0.01) resultRarity = 5;
        else if (user.pity[4] >= raritiesConfig[4].pity || roll <= 0.05) resultRarity = 4;
        else if (user.pity[3] >= raritiesConfig[3].pity || roll <= 0.15) resultRarity = 3;

        // 2. Filtrer les cartes de la bannière qui correspondent à cette rareté
        let possibleCards = data.cards.filter(c => c.rarity === resultRarity && banner.cards.includes(c.id));

        // 3. SECURITÉ : Si aucune carte de cette rareté n'est dans la bannière, 
        // on pioche n'importe quelle carte présente dans la bannière pour garantir un résultat
        if (possibleCards.length === 0) {
            possibleCards = data.cards.filter(c => banner.cards.includes(c.id));
        }

        const wonCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
        
        // 4. SAUVEGARDE PERMANENTE : Mise à jour de l'inventaire de l'utilisateur
        user.inventory[wonCard.id] = (user.inventory[wonCard.id] || 0) + 1;
        
        // Reset de la pity si nécessaire
        if (wonCard.rarity >= 2) {
            Object.keys(user.pity).forEach(r => {
                if (parseInt(r) <= wonCard.rarity) user.pity[r] = 0;
            });
        }
        
        obtainedCards.push(wonCard);
    }

    saveDB(data); // Sauvegarde immédiate dans database.json
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

// Création de compte par l'administrateur
app.post('/api/admin/create-user', (req, res) => {
    const { adminId, newUser } = req.body;
    const data = readDB();
    const admin = data.users.find(u => u.id === adminId);

    if (!admin || admin.role !== 'admin') return res.status(403).json({ error: "Accès refusé" });
    if (data.users.find(u => u.id === newUser.id)) return res.status(400).json({ error: "L'identifiant existe déjà" });

    const userToAdd = {
        id: newUser.id,
        pass: newUser.pass,
        role: newUser.role || "user",
        vows: parseInt(newUser.vows) || 10,
        xp: 0,
        level: 1,
        inventory: {},
        pity: { "2": 0, "3": 0, "4": 0, "5": 0 },
        avatarCardId: null,
        achievements: []
    };

    data.users.push(userToAdd);
    saveDB(data);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
