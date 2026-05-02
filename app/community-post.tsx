import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import { findPostById } from '@/constants/community-feed';
import {
  addCommunityComment,
  displayLikeCount,
  loadCommentsMap,
  loadLikedPostIds,
  toggleLikedPost,
} from '@/constants/community-storage';
import type { CommunityComment, CommunityPost } from '@/constants/community-types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function CommunityPostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = params.id ?? '';

  const [post, setPost] = React.useState<CommunityPost | null>(null);
  const [liked, setLiked] = React.useState(false);
  const [comments, setComments] = React.useState<CommunityComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commentText, setCommentText] = React.useState('');
  const [guestName, setGuestName] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!postId) {
      setPost(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await findPostById(postId);
      setPost(p ?? null);
      const likedIds = await loadLikedPostIds();
      setLiked(likedIds.has(postId));
      const map = await loadCommentsMap();
      setComments(map[postId] ?? []);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const onToggleLike = async () => {
    if (!postId) return;
    await toggleLikedPost(postId);
    setLiked(await loadLikedPostIds().then((s) => s.has(postId)));
  };

  const onSendComment = async () => {
    if (!postId || !commentText.trim()) return;
    setSending(true);
    try {
      const name = guestName.trim() || t('common.guest');
      const c = await addCommunityComment(postId, name, commentText);
      if (c) {
        setComments((prev) => [...prev, c]);
        setCommentText('');
      }
    } finally {
      setSending(false);
    }
  };

  const likesShown = post ? displayLikeCount(post, liked) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: 28 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }]}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#d3b275" />
            </View>
          ) : !post ? (
            <Text style={styles.err}>{t('community.postNotFound')}</Text>
          ) : (
            <>
              <Image source={{ uri: post.imageUrl }} style={styles.hero} />
              <Text style={styles.title}>{post.dishTitle}</Text>
              <Text style={styles.author}>{post.authorName}</Text>
              {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
              {post.recipePreview ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>{t('community.recipePreview')}</Text>
                  <Text style={styles.previewText}>{post.recipePreview}</Text>
                </View>
              ) : null}

              <View style={styles.likeRow}>
                <TouchableOpacity style={styles.likeBtn} onPress={onToggleLike}>
                  <MaterialIcons
                    name={liked ? 'favorite' : 'favorite-border'}
                    size={26}
                    color={liked ? '#e57373' : '#d3b275'}
                  />
                  <Text style={styles.likeCount}>
                    {t('community.likesCount', { count: likesShown })}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>
                {t('community.commentsHeading', { count: comments.length })}
              </Text>
              {comments.length === 0 ? (
                <Text style={styles.noComments}>{t('community.commentsEmpty')}</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{c.authorName}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                ))
              )}

              <Text style={styles.inputLabel}>{t('community.yourNameOptional')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('community.namePlaceholder')}
                placeholderTextColor="#666"
                value={guestName}
                onChangeText={setGuestName}
              />
              <Text style={styles.inputLabel}>{t('community.commentLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('community.commentPlaceholder')}
                placeholderTextColor="#666"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={onSendComment}
                disabled={sending || !commentText.trim()}>
                <Text style={styles.sendBtnText}>
                  {sending ? t('community.sending') : t('community.postComment')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
        <HomeExploreNav />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  back: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#d3b275',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  backText: { color: '#d3b275', fontSize: 14, fontWeight: '600' },
  loaderWrap: { paddingVertical: 60, alignItems: 'center' },
  err: { color: '#ff7f7f', fontSize: 15, textAlign: 'center', marginTop: 40 },
  hero: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  title: { color: '#d3b275', fontSize: 24, fontWeight: 'bold' },
  author: { color: '#ccc', fontSize: 14, marginTop: 8 },
  caption: { color: '#ddd', fontSize: 15, lineHeight: 22, marginTop: 12 },
  previewBox: {
    marginTop: 16,
    backgroundColor: '#141208',
    borderWidth: 1,
    borderColor: '#3d3420',
    borderRadius: 12,
    padding: 14,
  },
  previewLabel: { color: '#d3b275', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  previewText: { color: '#c8c8c8', fontSize: 14, lineHeight: 20 },
  likeRow: { marginTop: 18, marginBottom: 8 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeCount: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  noComments: { color: '#777', fontSize: 14, marginBottom: 12 },
  commentRow: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingVertical: 10,
  },
  commentAuthor: { color: '#d3b275', fontSize: 13, fontWeight: '600' },
  commentText: { color: '#ccc', fontSize: 14, marginTop: 4, lineHeight: 20 },
  inputLabel: { color: '#9a9a9a', fontSize: 12, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  sendBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: '#d3b275',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#111', fontSize: 16, fontWeight: '700' },
});
