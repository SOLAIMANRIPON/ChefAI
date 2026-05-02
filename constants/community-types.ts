export type CommunityComment = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  authorName: string;
  dishTitle: string;
  caption?: string;
  imageUrl: string;
  /** Short preview text — community recipe highlight */
  recipePreview?: string;
  /** Baseline like count (seed/server); user like adds +1 in UI */
  baseLikes: number;
  createdAt: string;
  /** User-created on this device */
  isLocal?: boolean;
};
