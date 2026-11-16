require('dotenv').config();

const express = require('express');
const path = require('path');
const { Store } = require('./lib/store');
const { seedEvents } = require('./seed/events');
const { seedVenues } = require('./seed/venues');

const app = express();
const PORT = process.env.PORT || 3000;
const store = new Store();

const MONTH_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function monthKey(value) {
  return String(value || '').trim().slice(0, 3).toLowerCase();
}

function eventOverlapsMonth(event, month) {
  if (!month || month === 'All' || month.toLowerCase() === 'spotlight') return true;
  const key = monthKey(month);
  if (event.month && monthKey(event.month) === key) return true;

  if (event.startDate && event.endDate) {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const index = MONTH_INDEX[key] ?? MONTH_INDEX[month.toLowerCase()];
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || index === undefined) {
      return false;
    }
    const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
    // Also include years in between for long ranges
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) {
      years.add(y);
    }
    for (const year of years) {
      const monthStart = new Date(Date.UTC(year, index, 1));
      const monthEnd = new Date(Date.UTC(year, index + 1, 0, 23, 59, 59, 999));
      if (start <= monthEnd && end >= monthStart) return true;
    }
  }
  return false;
}

function matchesSearch(event, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return [event.title, event.venue, event.district, event.address, event.description, event.category]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

function matchesCategory(event, category) {
  if (!category || category === 'All') return true;
  return String(event.category || '').toLowerCase() === String(category).toLowerCase();
}

function stripTags(value) {
  return String(value).replace(/<[^>]*>/g, '');
}

function sanitizeText(value, maxLength) {
  return stripTags(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function averageRating(reviews) {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((total, review) => total + Number(review.stars || 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

function publicReview(review) {
  return {
    eventId: review.eventId,
    stars: review.stars,
    comment: review.comment,
    nickname: review.nickname,
    createdAt: review.createdAt
  };
}

function attachReviewStats(event, reviews) {
  const eventReviews = reviews
    .filter((review) => String(review.eventId) === String(event.id))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    ...event,
    avgRating: averageRating(eventReviews),
    reviewCount: eventReviews.length,
    latestReviews: eventReviews.slice(0, 3).map(publicReview)
  };
}

function buildMetrics(events) {
  const scores = events
    .map((event) => {
      const raw = String(event.nightlifeScore || '');
      const match = raw.match(/[\d.]+/);
      return match ? Number(match[0]) : NaN;
    })
    .filter((n) => !Number.isNaN(n));
  const vibe = scores.length
    ? `${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} / 10`
    : '—';

  return {
    totalEconomicImpact: 'Illustrative*',
    impactNote: 'Any dollar figures on event cards are illustrative student-prototype placeholders, not official statistics. They are not summed into a city-wide total.',
    activeEventsCount: events.length,
    nighttimeVibeIndex: vibe
  };
}

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    mode: store.mode,
    message: store.mode === 'mongo'
      ? 'Using MongoDB (Atlas or other Mongo connection).'
      : 'Using local JSON file fallback. Set MONGODB_URI in .env to use Atlas.'
  });
});

app.get('/api/events', async (req, res) => {
  try {
    const { month, category, search } = req.query;
    const [events, reviews] = await Promise.all([store.getEvents(), store.getReviews()]);
    const filtered = events.filter((event) =>
      eventOverlapsMonth(event, month) &&
      matchesCategory(event, category) &&
      matchesSearch(event, typeof search === 'string' ? search : '')
    );
    res.json({
      metrics: buildMetrics(filtered),
      events: filtered.map((event) => attachReviewStats(event, reviews))
    });
  } catch (err) {
    console.error('GET /api/events failed:', err);
    res.status(500).json({ error: 'Could not load events.' });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await store.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    const reviews = await store.getReviews(req.params.id);
    res.json({
      event: attachReviewStats(event, reviews),
      reviews: reviews.map(publicReview)
    });
  } catch (err) {
    console.error('GET /api/events/:id failed:', err);
    res.status(500).json({ error: 'Could not load event.' });
  }
});

app.get('/api/venues', async (req, res) => {
  try {
    const venues = await store.getVenues();
    res.json(venues);
  } catch (err) {
    console.error('GET /api/venues failed:', err);
    res.status(500).json({ error: 'Could not load venues.' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const { eventId } = req.query;
    if (eventId) {
      const event = await store.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found.' });
      }
    }
    const reviews = await store.getReviews(eventId);
    res.json({ reviews: reviews.map(publicReview) });
  } catch (err) {
    console.error('GET /api/reviews failed:', err);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const eventId = body.eventId == null ? '' : String(body.eventId).trim();
    const stars = Number.parseInt(body.stars, 10);
    const comment = sanitizeText(body.comment == null ? '' : String(body.comment), 300);
    const nicknameRaw = sanitizeText(body.nickname == null ? '' : String(body.nickname), 40);
    const nickname = nicknameRaw || 'Visitor';

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required.' });
    }
    const event = await store.getEventById(eventId);
    if (!event) {
      return res.status(400).json({ error: 'Event not found.' });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'stars must be an integer from 1 to 5.' });
    }
    if (!comment) {
      return res.status(400).json({ error: 'comment is required (maximum 300 characters).' });
    }

    const review = {
      eventId: event.id,
      stars,
      comment,
      nickname,
      createdAt: new Date().toISOString()
    };
    await store.addReview(review);
    const reviews = await store.getReviews(event.id);
    res.status(201).json({
      ok: true,
      review: publicReview(review),
      event: attachReviewStats(event, reviews),
      reviews: reviews.map(publicReview)
    });
  } catch (err) {
    console.error('POST /api/reviews failed:', err);
    res.status(500).json({ error: 'Could not save review.' });
  }
});

async function start() {
  await store.connect();
  await store.seedIfEmpty(seedEvents, seedVenues);
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database mode: ${store.mode}`);
    if (store.mode !== 'mongo') {
      console.log('To use MongoDB Atlas, copy .env.example to .env and set MONGODB_URI.');
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});