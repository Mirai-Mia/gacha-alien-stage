let currentUser = null;
let globalData = null;

async function refreshData() {
    try {
        const res = await fetch('/api/data');
        globalData = await res.json();
        const saved = localStorage.getItem('gacha_userId');
        if (saved && !currentUser) {
            const u = globalData.users.find(x => x.id === saved);
            if (u) auth.autoLogin(u);
        } else if (currentUser) {
            currentUser = globalData.users.find(x => x.id === currentUser.id);
        }
    } catch (e) { console.error("Synchro impossible"); }
}

const auth = {
    async login() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        await refreshData();
        const u = globalData.users.find(x => x.id === id && x.pass === pass);
        if (u) { localStorage.setItem('gacha_userId', u.id); this.autoLogin(u); }
        else alert("Identifiants incorrects");
    },
    async register() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pass })
        });
        const data = await res.json();
        if (data.success) alert("Compte créé !"); else alert(data.error);
    },
    autoLogin(u) {
        currentUser = u;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = u.id;
        ui.renderSidebar(u.role);
        ui.loadTab('Bannières');
    }
};

const adminLogic = {
    canvas: null, ctx: null, img: new Image(), imgPos: { x: 0, y: 0, scale: 0.5 },
    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        document.getElementById('image-upload').onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => { this.img.src = ev.target.result; this.img.onload = () => this.draw(); };
            reader.readAsDataURL(e.target.files[0]);
        };
        document.getElementById('zoom-slider').oninput = (e) => { this.imgPos.scale = e.target.value / 100; this.draw(); };
    },
    draw() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, 330, 480);
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, this.img.width * this.imgPos.scale, this.img.height * this.imgPos.scale);
    },
    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        if(!name) return alert("Nom manquant");
        await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Date.now(), name, rarity, img: this.canvas.toDataURL("image/jpeg", 0.7) })
        });
        alert(`Carte ${rarity}★ créée !`);
    },
    async updateBanner(id) {
        const div = document.querySelector(`[data-banner-id="${id}"]`);
        const cardIds = Array.from(div.querySelectorAll('.banner-checkbox:checked')).map(c => parseInt(c.value));
        const image = div.querySelector('.banner-img-input').value;
        await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bannerId: id, cardIds, image })
        });
        alert("Bannière mise à jour !");
    },
    async updateUser(id) {
        const div = document.querySelector(`[data-user-id="${id}"]`);
        const updatedUser = {
            id: id,
            pass: div.querySelector('.edit-pass').value,
            vows: parseInt(div.querySelector('.edit-vows').value),
            role: div.querySelector('.edit-role').value
        };
        await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updatedUser })
        });
        alert("Compte joueur modifié !");
    }
};

const ui = {
    currentBannerIdx: 0,
    async loadTab(tab) {
        await refreshData();
        const area = document.getElementById('content-area');
        area.innerHTML = "";

        if (tab === 'Bannières') {
            const active = globalData.banners.filter(b => b.active);
            if (active.length === 0) { area.innerHTML = "<h2>Aucun flux disponible</h2>"; return; }
            const b = active[this.currentBannerIdx] || active[0];
            area.innerHTML = `
                <div class="banner-view" style="text-align:center;">
                    <p class="pity-info">Pity 5★ : ${currentUser.pity["5"]} / 50</p>
                    <img src="${b.image}" class="banner-main-img">
                    <div style="margin-top:20px;">
                        <button class="btn-roll" onclick="ui.doRoll(1, '${b.id}')">1 Vœu</button>
                        <button class="btn-roll" onclick="ui.doRoll(5, '${b.id}')">5 Vœux</button>
                    </div>
                    <div id="results" class="card-grid" style="margin-top:30px;"></div>
                </div>`;
        }

        if (tab === 'Création de carte') {
            area.innerHTML = `
                <h2>Créer une carte (1★ à 5★)</h2>
                <div class="admin-banner-card">
                    <input type="text" id="new-card-name" placeholder="Nom du perso">
                    <select id="new-card-rarity">
                        <option value="1">1★</option><option value="2">2★</option>
                        <option value="3">3★</option><option value="4">4★</option><option value="5">5★</option>
                    </select>
                    <input type="file" id="image-upload" accept="image/*">
                    <canvas id="crop-canvas" width="330" height="480" style="border:2px solid var(--accent); margin:10px auto; display:block;"></canvas>
                    <input type="range" id="zoom-slider" min="10" max="200" value="50" style="width:100%;">
                    <button class="btn-save" style="width:100%;" onclick="adminLogic.saveCard()">Enregistrer la carte</button>
                </div>`;
            adminLogic.initCanvas();
        }

        if (tab === 'Gestion des comptes') {
            area.innerHTML = `<h2>Gestion des joueurs</h2>` + globalData.users.map(u => `
                <div class="admin-banner-card" data-user-id="${u.id}">
                    <strong>${u.id}</strong> | 
                    MDP: <input class="edit-pass" value="${u.pass}" style="width:80px;"> | 
                    Vœux: <input type="number" class="edit-vows" value="${u.vows}" style="width:50px;"> | 
                    Rôle: <select class="edit-role"><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
                    <button class="btn-save" onclick="adminLogic.updateUser('${u.id}')">💾</button>
                </div>`).join('');
        }

        if (tab === 'Configuration Bannières') {
            area.innerHTML = `<h2>Flux Stellaires</h2>` + globalData.banners.map(b => `
                <div class="admin-banner-card" data-banner-id="${b.id}">
                    <h3>${b.id}</h3>
                    <input class="banner-img-input" value="${b.image}" placeholder="URL Image" style="width:100%;">
                    <details style="margin:10px 0;"><summary>Choisir les cartes</summary>
                        <div class="card-grid">${globalData.cards.map(c => `<label><input type="checkbox" class="banner-checkbox" value="${c.id}" ${b.cards.includes(c.id)?'checked':''}> ${c.name} (${c.rarity}★)</label>`).join('')}</div>
                    </details>
                    <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')">Sauver</button>
                </div>`).join('');
        }

        if (tab === 'Mon compte') {
            const avatar = globalData.cards.find(c => c.id == currentUser.avatarCardId)?.img || "";
            area.innerHTML = `<div class="profile-header">
                <img src="${avatar}" style="width:150px; border-radius:50%; border:2px solid var(--accent);">
                <h2>${currentUser.id} (Nv. ${currentUser.level})</h2>
                <div class="xp-bar-container"><div class="xp-fill" style="width:${currentUser.xp}%"></div></div>
                <p>Vœux disponibles : ${currentUser.vows} ⭐</p>
            </div>`;
        }
    },
    async doRoll(n, bid) {
        const res = await fetch('/api/gacha/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, count: n, bannerId: bid })
        });
        const data = await res.json();
        if(data.error) return alert(data.error);
        const resDiv = document.getElementById('results');
        resDiv.innerHTML = data.obtainedCards.map(c => `<div class="card card-anim rarity-${c.rarity}"><img src="${c.img}"><p>${c.name} (${c.rarity}★)</p></div>`).join('');
        await refreshData();
    },
    renderSidebar(role) {
        const tabs = role === 'admin' ? ['Mon compte', 'Bannières', 'Configuration Bannières', 'Création de carte', 'Gestion des comptes'] : ['Mon compte', 'Bannières'];
        document.getElementById('nav-links').innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};

window.onload = refreshData;
