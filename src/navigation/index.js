import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import ReelsScreen from "../screens/ReelsScreen";
import SearchScreen from "../screens/SearchScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReelUploadScreen from "../screens/ReelUploadScreen";
import ChatScreen from "../screens/ChatScreen";
import CoupleChatScreen from "../screens/CoupleChatScreen";
import NexaScreen from "../screens/NexaScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: "#05070b", card: "#070a0f", border: "#121923", primary: "#247cff" } };

const ICONS = {
  Home: ["home", "home-outline"],
  Reels: ["play-circle", "play-circle-outline"],
  Search: ["search", "search-outline"],
  Alerts: ["notifications", "notifications-outline"],
  Profile: ["person", "person-outline"],
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#247cff",
        tabBarInactiveTintColor: "#687486",
        tabBarStyle: { backgroundColor: "#070a0f", borderTopColor: "#121923", height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ me: true }} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { user, booting } = useAuth();
  if (booting) {
    return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color="#247cff" /></View>;
  }
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#05070b" } }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="UserProfile" component={ProfileScreen} />
            <Stack.Screen name="ReelUpload" component={ReelUploadScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="CoupleChat" component={CoupleChatScreen} />
            <Stack.Screen name="Nexa" component={NexaScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
