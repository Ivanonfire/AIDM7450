document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.getAttribute('data-page') || 'home';

    initBanner();
    initScrollEffects();

    initSchedule();

    if (page === 'home' || page === 'whats-happening') {
        initEventsPage();
        if (document.getElementById('year-round-grid')) {
            initSpotlight();
        }
    } else if (page === 'night-culture') {
        initNightPage();
    } else if (page === 'economic-impact') {
        initEconomyPage();
    } else if (page === 'venues') {
        initVenuesPage();
    }
});

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function starsText(avg) {
    const rounded = Math.round(Number(avg) || 0);
    return '★'.repeat(rounded) + '☆'.repeat(Math.max(0, 5 - rounded));
}

function formatReviewDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-HK', { dateStyle: 'medium', timeStyle: 'short' });
}

function isSafeMapsUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname === 'www.google.com' && parsed.pathname.startsWith('/maps/');
    } catch (_) {
        return false;
    }
}

function renderReviews(reviews) {
    const list = Array.isArray(reviews) ? reviews.slice(0, 1) : [];
    if (!list.length) {
        return '<p class="source-note">No visitor reviews yet. Be the first to rate this event.</p>';
    }
    return `<ul class="review-list">${list.map((review) => `
        <li class="review-item">
            <div class="review-meta">${escapeHtml(starsText(review.stars))} · ${escapeHtml(review.nickname || 'Visitor')} · ${escapeHtml(formatReviewDate(review.createdAt))}</div>
            <div>${escapeHtml(review.comment || '')}</div>
        </li>
    `).join('')}</ul>`;
}

function renderRatingSummary(event) {
    const count = Number(event.reviewCount) || 0;
    const avg = Number(event.avgRating) || 0;
    const label = count === 0 ? 'No ratings yet' : `${avg.toFixed(1)} (${count} review${count === 1 ? '' : 's'})`;
    return `
        <div class="card-rating">
            <span class="star-display" aria-hidden="true">${escapeHtml(starsText(avg))}</span>
            <span>${escapeHtml(label)}</span>
        </div>
    `;
}

function renderReviewForm(event) {
    const id = escapeHtml(event.id);
    return `
        <form class="review-form" data-event-id="${id}">
            <label>
                Your rating
                <select name="stars" required>
                    <option value="">Select 1–5 stars</option>
                    <option value="5">5 — Excellent</option>
                    <option value="4">4 — Great</option>
                    <option value="3">3 — Good</option>
                    <option value="2">2 — Fair</option>
                    <option value="1">1 — Poor</option>
                </select>
            </label>
            <label>
                Nickname (optional)
                <input type="text" name="nickname" maxlength="40" placeholder="Visitor">
            </label>
            <label>
                Comment
                <textarea name="comment" required maxlength="300" placeholder="Share a short comment (required, max 300 characters)"></textarea>
            </label>
            <button type="submit">Submit review</button>
            <p class="review-status" hidden></p>
        </form>
    `;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?auto=format&fit=crop&w=1200&q=80';

function renderEventCard(event) {
    const id = escapeHtml(event.id);
    const mapsUrl = isSafeMapsUrl(event.mapsUrl) ? event.mapsUrl : '';
    const mapsLink = mapsUrl
        ? `<a class="maps-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-map-location-dot"></i> Open in Google Maps</a>`
        : '';
    const saved = loadSchedule().some((item) => item.id === event.id);
    const address = event.address
        ? `<div class="card-address">${escapeHtml(event.address)}</div>`
        : '';
    const source = event.source
        ? `<p class="source-note">Source: ${escapeHtml(event.source)}</p>`
        : '';

    return `
        <div class="event-card" data-event-id="${escapeHtml(event.id)}">
            <div class="card-img-container">
                <img src="${escapeHtml(event.image || FALLBACK_IMAGE)}" alt="${escapeHtml(event.title || 'Event')}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
                <span class="card-badge">${escapeHtml(event.category || '')}</span>
            </div>
            <div class="card-content">
                <div class="card-date"><i class="fa-regular fa-calendar"></i> ${escapeHtml(event.date || '')}</div>
                <h3 class="card-title">${escapeHtml(event.title || '')}</h3>
                <div class="card-venue"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(event.venue || '')}</div>
                ${address}
                ${mapsLink}
                <p class="card-desc">${escapeHtml(event.description || '')}</p>
                <div class="card-footer-metrics">
                    <span>Economic Impact: <span class="eco-tag">${escapeHtml(event.economicImpact || 'Not estimated')}</span></span>
                    <span>Night Vibe: <span class="night-tag">${escapeHtml(event.nightlifeScore || '—')}</span></span>
                </div>
                ${renderRatingSummary(event)}
                <div class="latest-reviews">${renderReviews(event.latestReviews)}</div>
                <button type="button" class="add-schedule${saved ? ' added' : ''}" data-add-id="${id}">${saved ? 'Saved to my night' : 'Add to my night'}</button>
                ${renderReviewForm(event)}
                ${source}
            </div>
        </div>
    `;
}

const HOME_CARD_LIMIT = 3;

function renderEventCards(container, events) {
    if (!container) return;
    const button = document.getElementById('view-more-events');
    const isHome = document.body.getAttribute('data-page') === 'home';
    if (button) {
        button.hidden = true;
        button.textContent = 'View more';
        button.setAttribute('aria-expanded', 'false');
    }
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="no-results">No events found matching your criteria.</p>';
        return;
    }
    container.innerHTML = events.map((event, index) => {
        const card = renderEventCard(event);
        if (!isHome || index < HOME_CARD_LIMIT) return card;
        return card.replace('class="event-card"', 'class="event-card is-extra"');
    }).join('');
    if (button && isHome && events.length > HOME_CARD_LIMIT) {
        button.hidden = false;
    }
}

