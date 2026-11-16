const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('mongodb');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  events: path.join(DATA_DIR, 'events.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  venues: path.join(DATA_DIR, 'venues.json')
};

function eventIdEquals(a, b) {
  return String(a) === String(b);
}

class Store {
  constructor() {
    this.mode = 'json';
    this.client = null;
    this.db = null;
  }

  async connect() {
    const uri = (process.env.MONGODB_URI || '').trim();
    if (uri) {
      try {
        this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        await this.client.connect();
        await this.client.db('admin').command({ ping: 1 });
        const dbName = process.env.MONGODB_DB || 'nightpulse';
        this.db = this.client.db(dbName);
        this.mode = 'mongo';
        console.log(`[DB] Connected to MongoDB. Database: ${dbName}. Mode: mongo`);
        return this.mode;
      } catch (err) {
        console.warn(`[DB] MongoDB connection failed: ${err.message}`);
        console.warn('[DB] Falling back to local JSON file store.');
        if (this.client) {
          try { await this.client.close(); } catch (_) { /* ignore */ }
          this.client = null;
          this.db = null;
        }
      }
    } else {
      console.log('[DB] No MONGODB_URI set. Using local JSON file store.');
    }

    this.mode = 'json';
    await this.ensureJsonFiles();
    console.log(`[DB] Mode: json-fallback (${DATA_DIR})`);
    return this.mode;
  }

  async ensureJsonFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const file of Object.values(FILES)) {
      try {
        await fs.access(file);
      } catch (_) {
        await fs.writeFile(file, '[]', 'utf8');
      }
    }
  }

  async readJson(file) {
    await this.ensureJsonFiles();
    const raw = await fs.readFile(file, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn(`[DB] Could not parse ${path.basename(file)}: ${err.message}. Using empty list.`);
      return [];
    }
  }

  async writeJson(file, data) {
    await this.ensureJsonFiles();
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  }

  collection(name) {
    return this.db.collection(name);
  }

  async seedIfEmpty(seedEvents, seedVenues) {
    if (this.mode === 'mongo') {
      const eventsCount = await this.collection('events').countDocuments();
      if (eventsCount === 0) {
        if (seedEvents.length) {
          await this.collection('events').insertMany(seedEvents.map((e) => ({ ...e })));
        }
        console.log(`[DB] Seeded ${seedEvents.length} events into MongoDB.`);
      } else {
        console.log(`[DB] Events collection already has ${eventsCount} document(s). Seed skipped.`);
      }

      const venuesCount = await this.collection('venues').countDocuments();
      if (venuesCount === 0) {
        if (seedVenues.length) {
          await this.collection('venues').insertMany(seedVenues.map((v) => ({ ...v })));
        }
        console.log(`[DB] Seeded ${seedVenues.length} venues into MongoDB.`);
      }

      const reviewsCount = await this.collection('reviews').countDocuments();
      console.log(`[DB] Reviews collection has ${reviewsCount} document(s) (not wiped on restart).`);
      return;
    }

    const events = await this.readJson(FILES.events);
    if (events.length === 0) {
      await this.writeJson(FILES.events, seedEvents);
      console.log(`[DB] Seeded ${seedEvents.length} events into data/events.json.`);
    } else {
      console.log(`[DB] data/events.json already has ${events.length} event(s). Seed skipped.`);
    }

    const venues = await this.readJson(FILES.venues);
    if (venues.length === 0) {
      await this.writeJson(FILES.venues, seedVenues);
      console.log(`[DB] Seeded ${seedVenues.length} venues into data/venues.json.`);
    }

    const reviews = await this.readJson(FILES.reviews);
    console.log(`[DB] data/reviews.json has ${reviews.length} review(s) (not wiped on restart).`);
  }

  async getEvents() {
    if (this.mode === 'mongo') {
      return this.collection('events').find({}).project({ _id: 0 }).toArray();
    }
    return this.readJson(FILES.events);
  }

  eventIdQuery(id) {
    const query = [{ id }];
    if (/^\d+$/.test(String(id))) query.push({ id: Number(id) });
    return { $or: query };
  }

  async getEventById(id) {
    if (this.mode === 'mongo') {
      const doc = await this.collection('events').findOne(
        this.eventIdQuery(id),
        { projection: { _id: 0 } }
      );
      return doc || null;
    }
    const events = await this.readJson(FILES.events);
    return events.find((e) => eventIdEquals(e.id, id)) || null;
  }

  async getVenues() {
    if (this.mode === 'mongo') {
      return this.collection('venues').find({}).project({ _id: 0 }).toArray();
    }
    return this.readJson(FILES.venues);
  }

  async getReviews(eventId) {
    if (this.mode === 'mongo') {
      const query = eventId == null || eventId === ''
        ? {}
        : this.reviewEventQuery(eventId);
      return this.collection('reviews')
        .find(query)
        .project({ _id: 0 })
        .sort({ createdAt: -1 })
        .toArray();
    }
    const reviews = await this.readJson(FILES.reviews);
    const filtered = eventId == null || eventId === ''
      ? reviews
      : reviews.filter((r) => eventIdEquals(r.eventId, eventId));
    return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  reviewEventQuery(eventId) {
    const values = [eventId];
    if (/^\d+$/.test(String(eventId))) values.push(Number(eventId));
    return { $or: values.map((value) => ({ eventId: value })) };
  }

  async addReview(review) {
    if (this.mode === 'mongo') {
      const doc = { ...review };
      await this.collection('reviews').insertOne(doc);
      return review;
    }
    const reviews = await this.readJson(FILES.reviews);
    reviews.push(review);
    await this.writeJson(FILES.reviews, reviews);
    return review;
  }
}

module.exports = { Store, eventIdEquals };
