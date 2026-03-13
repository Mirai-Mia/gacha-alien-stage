/**
 * GACHA ALIEN STAGE - CLIENT SIDE (Version Finale)
 */

let currentUser = null;
let globalData = null;

const rarities = {
    1: { name: "Étoile montante", stars: "★", tradeCost: 2 },
    2: { name: "Célébrité", stars: "★★", tradeCost: 5 },
    3: { name: "Star", stars: "★★★", tradeCost: 15 },
    4: { name: "Idole", stars: "★★★★", tradeCost: 30 },
    5: { name: "Légende", stars: "★★★★★", tradeCost: 50 }
};

// Configuration de la Pity pour l'affichage visuel
const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

// --- SYNCHRONISATION SERVEUR ---
async function refreshData() {
    const response = await fetch('/api/data');
    globalData = await response.json();
    if (currentUser) {
        currentUser = globalData.users.find(u => u.id === currentUser.id);
    }
}

// --- LOGIQUE GACHA ---
const gachaLogic = {
    async roll(num) {
        const response = await fetch('/api/gacha/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, count: num })
        });
        const result = await response.json();

        if (result.error) {
            alert(result.error);
            return null;
        }

        await refreshData();
        return result.obtainedCards;
    }
};

// --- LOGIQUE ADMIN ---
const admin = {
    canvas: null, ctx: null, img: new Image(),
    imgPos: { x: 0, y: 0, scale: 1 },
    isDragging: false, lastMouse: { x: 0, y: 0 },

    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        document.getElementById('next-card-number').innerText = globalData.cards.length + 1;

        document.getElementById('image-upload').onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.img.src = ev.target.result;
                this.img.onload = () => { this.imgPos = {x:0, y:0, scale: 0.5}; this.draw(); };
            };
            reader.readAsDataURL(e.target.files[0]);
        };

        document.getElementById('zoom-slider').oninput = (e) => {
            this.imgPos.scale = e.target.value / 100;
            this.draw();
        };

        this.canvas.onmousedown = (e) => { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; };
        window.onmouseup = () => { this.isDragging = false; };
        this.canvas.onmousemove = (e) => {
            if (!this.isDragging) return;
            this.imgPos.x += (e.clientX - this.lastMouse.x);
            this.imgPos.y += (e.clientY - this.lastMouse.y);
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.draw();
        };
    },

    draw() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const w = this.img.width * this.imgPos.scale;
        const h = this.img.height * this.imgPos.scale;
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, w, h);
    },

    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        if (!name || !this.img.src) return alert("Nom et image requis");

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1100; exportCanvas.height = 1600;
        const exCtx = exportCanvas.getContext('2d');
        const ratio = 1100 / this.canvas.width;
        
        exCtx.drawImage(this.img, 
            this.imgPos.x * ratio, this.imgPos.y * ratio, 
            (this.img.width * this.imgPos.scale) * ratio, 
            (this.img.height * this.imgPos.scale) * ratio
        );

        const newCard = {
            id: globalData.cards.length + 1,
            name: name,
            rarity: rarity,
            img: exportCanvas.toDataURL("image/jpeg", 0.6),
            credits: document.getElementById('new-card-credits').value || "N/A"
        };

        const response = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCard)
        });

        if (response.ok) {
            alert("Carte sauvegardée !");
            await refreshData();
            ui.loadTab('Collection');
        }
    },

    async giftAllVows() {
        const amount = prompt("Combien de vœux pour tout le monde ?");
        if (!amount || isNaN(amount)) return;
        const response = await fetch('/api/admin/gift-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, amount: amount })
        });
        if (response.ok) { alert("Cadeaux envoyés !"); await refreshData(); ui.loadTab('Cadeaux'); }
    },

    async updateBannerContent() {
        const selectedCheckboxes = document.querySelectorAll('.banner-card-selector:checked');
        const cardIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        const response = await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, cardIds: cardIds })
        });
        if (response.ok) { alert("Bannière mise à jour !"); await refreshData(); }
    }
};

