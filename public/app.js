let currentUser = null;
let globalData = null;

const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

// --- SYNCHRONISATION ---
async function refreshData() {
    try {
        const response = await fetch('/api/data');
        globalData = await response.json();
        
        const savedUserId = localStorage.getItem('gacha_userId');
        if (savedUserId && !currentUser) {
            const user = globalData.users.find(u => u.id === savedUserId);
            if (user) auth.autoLogin(user);
        } else if (currentUser) {
            currentUser = globalData.users.find(u => u.id === currentUser.id);
        }
    } catch (e) { console.error("Erreur synchro:", e); }
}

const auth = {
    async login() {
        const id = document.getElementById('login-id').value;
        const pass = document.getElementById('login-pass').value;
        await refreshData();
        const user = globalData.users.find(u => u.id === id && u.pass === pass);
        if (user) {
            localStorage.setItem('gacha_userId', user.id);
            this.autoLogin(user);
        } else { alert("Identifiants incorrects"); }
    },

    async register() {
        const id = document.getElementById('login-id').value;
        const pass = document.getElementById('login-pass').value;
        if (!id || !pass) return alert("Remplis tous les champs");
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pass })
        });
        const res = await response.json();
        if (res.success) alert("Compte créé ! Connecte-toi.");
        else alert(res.error);
    },

    autoLogin(user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.id;
        ui.renderSidebar(user.role);
        ui.loadTab('Bannières');
    },

    logout() {
        localStorage.removeItem('gacha_userId');
        location.reload();
    }
};

const admin = {
    canvas: null, ctx: null, img: new Image(), imgPos: { x: 0, y: 0, scale: 1 },
    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        document.getElementById('image-upload').onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.img.src = ev.target.result;
                this.img.onload = () => { this.imgPos = {x:0, y:0, scale:0.5}; this.draw(); };
            };
            reader.readAsDataURL(e.target.files[0]);
        };
        document.getElementById('zoom-slider').oninput = (e) => { this.imgPos.scale = e.target.value / 100; this.draw(); };
    },
    draw() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, this.img.width * this.imgPos.scale, this.img.height * this.imgPos.scale);
    },
    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1100; exportCanvas.height = 1600;
        exportCanvas.getContext('2d').drawImage(this.canvas, 0, 0, 1100, 1600);
        const newCard = { id: Date.now(), name, rarity, img: this.canvas.toDataURL("image/jpeg", 0.7) };
        await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCard) });
        alert("Carte créée !"); await refreshData(); ui.loadTab('Collection');
    }
};

const ui = {
    async loadTab(tabName) {
        await refreshData();
        const main = document.getElementById('content-area');
        main.innerHTML = "";

        if (tabName === 'Mon compte') {
            const avatarCard = globalData.cards.find(c => c.id === currentUser.avatarCardId);
            const avatarImg = avatarCard ? avatarCard.img : "https://via.placeholder.com/150";
            const nextLevelXP = currentUser.level * 100;
            main.innerHTML = `
                <div class="profile-header">
                    <img src="${avatarImg}" id="current-avatar">
                    <h2>${currentUser.id} (Nv. ${currentUser.level})</h2>
                    <div class="xp-bar"><div class="fill" style="width:${(currentUser.xp/nextLevelXP)*100}%"></div></div>
                    <p>Vœux : ${currentUser.vows} ⭐</p>
                </div>
                <h3>Changer d'avatar :</h3>
                <div class="card-grid">${Object.keys(currentUser.inventory).map(id => {
                    const c = globalData.cards.find(card => card.id == id);
                    return `<img src="${c.img}" class="mini-avatar" onclick="ui.setAvatar(${c.id})">`;
                }).join('')}</div>`;
        } 
        else if (tabName === 'Bannières') {
            main.innerHTML = `
                <div class="banner-view">
                    <h2>Bannière Standard</h2>
                    <div class="pity-info">Pity 5★ : ${currentUser.pity[5]}/${raritiesConfig[5].pity}</div>
                    <button onclick="ui.doRoll(1)">1 Vœu</button>
                    <button onclick="ui.doRoll(5)">5 Vœux</button>
                    <div id="results" class="card-grid"></div>
                </div>`;
        }
        else if (tabName === 'Collection' || tabName === 'Ma collection') {
            let html = `<div class="card-grid">`;
            globalData.cards.forEach(c => {
                const count = currentUser.inventory[c.id] || 0;
                html += `<div class="card ${count === 0 ? 'locked' : ''}">
                    <img src="${c.img}">
                    <div class="card-info">${c.name} ${count > 0 ? '(x'+count+')' : ''}</div>
                </div>`;
            });
            main.innerHTML = html + `</div>`;
        }
        else if (tabName === 'Création de carte') {
            main.innerHTML = `<h2>Créer une carte</h2>
                <input type="text" id="new-card-name" placeholder="Nom">
                <select id="new-card-rarity"><option value="1">1★</option><option value="5">5★</option></select>
                <input type="file" id="image-upload">
                <canvas id="crop-canvas" width="330" height="480"></canvas>
                <input type="range" id="zoom-slider" min="10" max="200" value="50">
                <button onclick="admin.saveCard()">Sauvegarder</button>`;
            admin.initCanvas();
        }
    },

    async doRoll(n) {
        const res = await fetch('/api/gacha/roll', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: currentUser.id, count: n}) });
        const data = await res.json();
        if (data.error) return alert(data.error);
        const results = document.getElementById('results');
        results.innerHTML = data.obtainedCards.map(c => `<div class="card"><img src="${c.img}"><p>${c.name}</p></div>`).join('');
        await refreshData();
    },

    async setAvatar(cardId) {
        await fetch('/api/user/set-avatar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: currentUser.id, cardId}) });
        ui.loadTab('Mon compte');
    },

    renderSidebar(role) {
        const nav = document.getElementById('nav-links');
        const tabs = role === 'admin' ? ['Mon compte', 'Bannières', 'Collection', 'Création de carte'] : ['Mon compte', 'Bannières', 'Ma collection'];
        nav.innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};

window.onload = refreshData;
