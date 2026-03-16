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
        if (!globalData || !globalData.users) return alert("Erreur serveur.");
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

const adminLogic = {
    canvas: null, ctx: null, img: new Image(), imgPos: { x: 0, y: 0, scale: 0.5 },
    
    initCanvas() {
        this.canvas = document.getElementById('crop-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        document.getElementById('image-upload').onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.img.src = ev.target.result;
                this.img.onload = () => { this.draw(); };
            };
            reader.readAsDataURL(e.target.files[0]);
        };
        document.getElementById('zoom-slider').oninput = (e) => { 
            this.imgPos.scale = e.target.value / 100; 
            this.draw(); 
        };
    },

    draw() {
        if(!this.ctx) return;
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.img, this.imgPos.x, this.imgPos.y, 
            this.img.width * this.imgPos.scale, this.img.height * this.imgPos.scale);
    },

    async saveCard() {
        const name = document.getElementById('new-card-name').value;
        const rarity = parseInt(document.getElementById('new-card-rarity').value);
        if(!name || !this.img.src) return alert("Nom ou image manquante");
        const newCard = { id: Date.now(), name, rarity, img: this.canvas.toDataURL("image/jpeg", 0.7) };
        await fetch('/api/cards', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(newCard) 
        });
        alert("Carte créée !"); 
        ui.loadTab('Collection');
    },

    async createUser() {
        const id = document.getElementById('adm-id').value;
        const pass = document.getElementById('adm-pass').value;
        const vows = document.getElementById('adm-vows').value;
        const role = document.getElementById('adm-role').value;
        if(!id || !pass) return alert("Identifiant et mot de passe requis !");
        const response = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, newUser: { id, pass, vows, role } })
        });
        const res = await response.json();
        if (res.success) { alert("Compte créé !"); ui.loadTab('Gestion des comptes'); }
        else { alert(res.error); }
    },

    // --- LOGIQUE MULTI-BANNIÈRES ---
    async createNewBanner() {
        const name = prompt("Nom de la nouvelle bannière (ex: Hiver 2024) :");
        if (!name) return;
        const bannerId = name.toLowerCase().replace(/\s/g, '-');
        
        await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                adminId: currentUser.id, 
                bannerId: bannerId, // On envoie l'ID pour la création
                cardIds: [],
                image: "" 
            })
        });
        ui.loadTab('Configuration Bannières');
    },

    async updateBanner(bannerId) {
        const container = document.querySelector(`[data-banner-id="${bannerId}"]`);
        const selectedIds = Array.from(container.querySelectorAll('.banner-checkbox:checked'))
                                 .map(cb => parseInt(cb.value));
        const imageUrl = container.querySelector('.banner-img-input').value;
        
        await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                adminId: currentUser.id, 
                bannerId: bannerId,
                cardIds: selectedIds,
                image: imageUrl 
            })
        });
        alert(`Bannière "${bannerId}" mise à jour !`);
        ui.loadTab('Bannières');
    }
};

