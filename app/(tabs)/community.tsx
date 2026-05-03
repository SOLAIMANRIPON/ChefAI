import { DesignerCreditLine } from '@/components/designer-footer';
import { loadCommunityFeed } from '@/constants/community-feed';
import {
  displayLikeCount,
  loadCommentsMap,
  loadLikedPostIds,
  toggleLikedPost,
} from '@/constants/community-storage';
import type { CommunityPost } from '@/constants/community-types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function CommunityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [posts, setPosts] = React.useState<CommunityPost[]>([]);
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadAll = React.useCallback(async () => {
    try {
      const [feed, likedIds, cmap] = await Promise.all([
        loadCommunityFeed(),
        loadLikedPostIds(),
        loadCommentsMap(),
      ]);
      setPosts(feed);
      setLiked(likedIds);
      const counts: Record<string, number> = {};
      for (const [pid, arr] of Object.entries(cmap)) {
        counts[pid] = arr.length;
      }
      setCommentCounts(counts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadAll();
    }, [loadAll])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const onToggleLike = async (postId: string) => {
    await toggleLikedPost(postId);
    setLiked(await loadLikedPostIds());
  };

  const openPost = (id: string) => {
    router.push({ pathname: '/community-post', params: { id } });
  };

  const renderItem = ({ item }: { item: CommunityPost }) => {
    const isLiked = liked.has(item.id);
    const likesShown = displayLikeCount(item, isLiked);
    const cc = commentCounts[item.id] ?? 0;

    return (
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => openPost(item.id)}>
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => openPost(item.id)}>
            <Text style={styles.dishTitle} numberOfLines={2}>
              {item.dishTitle}
            </Text>
            <Text style={styles.author}>{item.authorName}</Text>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
            ) : null}
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onToggleLike(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons
                name={isLiked ? 'favorite' : 'favorite-border'}
                size={22}
                color={isLiked ? '#e57373' : '#a8a8a8'}
              />
              <Text style={styles.actionCount}>{likesShown}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openPost(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="chat-bubble-outline" size={20} color="#a8a8a8" />
              <Text style={styles.actionCount}>{cc}</Text>
            </TouchableOpacity>
            {item.isLocal ? (
              <Text style={styles.localBadge}>{t('community.yourPost')}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{t('community.title')}</Text>
          <Text style={styles.subtitle}>{t('community.subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.shareFab}
          onPress={() => router.push('/community-share')}
          activeOpacity={0.85}>
          <MaterialIcons name="add-a-photo" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#d3b275" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d3b275" />}
          ListEmptyComponent={<Text style={styles.empty}>{t('community.empty')}</Text>}
          ListFooterComponent={DesignerCreditLine}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  headerTextWrap: { flex: 1 },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#9a9a9a', fontSize: 13, marginTop: 6, lineHeight: 18 },
  shareFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d3b275',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 18,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 220, backgroundColor: '#1a1a1a' },
  cardBody: { padding: 14 },
  dishTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  author: { color: '#d3b275', fontSize: 13, marginTop: 6 },
  caption: { color: '#a8a8a8', fontSize: 13, marginTop: 8, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 18,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: '#ccc', fontSize: 14 },
  localBadge: {
    marginLeft: 'auto',
    color: '#7cb87c',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: { color: '#8f8f8f', fontSize: 14, textAlign: 'center', marginTop: 40 },
});
