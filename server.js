const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://maiaschapire_db_user:0GfNCz5M1m5XIQR6@cluster0.vh8xsee.mongodb.net/gachaDB?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connecté à MongoDB Atlas"))
    .catch(err => console.error("❌ Erreur:", err));

// --- MODÈLES ---
const User = mongoose.model('User', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    pass: String,
    role: { type: String, default: 'user' },
    vows: { type: Number, default: 10 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    inventory: { type: Map, of: Number, default: {} },
    pity: { type: Map, of: Number, default: { "1":0, "2": 0, "3": 0, "4": 0, "5": 0 } },
    avatarCardId: String
}));

const Card = mongoose.model('Card', new mongoose.Schema({
    id: Number, name: String, rarity: Number, img: String
}));

const Banner = mongoose.model('Banner', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    cards: [Number], image: String, active: { type: Boolean, default: true }
}));

app.post('/api/user/set-avatar', async (req, res) => {
    const { userId, cardId } = req.body;
    await User.findOneAndUpdate({ id: userId }, { avatarCardId: cardId });
    res.json({ success: true });
});

// --- ROUTES ---
app.get('/api/data', async (req, res) => {
    const users = await User.find();
    const cards = await Card.find();
    const banners = await Banner.find();
    res.json({ users, cards, banners });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "ID déjà pris" }); }
});

app.post('/api/admin/update-user', async (req, res) => {
    const { updatedUser } = req.body;
    await User.findOneAndUpdate({ id: updatedUser.id }, updatedUser);
    res.json({ success: true });
});

app.post('/api/admin/update-banner', async (req, res) => {
    const { bannerId, cardIds, image } = req.body;
    await Banner.findOneAndUpdate({ id: bannerId }, { cards: cardIds, image }, { upsert: true });
    res.json({ success: true });
});

app.post('/api/cards', async (req, res) => {
    await new Card(req.body).save();
    res.json({ success: true });
});

app.post('/api/gacha/roll', async (req, res) => {
    const { userId, count, bannerId } = req.body;
    const user = await User.findOne({ id: userId });
    const banner = await Banner.findOne({ id: bannerId });
    const allCards = await Card.find();
    let obtainedCards = [];

    for (let i = 0; i < count; i++) {
        user.vows--;
        user.xp += 10;
        let rarity = 1;
        const roll = Math.random();
        
        // Probabilités : 5★ (2%), 4★ (10%), 3★ (20%), 2★ (30%), le reste 1★
        if (user.pity.get("5") >= 50 || roll <= 0.02) rarity = 5;
        else if (user.pity.get("4") >= 10 || roll <= 0.10) rarity = 4;
        else if (roll <= 0.30) rarity = 3;
        else if (roll <= 0.60) rarity = 2;
        else rarity = 1;

        let possible = allCards.filter(c => c.rarity === rarity && banner.cards.includes(c.id));
        if (possible.length === 0) possible = allCards.filter(c => c.rarity === rarity);
        if (possible.length === 0) possible = allCards;

        const won = possible[Math.floor(Math.random() * possible.length)];
        user.inventory.set(won.id.toString(), (user.inventory.get(won.id.toString()) || 0) + 1);

        [1,2,3,4,5].forEach(r => {
            if (r === won.rarity) user.pity.set(r.toString(), 0);
            else user.pity.set(r.toString(), (user.pity.get(r.toString()) || 0) + 1);
        });
        obtainedCards.push(won);
    }
    if (user.xp >= user.level * 100) { user.xp = 0; user.level++; }
    user.markModified('inventory'); user.markModified('pity');
    await user.save();
    res.json({ success: true, obtainedCards });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
