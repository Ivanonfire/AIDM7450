const { buildMapsUrl } = require('./maps');

const seedVenues = [
  {
    id: 'central-harbourfront',
    name: 'Central Harbourfront Event Space',
    district: 'Central',
    type: 'Outdoor Waterfront',
    capacity: '30,000+',
    featuredEvents: 'Wine & Dine, Clockenflap',
    address: '9 Lung Wo Road, Central, Hong Kong Island',
    image: 'photos/central-waterfront-night.jpg'
  },
  {
    id: 'wkcd',
    name: 'West Kowloon Cultural District (WKCD)',
    district: 'Tsim Sha Tsui / West Kowloon',
    type: 'Cultural & Open Arts Space',
    capacity: '50,000+',
    featuredEvents: 'Cultural programmes and open-air events',
    address: '8 Austin Road West, West Kowloon, Kowloon',
    image: 'photos/xiqu-centre.jpg'
  },
  {
    id: 'lan-kwai-fong',
    name: 'Lan Kwai Fong (LKF)',
    district: 'Central',
    type: 'Nightlife & Dining Hub',
    capacity: '15,000',
    featuredEvents: 'Halloween street celebrations, Gourmet Month dining',
    address: 'Lan Kwai Fong, Central, Hong Kong Island',
    image: 'photos/lkf-night.jpg'
  }
].map((venue) => ({
  ...venue,
  mapsUrl: buildMapsUrl(venue.name, venue.address)
}));

module.exports = { seedVenues };
