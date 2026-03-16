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
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        await refreshData(); 
        const user = globalData.users.find(u => u.id === id && u.pass === pass);
        if (user) {
            localStorage.setItem('gacha_userId', user.id);
            this.autoLogin(user);
        } else { alert("Identifiants incorrects"); }
    },
    async register() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pass })
        });
        const res = await response.json();
        if (res.success) alert("Compte créé !"); else alert(res.error);
    },
    autoLogin(user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = user.id;
        ui.renderSidebar(user.role);
        ui.loadTab('Bannières');
    }
};

const adminLogic = {
    canvas: null, ctx: null, img: new Image(), imgPos: { x: 0, y: 0, scale: 0.5 },

    // --- CRÉATION DE CARTE ---
    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        document.getElementById('image-upload').onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.img.src = ev.target.result;
                this.img.onload = () => this.draw();
            };
            reader.readAsDataURL(e.target.files[0]);
        };
        document.getElementById('zoom-slider').oninput = (e) => { this.imgPos.scale = e.target.value / 100; this.draw(); };
    },
    draw() {
        if(!this.ctx) return;
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, this.img.width * this.imgPos.scale, this.img.height * this.imgPos.scale);
    },
    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        const imgData = this.canvas.toDataURL("image/jpeg", 0.7);
        await fetch('/api/cards', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ id: Date.now(), name, rarity, img: imgData }) 
        });
        alert("Carte créée !");
        ui.loadTab('Collection');
    },

    // --- GESTION BANNIÈRES ---
    async updateBanner(bannerId) {
        const container = document.querySelector(`[data-banner-id="${bannerId}"]`);
        const selectedIds = Array.from(container.querySelectorAll('.banner-checkbox:checked')).map(cb => parseInt(cb.value));
        const imageUrl = container.querySelector('.banner-img-input').value;
        await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bannerId, cardIds: selectedIds, image: imageUrl })
        });
        alert("Bannière mise à jour !");
    },

    // --- GESTION COMPTES ---
    async updateUser(targetId) {
        const container = document.querySelector(`[data-user-id="${targetId}"]`);
        const updatedUser = {
            id: targetId,
            pass: container.querySelector('.edit-pass').value,
            vows: parseInt(container.querySelector('.edit-vows').value),
            role: container.querySelector('.edit-role').value
        };
        await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, updatedUser })
        });
        alert("Utilisateur mis à jour !");
    }
};

const ui = {
    currentBannerIdx: 0,
    async loadTab(tabName) {
        await refreshData();
        const main = document.getElementById('content-area');
        main.innerHTML = "";

        if (tabName === 'Bannières') {
            const activeBanners = globalData.banners.filter(b => b.active);
            if (activeBanners.length === 0) { main.innerHTML = "<h2>Aucun flux disponible.</h2>"; return; }
            const b = activeBanners[this.currentBannerIdx] || activeBanners[0];
            main.innerHTML = `
                <div class="banner-view">
                    <div style="display:flex; gap:10px; justify-content:center; margin-bottom:20px;">
                        ${activeBanners.map((bn, i) => `<button onclick="ui.currentBannerIdx=${i}; ui.loadTab('Bannières')" class="btn-tab ${i===this.currentBannerIdx?'active':''}">${bn.id}</button>`).join('')}
                    </div>
                    <p class="pity-info">Pity 5★ : ${currentUser.pity["5"]} / 50</p>
                    <img src="${b.image}" class="banner-main-img">
                    <div class="roll-buttons">
                        <button class="btn-roll" onclick="ui.doRoll(1, '${b.id}')">1 Vœu</button>
                        <button class="btn-roll" onclick="ui.doRoll(5, '${b.id}')">5 Vœux</button>
                    </div>
                    <div id="results" class="card-grid"></div>
                </div>`;
        }

        if (tabName === 'Création de carte') {
            main.innerHTML = `
                <h2>Créer une carte</h2>
                <input type="text" id="new-card-name" placeholder="Nom du personnage">
                <select id="new-card-rarity"><option value="2">2★</option><option value="3">3★</option><option value="4">4★</option><option value="5">5★</option></select>
                <input type="file" id="image-upload" accept="image/*">
                <canvas id="crop-canvas" width="330" height="480" style="border:2px solid var(--accent); margin:10px 0;"></canvas>
                <input type="range" id="zoom-slider" min="10" max="200" value="50">
                <button class="btn-roll" onclick="adminLogic.saveCard()">Enregistrer la carte</button>`;
            adminLogic.initCanvas();
        }

        if (tabName === 'Configuration Bannières') {
            main.innerHTML = `<h2>Configuration Bannières</h2>
            ${globalData.banners.map(b => `
                <div class="admin-banner-card" data-banner-id="${b.id}">
                    <h3>${b.id}</h3>
                    <input type="text" class="banner-img-input" value="${b.image}" placeholder="URL de l'image">
                    <details><summary>Sélectionner les cartes</summary>
                        <div class="card-grid">${globalData.cards.map(c => `<label><input type="checkbox" class="banner-checkbox" value="${c.id}" ${b.cards.includes(c.id)?'checked':''}> ${c.name}</label>`).join('')}</div>
                    </details>
                    <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')">Sauvegarder</button>
                </div>`).join('')}`;
        }

        if (tabName === 'Gestion des comptes') {
            main.innerHTML = `<h2>Gestion des comptes</h2>
            ${globalData.users.map(u => `
                <div class="admin-banner-card" data-user-id="${u.id}">
                    <strong>ID: ${u.id}</strong> | Pass: <input type="text" class="edit-pass" value="${u.pass}">
                    Vœux: <input type="number" class="edit-vows" value="${u.vows}">
                    Rôle: <select class="edit-role"><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
                    <button onclick="adminLogic.updateUser('${u.id}')">💾</button>
                </div>`).join('')}`;
        }

        if (tabName === 'Mon compte') {
            const avatar = globalData.cards.find(c => c.id == currentUser.avatarCardId)?.img || "";
            main.innerHTML = `<div class="profile-header"><img src="${avatar}" id="current-avatar"><h2>${currentUser.id} (Nv. ${currentUser.level})</h2><p>Vœux : ${currentUser.vows} ⭐</p></div>`;
        }
    },
    async doRoll(n, bId) {
        const res = await fetch('/api/gacha/roll', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: currentUser.id, count: n, bannerId: bId}) });
        const data = await res.json();
        if (data.error) return alert(data.error);
        const resDiv = document.getElementById('results'); resDiv.innerHTML = "";
        data.obtainedCards.forEach((c, i) => {
            setTimeout(() => { resDiv.insertAdjacentHTML('beforeend', `<div class="card card-anim rarity-${c.rarity}"><img src="${c.img}"><div class="card-info">${c.name}</div></div>`); }, i * 200);
        });
        await refreshData();
    },
    renderSidebar(role) {
        const tabs = role === 'admin' ? ['Mon compte', 'Bannières', 'Configuration Bannières', 'Création de carte', 'Gestion des comptes'] : ['Mon compte', 'Bannières'];
        document.getElementById('nav-links').innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};
window.onload = refreshData;
