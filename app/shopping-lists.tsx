import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import { loadSavedRecipes, type StoredSavedRecipe } from '@/constants/saved-recipes-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ShoppingListsHubScreen() {
  const router = useRouter();
  const [saved, setSaved] = React.useState<StoredSavedRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const list = await loadSavedRecipes();
          if (!cancelled) setSaved(list);
        } catch {
          if (!cancelled) setSaved([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 28 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Shopping Lists</Text>
        <Text style={styles.blurb}>
          Pick a saved recipe to auto-generate a digital shopping list. Tap items as you buy
          them to keep track.
        </Text>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color="#d3b275" />
          </View>
        ) : saved.length === 0 ? (
          <Text style={styles.empty}>No saved recipes yet. Save one from the recipe details screen.</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Saved recipes — open shopping list</Text>
            {saved.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/shopping-list', params: { recipeId: item.id } })
                }>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.dishName}</Text>
                  <Text style={styles.rowMeta}>{item.cuisine ?? ''}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <DesignerCreditLine />
      </ScrollView>
      <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scroll: { padding: 20 },
  back: {
    alignSelf: 'flex-start',
    marginTop: 24,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d3b275',
    backgroundColor: '#111',
  },
  backText: { color: '#d3b275', fontWeight: '600', fontSize: 14 },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  blurb: { color: '#9a9a9a', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  loader: { paddingVertical: 40, alignItems: 'center' },
  empty: { color: '#8f8f8f', fontSize: 14, lineHeight: 22 },
  card: {
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
  },
  sectionTitle: { color: '#d3b275', fontWeight: '700', marginBottom: 10, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowMeta: { color: '#8f8f8f', fontSize: 12, marginTop: 4 },
  chev: { color: '#d3b275', fontSize: 22, fontWeight: '300' },
});
