let currentUser = null;
let globalData = null;

const raritiesConfig = { 2: { pity: 5 }, 3: { pity: 20 }, 4: { pity: 30 }, 5: { pity: 50 } };

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
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pass })
        });
        const res = await response.json();
        if (res.success) alert("Compte créé !");
        else alert(res.error);
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
    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
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
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, this.img.width * this.imgPos.scale, this.img.height * this.imgPos.scale);
    },
    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        const newCard = { id: Date.now(), name, rarity, img: this.canvas.toDataURL("image/jpeg", 0.7) };
        await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCard) });
        alert("Carte créée !");
        ui.loadTab('Collection');
    },
    async deleteBanner(id) {
        if (confirm("Supprimer ?")) {
            await fetch(`/api/admin/delete-banner/${id}`, { method: 'DELETE' });
            ui.loadTab('Configuration Bannières');
        }
    },
    async toggleBanner(id, currentStatus) {
        await fetch('/api/admin/toggle-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: !currentStatus })
        });
        ui.loadTab('Configuration Bannières');
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
            if (activeBanners.length === 0) {
                main.innerHTML = "<h2>Aucun flux disponible.</h2>";
                return;
            }
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

        if (tabName === 'Configuration Bannières') {
            main.innerHTML = `<h2>Gestion des Bannières</h2>
            ${globalData.banners.map(b => `
                <div class="admin-banner-card" data-banner-id="${b.id}">
                    <div style="display:flex; justify-content:space-between;">
                        <h3>${b.id} <span class="status-badge ${b.active?'status-active':'status-inactive'}">${b.active?'ACTIVE':'OFF'}</span></h3>
                        <div>
                            <button onclick="adminLogic.toggleBanner('${b.id}', ${b.active})">OnOff</button>
                            <button class="btn-delete" onclick="adminLogic.deleteBanner('${b.id}')">Suppr</button>
                        </div>
                    </div>
                    <input type="text" class="banner-img-input" value="${b.image}" style="width:100%; margin:10px 0;">
                    <details><summary>Cartes</summary>
                        <div class="card-grid">${globalData.cards.map(c => `<label><input type="checkbox" class="banner-checkbox" value="${c.id}" ${b.cards.includes(c.id)?'checked':''}> ${c.name}</label>`).join('')}</div>
                    </details>
                    <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')">Sauver</button>
                </div>
            `).join('')}`;
        }

        if (tabName === 'Mon compte') {
            const avatar = globalData.cards.find(c => c.id == currentUser.avatarCardId)?.img || "";
            main.innerHTML = `<div class="profile-header">
                <img src="${avatar}" id="current-avatar">
                <h2>${currentUser.id} (Nv. ${currentUser.level})</h2>
                <div class="xp-bar-container"><div class="xp-fill" style="width:${currentUser.xp}%"></div></div>
                <p>Vœux : ${currentUser.vows} ⭐</p>
            </div>`;
        }
    },
    async doRoll(n, bId) {
        const res = await fetch('/api/gacha/roll', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: currentUser.id, count: n, bannerId: bId}) });
        const data = await res.json();
        if (data.error) return alert(data.error);
        const resDiv = document.getElementById('results');
        resDiv.innerHTML = "";
        data.obtainedCards.forEach((c, i) => {
            setTimeout(() => {
                resDiv.insertAdjacentHTML('beforeend', `<div class="card card-anim rarity-${c.rarity}"><img src="${c.img}"><div class="card-info">${c.name}</div></div>`);
                if(c.rarity === 5) ui.createFlashEffect();
            }, i * 200);
        });
        await refreshData();
    },
    createFlashEffect() {
        const flash = document.createElement('div');
        flash.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 210, 255, 0.5);z-index:999;pointer-events:none;";
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = "0"; setTimeout(() => flash.remove(), 500); }, 50);
    },
    renderSidebar(role) {
        const tabs = role === 'admin' ? ['Mon compte', 'Bannières', 'Configuration Bannières', 'Création de carte'] : ['Mon compte', 'Bannières'];
        document.getElementById('nav-links').innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};
window.onload = refreshData;
