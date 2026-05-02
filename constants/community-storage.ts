import type { CommunityComment, CommunityPost } from '@/constants/community-types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LIKED_IDS_KEY = 'chefai_community_liked_v1';
const COMMENTS_KEY = 'chefai_community_comments_v1';
const USER_POSTS_KEY = 'chefai_community_user_posts_v1';

const MAX_USER_POSTS = 30;
const MAX_COMMENT_LEN = 400;
const MAX_NAME_LEN = 80;
const MAX_TITLE_LEN = 200;
const MAX_CAPTION_LEN = 600;
const MAX_PREVIEW_LEN = 800;
const MAX_COMMENTS_PER_POST = 40;
const MAX_IMAGE_URI_LEN = 8000;

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export async function loadLikedPostIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(LIKED_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export async function setLikedPostIds(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(LIKED_IDS_KEY, JSON.stringify([...ids]));
}

export async function toggleLikedPost(postId: string): Promise<boolean> {
  const set = await loadLikedPostIds();
  if (set.has(postId)) {
    set.delete(postId);
    await setLikedPostIds(set);
    return false;
  }
  set.add(postId);
  await setLikedPostIds(set);
  return true;
}

type CommentsMap = Record<string, CommunityComment[]>;

export async function loadCommentsMap(): Promise<CommentsMap> {
  try {
    const raw = await AsyncStorage.getItem(COMMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CommentsMap;
  } catch {
    return {};
  }
}

export async function addCommunityComment(
  postId: string,
  authorName: string,
  text: string
): Promise<CommunityComment | null> {
  const t = clip(text.trim(), MAX_COMMENT_LEN);
  if (!t) return null;
  const name = clip(authorName.trim() || 'Guest', MAX_NAME_LEN);
  const comment: CommunityComment = {
    id: `c${Date.now().toString(36)}x${Math.random().toString(36).slice(2, 9)}`,
    authorName: name,
    text: t,
    createdAt: new Date().toISOString(),
  };
  const map = await loadCommentsMap();
  const prev = map[postId] ?? [];
  const next = [...prev, comment].slice(-MAX_COMMENTS_PER_POST);
  map[postId] = next;
  await AsyncStorage.setItem(COMMENTS_KEY, JSON.stringify(map));
  return comment;
}

export async function loadUserPosts(): Promise<CommunityPost[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_POSTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((p: unknown) => p && typeof p === 'object' && 'id' in (p as object)) as CommunityPost[];
  } catch {
    return [];
  }
}

export async function addUserPost(post: Omit<CommunityPost, 'isLocal'>): Promise<CommunityPost> {
  const full: CommunityPost = {
    ...post,
    dishTitle: clip(post.dishTitle, MAX_TITLE_LEN),
    authorName: clip(post.authorName, MAX_NAME_LEN),
    caption: post.caption != null ? clip(post.caption, MAX_CAPTION_LEN) : undefined,
    recipePreview:
      post.recipePreview != null ? clip(post.recipePreview, MAX_PREVIEW_LEN) : undefined,
    imageUrl: clip(post.imageUrl, MAX_IMAGE_URI_LEN),
    isLocal: true,
  };
  const list = await loadUserPosts();
  const next = [full, ...list].slice(0, MAX_USER_POSTS);
  await AsyncStorage.setItem(USER_POSTS_KEY, JSON.stringify(next));
  return full;
}

export function displayLikeCount(post: CommunityPost, liked: boolean): number {
  return post.baseLikes + (liked ? 1 : 0);
}