function updateEventCard(event) {
    const card = document.querySelector(`.event-card[data-event-id="${CSS.escape(String(event.id))}"]`);
    if (!card) return;
    const extra = card.classList.contains('is-extra');
    const revealed = card.classList.contains('is-revealed');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderEventCard(event);
    const next = wrapper.firstElementChild;
    if (extra) next.classList.add('is-extra');
    if (revealed) next.classList.add('is-revealed');
    card.replaceWith(next);
}

async function submitReview(form) {
    const status = form.querySelector('.review-status');
    const button = form.querySelector('button[type="submit"]');
    const eventId = form.getAttribute('data-event-id');
    const stars = form.stars.value;
    const comment = form.comment.value.trim();
    const nickname = form.nickname.value.trim();

    const showStatus = (type, message) => {
        if (!status) return;
        status.hidden = false;
        status.className = `review-status ${type}`;
        status.textContent = message;
    };

    if (!stars || !comment) {
        showStatus('err', 'Please choose a star rating and write a comment.');
        return;
    }

    button.disabled = true;
    showStatus('ok', 'Submitting…');

    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, stars: Number(stars), comment, nickname })
        });
        const data = await res.json();
        if (!res.ok) {
            showStatus('err', data.error || 'Could not save your review.');
            button.disabled = false;
            return;
        }
        if (data.event) {
            updateEventCard(data.event);
            const nextForm = document.querySelector(`.review-form[data-event-id="${CSS.escape(String(eventId))}"]`);
            const nextStatus = nextForm ? nextForm.querySelector('.review-status') : null;
            if (nextStatus) {
                nextStatus.hidden = false;
                nextStatus.className = 'review-status ok';
                nextStatus.textContent = 'Thanks — your review has been saved.';
            }
        }
    } catch (err) {
        console.error(err);
        showStatus('err', 'Network error. Please try again.');
        button.disabled = false;
    }
}

document.addEventListener('submit', (event) => {
    const form = event.target.closest('.review-form');
    if (!form) return;
    event.preventDefault();
    submitReview(form);
});

function bindMonthButtons(buttons, onChange) {
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((other) => other.classList.remove('active'));
            btn.classList.add('active');
            onChange(btn.getAttribute('data-month') || 'All');
        });
    });
}

function defaultMonthFromButtons(buttons, fallback) {
    const active = Array.from(buttons).find((btn) => btn.classList.contains('active'));
    if (active) return active.getAttribute('data-month') || fallback;
    if (buttons.length) return fallback;
    return 'All';
}

