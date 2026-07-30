type Doc = { [key: string]: any } & { _id: string };

const now = () => new Date();

const seededAdmin: Doc = {
  _id: '6a69ba6ee55c17ab799a08ad',
  username: 'ajaysomra',
  password: 'Mayank@2012',
  name: 'Admin',
  role: 'admin',
  assignedPlantIds: [],
  tcodePermissions: [],
  createdAt: now(),
  updatedAt: now(),
};

const store: Record<string, Doc[]> = {
  users: [seededAdmin],
};

function clone(doc: Doc) {
  return JSON.parse(JSON.stringify(doc));
}

function matchFilter(doc: Doc, filter: any) {
  if (!filter || Object.keys(filter).length === 0) return true;
  return Object.entries(filter).every(([k, v]) => {
    if (typeof v === 'object' && v !== null) {
      // simple $eq handling
      if ('$eq' in v) return doc[k] === v.$eq;
      return false;
    }
    return doc[k] === v;
  });
}

function collection(name: string) {
  if (!store[name]) store[name] = [];
  return {
    find(filter: any = {}) {
      const results = store[name].filter((d) => matchFilter(d, filter));
      return {
        _results: results,
        sort(spec: Record<string, number>) {
          const keys = Object.keys(spec);
          this._results.sort((a: any, b: any) => {
            for (const k of keys) {
              const dir = spec[k] === 1 ? 1 : -1;
              if (a[k] < b[k]) return -1 * dir;
              if (a[k] > b[k]) return 1 * dir;
            }
            return 0;
          });
          return this;
        },
        limit(n: number) {
          this._results = this._results.slice(0, n);
          return this;
        },
        async toArray() { return this._results.map(clone); },
      };
    },
    async findOne(filter: any = {}) {
      const doc = store[name].find((d) => matchFilter(d, filter));
      return doc ? clone(doc) : null;
    },
    async insertOne(doc: any) {
      const _id = (Math.random().toString(16).slice(2, 10) + Date.now().toString(16));
      const newDoc = { ...doc, _id };
      store[name].push(newDoc);
      return { insertedId: _id };
    },
    async findOneAndUpdate(filter: any, update: any, options: any = {}) {
      let doc = store[name].find((d) => matchFilter(d, filter));
      if (!doc && options.upsert) {
        const created = { _id: (Math.random().toString(16).slice(2, 10) + Date.now().toString(16)), ...(filter.id ? { id: filter.id } : {}), ...update.$setOnInsert };
        const final = { ...created, ...update.$set };
        store[name].push(final);
        return clone(final);
      }
      if (!doc) return null;
      Object.assign(doc, update.$set || {});
      doc.updatedAt = new Date();
      return clone(doc);
    },
    async deleteOne(filter: any) {
      const before = store[name].length;
      for (let i = store[name].length - 1; i >= 0; i--) {
        if (matchFilter(store[name][i], filter)) store[name].splice(i, 1);
      }
      const after = store[name].length;
      return { deletedCount: before - after };
    },
  };
}

export function getFallbackDb() {
  return { collection };
}

export default getFallbackDb;
