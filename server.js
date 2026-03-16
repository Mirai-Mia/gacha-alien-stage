const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// --- CONNEXION MONGODB ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://maiaschapire_db_user:0GfNCz5M1m5XIQR6@cluster0.vh8xsee.mongodb.net/gachaDB?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connecté à MongoDB Atlas"))
    .catch(err => console.error("❌ Erreur de connexion:", err));

// --- MODÈLES (SCHEMAS) ---
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    pass: String,
    role: { type: String, default: 'user' },
    vows: { type: Number, default: 10 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    inventory: { type: Map, of: Number, default: {} }, // Utilisation d'une Map pour l'inventaire
    pity: { type: Map, of: Number, default: { "2": 0, "3": 0, "4": 0, "5": 0 } },
    avatarCardId: String,
    achievements: Array
});

const CardSchema = new mongoose.Schema({
    id: Number,
    name: String,
    rarity: Number,
    img: String
});

// Dans vos Schémas (Modèles)
const BannerSchema = new mongoose.Schema({
    id: { type: String, default: 'standard' },
    cards: [Number],
    image: { type: String, default: '' } // <-- Nouveau champ
});

const User = mongoose.model('User', UserSchema);
const Card = mongoose.model('Card', CardSchema);
const Banner = mongoose.model('Banner', BannerSchema);

const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

// --- ROUTES ---

// Récupérer toutes les données pour app.js
app.get('/api/data', async (req, res) => {
    try {
        const users = await User.find() || [];
        const cards = await Card.find() || [];
        const banners = await Banner.find() || [];
        // On renvoie un objet vide au lieu d'une erreur si c'est vide
        res.json({ users, cards, banners });
    } catch (e) { 
        console.error("Erreur data:", e);
        res.status(500).json({ users: [], cards: [], banners: [] }); 
    }
});

// Inscription classique
app.post('/api/auth/register', async (req, res) => {
    try {
        const { id, pass } = req.body;
        // On crée l'utilisateur avec les valeurs de base pour éviter les erreurs de lecture
        const newUser = new User({ 
            id, 
            pass,
            role: "user",
            vows: 10,
            xp: 0,
            level: 1,
            inventory: {}, 
            pity: { "2": 0, "3": 0, "4": 0, "5": 0 }
        });
        await newUser.save();
        res.json({ success: true });
    } catch (e) { 
        console.error(e);
        res.status(400).json({ error: "Identifiant déjà utilisé ou erreur serveur" }); 
    }
});

// Créer un compte par l'admin
app.post('/api/admin/create-user', async (req, res) => {
    try {
        const { newUser } = req.body;
        const userToAdd = new User({
            id: newUser.id,
            pass: newUser.pass,
            role: newUser.role || "user",
            vows: parseInt(newUser.vows) || 10
        });
        await userToAdd.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Erreur création" }); }
});

// Créer une carte (Admin)
app.post('/api/cards', async (req, res) => {
    const newCard = new Card(req.body);
    await newCard.save();
    res.json({ success: true });
});

// Configurer la bannière (Admin)
app.post('/api/admin/update-banner', async (req, res) => {
    const { adminId, cardIds, image } = req.body;
    // ... vérification admin ...
    await Banner.findOneAndUpdate(
        { id: 'standard' }, 
        { cards: cardIds, image: image }, 
        { upsert: true }
    );
    res.json({ success: true });
});

// Tirage Gacha
app.post('/api/gacha/roll', async (req, res) => {
    const { userId, count } = req.body;
    const user = await User.findOne({ id: userId });
    const banner = await Banner.findOne({ id: 'standard' });
    const allCards = await Card.find();

    if (!user || user.vows < count) return res.status(400).json({ error: "Vœux insuffisants" });
    if (!banner || banner.cards.length === 0) return res.status(400).json({ error: "Bannière vide" });

    let obtainedCards = [];
    for (let i = 0; i < count; i++) {
        user.vows--;
        user.xp += 10;
        
        // Logique de rareté
        // --- DANS SERVER.JS (Route /api/gacha/roll) ---
let resultRarity = 1; // Par défaut : 1 étoile
const roll = Math.random();

if (user.pity.get("5") >= raritiesConfig[5].pity || roll <= 0.01) {
    resultRarity = 5;
} else if (user.pity.get("4") >= raritiesConfig[4].pity || roll <= 0.05) {
    resultRarity = 4;
} else if (roll <= 0.15) {
    resultRarity = 3;
} else if (roll <= 0.40) {
    resultRarity = 2;
}
// Si aucun de ces cas n'est vrai, resultRarity reste à 1.

        let possible = allCards.filter(c => c.rarity === resultRarity && banner.cards.includes(c.id));
        if (possible.length === 0) possible = allCards.filter(c => banner.cards.includes(c.id));

        const won = possible[Math.floor(Math.random() * possible.length)];
        
        // Mise à jour inventaire (Mongoose Map)
        const currentQty = user.inventory.get(won.id.toString()) || 0;
        user.inventory.set(won.id.toString(), currentQty + 1);

        // Reset Pity
        user.pity.set(won.rarity.toString(), 0);
        obtainedCards.push(won);
    }

    user.markModified('inventory');
    user.markModified('pity');
    await user.save();
    res.json({ success: true, obtainedCards });
});

// Cadeaux (Admin)
app.post('/api/admin/gift-user', async (req, res) => {
    const { targetUserId, amount } = req.body;
    await User.findOneAndUpdate({ id: targetUserId }, { $inc: { vows: amount } });
    res.json({ success: true });
});

// Supprimer utilisateur
app.post('/api/admin/delete-user', async (req, res) => {
    await User.deleteOne({ id: req.body.targetUserId });
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));
