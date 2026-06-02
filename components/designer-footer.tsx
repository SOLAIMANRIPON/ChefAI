import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

type Props = {
  /** Merge overrides (e.g. home screen positions credit higher with larger marginBottom) */
  style?: TextStyle;
};

/** Credit line at end of page content, above the tab bar (same placement as original craft screen) */
export function DesignerCreditLine({ style }: Props) {
  return (
    <Text style={[styles.text, style]} accessibilityRole="text">
      DEVELOPED BY NISHARGA LABS · 2026
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#444',
    fontSize: 10,
    letterSpacing: 4,
    marginTop: 20,
    marginBottom: 40,
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
  },
});
