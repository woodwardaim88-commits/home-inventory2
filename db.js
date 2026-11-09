// Simple IndexedDB wrapper for Home Inventory
const DB_NAME = 'HomeInventoryDB';
const DB_VERSION = 1;

const DEFAULT_ROOMS = [
  'Hallway',
  'Downstairs closet',
  'Downstairs bathroom',
  'Living room',
  'Kitchen',
  'Gina office',
  'Master bedroom',
  'Guest bedroom',
  'Upstairs cupboard',
  'Jack office',
  'Family bathroom'
];

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      if (!database.objectStoreNames.contains('rooms')) {
        const rooms = database.createObjectStore('rooms', { keyPath: 'id' });
        rooms.createIndex('name', 'name', { unique: false });
        rooms.createIndex('order', 'order', { unique: false });
      }

      if (!database.objectStoreNames.contains('areas')) {
        const areas = database.createObjectStore('areas', { keyPath: 'id' });
        areas.createIndex('roomId', 'roomId', { unique: false });
        areas.createIndex('name', 'name', { unique: false });
      }

      if (!database.objectStoreNames.contains('items')) {
        const items = database.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('areaId', 'areaId', { unique: false });
        items.createIndex('roomId', 'roomId', { unique: false });
        items.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Generic helpers
function tx(storeName, mode = 'readonly') {
  return openDB().then(database => {
    const transaction = database.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function getAll(storeName) {
  return tx(storeName).then(store => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

function getById(storeName, id) {
  return tx(storeName).then(store => {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

function put(storeName, value) {
  return tx(storeName, 'readwrite').then(store => {
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  });
}

function remove(storeName, id) {
  return tx(storeName, 'readwrite').then(store => {
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

function getByIndex(storeName, indexName, value) {
  return tx(storeName).then(store => {
    return new Promise((resolve, reject) => {
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

// Public API
const DB = {
  async init() {
    await openDB();
    const rooms = await getAll('rooms');
    if (rooms.length === 0) {
      // Seed default rooms
      for (let i = 0; i < DEFAULT_ROOMS.length; i++) {
        await put('rooms', {
          id: generateId(),
          name: DEFAULT_ROOMS[i],
          order: i
        });
      }
    }
  },

  // Rooms
  async getRooms() {
    const rooms = await getAll('rooms');
    return rooms.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  async getRoom(id) {
    return getById('rooms', id);
  },

  async addRoom(name) {
    const rooms = await this.getRooms();
    const room = {
      id: generateId(),
      name: name.trim(),
      order: rooms.length
    };
    await put('rooms', room);
    return room;
  },

  async updateRoom(id, updates) {
    const room = await getById('rooms', id);
    if (!room) throw new Error('Room not found');
    Object.assign(room, updates);
    await put('rooms', room);
    return room;
  },

  async deleteRoom(id) {
    // Also delete areas and items under it
    const areas = await getByIndex('areas', 'roomId', id);
    for (const area of areas) {
      await this.deleteArea(area.id);
    }
    await remove('rooms', id);
  },

  // Areas
  async getAreas(roomId) {
    const areas = await getByIndex('areas', 'roomId', roomId);
    return areas.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getArea(id) {
    return getById('areas', id);
  },

  async addArea(roomId, name) {
    const area = {
      id: generateId(),
      roomId,
      name: name.trim()
    };
    await put('areas', area);
    return area;
  },

  async updateArea(id, updates) {
    const area = await getById('areas', id);
    if (!area) throw new Error('Area not found');
    Object.assign(area, updates);
    await put('areas', area);
    return area;
  },

  async deleteArea(id) {
    const items = await getByIndex('items', 'areaId', id);
    for (const item of items) {
      await remove('items', item.id);
    }
    await remove('areas', id);
  },

  // Items
  async getItems(areaId) {
    const items = await getByIndex('items', 'areaId', areaId);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getItem(id) {
    return getById('items', id);
  },

  async addItem({ roomId, areaId, name, photo }) {
    const item = {
      id: generateId(),
      roomId,
      areaId,
      name: name.trim(),
      photo: photo || null, // base64 data URL
      createdAt: Date.now()
    };
    await put('items', item);
    return item;
  },

  async updateItem(id, updates) {
    const item = await getById('items', id);
    if (!item) throw new Error('Item not found');
    Object.assign(item, updates);
    if (updates.name) item.name = updates.name.trim();
    await put('items', item);
    return item;
  },

  async deleteItem(id) {
    await remove('items', id);
  },

  async getAllAreas() {
    return getAll('areas');
  },

  async getAllItems() {
    return getAll('items');
  }
};
