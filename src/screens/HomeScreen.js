import React, { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { EP } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import CreateSheet from "../components/CreateSheet";
import { Avatar, Empty } from "../components/ui";

// backend categories are "friend" | "family" | null
const FILTERS = [
  { key: "all", label: "All Connected", icon: "people-outline" },
  { key: "family", label: "Family", icon: "heart-outline" },
  { key: "friend", label: "Friends", icon: "person-outline" },
];

export default function HomeScreen({ navigation }) {
  const { signOut } = useAuth();
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState(false);
  const [create, setCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState(null); // person whose category is being edited
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const c = await api(EP.connections);
      setPeople(c.connections || c.users || []);
      setError("");
    } catch (e) { setError(e.message); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = people.filter((p) => filter === "all" || p.category === filter);
  const title = FILTERS.find((f) => f.key === filter).label;

  const pick = (type) => {
    setCreate(false);
    if (type === "reel") navigation.navigate("ReelUpload");
    else navigation.navigate("Profile", { me: true, edit: Date.now() });
  };

  const setCategory = async (person, category) => {
    setPicked(null);
    try {
      if (category) {
        await api(EP.connectionCategory, { method: "POST", body: { connected_user_id: person.user_id, category } });
      } else {
        await api(EP.connectionCategoryRemove(person.user_id), { method: "DELETE" });
      }
      setPeople((l) => l.map((x) => (x.user_id === person.user_id ? { ...x, category } : x)));
    } catch (e) { setError(e.message); }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="h-14 flex-row items-center justify-between px-3.5">
        <Pressable onPress={() => setMenu(true)} className="w-10 h-10 items-center justify-center">
          <Ionicons name="menu" size={26} color="#a7b1bf" />
        </Pressable>
        <Text style={{ fontSize: 21, fontWeight: "800", letterSpacing: -0.5 }}>
          <Text className="text-brand">UTA</Text><Text className="text-white">NEXA</Text>
        </Text>
        <Pressable onPress={() => setCreate(true)} className="w-10 h-10 items-center justify-center">
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(i) => String(i.user_id)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#247cff"
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View className="px-3.5 pt-1">
            {error ? <Text className="text-danger text-xs mb-2">{error}</Text> : null}
            <View className="flex-row justify-between items-center mt-2 mb-2.5">
              <Text className="text-ink text-[17px] font-semibold">{title}</Text>
              <Text className="text-brand text-xs font-semibold">{shown.length}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("Chat", { user: item })}
            onLongPress={() => setPicked(item)}
            className="flex-row items-center mx-3.5 mb-2.5 p-3 rounded-xl border border-line bg-surface">
            <Pressable onPress={() => navigation.navigate("UserProfile", { userId: item.user_id })}>
              <Avatar uri={item.profile_photo} name={item.name || item.username} size={48} />
            </Pressable>
            <View className="flex-1 ml-3">
              <Text className="text-ink text-[14px] font-semibold" numberOfLines={1}>{item.name || item.username}</Text>
              <Text className="text-muted text-[11px] mt-0.5" numberOfLines={1}>
                @{item.username}{item.category ? `  ·  ${item.category}` : ""}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate("CoupleChat", { user: item })} hitSlop={8} className="mr-4">
              <Ionicons name="heart-outline" size={20} color="#ed80dc" />
            </Pressable>
            <Ionicons name="chatbubble-outline" size={20} color="#247cff" />
          </Pressable>
        )}
        ListEmptyComponent={<Empty text={filter === "all"
          ? "No connections yet. Use Search to find people and send connection requests."
          : "Nobody here yet. Long-press a connection to mark them as Friend or Family."} />}
      />

      {/* NEXA floating button */}
      <Pressable onPress={() => navigation.navigate("Nexa")}
        className="absolute right-4 bottom-4 w-14 h-14 rounded-full bg-brand items-center justify-center">
        <Text className="text-white text-2xl">✦</Text>
      </Pressable>

      <CreateSheet visible={create} onClose={() => setCreate(false)} onPick={pick} />

      {/* category picker (long-press a connection) */}
      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <Pressable className="flex-1 bg-black/60 justify-center px-8" onPress={() => setPicked(null)}>
          <Pressable className="bg-[#0b1424] border border-white/10 rounded-2xl p-4" onPress={() => {}}>
            <Text className="text-white text-base font-bold mb-3" numberOfLines={1}>{picked?.name || picked?.username}</Text>
            {[["friend", "Mark as Friend"], ["family", "Mark as Family"], [null, "Remove category"]].map(([k, l]) => (
              <Pressable key={String(k)} onPress={() => setCategory(picked, k)}
                className={`h-11 justify-center px-3 rounded-xl mb-1 ${picked?.category === k ? "bg-[#102f4b]" : ""}`}>
                <Text className={`text-[14px] ${k === null ? "text-danger" : "text-ink"}`}>{l}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable className="flex-1 bg-black/60 flex-row" onPress={() => setMenu(false)}>
          <Pressable className="w-[270px] max-w-[82%] h-full bg-[#090e15] border-r border-line px-3.5 pt-14" onPress={() => {}}>
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ fontSize: 18, fontWeight: "800" }}><Text className="text-brand">UTA</Text><Text className="text-white">NEXA</Text></Text>
              <Pressable onPress={() => setMenu(false)} className="w-8 h-8 rounded-full bg-[#111b27] items-center justify-center">
                <Ionicons name="close" size={18} color="#d9e1eb" />
              </Pressable>
            </View>
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => { setFilter(f.key); setMenu(false); }}
                className={`h-11 flex-row items-center gap-3 px-2.5 rounded-lg ${filter === f.key ? "bg-[#121a24]" : ""}`}>
                <Ionicons name={f.icon} size={18} color="#bec8d5" />
                <Text className="text-[#bec8d5] text-[13px]">{f.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => { setMenu(false); navigation.navigate("CoupleChat"); }} className="h-11 flex-row items-center gap-3 px-2.5">
              <Ionicons name="heart" size={18} color="#bec8d5" /><Text className="text-[#bec8d5] text-[13px]">Couple Chat</Text>
            </Pressable>
            <Pressable onPress={() => { setMenu(false); navigation.navigate("Nexa"); }} className="h-11 flex-row items-center gap-3 px-2.5">
              <Ionicons name="sparkles-outline" size={18} color="#bec8d5" /><Text className="text-[#bec8d5] text-[13px]">NEXA AI</Text>
            </Pressable>
            <Pressable onPress={() => { setMenu(false); signOut(); }} className="h-11 mt-3 justify-center px-2.5">
              <Text className="text-danger text-[13px]">Log out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
