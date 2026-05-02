import { addUserPost } from '@/constants/community-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function CommunityShareScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [authorName, setAuthorName] = React.useState('');
  const [dishTitle, setDishTitle] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [recipePreview, setRecipePreview] = React.useState('');
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('community.alertPermissionTitle'), t('community.alertPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onPublish = async () => {
    const title = dishTitle.trim();
    if (!title) {
      Alert.alert(t('community.alertMissingTitle'), t('community.alertMissingBody'));
      return;
    }
    if (!imageUri) {
      Alert.alert(t('community.alertPhotoTitle'), t('community.alertPhotoBody'));
      return;
    }
    setSaving(true);
    try {
      const id = `u${Date.now().toString(36)}x${Math.random().toString(36).slice(2, 10)}`;
      const name = authorName.trim() || t('community.defaultAuthor');
      await addUserPost({
        id,
        authorName: name,
        dishTitle: title,
        caption: caption.trim() || undefined,
        recipePreview: recipePreview.trim() || undefined,
        imageUrl: imageUri,
        baseLikes: 0,
        createdAt: new Date().toISOString(),
      });
      router.replace('/community');
    } catch {
      Alert.alert(t('community.alertSaveFailTitle'), t('community.alertSaveFailBody'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('community.shareTitle')}</Text>
        <Text style={styles.sub}>{t('community.shareSubtitle')}</Text>

        <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.85}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialIcons name="add-a-photo" size={48} color="#555" />
              <Text style={styles.photoHint}>{t('community.photoHint')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>{t('community.yourName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('community.namePlaceholderShare')}
          placeholderTextColor="#666"
          value={authorName}
          onChangeText={setAuthorName}
        />

        <Text style={styles.label}>{t('community.dishName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('community.dishPlaceholder')}
          placeholderTextColor="#666"
          value={dishTitle}
          onChangeText={setDishTitle}
        />

        <Text style={styles.label}>{t('community.caption')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('community.captionPlaceholder')}
          placeholderTextColor="#666"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Text style={styles.label}>{t('community.recipeTeaser')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('community.recipeTeaserPlaceholder')}
          placeholderTextColor="#666"
          value={recipePreview}
          onChangeText={setRecipePreview}
          multiline
        />

        <TouchableOpacity
          style={[styles.publish, saving && styles.publishDisabled]}
          onPress={onPublish}
          disabled={saving}>
          <Text style={styles.publishText}>
            {saving ? t('community.posting') : t('community.postToCommunity')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 40 },
  back: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
  },
  backText: { color: '#d3b275', fontSize: 15, fontWeight: '600' },
  title: { color: '#d3b275', fontSize: 26, fontWeight: 'bold' },
  sub: { color: '#9a9a9a', fontSize: 13, marginTop: 8, lineHeight: 18, marginBottom: 20 },
  photoBox: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoHint: { color: '#777', fontSize: 14 },
  label: { color: '#d3b275', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  publish: {
    backgroundColor: '#d3b275',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  publishDisabled: { opacity: 0.65 },
  publishText: { color: '#111', fontSize: 17, fontWeight: '700' },
});
