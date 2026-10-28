import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, Image, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api, absUrl, openSocket } from "../api/client";
import { EP } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/ui";

// Backend stores naive UTC timestamps (no "Z"), so add it before parsing.
export const parseTime = (iso) => {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return isNaN(d) ? null : d;
};
const hhmm = (iso) => parseTime(iso)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";
const seen = (iso) => {
  const d = parseTime(iso);
  return d ? `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
};

// REST:  GET /api/chat/{user_id}  ·  POST /api/chat/send (multipart)  ·  POST /api/chat/message/{id}/delete
// WS:    /api/chat/ws/{user_id}   (typing + online presence only; messages arrive by polling)
export default function ChatScreen({ navigation, route }) {
  const [peer, setPeer] = useState(route.params?.user || {});
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = await api(EP.chatHistory(peer.user_id));
      if (d.user) setPeer((p) => ({ ...p, ...d.user }));
      setMessages((prev) => [...(d.messages || []), ...prev.filter((m) => m.pending)]);
      setError("");
    } catch (e) { setError(e.message || "Unable to load messages."); }
  }, [peer.user_id]);

  useEffect(() => { load(); const t = setInterval(load, 3500); return () => clearInterval(t); }, [load]);
  useEffect(() => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }, [messages.length]);

  // ── typing / presence socket ────────────────────────────────
  useEffect(() => {
    let closed = false, retry, hide;
    const connect = () => {
      let ws;
      try { ws = openSocket(EP.chatWs(peer.user_id)); } catch { return; }
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "presence") { setOnline(!!m.online); setLastSeen(m.last_seen || null); if (!m.online) setTyping(false); }
          else if (m.type === "typing") {
            setTyping(!!m.typing);
            clearTimeout(hide);
            if (m.typing) hide = setTimeout(() => setTyping(false), 6000);
          }
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = (e) => { if (!closed && ![4401, 4403, 4404].includes(e.code)) retry = setTimeout(connect, 4000); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); clearTimeout(hide); try { wsRef.current?.close(); } catch {} };
  }, [peer.user_id]);

  const sendTyping = (on) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "typing", typing: on }));
  };
  const onChange = (v) => {
    setText(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 2500) { lastTypingSent.current = now; sendTyping(true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { lastTypingSent.current = 0; sendTyping(false); }, 2000);
  };

  // ── send / delete ───────────────────────────────────────────
  const send = async (file) => {
    const body = text.trim();
    if ((!body && !file) || sending) return;
    const tmp = { id: `tmp${Date.now()}`, sender_id: user.id, content: body, pending: true, created_at: new Date().toISOString() };
    setMessages((m) => [...m, tmp]); setText(""); sendTyping(false); setSending(true);
    try {
      const fd = new FormData();
      fd.append("receiver_id", peer.user_id);
      fd.append("content", body);
      if (file) fd.append("file", file);
      const d = await api(EP.chatSend, { method: "POST", form: fd });
      setMessages((m) => m.map((x) => (x.id === tmp.id ? d.message : x)));
    } catch (e) {
      Alert.alert("Not sent", e.message);
      setMessages((m) => m.filter((x) => x.id !== tmp.id));
      if (body) setText(body);
    }
    setSending(false);
  };

  const attach = () =>
    Alert.alert("Attach", undefined, [
      { text: "Photo / Video", onPress: async () => {
          const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!p.granted) return Alert.alert("Permission needed", "Allow photo library access.");
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85 });
          if (r.canceled) return;
          const a = r.assets[0];
          const vid = a.type === "video";
          send({ uri: a.uri, name: a.fileName || (vid ? "video.mp4" : "photo.jpg"), type: a.mimeType || (vid ? "video/mp4" : "image/jpeg") });
        } },
      { text: "File / Audio", onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
          if (r.canceled) return;
          const a = r.assets[0];
          send({ uri: a.uri, name: a.name || "file", type: a.mimeType || "application/octet-stream" });
        } },
      { text: "Cancel", style: "cancel" },
    ]);

  const del = (m) => {
    if (m.sender_id !== user.id || m.pending) return;
    Alert.alert("Delete message", "Delete this message for everyone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await api(EP.chatDelete(m.id), { method: "POST" }); setMessages((l) => l.filter((x) => x.id !== m.id)); }
          catch (e) { Alert.alert("Could not delete", e.message); }
        } },
    ]);
  };

  const status = error ? "Offline" : typing ? "typing…" : online ? "online" : seen(lastSeen) || "Private chat";

  return (
    <SafeAreaView className="flex-1 bg-[#090d18]">
      <View className="h-[60px] flex-row items-center px-2 border-b border-[#263249] bg-[#101726]">
        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center"><Ionicons name="chevron-back" size={24} color="#f4f6fb" /></Pressable>
        <Pressable onPress={() => navigation.navigate("UserProfile", { userId: peer.user_id })} className="flex-row items-center flex-1">
          <Avatar uri={peer.profile_photo} name={peer.name || peer.username} size={38} />
          <View className="ml-2.5 flex-1">
            <Text className="text-[#f4f6fb] text-[15px] font-bold" numberOfLines={1}>{peer.name || peer.username || "Chat"}</Text>
            <Text className={`text-[11px] ${typing || online ? "text-[#43d9a3]" : "text-[#96a3b9]"}`}>{status}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("CoupleChat", { user: peer })} className="w-10 h-10 items-center justify-center"><Ionicons name="heart-outline" size={22} color="#f4f6fb" /></Pressable>
      </View>

      {error ? (
        <View className="flex-row justify-between items-center px-4 py-2.5 bg-danger/10">
          <Text className="text-danger text-xs flex-1 mr-3" numberOfLines={2}>{error}</Text>
          <Pressable onPress={load}><Text className="text-white text-xs font-bold">Retry</Text></Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => String(m.id ?? i)}
          contentContainerClassName="p-3.5 gap-2"
          ListHeaderComponent={
            <View className="items-center py-6">
              <View className="w-14 h-14 rounded-full bg-[#151e2f] items-center justify-center mb-2"><Text className="text-[#8bb8ff] font-extrabold text-lg">UN</Text></View>
              <Text className="text-white font-bold">{peer.name || peer.username}</Text>
              <Text className="text-[#96a3b9] text-xs mt-1">Your private conversation starts here.</Text>
            </View>
          }
          renderItem={({ item: m }) => {
            const mine = m.sender_id === user.id;
            const url = absUrl(m.media_url);
            return (
              <Pressable onLongPress={() => del(m)} className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl ${mine ? "self-end bg-[#18385e]" : "self-start bg-[#151e2f]"}`} style={{ opacity: m.pending ? 0.6 : 1 }}>
                {m.media_url && m.media_type === "image" ? <Image source={{ uri: url }} className="w-[220px] h-[220px] rounded-xl mb-1.5" resizeMode="cover" /> : null}
                {m.media_url && m.media_type === "video" ? <Video source={{ uri: url }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 6, backgroundColor: "#000" }} /> : null}
                {m.media_url && m.media_type !== "image" && m.media_type !== "video" ? (
                  <Pressable onPress={() => Linking.openURL(url)} className="flex-row items-center gap-2 mb-1.5">
                    <Ionicons name={m.media_type === "audio" ? "musical-notes-outline" : "document-outline"} size={20} color="#8bb8ff" />
                    <Text className="text-[#8bb8ff] text-[13px] underline">{m.media_type === "audio" ? "Play audio" : "Open file"}</Text>
                  </Pressable>
                ) : null}
                {m.content ? <Text className="text-[#f4f6fb] text-[14px] leading-5">{m.content}</Text> : null}
                <View className="flex-row justify-end items-center mt-1 gap-1">
                  <Text className="text-[#96a3b9] text-[10px]">{hhmm(m.created_at)}</Text>
                  {mine && !m.pending && <Ionicons name={m.is_read ? "checkmark-done" : "checkmark"} size={13} color={m.is_read ? "#43d9a3" : "#96a3b9"} />}
                </View>
              </Pressable>
            );
          }}
        />

        <View className="flex-row items-end gap-2 px-3 py-2.5 bg-[#101726] border-t border-[#263249]">
          <Pressable onPress={attach} className="w-10 h-10 items-center justify-center"><Ionicons name="attach" size={24} color="#96a3b9" /></Pressable>
          <TextInput value={text} onChangeText={onChange} multiline maxLength={10000} placeholder="Message…" placeholderTextColor="#96a3b9"
            className="flex-1 max-h-[110px] px-4 py-2.5 rounded-[22px] bg-[#151e2f] text-white text-[14px]" />
          <Pressable onPress={() => send()} className="w-11 h-11 rounded-full bg-[#8bb8ff] items-center justify-center"><Ionicons name="send" size={19} color="#090d18" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
