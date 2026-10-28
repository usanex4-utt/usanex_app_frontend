import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { EP } from "../api/endpoints";
import { Avatar, Empty } from "../components/ui";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return isNaN(d) ? "" : d.toLocaleString();
};

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);       // pending requests I can accept / reject
  const [others, setOthers] = useState([]);           // everything else
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, n] = await Promise.all([api(EP.connectionRequests), api(EP.connectionNotifications)]);
      const pending = r.requests || [];
      const pendingIds = new Set(pending.map((x) => x.request_id));
      setRequests(pending);
      // a "connection_request" notification that is still pending is shown above with buttons
      setOthers((n.notifications || []).filter((x) => !(x.type === "connection_request" && pendingIds.has(x.request_id))));
    } catch (e) { flash(e.message); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const flash = (t) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const respond = async (r, accept) => {
    setRequests((l) => l.filter((x) => x.request_id !== r.request_id));
    try {
      await api(accept ? EP.connectionAccept(r.request_id) : EP.connectionReject(r.request_id), { method: "POST" });
      flash(accept ? "Connected" : "Request removed");
      load();
    } catch (e) { flash(e.message); load(); }
  };

  const markRead = async (n) => {
    if (n.is_read) return;
    setOthers((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try { await api(EP.connectionNotificationRead, { method: "POST", body: { notification_id: n.id } }); } catch {}
  };

  const markAllRead = async () => {
    const unread = others.filter((n) => !n.is_read);
    if (!unread.length) return flash("Nothing to mark");
    setOthers((l) => l.map((x) => ({ ...x, is_read: true })));
    await Promise.all(unread.map((n) =>
      api(EP.connectionNotificationRead, { method: "POST", body: { notification_id: n.id } }).catch(() => {})));
    flash("All marked as read");
  };

  const empty = !loading && !requests.length && !others.length;

  return (
    <SafeAreaView className="flex-1 bg-[#070b12]" edges={["top"]}>
      <View className="h-14 flex-row items-center justify-between px-4 border-b border-white/5">
        <Text className="text-white text-[20px] font-bold">Notifications</Text>
        <Pressable onPress={markAllRead} hitSlop={10}><Ionicons name="checkmark-done-outline" size={24} color="#a7b1bf" /></Pressable>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#247cff"
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {loading && <ActivityIndicator color="#247cff" />}
        {empty && (
          <View className="items-center pt-16">
            <Ionicons name="notifications-outline" size={44} color="#626e7e" />
            <Text className="text-white text-lg font-bold mt-3">No notifications</Text>
            <Empty text="New connection requests and updates will appear here." />
          </View>
        )}
        {requests.length > 0 && (
          <View className="mb-5">
            <Text className="text-white text-[16px] font-semibold mb-2.5">Connection Requests</Text>
            {requests.map((r) => (
              <View key={r.request_id} className="flex-row items-center p-3 mb-2.5 rounded-2xl border border-line bg-surface">
                <Avatar uri={r.sender_profile_photo} name={r.sender_name || r.sender_username} size={48} />
                <View className="flex-1 ml-3">
                  <Text className="text-white text-sm font-semibold" numberOfLines={1}>{r.sender_name || r.sender_username}</Text>
                  <Text className="text-muted text-xs" numberOfLines={1}>@{r.sender_username} wants to connect</Text>
                </View>
                <Pressable onPress={() => respond(r, true)} className="h-9 px-3.5 rounded-lg bg-brand items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">Accept</Text>
                </Pressable>
                <Pressable onPress={() => respond(r, false)} className="h-9 px-3 rounded-lg bg-[#202733] items-center justify-center">
                  <Text className="text-[#aeb7c5] text-xs font-bold">Reject</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {others.length > 0 && (
          <View>
            <Text className="text-white text-[16px] font-semibold mb-2.5">Activity</Text>
            {others.map((n) => (
              <Pressable key={n.id} onPress={() => markRead(n)}
                className={`flex-row items-center p-3.5 mb-2.5 rounded-2xl border bg-surface ${n.is_read ? "border-line" : "border-brand/40"}`}>
                <Avatar uri={n.sender_profile_picture} name={n.sender_name || n.sender_username} size={40} />
                <View className="flex-1 ml-3">
                  <Text className="text-ink text-[13px] leading-5">{n.message}</Text>
                  <Text className="text-faint text-[11px] mt-1">{when(n.created_at)}</Text>
                </View>
                {!n.is_read && <View className="w-2.5 h-2.5 rounded-full bg-brand ml-2" />}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      {toast ? (
        <View className="absolute bottom-6 self-center px-4 py-2.5 rounded-lg bg-[#111923] border border-line">
          <Text className="text-ink text-xs">{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
