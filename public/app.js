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
    } catch (e) { console.error("Synchro impossible", e); }
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
    
    logout() {
        // 1. Supprimer l'ID de l'utilisateur du stockage local
        localStorage.removeItem('gacha_userId');
        
        // 2. Réinitialiser la variable globale
        currentUser = null;
        
        // 3. Recharger la page pour revenir à l'écran de connexion
        // C'est la méthode la plus propre pour réinitialiser tout l'état de l'app
        window.location.reload();
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

    nextBanner() {
            const active = globalData.banners.filter(b => b.active);
            this.currentBannerIdx = (this.currentBannerIdx + 1) % active.length;
            this.loadTab('Bannières');
    },
    
    prevBanner() {
        const active = globalData.banners.filter(b => b.active);
        this.currentBannerIdx = (this.currentBannerIdx - 1 + active.length) % active.length;
        this.loadTab('Bannières');
    },

    
    async loadTab(tab) {
        await refreshData();
        const area = document.getElementById('content-area');
        area.innerHTML = "";


    
        if (tab === 'Bannières') {
            const active = globalData.banners.filter(b => b.active);
            if (active.length === 0) { area.innerHTML = "<h2>Aucun flux disponible</h2>"; return; }
            
            // On s'assure que l'index ne dépasse pas le nombre de bannières
            if (this.currentBannerIdx >= active.length) this.currentBannerIdx = 0;
            
            const b = active[this.currentBannerIdx];
            
            area.innerHTML = `
                <div class="banner-view" style="text-align:center;">
                    <div class="banner-navigation" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <button class="btn-save" onclick="ui.prevBanner()">◀ Précédente</button>
                        <h3 style="margin:0; color:var(--accent)">Flux ${this.currentBannerIdx + 1} / ${active.length}</h3>
                        <button class="btn-save" onclick="ui.nextBanner()">Suivante ▶</button>
                    </div>

                    <p id="vows-display">Vœux disponibles : ${currentUser.vows} ⭐</p>
                    <p class="pity-info">Pity 5★ : ${currentUser.pity["5"] || 0} / 50</p>
                    <img src="${b.image}" class="banner-main-img" style="max-width:80%; border-radius:15px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                    
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
                    <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')">Enregistrer</button>
                </div>`).join('');
        }

        if (tab === 'Mon compte') {
            const avatar = globalData.cards.find(c => c.id == currentUser.avatarCardId)?.img || "";
            area.innerHTML = `<div class="profile-header" style="text-align:center;">
                <img src="${avatar}" style="width:150px; height:150px; object-fit:cover; border-radius:10%; border:2px solid var(--accent); background:#000;">
                <h2>${currentUser.id} (Nv. ${currentUser.level})</h2>
                <div class="xp-bar-container"><div class="xp-fill" style="width:${currentUser.xp}%"></div></div>
                <p>Vœux disponibles : ${currentUser.vows} ⭐</p>
            </div>`;
        }

        if (tab === 'Collection' || tab === 'Ma collection') {
            const inv = currentUser.inventory || {};
            area.innerHTML = `
                <div class="collection-header">
                    <h2>Ma Collection</h2>
                    <p>Cartes débloquées : ${Object.keys(inv).length} / ${globalData.cards.length}</p>
                </div>
                <div class="card-grid">
                    ${globalData.cards.map(c => {
                        const qty = inv[c.id] || 0;
                        const isLocked = qty === 0;
                        return `
                            <div class="card ${isLocked ? 'locked' : ''} rarity-${c.rarity}">
                                <img src="${c.img}" style="${isLocked ? 'filter: grayscale(1) brightness(0.4);' : ''}">
                                <div class="card-info" style="padding:10px; text-align:center;">
                                    <strong>${c.name}</strong><br>
                                    <span class="rarity-text">${c.rarity}★</span>
                                    ${qty > 1 ? `<div class="qty-badge" style="color:var(--accent)">x${qty}</div>` : ''}
                                    ${!isLocked ? `<button onclick="ui.setAvatar('${c.id}')" style="margin-top:5px; font-size:0.7rem; cursor:pointer;">Avatar</button>` : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>`;
        }
    },


    async setAvatar(cardId) {
        await fetch('/api/user/set-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, cardId })
        });
        alert("Avatar mis à jour !");
        await refreshData();
        ui.loadTab('Mon compte');
    },

    async doRoll(n, bid) {
        const res = await fetch('/api/gacha/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, count: n, bannerId: bid })
        });
        
        const data = await res.json();
        if(data.error) return alert(data.error);

        // 1. Création de l'Overlay
        const overlay = document.createElement('div');
        overlay.id = "gacha-overlay";
        if (data.obtainedCards.some(c => c.rarity === 5)) {
            overlay.classList.add('gacha-ultra-rare');
            ui.createFlashEffect();
        }

        // 2. AJOUT DES ÉTOILES (en premier)
        const starsContainer = document.createElement('div');
        starsContainer.className = 'stars-container';
        overlay.appendChild(starsContainer);
        this.createStars(starsContainer, 120); // Génère 120 étoiles

        // 3. AJOUT DU WRAPPER DE CARTES (en second)
        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = "gacha-cards-wrapper";
        cardsWrapper.innerHTML = data.obtainedCards.map((c, index) => `
            <div class="card card-anim rarity-${c.rarity}" style="animation-delay: ${index * 0.1}s">
                <img src="${c.img}">
                <div style="padding:10px; text-align:center; color:white;">
                    <strong>${c.name}</strong><br>
                    <span style="color:var(--rarity-${c.rarity})">${'★'.repeat(c.rarity)}</span>
                </div>
            </div>
        `).join('');
        overlay.appendChild(cardsWrapper);

        // 4. Texte de fermeture
        const info = document.createElement('p');
        info.innerHTML = "Cliquez pour continuer";
        info.style = "color:rgba(255,255,255,0.5); margin-top:30px; z-index:10; font-style:italic;";
        overlay.appendChild(info);

        overlay.onclick = () => {
            overlay.remove();
            ui.loadTab('Bannières'); // Rafraîchir l'affichage
        };
        document.body.appendChild(overlay);

        await refreshData();
    },

    createFlashEffect() {
        const flash = document.createElement('div');
        // On utilise un dégradé radial bleu clair vers transparent
        flash.style = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(39, 13, 84, 0.8) 0%, rgba(5, 10, 20, 0) 70%);
            backdrop-filter: blur(5px);
            z-index: 9999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        `;
        document.body.appendChild(flash);

        // Apparition douce puis disparition lente
        requestAnimationFrame(() => {
            flash.style.opacity = "1";
            setTimeout(() => {
                flash.style.opacity = "0";
                setTimeout(() => flash.remove(), 800);
            }, 150); // Reste visible un court instant avant de s'effacer
        });
    },

    // --- Dans l'objet ui = { ... ---

    createStars(container, count) {
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';

            // Taille aléatoire (entre 1px et 3px)
            const size = Math.random() * 2 + 1 + 'px';
            star.style.width = size;
            star.style.height = size;

            // Position aléatoire sur l'écran
            star.style.top = Math.random() * 100 + '%';
            star.style.left = Math.random() * 100 + '%';

            // Durée de l'animation aléatoire (entre 1s et 4s) pour un effet naturel
            star.style.animationDuration = Math.random() * 3 + 1 + 's';
            
            // Délai aléatoire pour que toutes ne scintillent pas en même temps
            star.style.animationDelay = Math.random() * 2 + 's';

            container.appendChild(star);
        }
    },

    renderSidebar(role) {
        const tabs = role === 'admin' 
            ? ['Mon compte', 'Bannières', 'Collection', 'Configuration Bannières', 'Création de carte', 'Gestion des comptes'] 
            : ['Mon compte', 'Bannières', 'Collection'];
        // On génère les liens des onglets
        let html = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
        
        // ON AJOUTE LE BOUTON DE DÉCONNEXION ICI
        html += `
            <div class="nav-item" onclick="auth.logout()" style="margin-top: auto; color: var(--danger); border-top: 1px solid var(--border);">
                Déconnexion
            </div>
        `;
        
        document.getElementById('nav-links').innerHTML = html;
    }
};

window.onload = refreshData;