async function initEventsPage() {
    const eventsGrid = document.getElementById('events-grid');
    const searchInput = document.getElementById('search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const sortSelect = document.getElementById('sort-select');
    const monthButtons = document.querySelectorAll('.month-btn');
    const categoryPills = document.querySelectorAll('.pill');

    let currentMonth = defaultMonthFromButtons(monthButtons, 'Nov');
    let currentCategory = 'All';
    let currentSearch = '';
    let currentSort = 'default';
    let cachedEvents = [];
    let cachedMetrics = null;

    async function fetchAndRenderEvents() {
        try {
            const params = new URLSearchParams({
                month: currentSearch ? 'All' : currentMonth,
                category: currentCategory,
                search: currentSearch
            });
            const response = await fetch(`/api/events?${params.toString()}`);
            const data = await response.json();
            cachedEvents = data.events || [];
            rememberEvents(cachedEvents);
            cachedMetrics = data.metrics || null;
            applySortingAndRender();
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    function applySortingAndRender() {
        const eventsList = [...cachedEvents];
        if (currentSort === 'az') {
            eventsList.sort((a, b) => String(a.title).localeCompare(String(b.title)));
        } else if (currentSort === 'za') {
            eventsList.sort((a, b) => String(b.title).localeCompare(String(a.title)));
        } else if (currentSort === 'soonest') {
            eventsList.sort((a, b) => String(a.startDate || a.date || '').localeCompare(String(b.startDate || b.date || '')));
        }

        if (cachedMetrics) {
            const eco = document.getElementById('eco-impact');
            const count = document.getElementById('event-count');
            const vibe = document.getElementById('vibe-index');
            if (eco) eco.textContent = cachedMetrics.totalEconomicImpact;
            if (count) count.textContent = eventsList.length;
            if (vibe) vibe.textContent = cachedMetrics.nighttimeVibeIndex;
        }

        const sortLabels = {
            default: 'featured order',
            az: 'A to Z',
            za: 'Z to A',
            soonest: 'soonest first'
        };
        const heading = document.getElementById('results-count');
        if (heading) {
            const label = eventsList.length === 1 ? 'event' : 'events';
            heading.textContent = eventsList.length
                ? `Showing ${eventsList.length} ${label} · ${sortLabels[currentSort] || 'featured order'}`
                : 'No events match these filters';
        }
        const status = document.getElementById('search-status');
        if (status) {
            status.textContent = currentSearch
                ? `Results for “${currentSearch}” from every month, not only the month button above.`
                : '';
        }

        if (document.body.getAttribute('data-page') === 'whats-happening') {
            renderAgenda(eventsGrid, eventsList);
        } else {
            renderEventCards(eventsGrid, eventsList);
        }
    }

    const viewMore = document.getElementById('view-more-events');
    if (viewMore && eventsGrid) {
        viewMore.addEventListener('click', () => {
            const expanded = viewMore.getAttribute('aria-expanded') === 'true';
            const extras = eventsGrid.querySelectorAll('.event-card.is-extra');
            if (expanded) {
                extras.forEach((card) => {
                    card.classList.remove('is-revealed');
                    card.style.animationDelay = '';
                });
                viewMore.textContent = 'View more';
                viewMore.setAttribute('aria-expanded', 'false');
                return;
            }
            extras.forEach((card, index) => {
                card.style.animationDelay = `${index * 90}ms`;
                card.classList.add('is-revealed');
            });
            viewMore.textContent = 'View less';
            viewMore.setAttribute('aria-expanded', 'true');
        });
    }

    bindMonthButtons(monthButtons, (month) => {
        currentMonth = month;
        fetchAndRenderEvents();
        if (typeof window.refreshSpotlight === 'function') {
            window.refreshSpotlight(month);
        }
    });

    categoryPills.forEach((pill) => {
        pill.addEventListener('click', () => {
            categoryPills.forEach((other) => other.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.getAttribute('data-category') || 'All';
            fetchAndRenderEvents();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentSearch = query;
            fetchAndRenderEvents();

            if (!searchSuggestions) return;
            if (query.length > 0 && cachedEvents.length > 0) {
                const needle = query.toLowerCase();
                const matches = cachedEvents.filter((ev) =>
                    String(ev.title || '').toLowerCase().includes(needle) ||
                    String(ev.venue || '').toLowerCase().includes(needle)
                ).slice(0, 5);

                if (matches.length > 0) {
                    searchSuggestions.style.display = 'block';
                    searchSuggestions.innerHTML = matches.map((item) => `
                        <div class="suggestion-item" data-title="${escapeHtml(item.title)}">
                            <i class="fa-solid fa-magnifying-glass" style="margin-right: 8px; color:#888;"></i> ${escapeHtml(item.title)} <span style="color:#888; font-size:0.8rem;">(${escapeHtml(item.venue || '')})</span>
                        </div>
                    `).join('');
                    searchSuggestions.querySelectorAll('.suggestion-item').forEach((item) => {
                        item.addEventListener('click', () => {
                            searchInput.value = item.getAttribute('data-title') || '';
                            currentSearch = searchInput.value;
                            searchSuggestions.style.display = 'none';
                            fetchAndRenderEvents();
                        });
                    });
                } else {
                    searchSuggestions.style.display = 'none';
                }
            } else {
                searchSuggestions.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (searchSuggestions && !searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
                searchSuggestions.style.display = 'none';
            }
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applySortingAndRender();
        });
    }

    await fetchAndRenderEvents();
}

function initSpotlight() {
    const grid = document.getElementById('year-round-grid');
    if (!grid) return;

    const monthButtons = document.querySelectorAll('.month-btn');
    let currentMonth = defaultMonthFromButtons(monthButtons, 'Nov');

    async function renderYearRoundEvents(filterMonth = currentMonth) {
        currentMonth = filterMonth;
        try {
            const month = (!filterMonth || filterMonth === 'All' || filterMonth === 'Spotlight') ? 'All' : filterMonth;
            const res = await fetch(`/api/events?month=${encodeURIComponent(month)}`);
            const data = await res.json();
            let items = data.events || [];
            if (month === 'All') {
                const featured = items.filter((item) => item.featured);
                if (featured.length) items = featured;
            }

            if (!items.length) {
                grid.innerHTML = '<p style="grid-column: 1/-1; color: #777;">No featured events for this month.</p>';
                return;
            }

            grid.innerHTML = items.map((item) => `
                <div class="list-card">
                    <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.title || '')}" class="list-card-img">
                    <div class="list-card-info">
                        <h4 class="list-card-title">${escapeHtml(item.title || '')}</h4>
                        <div class="list-card-meta">
                            <strong>Date:</strong> ${escapeHtml(item.date || '')}
                        </div>
                        <div class="list-card-meta" style="margin-top: 4px;">
                            <strong>Organiser:</strong> ${escapeHtml(item.organiser || '—')}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Error loading spotlight events:', err);
        }
    }

    window.refreshSpotlight = renderYearRoundEvents;
    renderYearRoundEvents(currentMonth);
}

async function initSimpleEventsGrid(gridId) {
    const grid = document.getElementById(gridId);
    try {
        const res = await fetch('/api/events');
        const data = await res.json();
        renderEventCards(grid, data.events || []);
    } catch (err) {
        console.error(err);
    }
}

const NIGHT_NOTES = {
    'central-harbourfront': 'Best after dark for harbour festivals. Arrive before sunset if you want a front rail at Wine & Dine or Clockenflap.',
    'wkcd': 'Use the waterfront paths between shows. Outdoor programmes are easier to pair with a TST dinner than a second ticketed event.',
    'lan-kwai-fong': 'The street itself is the event on Halloween week and during Gourmet Month. Go after 9pm if you want the full crowd, earlier if you want a table.'
};

async function initNightPage() {
    const grid = document.getElementById('night-events-grid');
    try {
        const res = await fetch('/api/events?month=All');
        const data = await res.json();
        const nights = (data.events || [])
            .map((event) => ({ event, score: nightScore(event) }))
            .filter((item) => item.score >= 8)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.event);
        rememberEvents(data.events || []);
        renderNightBoard(grid, nights);
    } catch (err) {
        console.error(err);
    }
}

function nightScore(event) {
    const match = String(event.nightlifeScore || '').match(/[\d.]+/);
    return match ? Number(match[0]) : 0;
}

function parseImpactMillions(value) {
    const match = String(value || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    return Number(match[1]);
}

async function initEconomyPage() {
    const spend = document.getElementById('spend-chart');
    const pie = document.getElementById('category-chart');
    const table = document.getElementById('economy-table');
    try {
        const res = await fetch('/api/events?month=All');
        const data = await res.json();
        const events = data.events || [];
        if (spend) renderSpendBars(spend, events);
        if (pie) renderCategoryPie(pie, events);
        if (table) renderEconomyTable(table, events);
    } catch (err) {
        console.error(err);
    }
}

function renderSpendBars(container, events) {
    const rows = events
        .map((event) => ({ title: event.title, value: parseImpactMillions(event.economicImpact) }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value);
    if (!rows.length) {
        container.innerHTML = '<p>No illustrative dollar figures are stored for these events.</p>';
        return;
    }
    const max = Math.max(...rows.map((row) => row.value));
    container.innerHTML = rows.map((row) => `
        <div class="bar-row">
            <span>${escapeHtml(row.title)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (row.value / max) * 100)}%"></div></div>
            <strong>HK$${escapeHtml(String(row.value))}M</strong>
        </div>
    `).join('');
}

function renderCategoryPie(container, events) {
    const counts = {};
    events.forEach((event) => {
        const name = event.category || 'Other';
        counts[name] = (counts[name] || 0) + 1;
    });
    const colors = ['#e11d5a', '#1b3a6f', '#c9892d', '#0f766e', '#7c3aed'];
    const total = events.length || 1;
    let cursor = 0;
    const stops = Object.entries(counts).map(([name, count], index) => {
        const start = cursor;
        cursor += (count / total) * 100;
        return { name, count, color: colors[index % colors.length], start, end: cursor };
    });
    const gradient = stops.map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`).join(', ');
    container.innerHTML = `
        <div class="pie-wrap">
            <div class="pie" style="background: conic-gradient(${gradient})"></div>
            <ul class="pie-legend">
                ${stops.map((stop) => `<li><i class="swatch" style="background:${stop.color}"></i> ${escapeHtml(stop.name)} · ${stop.count}</li>`).join('')}
            </ul>
        </div>
    `;
}

function renderEconomyTable(container, events) {
    const rows = [...events].sort((a, b) => String(a.title).localeCompare(String(b.title)));
    container.innerHTML = `
        <table class="night-table">
            <thead><tr><th>Event</th><th>When</th><th>Illustrative impact</th><th>Night vibe</th></tr></thead>
            <tbody>
                ${rows.map((event) => `<tr>
                    <td>${escapeHtml(event.title)}</td>
                    <td>${escapeHtml(event.date || '')}</td>
                    <td>${escapeHtml(event.economicImpact || 'Not estimated')}</td>
                    <td>${escapeHtml(event.nightlifeScore || '—')}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

const eventCache = new Map();

function rememberEvents(events) {
    (events || []).forEach((event) => {
        if (event && event.id != null) eventCache.set(String(event.id), event);
    });
}

function renderAgenda(container, events) {
    if (!container) return;
    if (!events || !events.length) {
        container.innerHTML = '<p class="no-results">No events found matching your criteria.</p>';
        return;
    }
    container.innerHTML = events.map((event) => {
        const id = escapeHtml(event.id);
        return `
            <article class="agenda-row">
                <div class="agenda-date">${escapeHtml(event.date || '')}</div>
                <div>
                    <h3>${escapeHtml(event.title || '')}</h3>
                    <p>${escapeHtml(event.venue || '')}${event.district ? ` · ${escapeHtml(event.district)}` : ''}</p>
                </div>
                <button type="button" class="add-schedule" data-add-id="${id}">Add to my night</button>
            </article>
        `;
    }).join('');
}

function renderNightBoard(container, events) {
    if (!container) return;
    if (!events || !events.length) {
        container.innerHTML = '<p class="no-results">No high night-vibe events are stored yet.</p>';
        return;
    }
    const topicPhotos = {
        'clockenflap-2026': 'photos/central-waterfront-night.jpg',
        'wine-dine-2026': 'photos/harbour-night.jpg',
        'winterfest-2026': 'photos/tst-wanchai-night.jpg',
        'halloween-lkf-2026': 'photos/lkf-night.jpg'
    };
    container.innerHTML = events.map((event) => {
        const photo = topicPhotos[event.id] || event.image || FALLBACK_IMAGE;
        return `
        <article class="night-row">
            <img src="${escapeHtml(photo)}" alt="${escapeHtml(event.title || 'Hong Kong night event')}">
            <div class="night-score">${escapeHtml(event.nightlifeScore || '—')}</div>
            <div>
                <h3>${escapeHtml(event.title || '')}</h3>
                <p>${escapeHtml(event.date || '')} · ${escapeHtml(event.venue || '')}</p>
                <p>${escapeHtml(event.description || '')}</p>
            </div>
        </article>
    `;
    }).join('');
}

const SCHEDULE_KEY = 'nightpulse-schedule';

function loadSchedule() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function saveSchedule(items) {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items));
    renderSchedule();
    document.querySelectorAll('[data-add-id]').forEach((button) => {
        const id = button.getAttribute('data-add-id');
        const saved = items.some((item) => item.id === id);
        button.classList.toggle('added', saved);
        if (button.classList.contains('add-schedule') && !button.getAttribute('data-title')) {
            button.textContent = saved ? 'Saved to my night' : 'Add to my night';
        }
    });
}

function addToSchedule(eventId) {
    const card = document.querySelector(`.event-card[data-event-id="${CSS.escape(String(eventId))}"]`);
    const title = card ? card.querySelector('.card-title')?.textContent : '';
    const date = card ? card.querySelector('.card-date')?.textContent : '';
    const venue = card ? card.querySelector('.card-venue')?.textContent : '';
    const known = document.querySelector(`[data-add-id="${CSS.escape(String(eventId))}"]`);
    const cached = eventCache.get(String(eventId));
    const items = loadSchedule().filter((item) => item.id !== eventId);
    items.push({
        id: eventId,
        title: (cached?.title || known?.getAttribute('data-title') || title || 'Event').replace(/\s+/g, ' ').trim(),
        date: (cached?.date || date || '').replace(/\s+/g, ' ').trim(),
        venue: (cached?.venue || venue || '').replace(/\s+/g, ' ').trim(),
        address: cached?.address || '',
        startDate: cached?.startDate || '',
        endDate: cached?.endDate || cached?.startDate || ''
    });
    saveSchedule(items);
}

function renderSchedule() {
    const list = document.getElementById('schedule-list');
    const count = document.getElementById('schedule-count');
    const items = loadSchedule();
    if (count) {
        count.textContent = items.length
            ? `${items.length} stop${items.length === 1 ? '' : 's'} on your night.`
            : 'No events saved yet. Use “Add to my night” on a card.';
    }
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '';
        return;
    }
    list.innerHTML = items.map((item, index) => `
        <li class="schedule-item">
            <div>
                <strong>${index + 1}. ${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.date || '')} ${escapeHtml(item.venue || '')}</span>
            </div>
            <button type="button" data-remove-id="${escapeHtml(item.id)}">Remove</button>
        </li>
    `).join('');
}

function icsEscape(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function icsDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}${match[2]}${match[3]}` : '';
}

function nextIcsDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    date.setUTCDate(date.getUTCDate() + 1);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function buildIcs(items) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NightPulse//Hong Kong Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];
    items.forEach((item) => {
        const start = icsDate(item.startDate);
        const end = nextIcsDate(item.endDate || item.startDate);
        if (!start || !end) return;
        lines.push(
            'BEGIN:VEVENT',
            `UID:${icsEscape(item.id)}@nightpulse.local`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${start}`,
            `DTEND;VALUE=DATE:${end}`,
            `SUMMARY:${icsEscape(item.title)}`,
            `LOCATION:${icsEscape([item.venue, item.address].filter(Boolean).join(', '))}`,
            'END:VEVENT'
        );
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

async function hydrateScheduleDates() {
    if (!eventCache.size) {
        const res = await fetch('/api/events?month=All');
        const data = await res.json();
        rememberEvents(data.events || []);
    }
    const items = loadSchedule().map((item) => {
        const event = eventCache.get(String(item.id));
        if (!event) return item;
        return {
            ...item,
            title: item.title || event.title,
            date: event.date || item.date,
            venue: event.venue || item.venue,
            address: event.address || item.address || '',
            startDate: event.startDate || item.startDate || '',
            endDate: event.endDate || event.startDate || item.endDate || ''
        };
    });
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items));
    renderSchedule();
    return items;
}

function downloadIcs(items) {
    const ics = buildIcs(items);
    const file = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hong-kong-night.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function addScheduleToCalendar() {
    const count = document.getElementById('schedule-count');
    const items = await hydrateScheduleDates();
    const dated = items.filter((item) => icsDate(item.startDate));
    if (!dated.length) {
        if (count) count.textContent = 'Add at least one event before opening your calendar.';
        return;
    }
    downloadIcs(dated);
    if (count) {
        count.textContent = 'Calendar file downloaded. Open it to add these dates in Calendar, Google Calendar, or Outlook.';
    }
}

function initSchedule() {
    renderSchedule();
    hydrateScheduleDates().catch((err) => console.error(err));
    const saveButton = document.getElementById('add-calendar');
    const clearButton = document.getElementById('clear-schedule');
    if (saveButton) saveButton.addEventListener('click', () => addScheduleToCalendar());
    if (clearButton) {
        clearButton.addEventListener('click', () => saveSchedule([]));
    }
    document.addEventListener('click', (event) => {
        const add = event.target.closest('[data-add-id]');
        if (add && !add.closest('.review-form')) {
            addToSchedule(add.getAttribute('data-add-id'));
            return;
        }
        const remove = event.target.closest('[data-remove-id]');
        if (remove) {
            const id = remove.getAttribute('data-remove-id');
            saveSchedule(loadSchedule().filter((item) => item.id !== id));
        }
    });
}

async function initVenuesPage() {
    const grid = document.getElementById('venues-grid');
    if (!grid) return;
    try {
        const res = await fetch('/api/venues');
        const venues = await res.json();
        const venuePhotos = {
            'central-harbourfront': 'photos/central-waterfront-night.jpg',
            'wkcd': 'photos/xiqu-centre.jpg',
            'lan-kwai-fong': 'photos/lkf-night.jpg'
        };
        grid.innerHTML = venues.map((venue) => {
            const photo = venuePhotos[venue.id] || venue.image || FALLBACK_IMAGE;
            const mapsUrl = isSafeMapsUrl(venue.mapsUrl) ? venue.mapsUrl : '';
            const mapsLink = mapsUrl
                ? `<a class="maps-link venues-maps" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-map-location-dot"></i> Open in Google Maps</a>`
                : '';
            const address = venue.address ? `<p class="card-address">${escapeHtml(venue.address)}</p>` : '';
            return `
                <div class="event-card">
                    <div class="card-img-container">
                        <img src="${escapeHtml(photo)}" alt="${escapeHtml(venue.name || '')}">
                        <span class="card-badge">${escapeHtml(venue.type || '')}</span>
                    </div>
                    <div class="card-content">
                        <div class="card-date"><i class="fa-solid fa-map-pin"></i> ${escapeHtml(venue.district || '')}</div>
                        <h3 class="card-title">${escapeHtml(venue.name || '')}</h3>
                        ${address}
                        ${mapsLink}
                        <p class="card-desc"><strong>Capacity:</strong> ${escapeHtml(venue.capacity || '')}</p>
                        <p class="card-desc"><strong>Key events:</strong> ${escapeHtml(venue.featuredEvents || '')}</p>
                        <p class="venue-note">${escapeHtml(NIGHT_NOTES[venue.id] || 'A useful stop on a harbour night. Open the map before you travel.')}</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

function initBanner() {
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.banner-dots .dot');
    if (!slides.length) return;

    let currentSlide = 0;
    let bannerInterval;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (dots[i]) dots[i].classList.remove('active');
        });
        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        currentSlide = index;
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    bannerInterval = setInterval(nextSlide, 5000);

    dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
            clearInterval(bannerInterval);
            const index = parseInt(e.target.getAttribute('data-index'), 10);
            if (!Number.isNaN(index)) showSlide(index);
            bannerInterval = setInterval(nextSlide, 5000);
        });
    });
}

function initScrollEffects() {
    const animatedElements = document.querySelectorAll('.scroll-animate');
    const scrollVideo = document.getElementById('scroll-driven-video');

    if (animatedElements.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.15 });
        animatedElements.forEach((el) => observer.observe(el));
    }

    if (!scrollVideo) return;

    let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    window.addEventListener('scroll', () => {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        const videoRect = scrollVideo.getBoundingClientRect();
        if (videoRect.top < window.innerHeight && videoRect.bottom > 0) {
            if (st > lastScrollTop) {
                scrollVideo.playbackRate = 1.2;
                scrollVideo.play().catch(() => {});
            } else if (scrollVideo.currentTime > 0.5) {
                scrollVideo.currentTime -= 0.15;
            }
        }
        lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });
}

// --- Mobile Hamburger Navigation Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const open = navLinks.classList.toggle('mobile-active');
            menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            const icon = menuToggle.querySelector('i');
            if (open) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });
    }
});