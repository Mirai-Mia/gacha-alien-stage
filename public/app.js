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
        } else { alert("Identifiants incorrects"); }
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
    }
};

const adminLogic = {
    // --- GESTION DES UTILISATEURS ---
    async updateUser(targetId) {
        const container = document.querySelector(`[data-user-id="${targetId}"]`);
        const updatedData = {
            id: targetId,
            pass: container.querySelector('.edit-pass').value,
            vows: parseInt(container.querySelector('.edit-vows').value),
            role: container.querySelector('.edit-role').value
        };

        const response = await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, updatedUser: updatedData })
        });

        const res = await response.json();
        if (res.success) {
            alert(`Utilisateur ${targetId} mis à jour !`);
            ui.loadTab('Gestion des comptes');
        } else {
            alert(res.error);
        }
    },

    async deleteUser(targetId) {
        if (!confirm(`Supprimer définitivement l'utilisateur ${targetId} ?`)) return;
        await fetch(`/api/admin/delete-user/${targetId}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id })
        });
        ui.loadTab('Gestion des comptes');
    },

    // --- GESTION BANNIÈRES ---
    async updateBanner(bannerId) {
        const container = document.querySelector(`[data-banner-id="${bannerId}"]`);
        const selectedIds = Array.from(container.querySelectorAll('.banner-checkbox:checked'))
                                 .map(cb => parseInt(cb.value));
        const imageUrl = container.querySelector('.banner-img-input').value;
        
        await fetch('/api/admin/update-banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: currentUser.id, bannerId, cardIds: selectedIds, image: imageUrl })
        });
        alert(`Bannière mise à jour !`);
        ui.loadTab('Bannières');
    }
};

const ui = {
    currentBannerIdx: 0,

    async loadTab(tabName) {
        await refreshData();
        const main = document.getElementById('content-area');
        main.innerHTML = "";

        if (tabName === 'Gestion des comptes') {
            main.innerHTML = `
                <h2 style="color:var(--accent);">👥 Gestion des Utilisateurs</h2>
                <div class="user-list">
                    ${globalData.users.map(u => `
                        <div class="admin-banner-card" data-user-id="${u.id}" style="margin-bottom:15px;">
                            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:10px; align-items:end;">
                                <div>
                                    <label style="font-size:0.7rem; color:var(--accent);">ID</label><br>
                                    <strong>${u.id}</strong>
                                </div>
                                <div>
                                    <label style="font-size:0.7rem;">MOT DE PASSE</label>
                                    <input type="text" class="edit-pass" value="${u.pass}" style="width:100%; padding:5px; background:#000; border:1px solid var(--border); color:#fff;">
                                </div>
                                <div>
                                    <label style="font-size:0.7rem;">VŒUX (⭐)</label>
                                    <input type="number" class="edit-vows" value="${u.vows}" style="width:100%; padding:5px; background:#000; border:1px solid var(--border); color:#fff;">
                                </div>
                                <div>
                                    <label style="font-size:0.7rem;">RÔLE</label>
                                    <select class="edit-role" style="width:100%; padding:5px; background:#000; border:1px solid var(--border); color:#fff;">
                                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                                <div style="display:flex; gap:5px;">
                                    <button class="btn-save" onclick="adminLogic.updateUser('${u.id}')" style="padding:8px;">💾</button>
                                    <button class="btn-delete" onclick="adminLogic.deleteUser('${u.id}')" style="padding:8px;">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        }

        else if (tabName === 'Bannières') {
            const activeBanners = globalData.banners.filter(b => b.active);
            if (activeBanners.length === 0) {
                main.innerHTML = "<h2>Aucun flux disponible.</h2>";
                return;
            }
            const b = activeBanners[this.currentBannerIdx] || activeBanners[0];
            main.innerHTML = `
                <div class="banner-view">
                    <div style="display:flex; gap:10px; justify-content:center; margin-bottom:20px;">
                        ${activeBanners.map((bn, i) => `<button onclick="ui.currentBannerIdx=${i}; ui.loadTab('Bannières')" class="btn-tab ${i===this.currentBannerIdx?'active':''}">${bn.id.toUpperCase()}</button>`).join('')}
                    </div>
                    <div class="pity-info">Pity 5★ : ${currentUser.pity["5"] || 0} / 50</div>
                    <img src="${b.image}" class="banner-main-img">
                    <div style="margin-top:20px;">
                        <button class="btn-roll" onclick="ui.doRoll(1, '${b.id}')">1 Vœu</button>
                        <button class="btn-roll" onclick="ui.doRoll(5, '${b.id}')">5 Vœux</button>
                    </div>
                    <div id="results" class="card-grid"></div>
                </div>`;
        }

        else if (tabName === 'Configuration Bannières') {
            main.innerHTML = `<h2>⚡ Configuration Bannières</h2>
                ${globalData.banners.map(b => `
                    <div class="admin-banner-card" data-banner-id="${b.id}">
                        <h3>${b.id.toUpperCase()}</h3>
                        <input type="text" class="banner-img-input" value="${b.image || ''}" style="width:100%; margin-bottom:10px;">
                        <button class="btn-save" onclick="adminLogic.updateBanner('${b.id}')">Sauvegarder</button>
                    </div>
                `).join('')}`;
        }

        else if (tabName === 'Mon compte') {
            const avatar = globalData.cards.find(c => c.id == currentUser.avatarCardId)?.img || "";
            main.innerHTML = `<div class="profile-header">
                <img src="${avatar}" id="current-avatar">
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

    async doRoll(n, bId) {
        const res = await fetch('/api/gacha/roll', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: currentUser.id, count: n, bannerId: bId}) });
        const data = await res.json();
        if (data.error) return alert(data.error);
        const resDiv = document.getElementById('results'); resDiv.innerHTML = "";
        data.obtainedCards.forEach((c, i) => {
            setTimeout(() => {
                resDiv.insertAdjacentHTML('beforeend', `<div class="card card-anim rarity-${c.rarity}"><img src="${c.img}"><div class="card-info">${c.name}</div></div>`);
            }, i * 250);
        });
        await refreshData();
    },

    renderSidebar(role) {
        const tabs = role === 'admin' 
            ? ['Mon compte', 'Bannières', 'Collection', 'Configuration Bannières', 'Gestion des comptes'] 
            : ['Mon compte', 'Bannières', 'Ma collection'];
        document.getElementById('nav-links').innerHTML = tabs.map(t => `<div class="nav-item" onclick="ui.loadTab('${t}')">${t}</div>`).join('');
    }
};

window.onload = refreshData;