const ui = {
    currentBannerIdx: 0, // Pour suivre quelle bannière le joueur regarde

    async loadTab(tabName) {
        await refreshData();
        const main = document.getElementById('content-area');
        main.innerHTML = "";

        if (tabName === 'Bannières') {
            const banners = globalData.banners;
            if (banners.length === 0) {
                main.innerHTML = "<h2>Aucune bannière disponible.</h2>";
                return;
            }
            const b = banners[this.currentBannerIdx] || banners[0];
            main.innerHTML = `
                <div class="banner-view">
                    <div class="banner-nav" style="margin-bottom:20px; display:flex; gap:10px; justify-content:center;">
                        ${banners.map((bn, idx) => `
                            <button onclick="ui.currentBannerIdx=${idx}; ui.loadTab('Bannières')" 
                                    class="btn-tab ${idx === this.currentBannerIdx ? 'active' : ''}">
                                ${bn.id.toUpperCase()}
                            </button>
                        `).join('')}
                    </div>
                    <div class="pity-info">Pity 5★ : ${currentUser.pity["5"] || 0} / ${raritiesConfig[5].pity}</div>
                    ${b.image ? `<img src="${b.image}" class="banner-main-img" style="width:90%; border-radius:15px; margin-bottom:20px;">` : `<h2>Bannière : ${b.id}</h2>`}
                    <div style="margin-top:20px;">
                        <button class="btn-roll" onclick="ui.doRoll(1, '${b.id}')">1 Vœu</button>
                        <button class="btn-roll" onclick="ui.doRoll(5, '${b.id}')">5 Vœux</button>
                    </div>
                    <div id="results" class="card-grid"></div>
                </div>`;
        }

        else if (tabName === 'Configuration Bannières') {
            main.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>Configuration des Bannières</h2>
                    <button class="btn-save" onclick="adminLogic.createNewBanner()">+ Créer une nouvelle bannière</button>
                </div>
                ${globalData.banners.map(b => `
                    <div class="admin-panel" data-banner-id="${b.id}" style="margin-bottom:30px; border: 1px solid var(--accent); padding: 15px;">
                        <h3>Bannière : ${b.id}</h3>
                        <label>URL Image :</label>
                        <input type="text" class="banner-img-input" value="${b.image || ''}" style="width:100%; margin-bottom:15px;">
                        <h4>Cartes dans cette bannière :</h4>
                        <div class="card-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));">
                            ${globalData.cards.map(c => `
                                <div class="card mini">
                                    <img src="${c.img}" style="height:100px;">
                                    <label><input type="checkbox" class="banner-checkbox" value="${c.id}" ${b.cards.includes(c.id) ? 'checked' : ''}> Inclure</label>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')" style="margin-top:15px;">Sauvegarder ${b.id}</button>
                    </div>
                `).join('')}`;
        }

        // --- Les autres onglets restent identiques à ta version ---
        else if (tabName === 'Mon compte') {
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
                    return c ? `<img src="${c.img}" class="mini-avatar" onclick="ui.setAvatar(${c.id})">` : '';
                }).join('')}</div>`;
        } 

        else if (tabName === 'Collection' || tabName === 'Ma collection') {
            let html = `<div class="card-grid">`;
            globalData.cards.forEach(c => {
                const count = currentUser.inventory[c.id] || 0;
                html += `<div class="card ${count === 0 ? 'locked' : ''}">
                    <img src="${c.img}"><div class="card-info">${c.name} ${count > 0 ? '(x'+count+')' : ''}</div>
                </div>`;
            });
            main.innerHTML = html + `</div>`;
        }

        else if (tabName === 'Création de carte') {
            main.innerHTML = `
                <h2>Créer une nouvelle carte</h2>
                <div class="creator-container">
                    <input type="text" id="new-card-name" placeholder="Nom du personnage">
                    <select id="new-card-rarity">
                        <option value="1">1★</option><option value="2">2★</option>
                        <option value="3">3★</option><option value="4">4★</option>
                        <option value="5">5★</option>
                    </select>
                    <input type="file" id="image-upload" accept="image/*">
                    <canvas id="crop-canvas" width="330" height="480"></canvas>
                    <input type="range" id="zoom-slider" min="10" max="200" value="50">
                    <button class="btn-save" onclick="adminLogic.saveCard()">Enregistrer la carte</button>
                </div>`;
            adminLogic.initCanvas();
        }

        else if (tabName === 'Gestion des comptes') {
            main.innerHTML = `<h2>Gestion des Utilisateurs</h2>... (table des comptes ici)`;
        }
    },

    async doRoll(n, bannerId) {
        const res = await fetch('/api/gacha/roll', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({userId: currentUser.id, count: n, bannerId: bannerId}) 
        });
        const data = await res.json();
        if (data.error) return alert(data.error);

        const results = document.getElementById('results');
        results.innerHTML = ""; 

        data.obtainedCards.forEach((c, index) => {
            setTimeout(() => {
                const isHighRarity = c.rarity >= 4 ? 'special-glow' : '';
                const cardHtml = `
                    <div class="card card-anim rarity-${c.rarity} ${isHighRarity}">
                        <img src="${c.img}">
                        <div class="card-info">
                            <p><strong>${c.name}</strong></p>
                            <span class="rarity-badge">${c.rarity} ★</span>
                        </div>
                    </div>`;
                results.insertAdjacentHTML('beforeend', cardHtml);
                if(c.rarity === 5) ui.createFlashEffect();
            }, index * 250);
        });

        await refreshData();
        const pityDisplay = document.querySelector('.pity-info');
        if(pityDisplay) pityDisplay.innerText = `Pity 5★ : ${currentUser.pity["5"] || 0} / ${raritiesConfig[5].pity}`;
    },

    createFlashEffect() {
        const flash = document.createElement('div');
        flash.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999;opacity:0.8;pointer-events:none;";
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.transition = "opacity 0.5s";
            flash.style.opacity = "0";
            setTimeout(() => flash.remove(), 500);
        }, 50);
    },

    async setAvatar(cardId) {
        await fetch('/api/user/set-avatar', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({userId: currentUser.id, cardId}) 
        });
        ui.loadTab('Mon compte');
    },

    toggleTheme() { document.body.classList.toggle('light-mode'); },

    renderSidebar(role) {
        const nav = document.getElementById('nav-links');
        const tabs = role === 'admin' 
            ? ['Mon compte', 'Bannières', 'Collection', 'Création de carte', 'Configuration Bannières', 'Gestion des comptes'] 
            : ['Mon compte', 'Bannières', 'Ma collection'];
        nav.innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};

window.onload = refreshData;
