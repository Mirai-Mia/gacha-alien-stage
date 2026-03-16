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

// --- MODÈLES ---
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    pass: String,
    role: { type: String, default: 'user' },
    vows: { type: Number, default: 10 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    inventory: { type: Map, of: Number, default: {} },
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

const BannerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    cards: [Number],
    image: { type: String, default: '' } 
});

const User = mongoose.model('User', UserSchema);
const Card = mongoose.model('Card', CardSchema);
const Banner = mongoose.model('Banner', BannerSchema);

const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

// --- ROUTES API ---

app.get('/api/data', async (req, res) => {
    try {
        const users = await User.find() || [];
        const cards = await Card.find() || [];
        const banners = await Banner.find() || [];
        res.json({ users, cards, banners });
    } catch (e) { res.status(500).json({ error: "Erreur data" }); }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { id, pass } = req.body;
        const newUser = new User({ id, pass });
        await newUser.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Erreur inscription" }); }
});

app.post('/api/admin/update-banner', async (req, res) => {
    const { bannerId, cardIds, image } = req.body;
    await Banner.findOneAndUpdate({ id: bannerId }, { cards: cardIds, image }, { upsert: true });
    res.json({ success: true });
});

app.post('/api/gacha/roll', async (req, res) => {
    try {
        const { userId, count, bannerId } = req.body;
        const user = await User.findOne({ id: userId });
        const banner = await Banner.findOne({ id: bannerId });
        const allCards = await Card.find();

        if (!user || user.vows < count) return res.status(400).json({ error: "Vœux insuffisants" });
        if (!banner) return res.status(400).json({ error: "Bannière introuvable" });

        let obtainedCards = [];
        for (let i = 0; i < count; i++) {
            user.vows--;
            user.xp += 10;
            let resultRarity = 1;
            const roll = Math.random();

            if (user.pity.get("5") >= 50 || roll <= 0.01) resultRarity = 5;
            else if (user.pity.get("4") >= 10 || roll <= 0.05) resultRarity = 4;
            else if (roll <= 0.15) resultRarity = 3;
            else if (roll <= 0.40) resultRarity = 2;

            let possible = allCards.filter(c => c.rarity === resultRarity && banner.cards.includes(c.id));
            if (possible.length === 0) possible = allCards.filter(c => banner.cards.includes(c.id));
            
            const won = possible[Math.floor(Math.random() * possible.length)];
            const currentQty = user.inventory.get(won.id.toString()) || 0;
            user.inventory.set(won.id.toString(), currentQty + 1);

            [2,3,4,5].forEach(r => {
                if (r === won.rarity) user.pity.set(r.toString(), 0);
                else user.pity.set(r.toString(), (user.pity.get(r.toString()) || 0) + 1);
            });
            obtainedCards.push(won);
        }

        user.markModified('inventory');
        user.markModified('pity');
        await user.save();
        res.json({ success: true, obtainedCards });
    } catch (e) { res.status(500).json({ error: "Erreur roll" }); }
});

app.post('/api/user/set-avatar', async (req, res) => {
    await User.findOneAndUpdate({ id: req.body.userId }, { avatarCardId: req.body.cardId });
    res.json({ success: true });
});

app.post('/api/cards', async (req, res) => {
    const newCard = new Card(req.body);
    await newCard.save();
    res.json({ success: true });
});

app.post('/api/admin/create-user', async (req, res) => {
    const userToAdd = new User(req.body.newUser);
    await userToAdd.save();
    res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
