// Home Inventory App
const app = {
  state: {
    screen: 'home',
    roomId: null,
    areaId: null,
    itemId: null,
    editMode: null // 'rooms' | 'areas' | 'items' | null
  },

  async init() {
    await DB.init();
    this.bindGlobal();
    this.navigate('home');
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  bindGlobal() {
    document.getElementById('back-btn').addEventListener('click', () => this.goBack());
    document.getElementById('modal-cancel').addEventListener('click', () => this.hideModal());
  },

  // Navigation
  navigate(screen, params = {}) {
    this.state.screen = screen;
    Object.assign(this.state, params);
    this.render();
  },

  goBack() {
    const { screen, roomId, areaId } = this.state;
    if (screen === 'areas') this.navigate('rooms');
    else if (screen === 'items') this.navigate('areas', { roomId });
    else if (screen === 'item-detail') this.navigate('items', { roomId, areaId });
    else if (screen === 'add') this.navigate('home');
    else if (screen === 'edit') this.navigate('home');
    else if (screen === 'edit-rooms') this.navigate('edit');
    else if (screen === 'edit-areas') this.navigate('edit');
    else if (screen === 'edit-item') this.navigate('item-detail', { itemId: this.state.itemId });
    else this.navigate('home');
  },

  // UI helpers
  showToast(msg, duration = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  },

  showModal(message, onConfirm) {
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal').classList.remove('hidden');
    const confirmBtn = document.getElementById('modal-confirm');
    const handler = () => {
      this.hideModal();
      onConfirm();
      confirmBtn.removeEventListener('click', handler);
    };
    confirmBtn.addEventListener('click', handler);
  },

  hideModal() {
    document.getElementById('modal').classList.add('hidden');
  },

  setHeader(title, showBack = true) {
    document.getElementById('page-title').textContent = title;
    document.getElementById('back-btn').classList.toggle('hidden', !showBack);
  },

  // ========== RENDER ==========
  async render() {
    const main = document.getElementById('main');
    main.innerHTML = '';

    switch (this.state.screen) {
      case 'home':
        this.setHeader('Home Inventory', false);
        this.renderHome(main);
        break;
      case 'rooms':
        this.setHeader('Find Items');
        await this.renderRooms(main);
        break;
      case 'areas':
        await this.renderAreas(main);
        break;
      case 'items':
        await this.renderItems(main);
        break;
      case 'item-detail':
        await this.renderItemDetail(main);
        break;
      case 'add':
        this.setHeader('Add Item');
        await this.renderAddForm(main);
        break;
      case 'edit':
        this.setHeader('Edit');
        this.renderEditMenu(main);
        break;
      case 'edit-rooms':
        this.setHeader('Edit Rooms');
        await this.renderEditRooms(main);
        break;
      case 'edit-areas':
        this.setHeader('Edit Areas');
        await this.renderEditAreas(main);
        break;
      case 'edit-item':
        this.setHeader('Edit Item');
        await this.renderEditItem(main);
        break;
    }
  },

  // Home
  renderHome(main) {
    main.innerHTML = `
      <div class="tiles">
        <div class="tile primary" data-action="add">
          <div class="tile-icon">＋</div>
          <div class="tile-label">Add Items</div>
        </div>
        <div class="tile accent" data-action="find">
          <div class="tile-icon">🔍</div>
          <div class="tile-label">Find Items</div>
        </div>
        <div class="tile warn" data-action="edit">
          <div class="tile-icon">✏️</div>
          <div class="tile-label">Edit</div>
        </div>
      </div>
    `;
    main.querySelector('[data-action="add"]').onclick = () => this.navigate('add');
    main.querySelector('[data-action="find"]').onclick = () => this.navigate('rooms');
    main.querySelector('[data-action="edit"]').onclick = () => this.navigate('edit');
  },

  // Find → Rooms
  async renderRooms(main) {
    const rooms = await DB.getRooms();
    if (rooms.length === 0) {
      main.innerHTML = `<div class="empty"><div class="empty-icon">🏠</div>No rooms yet.<br>Go to Edit to add some.</div>`;
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'grid';
    rooms.forEach(room => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="card-title">${escapeHtml(room.name)}</div>`;
      card.onclick = () => this.navigate('areas', { roomId: room.id });
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // Areas under a room
  async renderAreas(main) {
    const room = await DB.getRoom(this.state.roomId);
    this.setHeader(room ? room.name : 'Areas');

    const areas = await DB.getAreas(this.state.roomId);
    if (areas.length === 0) {
      main.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📦</div>
          No areas in this room yet.
          <p class="mt-16">Add items and type a new area name, or create areas in Edit.</p>
        </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const area of areas) {
      const items = await DB.getItems(area.id);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${escapeHtml(area.name)}</div>
        <div class="card-sub">${items.length} item${items.length !== 1 ? 's' : ''}</div>
      `;
      card.onclick = () => this.navigate('items', { roomId: this.state.roomId, areaId: area.id });
      grid.appendChild(card);
    }
    main.appendChild(grid);
  },

  // Items in an area
  async renderItems(main) {
    const area = await DB.getArea(this.state.areaId);
    const room = await DB.getRoom(this.state.roomId);
    this.setHeader(area ? area.name : 'Items');

    const items = await DB.getItems(this.state.areaId);
    if (items.length === 0) {
      main.innerHTML = `<div class="empty"><div class="empty-icon">📷</div>No items here yet.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'item-list';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const thumb = item.photo
        ? `<img class="item-thumb" src="${item.photo}" alt="" />`
        : `<div class="item-thumb placeholder">📷</div>`;
      row.innerHTML = `
        ${thumb}
        <div class="item-info">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-meta">${room ? escapeHtml(room.name) : ''} › ${area ? escapeHtml(area.name) : ''}</div>
        </div>
      `;
      row.onclick = () => this.navigate('item-detail', {
        roomId: this.state.roomId,
        areaId: this.state.areaId,
        itemId: item.id
      });
      list.appendChild(row);
    });
    main.appendChild(list);
  },

  // Item detail
  async renderItemDetail(main) {
    const item = await DB.getItem(this.state.itemId);
    if (!item) {
      this.showToast('Item not found');
      this.goBack();
      return;
    }
    const room = await DB.getRoom(item.roomId);
    const area = await DB.getArea(item.areaId);
    this.setHeader(item.name);

    main.innerHTML = `
      ${item.photo
        ? `<img class="detail-photo" src="${item.photo}" alt="${escapeHtml(item.name)}" />`
        : `<div class="detail-photo" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-muted)">📷</div>`
      }
      <div class="detail-name">${escapeHtml(item.name)}</div>
      <div class="detail-path">${room ? escapeHtml(room.name) : ''} › ${area ? escapeHtml(area.name) : ''}</div>
      <div class="detail-actions">
        <button class="btn primary full" id="edit-item-btn">Edit Item</button>
        <button class="btn danger full" id="delete-item-btn">Delete Item</button>
      </div>
    `;

    document.getElementById('edit-item-btn').onclick = () => {
      this.navigate('edit-item', { itemId: item.id });
    };
    document.getElementById('delete-item-btn').onclick = () => {
      this.showModal(`Delete “${item.name}”? This cannot be undone.`, async () => {
        await DB.deleteItem(item.id);
        this.showToast('Item deleted');
        this.navigate('items', { roomId: item.roomId, areaId: item.areaId });
      });
    };
  },

  // Add form
  async renderAddForm(main) {
    const rooms = await DB.getRooms();
    const roomOptions = rooms.map(r =>
      `<option value="${r.id}">${escapeHtml(r.name)}</option>`
    ).join('');

    main.innerHTML = `
      <form class="form" id="add-form">
        <div class="field">
          <label>Room</label>
          <select id="add-room" required>
            <option value="">Select a room…</option>
            ${roomOptions}
          </select>
        </div>
        <div class="field">
          <label>Area</label>
          <input type="text" id="add-area" placeholder="e.g. Pax wardrobe – Drawer 1" required list="area-suggestions" />
          <datalist id="area-suggestions"></datalist>
        </div>
        <div class="field">
          <label>Item name</label>
          <input type="text" id="add-name" placeholder="What is it?" required />
        </div>
        <div class="field">
          <label>Photo</label>
          <div class="photo-area">
            <img id="photo-preview" class="photo-preview" alt="Preview" />
            <div class="photo-actions">
              <label class="btn secondary" style="flex:1;cursor:pointer">
                📷 Take / Choose Photo
                <input type="file" id="add-photo" accept="image/*" capture="environment" hidden />
              </label>
              <button type="button" class="btn secondary" id="clear-photo" style="display:none">✕</button>
            </div>
          </div>
        </div>
        <button type="submit" class="btn primary full mt-16">Save Item</button>
      </form>
    `;

    const roomSelect = document.getElementById('add-room');
    const areaInput = document.getElementById('add-area');
    const datalist = document.getElementById('area-suggestions');
    const photoInput = document.getElementById('add-photo');
    const preview = document.getElementById('photo-preview');
    const clearBtn = document.getElementById('clear-photo');
    let photoData = null;

    // Suggest existing areas when room changes
    roomSelect.addEventListener('change', async () => {
      datalist.innerHTML = '';
      if (!roomSelect.value) return;
      const areas = await DB.getAreas(roomSelect.value);
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.name;
        datalist.appendChild(opt);
      });
    });

    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        // Resize for storage efficiency
        resizeImage(e.target.result, 900, 0.8).then(dataUrl => {
          photoData = dataUrl;
          preview.src = dataUrl;
          preview.classList.add('visible');
          clearBtn.style.display = 'inline-flex';
        });
      };
      reader.readAsDataURL(file);
    });

    clearBtn.addEventListener('click', () => {
      photoData = null;
      photoInput.value = '';
      preview.src = '';
      preview.classList.remove('visible');
      clearBtn.style.display = 'none';
    });

    document.getElementById('add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomId = roomSelect.value;
      const areaName = areaInput.value.trim();
      const name = document.getElementById('add-name').value.trim();
      if (!roomId || !areaName || !name) return;

      // Find or create area
      let areas = await DB.getAreas(roomId);
      let area = areas.find(a => a.name.toLowerCase() === areaName.toLowerCase());
      if (!area) {
        area = await DB.addArea(roomId, areaName);
      }

      await DB.addItem({
        roomId,
        areaId: area.id,
        name,
        photo: photoData
      });

      this.showToast('Item saved!');
      this.navigate('home');
    });
  },

  // Edit menu
  renderEditMenu(main) {
    main.innerHTML = `
      <div class="tiles">
        <div class="tile" data-action="rooms" style="background:var(--surface)">
          <div class="tile-icon">🏠</div>
          <div class="tile-label">Rooms</div>
        </div>
        <div class="tile" data-action="areas" style="background:var(--surface)">
          <div class="tile-icon">📦</div>
          <div class="tile-label">Areas</div>
        </div>
      </div>
      <p class="text-center mt-24" style="color:var(--text-muted);font-size:0.9rem">
        Tip: You can also edit individual items from the Find flow.
      </p>
    `;
    main.querySelector('[data-action="rooms"]').onclick = () => this.navigate('edit-rooms');
    main.querySelector('[data-action="areas"]').onclick = () => this.navigate('edit-areas');
  },

  // Edit rooms
  async renderEditRooms(main) {
    const rooms = await DB.getRooms();
    let html = `
      <form class="form" id="add-room-form" style="margin-bottom:20px">
        <div class="field">
          <label>Add new room</label>
          <div class="flex-gap">
            <input type="text" id="new-room-name" placeholder="Room name" required style="flex:1" />
            <button type="submit" class="btn primary">Add</button>
          </div>
        </div>
      </form>
      <div class="section-title">Current rooms</div>
      <div class="edit-list" id="room-list"></div>
    `;
    main.innerHTML = html;

    const list = document.getElementById('room-list');
    rooms.forEach(room => {
      const row = document.createElement('div');
      row.className = 'edit-row';
      row.innerHTML = `
        <div class="name">${escapeHtml(room.name)}</div>
        <div class="actions">
          <button data-action="rename" title="Rename">✏️</button>
          <button data-action="delete" title="Delete">🗑️</button>
        </div>
      `;
      row.querySelector('[data-action="rename"]').onclick = () => {
        const newName = prompt('New room name:', room.name);
        if (newName && newName.trim() && newName.trim() !== room.name) {
          DB.updateRoom(room.id, { name: newName.trim() }).then(() => {
            this.showToast('Room renamed');
            this.render();
          });
        }
      };
      row.querySelector('[data-action="delete"]').onclick = () => {
        this.showModal(`Delete room “${room.name}” and everything inside it?`, async () => {
          await DB.deleteRoom(room.id);
          this.showToast('Room deleted');
          this.render();
        });
      };
      list.appendChild(row);
    });

    document.getElementById('add-room-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-room-name').value.trim();
      if (!name) return;
      await DB.addRoom(name);
      this.showToast('Room added');
      this.render();
    });
  },

  // Edit areas (pick room first)
  async renderEditAreas(main) {
    const rooms = await DB.getRooms();
    main.innerHTML = `
      <div class="field">
        <label>Select room</label>
        <select id="edit-area-room">
          <option value="">Choose a room…</option>
          ${rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
        </select>
      </div>
      <div id="area-edit-content" class="mt-16"></div>
    `;

    const roomSelect = document.getElementById('edit-area-room');
    const content = document.getElementById('area-edit-content');

    roomSelect.addEventListener('change', async () => {
      content.innerHTML = '';
      if (!roomSelect.value) return;
      const areas = await DB.getAreas(roomSelect.value);

      content.innerHTML = `
        <form class="form" id="add-area-form" style="margin-bottom:16px">
          <div class="field">
            <label>Add area to this room</label>
            <div class="flex-gap">
              <input type="text" id="new-area-name" placeholder="e.g. Top shelf" required style="flex:1" />
              <button type="submit" class="btn primary">Add</button>
            </div>
          </div>
        </form>
        <div class="section-title">Areas</div>
        <div class="edit-list" id="area-list"></div>
      `;

      const list = document.getElementById('area-list');
      if (areas.length === 0) {
        list.innerHTML = `<div class="empty" style="padding:20px">No areas yet.</div>`;
      } else {
        areas.forEach(area => {
          const row = document.createElement('div');
          row.className = 'edit-row';
          row.innerHTML = `
            <div class="name">${escapeHtml(area.name)}</div>
            <div class="actions">
              <button data-action="rename">✏️</button>
              <button data-action="delete">🗑️</button>
            </div>
          `;
          row.querySelector('[data-action="rename"]').onclick = () => {
            const newName = prompt('New area name:', area.name);
            if (newName && newName.trim() && newName.trim() !== area.name) {
              DB.updateArea(area.id, { name: newName.trim() }).then(() => {
                this.showToast('Area renamed');
                roomSelect.dispatchEvent(new Event('change'));
              });
            }
          };
          row.querySelector('[data-action="delete"]').onclick = () => {
            this.showModal(`Delete area “${area.name}” and all its items?`, async () => {
              await DB.deleteArea(area.id);
              this.showToast('Area deleted');
              roomSelect.dispatchEvent(new Event('change'));
            });
          };
          list.appendChild(row);
        });
      }

      document.getElementById('add-area-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-area-name').value.trim();
        if (!name) return;
        await DB.addArea(roomSelect.value, name);
        this.showToast('Area added');
        roomSelect.dispatchEvent(new Event('change'));
      });
    });
  },

  // Edit existing item
  async renderEditItem(main) {
    const item = await DB.getItem(this.state.itemId);
    if (!item) {
      this.showToast('Item not found');
      this.goBack();
      return;
    }

    const rooms = await DB.getRooms();
    const areas = await DB.getAreas(item.roomId);

    main.innerHTML = `
      <form class="form" id="edit-item-form">
        <div class="field">
          <label>Item name</label>
          <input type="text" id="edit-name" value="${escapeHtml(item.name)}" required />
        </div>
        <div class="field">
          <label>Room</label>
          <select id="edit-room">
            ${rooms.map(r => `<option value="${r.id}" ${r.id === item.roomId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Area</label>
          <input type="text" id="edit-area" value="${escapeHtml((await DB.getArea(item.areaId))?.name || '')}" required list="edit-area-list" />
          <datalist id="edit-area-list">
            ${areas.map(a => `<option value="${escapeHtml(a.name)}">`).join('')}
          </datalist>
        </div>
        <div class="field">
          <label>Photo</label>
          <div class="photo-area">
            <img id="edit-photo-preview" class="photo-preview ${item.photo ? 'visible' : ''}" src="${item.photo || ''}" alt="Preview" />
            <div class="photo-actions">
              <label class="btn secondary" style="flex:1;cursor:pointer">
                📷 Change Photo
                <input type="file" id="edit-photo" accept="image/*" capture="environment" hidden />
              </label>
              <button type="button" class="btn secondary" id="edit-clear-photo" style="${item.photo ? '' : 'display:none'}">✕</button>
            </div>
          </div>
        </div>
        <button type="submit" class="btn primary full mt-16">Save Changes</button>
      </form>
    `;

    let photoData = item.photo;
    const photoInput = document.getElementById('edit-photo');
    const preview = document.getElementById('edit-photo-preview');
    const clearBtn = document.getElementById('edit-clear-photo');
    const roomSelect = document.getElementById('edit-room');
    const areaInput = document.getElementById('edit-area');
    const datalist = document.getElementById('edit-area-list');

    roomSelect.addEventListener('change', async () => {
      const newAreas = await DB.getAreas(roomSelect.value);
      datalist.innerHTML = newAreas.map(a => `<option value="${escapeHtml(a.name)}">`).join('');
      areaInput.value = '';
    });

    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        resizeImage(e.target.result, 900, 0.8).then(dataUrl => {
          photoData = dataUrl;
          preview.src = dataUrl;
          preview.classList.add('visible');
          clearBtn.style.display = 'inline-flex';
        });
      };
      reader.readAsDataURL(file);
    });

    clearBtn.addEventListener('click', () => {
      photoData = null;
      photoInput.value = '';
      preview.src = '';
      preview.classList.remove('visible');
      clearBtn.style.display = 'none';
    });

    document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value.trim();
      const roomId = roomSelect.value;
      const areaName = areaInput.value.trim();
      if (!name || !roomId || !areaName) return;

      // Find or create area in the (possibly new) room
      let targetAreas = await DB.getAreas(roomId);
      let area = targetAreas.find(a => a.name.toLowerCase() === areaName.toLowerCase());
      if (!area) {
        area = await DB.addArea(roomId, areaName);
      }

      await DB.updateItem(item.id, {
        name,
        roomId,
        areaId: area.id,
        photo: photoData
      });

      this.showToast('Item updated');
      this.navigate('item-detail', { itemId: item.id, roomId, areaId: area.id });
    });
  }
};

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resizeImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback
    img.src = dataUrl;
  });
}

// Boot
document.addEventListener('DOMContentLoaded', () => app.init());
