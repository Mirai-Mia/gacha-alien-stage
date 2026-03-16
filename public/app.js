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
    } catch (e) { 
        console.error("Erreur synchro:", e); 
    }
}

const auth = {
    async login() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        
        await refreshData(); 
        
        if (!globalData || !globalData.users) return alert("Erreur serveur.");
        
        const user = globalData.users.find(u => u.id === id && u.pass === pass);
        
        if (user) {
            localStorage.setItem('gacha_userId', user.id);
            this.autoLogin(user);
        } else { 
            alert("Identifiants incorrects"); 
        }
    },

    async register() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        
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
    },

    async deleteBanner(id) {
        if (!confirm(`Supprimer définitivement la bannière ${id} ?`)) return;
        await fetch(`/api/admin/delete-banner/${id}`, { method: 'DELETE' });
        ui.loadTab('Configuration Bannières');
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
                main.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>Aucun flux stellaire disponible.</h2>";
                return;
            }

            const b = activeBanners[this.currentBannerIdx] || activeBanners[0];

            main.innerHTML = `
                <div class="banner-view">
                    <div class="banner-nav" style="margin-bottom:20px; display:flex; gap:10px; justify-content:center;">
                        ${activeBanners.map((bn, idx) => `
                            <button onclick="ui.currentBannerIdx=${idx}; ui.loadTab('Bannières')" 
                                    class="btn-tab ${idx === this.currentBannerIdx ? 'active' : ''}">
                                ${bn.id.toUpperCase()}
                            </button>
                        `).join('')}
                    </div>
                    <div class="pity-info">Pity 5★ : ${currentUser.pity["5"] || 0} / 50</div>
                    ${b.image ? `<img src="${b.image}" class="banner-main-img">` : `<h2>Bannière : ${b.id}</h2>`}
                    <div style="margin-top:20px;">
                        <button class="btn-roll" onclick="ui.doRoll(1, '${b.id}')">1 Vœu</button>
                        <button class="btn-roll" onclick="ui.doRoll(5, '${b.id}')">5 Vœux</button>
                    </div>
                    <div id="results" class="card-grid"></div>
                </div>`;
        }

        else if (tabName === 'Configuration Bannières') {
            main.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <h2 style="color:var(--accent);">⚡ Gestion des Flux</h2>
            </div>
            ${globalData.banners.map(b => `
                <div class="admin-banner-card" data-banner-id="${b.id}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <div>
                            <span class="status-badge ${b.active ? 'status-active' : 'status-inactive'}">
                                ${b.active ? '● ACTIVE' : '○ INACTIVE'}
                            </span>
                            <h3>${b.id.toUpperCase()}</h3>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-tab" onclick="adminLogic.toggleBanner('${b.id}', ${b.active})">
                                ${b.active ? 'Désactiver' : 'Activer'}
                            </button>
                            <button class="btn-delete" onclick="adminLogic.deleteBanner('${b.id}')">Supprimer</button>
                        </div>
                    </div>
                    <input type="text" class="banner-img-input" value="${b.image || ''}" placeholder="URL Image" style="width:100%; margin-bottom:15px;">
                    <details>
                        <summary style="cursor:pointer; color:var(--accent);">Cartes (${b.cards.length})</summary>
                        <div class="card-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));">
                            ${globalData.cards.map(c => `
                                <div class="card mini">
                                    <label><input type="checkbox" class="banner-checkbox" value="${c.id}" ${b.cards.includes(c.id) ? 'checked' : ''}> ${c.name}</label>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                    <button class="btn-roll" style="width:100%; margin-top:20px;" onclick="adminLogic.updateBanner('${b.id}')">Sauvegarder</button>
                </div>
            `).join('')}`;
        }

        else if (tabName === 'Mon compte') {
            const avatarCard = globalData.cards.find(c => c.id == currentUser.avatarCardId);
            const avatarImg = avatarCard ? avatarCard.img : "https://via.placeholder.com/150";
            main.innerHTML = `
                <div class="profile-header">
                    <img src="${avatarImg}" id="current-avatar">
                    <h2>${currentUser.id} (Nv. ${currentUser.level})</h2>
                    <div class="xp-bar-container"><div class="xp-fill" style="width:${currentUser.xp}%"></div></div>
                    <p>Vœux : ${currentUser.vows} ⭐</p>
                </div>`;
        }

        else if (tabName === 'Collection' || tabName === 'Ma collection') {
            let html = `<div class="card-grid">`;
            globalData.cards.forEach(c => {
                const count = currentUser.inventory[c.id] || 0;
                html += `<div class="card ${count === 0 ? 'locked' : ''}">
                    <img src="${c.img}"><div class="card-info">${c.name} (x${count})</div>
                </div>`;
            });
            main.innerHTML = html + `</div>`;
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
                const cardHtml = `
                    <div class="card card-anim rarity-${c.rarity}">
                        <img src="${c.img}">
                        <div class="card-info"><p><strong>${c.name}</strong></p><span>${c.rarity} ★</span></div>
                    </div>`;
                results.insertAdjacentHTML('beforeend', cardHtml);
                if(c.rarity === 5) ui.createFlashEffect();
            }, index * 250);
        });

        await refreshData();
    },

    createFlashEffect() {
        const flash = document.createElement('div');
        flash.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 210, 255, 0.5);z-index:9999;pointer-events:none;";
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.transition = "opacity 0.5s";
            flash.style.opacity = "0";
            setTimeout(() => flash.remove(), 500);
        }, 50);
    },

    renderSidebar(role) {
        const nav = document.getElementById('nav-links');
        const tabs = role === 'admin' 
            ? ['Mon compte', 'Bannières', 'Collection', 'Configuration Bannières'] 
            : ['Mon compte', 'Bannières', 'Ma collection'];
        nav.innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};

window.onload = refreshData;