// --- INTERFACE UTILISATEUR ---
const ui = {
    async loadTab(tabName) {
        await refreshData();
        const main = document.getElementById('content-area');
        main.innerHTML = '';
        
        if (tabName === 'Mon compte') {
            const avatarCard = globalData.cards.find(c => c.id === currentUser.avatarCardId);
            const avatarImg = avatarCard ? avatarCard.img : "https://via.placeholder.com/150";
            const nextLevelXP = (currentUser.level || 1) * 100;

            main.innerHTML = `
                <div class="profile-container">
                    <div class="profile-header" style="display:flex; align-items:center; gap:20px; background:rgba(255,255,255,0.05); padding:20px; border-radius:15px;">
                        <div style="position:relative;">
                            <img src="${avatarImg}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid var(--accent);">
                            <div style="position:absolute; bottom:0; right:0; background:var(--accent); color:#000; padding:2px 10px; border-radius:10px; font-weight:bold;">Nv. ${currentUser.level || 1}</div>
                        </div>
                        <div>
                            <h2 style="margin:0;">${currentUser.id}</h2>
                            <p style="opacity:0.7;">Statut: ${currentUser.role === 'admin' ? 'Administrateur' : 'Célébrité'}</p>
                            <div style="width:200px; height:8px; background:#222; border-radius:4px; margin-top:10px;">
                                <div style="width:${(currentUser.xp/nextLevelXP)*100}%; height:100%; background:#00d2ff; border-radius:4px;"></div>
                            </div>
                            <small>XP: ${currentUser.xp || 0} / ${nextLevelXP}</small>
                        </div>
                    </div>
                    <h3 style="margin-top:30px;">Changer d'avatar (Vos cartes)</h3>
                    <div class="card-grid">
                        ${Object.keys(currentUser.inventory).map(id => {
                            const card = globalData.cards.find(c => c.id == id);
                            return `<img src="${card.img}" style="width:80px; height:80px; border-radius:50%; cursor:pointer; object-fit:cover;" onclick="ui.setAvatar(${card.id})">`;
                        }).join('')}
                    </div>
                </div>`;

        } else if (tabName === 'Création de carte') {
            main.innerHTML = `<h2>Nouvelle Carte</h2><div id="tab-create-card"><div class="form-group"><input type="text" id="new-card-name" placeholder="Nom"><select id="new-card-rarity"><option value="1">1★</option><option value="2">2★</option><option value="3">3★</option><option value="4">4★</option><option value="5">5★</option></select><input type="file" id="image-upload"><button onclick="admin.saveCard()">Publier</button></div><canvas id="crop-canvas" width="330" height="480"></canvas><input type="range" id="zoom-slider" min="5" max="200" value="50"></div>`;
            admin.initCanvas();
        } else if (tabName === 'Bannières') {
            this.renderBanners();
        } else if (tabName === 'Collection' || tabName === 'Ma collection') {
            this.renderCollection();
        } else if (tabName === 'Cadeaux') {
            main.innerHTML = `<div class="admin-panel"><h2>Cadeaux</h2><button onclick="admin.giftAllVows()" class="btn-gift">🎁 Offrir des vœux à tous</button></div>`;
        } else if (tabName === 'Configuration Bannières' && currentUser.role === 'admin') {
            const standardBanner = globalData.banners.find(b => b.id === 'standard') || { cards: [] };
            let html = `<h2>Rotation de la Bannière</h2><div class="banner-config-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; max-height:400px; overflow-y:auto; background:var(--panel); padding:15px;">`;
            globalData.cards.forEach(card => {
                const isChecked = standardBanner.cards.includes(card.id) ? 'checked' : '';
                html += `<label><input type="checkbox" class="banner-card-selector" value="${card.id}" ${isChecked}> ${card.name}</label>`;
            });
            main.innerHTML = html + `</div><button onclick="admin.updateBannerContent()" class="btn-save">Enregistrer</button>`;
        }
    },

    async setAvatar(cardId) {
        const response = await fetch('/api/user/set-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, cardId: cardId })
        });
        if (response.ok) { await refreshData(); this.loadTab('Mon compte'); }
    },

    renderBanners() {
        const main = document.getElementById('content-area');
        const p5 = raritiesConfig[5].pity - currentUser.pity[5];
        const p4 = raritiesConfig[4].pity - currentUser.pity[4];

        main.innerHTML = `
            <div class="banner-view">
                <div class="vow-display">⭐ ${currentUser.vows} Vœux</div>
                <div class="banner-card">
                    <img src="https://via.placeholder.com/1600x1000" class="banner-img">
                    <div class="pity-container">
                        <div>5★ dans : <strong>${p5}</strong></div>
                        <div>4★ dans : <strong>${p4}</strong></div>
                    </div>
                    <div class="banner-btns">
                        <button onclick="ui.doDraw(1)">1 Vœu</button>
                        <button onclick="ui.doDraw(5)">5 Vœux</button>
                    </div>
                </div>
                <div id="draw-results" class="card-grid"></div>
            </div>`;
    },

    async doDraw(num) {
        const results = await gachaLogic.roll(num);
        if (!results) return;
        const resDiv = document.getElementById('draw-results');
        resDiv.innerHTML = '';
        results.forEach(card => {
            resDiv.innerHTML += `<div class="card rarity-${card.rarity}"><img src="${card.img}"><div class="card-info">${card.name}</div></div>`;
        });
        this.renderBanners();
    },

    renderCollection() {
        const main = document.getElementById('content-area');
        let html = `<h2>Collection</h2><div class="card-grid">`;
        globalData.cards.forEach(card => {
            const count = currentUser.inventory[card.id] || 0;
            const isLocked = count === 0;
            html += `<div class="card ${isLocked ? 'locked' : ''}">${isLocked ? `<div class="card-num">#${card.id}</div>` : `<img src="${card.img}"><div class="card-info">${card.name} (x${count})</div>`}</div>`;
        });
        main.innerHTML = html + `</div>`;
    },

    renderSidebar(role) {
        const links = document.getElementById('nav-links');
        links.innerHTML = '';
        const menu = role === 'admin' ? 
            ['Mon compte', 'Bannières', 'Cadeaux', 'Création de carte', 'Collection', 'Configuration Bannières'] :
            ['Mon compte', 'Bannières', 'Ma collection'];
        menu.forEach(item => {
            let div = document.createElement('div');
            div.className = 'nav-item';
            div.innerText = item;
            div.onclick = () => ui.loadTab(item);
            links.appendChild(div);
        });
    }
};

const auth = {
    async login() {
        const id = document.getElementById('login-id').value;
        const pass = document.getElementById('login-pass').value;
        await refreshData();
        const user = globalData.users.find(u => u.id === id && u.pass === pass);
        if (user) {
            currentUser = user;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('user-display').innerText = user.id;
            ui.renderSidebar(user.role);
            ui.loadTab('Bannières');
        } else { alert("Erreur d'identifiants"); }
    }
};

window.onload = refreshData;
