import React from 'react';
import { StyleSheet, Text } from 'react-native';

/** Credit line at end of page content, above the tab bar (same placement as original craft screen) */
export function DesignerCreditLine() {
  return (
    <Text style={styles.text} accessibilityRole="text">
      DESIGNED BY SOLAIMAN • 2026
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
