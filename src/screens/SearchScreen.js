import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Modal, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, absUrl } from "../api/client";
import { EP } from "../api/endpoints";
import { Avatar } from "../components/ui";

const HINT = "Search people by name, username, user ID or mobile";

function status(u) {
  if (u.is_self || u.connection_status === "self") return "self";
  if (u.is_connected || u.connection_status === "connected") return "connected";
  if (u.request_sent || u.connection_status === "pending_sent") return "pending_sent";
  if (u.request_received || u.connection_status === "pending_received") return "pending_received";
  return "none"; // includes "rejected" -> backend lets you send a new request
}

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(HINT);
  const [viewer, setViewer] = useState(null);
  const ctrl = useRef(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) { setUsers([]); setInfo(HINT); return; }
    setLoading(true); setInfo("Searching...");
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        const d = await api(`${EP.searchPeople}?q=${encodeURIComponent(query)}&limit=50&offset=0`, { signal: ctrl.current.signal });
        const list = Array.isArray(d.users) ? d.users : [];
        setUsers(list);
        setInfo(list.length ? `${list.length} result${list.length > 1 ? "s" : ""}` : "No users found");
      } catch (e) { if (e.name !== "AbortError") setInfo(e.message || "Search failed. Try again."); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const patch = (id, connection_status) =>
    setUsers((l) => l.map((x) => (x.user_id === id ? { ...x, connection_status, is_connected: connection_status === "connected", request_sent: connection_status === "pending_sent", request_received: connection_status === "pending_received" } : x)));

  const connect = async (u) => {
    patch(u.user_id, "pending_sent");
    try {
      const d = await api(EP.connectionRequest, { method: "POST", body: { user_id: u.user_id } });
      patch(u.user_id, d.status || "pending_sent"); // backend may answer "connected" / "pending_received"
    } catch (e) { patch(u.user_id, "none"); setInfo(e.message); }
  };

  // The search result has no request id, so look it up in my pending requests first.
  const accept = async (u) => {
    try {
      const r = await api(EP.connectionRequests);
      const req = (r.requests || []).find((x) => x.sender_user_id === u.user_id);
      if (!req) return setInfo("Request not found. Pull to refresh in Alerts.");
      await api(EP.connectionAccept(req.request_id), { method: "POST" });
      patch(u.user_id, "connected");
    } catch (e) { setInfo(e.message); }
  };

  const openProfile = (u) => {
    if (status(u) === "connected" || status(u) === "self") navigation.navigate("UserProfile", { userId: u.user_id });
    else setInfo("Profiles are visible only to connected users. Send a request first.");
  };

  const Action = ({ u }) => {
    const s = status(u);
    if (s === "self") return null;
    if (s === "connected") return <Text className="text-success text-xs font-bold">Connected</Text>;
    const sent = s === "pending_sent";
    return (
      <Pressable disabled={sent} onPress={() => (s === "pending_received" ? accept(u) : connect(u))}
        className={`min-w-[82px] h-9 px-3 rounded-[11px] items-center justify-center ${sent ? "bg-[#202733] border border-[#303947]" : "bg-[#2f7cff]"}`}>
        <Text className={`text-[13px] font-bold ${sent ? "text-[#aeb7c5]" : "text-white"}`}>
          {sent ? "Requested" : s === "pending_received" ? "Accept" : "Connect"}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="px-4 pt-2">
        <View className="h-[50px] flex-row items-center rounded-2xl border border-[#1b222d] bg-[#10141b] px-4">
          <Ionicons name="search" size={20} color="#8d96a5" />
          <TextInput value={q} onChangeText={setQ} placeholder="Search people" placeholderTextColor="#737c8b"
            autoCapitalize="none" autoCorrect={false} maxLength={100} className="flex-1 ml-3 text-white text-[15px] h-full" />
          {q ? (
            <Pressable onPress={() => setQ("")} className="w-8 h-8 rounded-full bg-[#252c36] items-center justify-center">
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <Text className="text-[#7e8795] text-sm py-4 px-1">{info}</Text>
      </View>
      {loading && <ActivityIndicator color="#2f7cff" />}
      <FlatList
        data={users}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(u, i) => String(u.user_id || i)}
        contentContainerClassName="px-4 gap-2.5 pb-6"
        renderItem={({ item: u }) => (
          <View className="flex-row items-center p-3 rounded-[17px] border border-[#171e28] bg-[#0d1117]">
            <Pressable onPress={() => setViewer(u)}>
              <Avatar uri={u.profile_photo} name={u.name || u.username} size={52} />
            </Pressable>
            <Pressable className="flex-1 ml-3" onPress={() => openProfile(u)}>
              <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{u.name || u.username}</Text>
              <Text className="text-[#8d96a5] text-[13px] mt-0.5" numberOfLines={1}>@{u.username}</Text>
            </Pressable>
            <Action u={u} />
          </View>
        )}
      />
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable className="flex-1 bg-black/95 items-center justify-center" onPress={() => setViewer(null)}>
          <View className="w-[82%] aspect-square rounded-full overflow-hidden bg-[#11161e] border-2 border-white/10 items-center justify-center">
            {viewer?.profile_photo
              ? <Image source={{ uri: absUrl(viewer.profile_photo) }} style={{ width: "100%", height: "100%" }} />
              : <Text className="text-white text-7xl font-bold">{(viewer?.name || "U").charAt(0).toUpperCase()}</Text>}
          </View>
          <Text className="text-white text-sm font-bold mt-6">{viewer?.name || viewer?.username}</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
