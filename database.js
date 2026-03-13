const DB = {
    init() {
        if (!localStorage.getItem('gacha_data')) {
            const initialData = {
                users: [
                    { id: "Mirai03", pass: "alnst2026", role: "admin", vows: 100, inventory: {}, pity: {2:0, 3:0, 4:0, 5:0}, achievements: [] }
                ],
                cards: [
                    { id: 1, name: "Alien Alpha", rarity: 1, img: "https://via.placeholder.com/1100x1600" },
                    { id: 2, name: "Star Voyager", rarity: 3, img: "https://via.placeholder.com/1100x1600" }
                ],
                banners: [
                    { id: "standard", name: "Standard", img: "https://via.placeholder.com/1600x1000", cards: [1, 2], active: true }
                ],
                trades: [],
                achievements: []
            };
            localStorage.setItem('gacha_data', JSON.stringify(initialData));
        }
    },
    get() { return JSON.parse(localStorage.getItem('gacha_data')); },
    save(data) { localStorage.setItem('gacha_data', JSON.stringify(data)); }
};
DB.init();