function buildMapsUrl(venue, address) {
  const query = [venue, address, 'Hong Kong'].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

module.exports = { buildMapsUrl };
