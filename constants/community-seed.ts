import type { CommunityPost } from '@/constants/community-types';

/** Curated demo posts (English) — offline fallback; server feed can extend later */
export const COMMUNITY_SEED_POSTS: CommunityPost[] = [
  {
    id: 'seed-mishti-doi',
    authorName: 'Rumana',
    dishTitle: 'Mishti doi (sweet yogurt)',
    caption: 'Afternoon treat — set yogurt made at home.',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=80',
    recipePreview: 'Heat milk, cool, culture overnight 6–8 hours with a little starter and sugar to taste.',
    baseLikes: 42,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'seed-kacchi',
    authorName: 'Chef Omar',
    dishTitle: 'Kacchi biryani',
    caption: 'Weekend special — layered rice and mutton.',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d29c?w=900&q=80',
    recipePreview: 'Marinated meat, fried potato, rice layers — seal and cook on low (“dum”) until tender.',
    baseLikes: 128,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'seed-shorshe-ilish',
    authorName: 'Tanvir',
    dishTitle: 'Hilsa in mustard (shorshe ilish)',
    caption: 'Seasonal hilsa with mustard paste and green chili.',
    imageUrl: 'https://images.unsplash.com/photo-1580959378444-185327b9e82c?w=900&q=80',
    recipePreview: 'Marinate fish in mustard–nigella paste; finish with mustard oil and a gentle simmer.',
    baseLikes: 89,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'seed-fuchka',
    authorName: 'Neelu',
    dishTitle: 'Pani puri / fuchka',
    caption: 'Street-style crunch — tangy spiced water at home.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=900&q=80',
    recipePreview: 'Crisp shells, potato–chickpea filling, and chilled tangy jaljeera-style water.',
    baseLikes: 56,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];
