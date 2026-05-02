import { COMMUNITY_SEED_POSTS } from '@/constants/community-seed';
import { loadUserPosts } from '@/constants/community-storage';
import type { CommunityPost } from '@/constants/community-types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function apiOrigin(base: string): string {
  return base.replace(/\/+$/, '');
}

function isPost(x: unknown): x is CommunityPost {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.authorName === 'string' &&
    typeof o.dishTitle === 'string' &&
    typeof o.imageUrl === 'string' &&
    typeof o.baseLikes === 'number' &&
    typeof o.createdAt === 'string'
  );
}

/**
 * Merges remote feed (optional), seed posts, and device user posts.
 * Newest first.
 */
export async function loadCommunityFeed(): Promise<CommunityPost[]> {
  let remote: CommunityPost[] = [];
  if (API_BASE_URL) {
    try {
      const url = `${apiOrigin(API_BASE_URL)}/api/v1/community/feed`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const j = await res.json();
        const posts = j?.posts;
        if (Array.isArray(posts)) {
          remote = posts.filter(isPost);
        }
      }
    } catch {
      /* offline / server down — seed + local only */
    }
  }

  const userPosts = await loadUserPosts();
  const byId = new Map<string, CommunityPost>();

  for (const p of COMMUNITY_SEED_POSTS) {
    byId.set(p.id, p);
  }
  for (const p of remote) {
    byId.set(p.id, p);
  }
  for (const p of userPosts) {
    byId.set(p.id, p);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function findPostById(id: string): Promise<CommunityPost | undefined> {
  const feed = await loadCommunityFeed();
  return feed.find((p) => p.id === id);
}
