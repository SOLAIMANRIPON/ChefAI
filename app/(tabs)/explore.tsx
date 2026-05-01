import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SAVED_RECIPES_STORAGE_KEY = 'chefai_saved_recipes_v1';
const RECENT_VIEWS_STORAGE_KEY = 'chefai_recent_views_v1';
const RECENT_SEARCHES_STORAGE_KEY = 'chefai_recent_searches_v1';

type SavedRecipe = {
  id: string;
  dishName: string;
  ingredient?: string;
  cuisine?: string;
  language?: string;
};

type RecentView = {
  id: string;
  recipeName: string;
  ingredient?: string;
  cuisine?: string;
  language?: string;
};

type RecentSearch = {
  query: string;
  cuisine: string;
  language: string;
  at: string;
};

export default function ExploreScreen() {
  const router = useRouter();
  const [savedRecipes, setSavedRecipes] = React.useState<SavedRecipe[]>([]);
  const [recentViews, setRecentViews] = React.useState<RecentView[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearch[]>([]);

  const loadExploreData = React.useCallback(async () => {
    try {
      const [savedRaw, viewsRaw, searchesRaw] = await Promise.all([
        AsyncStorage.getItem(SAVED_RECIPES_STORAGE_KEY),
        AsyncStorage.getItem(RECENT_VIEWS_STORAGE_KEY),
        AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY),
      ]);
      setSavedRecipes(savedRaw ? JSON.parse(savedRaw) : []);
      setRecentViews(viewsRaw ? JSON.parse(viewsRaw) : []);
      setRecentSearches(searchesRaw ? JSON.parse(searchesRaw) : []);
    } catch {
      setSavedRecipes([]);
      setRecentViews([]);
      setRecentSearches([]);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadExploreData();
    }, [loadExploreData])
  );

  const trendingDishes = React.useMemo(() => {
    const counts: Record<string, number> = {};
    recentViews.forEach((item) => {
      const key = item.recipeName?.trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [recentViews]);

  const openRecipe = (recipeName: string, ingredient = '', cuisine = 'Bangladeshi', language = 'বাংলা') => {
    router.push({
      pathname: '/recipe-details',
      params: {
        recipeName,
        ingredient,
        selectedCuisine: cuisine,
        selectedLang: language,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>Saved recipes, trending dishes, and recent history</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Recipes</Text>
        {savedRecipes.length === 0 ? (
          <Text style={styles.emptyText}>No saved recipes yet. Save from recipe details.</Text>
        ) : (
          savedRecipes.slice(0, 12).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() => openRecipe(item.dishName, item.ingredient, item.cuisine, item.language)}>
              <Text style={styles.itemTitle}>{item.dishName}</Text>
              <Text style={styles.itemMeta}>
                {item.cuisine || 'Cuisine'} | {item.language || 'Language'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Dishes</Text>
        {trendingDishes.length === 0 ? (
          <Text style={styles.emptyText}>No trending data yet. Open more recipes to build trends.</Text>
        ) : (
          trendingDishes.map((name) => (
            <TouchableOpacity key={name} style={styles.item} onPress={() => openRecipe(name)}>
              <Text style={styles.itemTitle}>{name}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent History</Text>
        {recentSearches.length === 0 ? (
          <Text style={styles.emptyText}>No recent searches yet.</Text>
        ) : (
          recentSearches.slice(0, 12).map((item, idx) => (
            <TouchableOpacity
              key={`${item.query}-${idx}`}
              style={styles.item}
              onPress={() => router.push({ pathname: '/', params: { ingredient: item.query } })}>
              <Text style={styles.itemTitle}>{item.query}</Text>
              <Text style={styles.itemMeta}>
                {item.cuisine} | {item.language}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#000', paddingBottom: 80 },
  title: { color: '#d3b275', fontSize: 30, fontWeight: 'bold', marginTop: 50 },
  subtitle: { color: '#9a9a9a', fontSize: 13, marginTop: 6, marginBottom: 20 },
  section: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  item: { borderTopWidth: 1, borderTopColor: '#222', paddingVertical: 10 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemMeta: { color: '#8f8f8f', fontSize: 12, marginTop: 4 },
  emptyText: { color: '#8f8f8f', fontSize: 13, paddingVertical: 6 },
});
