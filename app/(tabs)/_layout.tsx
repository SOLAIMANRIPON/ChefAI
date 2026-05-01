import { Tabs } from 'expo-router';
import React from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // নীল কালার বদলে আপনার সেই নির্দিষ্ট গোল্ডেন কালার দেওয়া হলো
        tabBarActiveTintColor: '#c9af80', 
        tabBarInactiveTintColor: '#444444', // ইনঅ্যাক্টিভ অবস্থায় ডার্ক অ্যাশ
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000', // নিচের বারটি এখন পিওর ব্ল্যাক
          borderTopWidth: 0,          // কোনো বর্ডার থাকবে না, একদম ক্লিন লুক
          height: 65,                 // বারের হাইট একটু বাড়ানো হলো প্রিমিয়াম ফিনিশের জন্য
          paddingBottom: 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}