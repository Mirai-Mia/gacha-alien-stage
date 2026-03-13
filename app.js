/**
 * GACHA ALIEN STAGE - LOGIQUE PRINCIPALE
 * Version: 1.0 (2026)
 */

let currentUser = null;

// Configuration des raretés et probabilités
const rarities = {
    1: { name: "Étoile montante", stars: "★", chance: 0.465 },
    2: { name: "Célébrité", stars: "★★", chance: 0.40, pity: 5, tradeCost: 5 },
    3: { name: "Star", stars: "★★★", chance: 0.10, pity: 20, tradeCost: 15 },
    4: { name: "Idole", stars: "★★★★", chance: 0.03, pity: 30, tradeCost: 30 },
    5: { name: "Légende", stars: "★★★★★", chance: 0.005, pity: 50, tradeCost: 50 }
};

// --- LOGIQUE GACHA ---
const gachaLogic = {
    roll(userId, count = 1) {
        let data = DB.get();
        let user = data.users.find(u => u.id === userId);
        let obtainedCards = [];

        if (user.vows < count) {
            alert("Vœux insuffisants !");
            return null;
        }

        for (let i = 0; i < count; i++) {
            user.vows--;
            // Incrémenter les compteurs de pity
            Object.keys(user.pity).forEach(r => user.pity[r]++);

            let resultRarity = 1;

            // Priorité des garanties (de la plus rare à la moins rare)
            // Si deux garanties tombent en même temps, la moins rare attendra le vœu suivant
            if (user.pity[5] >= rarities[5].pity) resultRarity = 5;
            else if (user.pity[4] >= rarities[4].pity) resultRarity = 4;
            else if (user.pity[3] >= rarities[3].pity) resultRarity = 3;
            else if (user.pity[2] >= rarities[2].pity) resultRarity = 2;
            else {
                // Tirage aléatoire standard
                const r = Math.random();
                if (r <= 0.005) resultRarity = 5;
                else if (r <= 0.035) resultRarity = 4;
                else if (r <= 0.135) resultRarity = 3;
                else if (r <= 0.535) resultRarity = 2;
            }

            // Réinitialisation de la pity pour la rareté obtenue
            if (resultRarity > 1) user.pity[resultRarity] = 0;

            // Sélection d'une carte de la rareté
            const possibleCards = data.cards.filter(c => c.rarity === resultRarity);
            if (possibleCards.length > 0) {
                const wonCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
                user.inventory[wonCard.id] = (user.inventory[wonCard.id] || 0) + 1;
                obtainedCards.push(wonCard);
            }
        }

        DB.save(data);
        this.checkAchievements(user);
        return obtainedCards;
    },

    checkAchievements(user) {
        // Logique simplifiée des succès (ex: nombre de cartes possédées)
        // À étendre selon vos besoins de "Paramètres succès"
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
        
        const data = DB.get();
        document.getElementById('next-card-number').innerText = data.cards.length + 1;

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

    saveCard() {
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

        const data = DB.get();
        data.cards.push({
            id: data.cards.length + 1,
            name: name,
            rarity: rarity,
            img: exportCanvas.toDataURL("image/jpeg", 0.7),
            credits: document.getElementById('new-card-credits').value || "N/A"
        });
        DB.save(data);
        alert("Carte enregistrée !");
        ui.loadTab('Collection');
    }
};

// --- INTERFACE UTILISATEUR (UI) ---
const ui = {
    loadTab(tabName) {
        const main = document.getElementById('content-area');
        main.innerHTML = '';
        
        if (tabName === 'Création de carte') {
            main.innerHTML = `
                <div id="tab-create-card">
                    <h2>Création de Carte (N°<span id="next-card-number"></span>)</h2>
                    <div class="creator-container">
                        <div class="form-group">
                            <input type="text" id="new-card-name" placeholder="Nom de l'Alien">
                            <select id="new-card-rarity">
                                <option value="1">1★ Étoile montante</option>
                                <option value="2">2★ Célébrité</option>
                                <option value="3">3★ Star</option>
                                <option value="4">4★ Idole</option>
                                <option value="5">5★ Légende</option>
                            </select>
                            <input type="file" id="image-upload" accept="image/*">
                            <input type="text" id="new-card-credits" placeholder="Artiste / Crédits">
                            <button onclick="admin.saveCard()" class="btn-save">Valider la Carte</button>
                        </div>
                        <div class="crop-zone">
                            <canvas id="crop-canvas" width="330" height="480"></canvas>
                            <input type="range" id="zoom-slider" min="5" max="200" value="50">
                        </div>
                    </div>
                </div>`;
            admin.initCanvas();
        } else if (tabName === 'Bannières') {
            this.renderBanners();
        } else if (tabName === 'Collection' || tabName === 'Ma collection') {
            this.renderCollection();
        }
        // Dans ui.loadTab...
else if (tabName === 'Échange') {
    const data = DB.get();
    let html = `<h2>Centre d'Échange</h2><p>Vœux actuels : ⭐ ${currentUser.vows}</p>`;

    // --- SECTION 1 : PROPOSER UN ÉCHANGE ---
    html += `<h3>Proposer un échange</h3>
             <div class="trade-form">
                <select id="trade-target-user">
                    <option value="">Choisir un joueur en ligne...</option>
                    ${data.users.filter(u => u.id !== currentUser.id).map(u => `<option value="${u.id}">${u.id}</option>`).join('')}
                </select>
                <select id="trade-my-card">
                    <option value="">Choisir une de vos cartes...</option>
                    ${Object.keys(currentUser.inventory).filter(id => currentUser.inventory[id] > 0).map(id => {
                        const c = data.cards.find(card => card.id == id);
                        return `<option value="${c.id}">${c.name} (${rarities[c.rarity].name} - Coût: ${rarities[c.rarity].tradeCost})</option>`;
                    }).join('')}
                </select>
                <button onclick="const u=document.getElementById('trade-target-user').value; const c=parseInt(document.getElementById('trade-my-card').value); tradeLogic.sendProposal(currentUser, u, c)">Envoyer</button>
             </div>`;

    // --- SECTION 2 : ÉCHANGES EN ATTENTE (REÇUS) ---
    const myTrades = data.trades.filter(t => t.receiverId === currentUser.id && t.status === 'pending');
    html += `<h3>Propositions reçues</h3>`;
    if(myTrades.length === 0) html += `<p>Aucune proposition pour le moment.</p>`;
    
    myTrades.forEach(t => {
        const senderCard = data.cards.find(c => c.id === t.senderCardId);
        html += `<div class="trade-item">
            <p><strong>${t.senderId}</strong> vous propose <strong>${senderCard.name}</strong> (${rarities[t.rarity].name}).</p>
            <p>Choisissez une carte ${rarities[t.rarity].name} à donner en retour (Taxe: ${rarities[t.rarity].tradeCost} vœux) :</p>
            <select id="reply-card-${t.id}">
                ${Object.keys(currentUser.inventory).filter(id => {
                    const c = data.cards.find(card => card.id == id);
                    return currentUser.inventory[id] > 0 && c.rarity === t.rarity;
                }).map(id => `<option value="${id}">${data.cards.find(card => card.id == id).name}</option>`).join('')}
            </select>
            <button onclick="tradeLogic.acceptTrade(${t.id}, parseInt(document.getElementById('reply-card-${t.id}').value))">Accepter l'échange</button>
        </div>`;
    });

    // --- SECTION 3 : HISTORIQUE (Pour l'admin et le joueur) ---
    if (currentUser.role === 'admin') {
        html += `<h3>Historique global des échanges (Admin)</h3>`;
        data.trades.filter(t => t.status === 'completed').forEach(t => {
            html += `<p>Succès : ${t.senderId} ↔ ${t.receiverId} (Rareté ${t.rarity})</p>`;
        });
    }

    main.innerHTML = html;
}
        else if (tabName === 'Paramètres succès') {
    const data = DB.get();
    let html = `<h2>Gestion des Succès</h2>
                <div class="admin-panel">
                    <h3>Créer un nouveau succès</h3>
                    <input type="text" id="ach-new-name" placeholder="Nom du succès">
                    <input type="number" id="ach-new-reward" placeholder="Récompense (vœux)">
                    
                    <select id="ach-new-type" onchange="ui.toggleAchFields(this.value)">
                        <option value="rarity_count">Nombre de cartes d'une rareté</option>
                        <option value="collection_set">Posséder une liste de cartes</option>
                    </select>

                    <div id="ach-config-fields">
                        </div>

                    <button onclick="ui.saveAchievement()">Créer le succès</button>
                </div>
                <h3>Succès existants</h3>
                <div class="ach-list">
                    ${data.achievements.map(a => `<p>🏆 ${a.name} (${a.reward} vœux)</p>`).join('')}
                </div>`;
    main.innerHTML = html;
}
    },

    renderBanners() {
        const main = document.getElementById('content-area');
        main.innerHTML = `
            <div class="banner-view">
                <div class="vow-display">⭐ ${currentUser.vows} Vœux</div>
                <div class="banner-card">
                    <img src="https://via.placeholder.com/1600x1000" class="banner-img">
                    <div class="banner-btns">
                        <button onclick="ui.doDraw(1)">Faire 1 vœu</button>
                        <button onclick="ui.doDraw(5)">Faire 5 vœux</button>
                    </div>
                </div>
                <div id="draw-results" class="card-grid"></div>
            </div>`;
    },

    doDraw(num) {
        const results = gachaLogic.roll(currentUser.id, num);
        if (!results) return;
        const resDiv = document.getElementById('draw-results');
        resDiv.innerHTML = '';
        results.forEach(card => {
            resDiv.innerHTML += `
                <div class="card rarity-${card.rarity}">
                    <img src="${card.img}">
                    <div class="card-info">${card.name}<br>${rarities[card.rarity].stars}</div>
                </div>`;
        });
        this.renderBanners(); // Refresh vœux
    },

    renderCollection() {
        const data = DB.get();
        const main = document.getElementById('content-area');
        let html = `<h2>Ma Collection</h2><div class="card-grid">`;
        
        data.cards.forEach(card => {
            const count = currentUser.inventory[card.id] || 0;
            const isLocked = count === 0;
            html += `
                <div class="card ${isLocked ? 'locked' : ''}">
                    ${isLocked ? `<div class="card-num">#${card.id}</div>` : `<img src="${card.img}">`}
                    <div class="card-info">
                        ${card.name} ${!isLocked ? `(x${count})` : ''}<br>
                        ${!isLocked ? rarities[card.rarity].stars : ''}
                    </div>
                </div>`;
        });
        main.innerHTML = html + `</div>`;
    },

    renderSidebar(role) {
        const links = document.getElementById('nav-links');
        links.innerHTML = '';
        const menu = role === 'admin' ? 
            ['Mon compte', 'Compte', 'Cadeaux', 'Échange', 'Création de carte', 'Collection', 'Bannières'] :
            ['Mon compte', 'Bannières', 'Ma collection', 'Échange'];
            
        menu.forEach(item => {
            let div = document.createElement('div');
            div.className = 'nav-item';
            div.innerText = item;
            div.onclick = () => ui.loadTab(item);
            links.appendChild(div);
        });
    },

    toggleTheme() {
        document.body.classList.toggle('light-mode');
    }
};

// --- AUTHENTIFICATION ---
const auth = {
    login() {
        const id = document.getElementById('login-id').value;
        const pass = document.getElementById('login-pass').value;
        const data = DB.get();
        const user = data.users.find(u => u.id === id && u.pass === pass);
        
        if (user) {
            currentUser = user;
            achievementLogic.checkAll(currentUser);
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('user-display').innerText = user.id;
            ui.renderSidebar(user.role);
            ui.loadTab('Bannières');
        } else {
            alert("Accès refusé");
        }
    },
    logout() { location.reload(); }
};

const tradeLogic = {
    // Coûts définis dans ton énoncé
    getTradeCost(rarity) {
        return rarities[rarity].tradeCost;
    },

    // Simule l'envoi d'une proposition
    sendProposal(fromUser, toUserId, cardId) {
        let data = DB.get();
        const card = data.cards.find(c => c.id === cardId);
        const cost = this.getTradeCost(card.rarity);

        if (fromUser.vows < cost) {
            alert(`Vœux insuffisants ! Il vous faut ${cost} vœux pour échanger une carte ${rarities[card.rarity].name}.`);
            return;
        }

        // Dans une version réelle, ceci enverrait une notification à toUserId
        alert(`Proposition envoyée à ${toUserId}. En attente d'une carte de rareté ${card.rarity} (${rarities[card.rarity].name}) en retour.`);
        
        // On stocke temporairement l'échange en attente
        data.trades.push({
            id: Date.now(),
            senderId: fromUser.id,
            receiverId: toUserId,
            senderCardId: cardId,
            rarity: card.rarity,
            status: 'pending'
        });
        DB.save(data);
        ui.loadTab('Échange');
    },

    // Finaliser l'échange
    acceptTrade(tradeId, receiverCardId) {
        let data = DB.get();
        const trade = data.trades.find(t => t.id === tradeId);
        const sender = data.users.find(u => u.id === trade.senderId);
        const receiver = data.users.find(u => u.id === trade.receiverId);
        const cost = this.getTradeCost(trade.rarity);

        if (receiver.vows < cost) return alert("Vœux insuffisants pour accepter l'échange.");

        // Transfert des cartes
        // Retrait chez l'envoyeur, ajout chez le receveur
        sender.inventory[trade.senderCardId]--;
        receiver.inventory[trade.senderCardId] = (receiver.inventory[trade.senderCardId] || 0) + 1;

        // Retrait chez le receveur, ajout chez l'envoyeur
        receiver.inventory[receiverCardId]--;
        sender.inventory[receiverCardId] = (sender.inventory[receiverCardId] || 0) + 1;

        // Paiement des taxes
        sender.vows -= cost;
        receiver.vows -= cost;

        trade.status = 'completed';
        trade.receiverCardId = receiverCardId;

        DB.save(data);
        alert("Échange réussi ! Les vœux ont été déduits.");
        ui.loadTab('Échange');
    }
};

const achievementLogic = {
    // Vérifier si le joueur remplit les conditions d'un succès
    checkAll(user) {
        const data = DB.get();
        data.achievements.forEach(ach => {
            // Si le joueur n'a pas encore ce succès
            if (!user.achievements.includes(ach.id)) {
                let accomplished = false;

                if (ach.type === 'rarity_count') {
                    const count = Object.keys(user.inventory).filter(cardId => {
                        const card = data.cards.find(c => c.id == cardId);
                        return card.rarity == ach.targetRarity && user.inventory[cardId] > 0;
                    }).length;
                    if (count >= ach.requiredCount) accomplished = true;
                } 
                
                else if (ach.type === 'collection_set') {
                    accomplished = ach.requiredCardIds.every(id => user.inventory[id] > 0);
                }

                if (accomplished) {
                    this.unlock(user, ach);
                }
            }
        });
    },

    unlock(user, ach) {
        user.achievements.push(ach.id);
        user.vows += ach.reward;
        
        // Affichage du Pop-up
        const popup = document.getElementById('success-popup');
        document.getElementById('ach-name').innerText = ach.name;
        document.getElementById('ach-reward').innerText = ach.reward;
        popup.classList.remove('hidden');
        
        // Sauvegarde immédiate
        const data = DB.get();
        const userIdx = data.users.findIndex(u => u.id === user.id);
        data.users[userIdx] = user;
        DB.save(data);
    }
};

// Fonction pour fermer le pop-up (à ajouter dans l'objet ui)
ui.closePopup = () => {
    document.getElementById('success-popup').classList.add('hidden');
};

ui.toggleAchFields = (type) => {
    const container = document.getElementById('ach-config-fields');
    if (type === 'rarity_count') {
        container.innerHTML = `
            <select id="ach-rarity-target">
                <option value="1">1★</option><option value="2">2★</option>
                <option value="3">3★</option><option value="4">4★</option>
                <option value="5">5★</option>
            </select>
            <input type="number" id="ach-rarity-qty" placeholder="Quantité requise">`;
    } else {
        const data = DB.get();
        container.innerHTML = `<p>Sélectionnez les cartes requises :</p>
            <div style="max-height:150px; overflow-y:auto;">
                ${data.cards.map(c => `
                    <label><input type="checkbox" class="ach-card-check" value="${c.id}"> ${c.name}</label><br>
                `).join('')}
            </div>`;
    }
};

ui.saveAchievement = () => {
    const data = DB.get();
    const type = document.getElementById('ach-new-type').value;
    const newAch = {
        id: Date.now(),
        name: document.getElementById('ach-new-name').value,
        reward: parseInt(document.getElementById('ach-new-reward').value),
        type: type
    };

    if (type === 'rarity_count') {
        newAch.targetRarity = document.getElementById('ach-rarity-target').value;
        newAch.requiredCount = document.getElementById('ach-rarity-qty').value;
    } else {
        newAch.requiredCardIds = Array.from(document.querySelectorAll('.ach-card-check:checked')).map(el => parseInt(el.value));
    }

    data.achievements.push(newAch);
    DB.save(data);
    alert("Succès créé !");
    ui.loadTab('Paramètres succès');
};

