import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, openSocket } from "../api/client";
import { EP } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Avatar, Empty } from "../components/ui";
import { parseTime } from "./ChatScreen";

// [key, label, accent colour, background tint]  (mood is a local theme)
const MOODS = [
  ["romantic", "Romantic", "#e56b9a", "#fff0f6"], ["deep_love", "Deep Love", "#d6336c", "#ffe8ef"],
  ["happy", "Happy", "#f5a623", "#fff8e6"], ["funny", "Funny", "#f08c00", "#fff4e0"],
  ["sad", "Sad", "#5c7cfa", "#eef2ff"], ["emotional", "Emotional", "#9775fa", "#f3eeff"],
  ["angry", "Angry", "#e03131", "#ffecec"], ["frustrated", "Frustrated", "#d9480f", "#fff0e8"],
  ["caring", "Caring", "#3bb273", "#e9f9f0"], ["comfort", "Comfort", "#70b8ad", "#f0faf7"],
  ["flirty", "Flirty", "#f06595", "#fff0f6"], ["passionate", "Passionate", "#c2255c", "#ffe3ec"],
  ["good_night", "Good Night", "#4c6ef5", "#e8ecff"], ["good_morning", "Good Morning", "#fab005", "#fff9db"],
  ["memory", "Memory", "#845ef7", "#f3eeff"], ["celebration", "Celebration", "#e8590c", "#fff3e6"],
  ["birthday", "Birthday", "#f06595", "#fff0f6"], ["future_marriage", "Future", "#ae3ec9", "#f8eaff"],
  ["missing_you", "Missing You", "#4dabf7", "#e7f5ff"], ["apology", "Apology", "#868e96", "#f1f3f5"],
  ["appreciation", "Appreciation", "#20c997", "#e6fcf5"], ["game", "Game", "#7950f2", "#f1ebff"],
  ["photo_memory", "Photo Memory", "#845ef7", "#f3eeff"], ["serious_talk", "Serious Talk", "#495057", "#f1f3f5"],
  ["deep_conversation", "Deep Talk", "#5f3dc4", "#efeaff"], ["calm", "Calm", "#70b8ad", "#f0faf7"],
];

const QUICK = {
  love: { icon: "heart-outline", label: "Love", text: "I love you more than words can say ❤️" },
  memory: { icon: "images-outline", label: "Memory", text: "Remember our first time together? I still smile thinking about it 🥰" },
  question: { icon: "help-circle-outline", label: "Question", text: "If we could go anywhere tomorrow, where would you take me?" },
  game: { icon: "game-controller-outline", label: "Game", text: "Let's play: tell me 3 things you love about us 💞" },
};

// Suggestions are generated on the device (the backend has no couple-AI endpoint).
const BY_MOOD = {
  romantic: ["You're my favourite person in the whole world 💕", "Every moment with you feels like a love story ❤️"],
  missing_you: ["Missing you so much right now 🥺", "Wish you were here with me 💭"],
  good_night: ["Good night, sleep tight. Sweet dreams of us 🌙", "Sending you a big goodnight hug 🤍"],
  good_morning: ["Good morning, sunshine ☀️ Hope your day is beautiful", "Waking up and thinking of you 🌸"],
  apology: ["I'm really sorry. I care about you and want to make it right 🙏", "You matter to me more than being right"],
  appreciation: ["Thank you for always being there for me 🌷", "I appreciate everything you do, more than you know"],
  sad: ["I'm here for you, always. Want to talk about it? 🤍", "You're not alone. I'm right here"],
  happy: ["You make me so happy 😊", "Best part of my day is talking to you"],
};
const GENERIC = ["Thinking of you right now 💭", "Can't wait to see you ❤️", "You make my day better 🌸"];
const QUESTIONS = [
  "What's your favourite memory of us?", "Where would you want to travel together next?", "What's one thing I do that makes you smile?",
  "What are you most excited about for our future?", "What song reminds you of us?",
];
const GAMES = [
  "Two truths and a lie — you go first 😄", "Tell me 3 things you love about us 💞", "Describe our relationship in 3 emojis",
  "Rate our last date out of 10 and tell me why", "Guess what I'm thinking about right now 😉",
];
const pick3 = (arr) => [...arr].sort(() => Math.random() - 0.5).slice(0, 3);
const rank = { sending: 0, sent: 1, delivered: 2, seen: 3 };

// WS: /ws/couple/{partner_user_id}   events: connected, message_history, message,
//     message_receipt, typing, presence, pong, error   (see routes/couple_realtime.py)
export default function CoupleChatScreen({ navigation, route }) {
  const { user } = useAuth();
  const [partner, setPartner] = useState(route.params?.user || null);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState("calm");
  const [moodModal, setMoodModal] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [conn, setConn] = useState("connecting"); // connecting | open | closed | denied
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const listRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimer = useRef(null);
  const typingOn = useRef(false);

  const m = MOODS.find((x) => x[0] === mood) || MOODS[MOODS.length - 1];
  const accent = m[2], bg = m[3];

  // no partner passed (opened from the side menu) -> let the user pick a connection
  useEffect(() => {
    if (partner) return;
    api(EP.connections).then((d) => setConnections(d.connections || d.users || [])).catch(() => {});
  }, [partner]);

  // ── websocket lifecycle ─────────────────────────────────────
  useEffect(() => {
    if (!partner?.user_id) return;
    let closed = false, retry, ping, attempts = 0, hide;
    setMessages([]); setConn("connecting");

    const wsSend = (obj) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
      return false;
    };
    const ackRead = (list) => list.filter((x) => x.sender_id !== user.id && x.id).slice(-20)
      .forEach((x) => wsSend({ type: "message_read", message_id: x.id }));

    const connect = () => {
      let ws;
      try { ws = openSocket(EP.coupleWs(partner.user_id)); } catch { setConn("closed"); return; }
      wsRef.current = ws;
      ws.onopen = () => {
        attempts = 0; setConn("open");
        clearInterval(ping);
        ping = setInterval(() => wsSend({ type: "ping" }), 25000); // server drops us after 75s of silence
      };
      ws.onmessage = (e) => {
        let ev; try { ev = JSON.parse(e.data); } catch { return; }
        switch (ev.type) {
          case "connected":
            setOnline(!!ev.partner_online); setLastSeen(ev.partner_last_seen || null); break;
          case "message_history": {
            const list = ev.messages || [];
            setMessages(list.map((x) => ({ ...x, content: x.content, status: "seen" })));
            ackRead(list);
            break;
          }
          case "message": {
            const mine = ev.sender_id === user.id;
            const msg = { id: ev.id ?? ev.message_id, client_message_id: ev.client_message_id, sender_id: ev.sender_id,
              content: ev.content, media_url: ev.media_url, created_at: ev.timestamp, status: mine ? "sent" : undefined };
            setMessages((l) => {
              if (l.some((x) => x.id === msg.id)) return l;
              const i = mine && msg.client_message_id ? l.findIndex((x) => x.client_message_id === msg.client_message_id) : -1;
              if (i >= 0) { const c = [...l]; c[i] = { ...c[i], ...msg, pending: false, status: c[i].status && rank[c[i].status] > 1 ? c[i].status : "sent" }; return c; }
              return [...l, msg];
            });
            if (!mine) wsSend({ type: "message_read", message_id: msg.id });
            break;
          }
          case "message_receipt": {
            const next = ev.status;
            if (!next) break;
            setMessages((l) => l.map((x) => {
              const hit = (ev.message_id && x.id === ev.message_id) || (ev.client_message_id && x.client_message_id === ev.client_message_id);
              if (!hit || x.sender_id !== user.id) return x;
              return rank[next] > (rank[x.status] ?? 0) ? { ...x, id: ev.message_id ?? x.id, status: next } : { ...x, id: ev.message_id ?? x.id };
            }));
            break;
          }
          case "typing":
            setTyping(!!ev.is_typing); clearTimeout(hide);
            if (ev.is_typing) hide = setTimeout(() => setTyping(false), 6000);
            break;
          case "presence":
            setOnline(!!ev.is_online); setLastSeen(ev.last_seen || null); if (!ev.is_online) setTyping(false); break;
          case "error":
            setNotice(ev.message || "Something went wrong");
            if (ev.client_message_id) setMessages((l) => l.filter((x) => x.client_message_id !== ev.client_message_id));
            setTimeout(() => setNotice(""), 3000);
            break;
          default: break; // pong
        }
      };
      ws.onerror = () => {};
      ws.onclose = (e) => {
        clearInterval(ping);
        if (closed) return;
        if (e.code === 1008) { setConn("denied"); setNotice(e.reason || "Not allowed to open this chat"); return; }
        setConn("closed");
        attempts += 1;
        retry = setTimeout(() => { setConn("connecting"); connect(); }, Math.min(1000 * 2 ** attempts, 15000));
      };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); clearTimeout(hide); clearInterval(ping); try { wsRef.current?.close(); } catch {} };
  }, [partner?.user_id, user.id]);

  useEffect(() => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }, [messages.length]);

  const wsSendNow = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  };

  const onChange = (v) => {
    setText(v);
    if (v && !typingOn.current) { typingOn.current = true; wsSendNow({ type: "typing_start" }); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { if (typingOn.current) { typingOn.current = false; wsSendNow({ type: "typing_stop" }); } }, 1800);
  };

  const send = (override) => {
    const body = (override ?? text).trim();
    if (!body) return;
    const cid = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const ok = wsSendNow({ type: "message", content: body, client_message_id: cid, message_type: "text" });
    if (!ok) { setNotice("Connecting… try again in a moment"); setTimeout(() => setNotice(""), 2500); return; }
    typingOn.current = false; wsSendNow({ type: "typing_stop" });
    setMessages((l) => [...l, { id: cid, client_message_id: cid, sender_id: user.id, content: body, pending: true, status: "sending", created_at: new Date().toISOString() }]);
    setText(""); setSuggestions([]);
  };

  const askAi = (action) => {
    setAiModal(false);
    if (action === "question") setSuggestions(pick3(QUESTIONS));
    else if (action === "game") setSuggestions(pick3(GAMES));
    else setSuggestions(pick3([...(BY_MOOD[mood] || []), ...GENERIC]));
  };

  const headerStatus = conn === "denied" ? "Unavailable" : conn !== "open" ? (conn === "connecting" ? "Connecting…" : "Reconnecting…")
    : typing ? "typing…" : online ? "online" : (() => { const d = parseTime(lastSeen); return d ? `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Couple chat"; })();

  // ── partner picker ──────────────────────────────────────────
  if (!partner) {
    return (
      <SafeAreaView className="flex-1 bg-[#fff0f6]">
        <View className="h-14 flex-row items-center px-2">
          <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center"><Ionicons name="chevron-back" size={24} color="#382b3b" /></Pressable>
          <Text className="text-[#382b3b] text-[18px] font-bold ml-1">Choose your partner</Text>
        </View>
        <FlatList data={connections} keyExtractor={(c) => c.user_id} contentContainerClassName="p-4 gap-2.5"
          ListEmptyComponent={<Empty text="No connections yet. Connect with your partner first (Search tab)." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPartner(item)} className="flex-row items-center p-3 rounded-2xl bg-white">
              <Avatar uri={item.profile_photo} name={item.name || item.username} size={46} />
              <View className="flex-1 ml-3">
                <Text className="text-[#382b3b] font-bold" numberOfLines={1}>{item.name || item.username}</Text>
                <Text className="text-[#968b98] text-xs">@{item.username}</Text>
              </View>
              <Ionicons name="heart" size={20} color="#e56b9a" />
            </Pressable>
          )} />
      </SafeAreaView>
    );
  }

  const tick = (x) => x.status === "seen" ? ["checkmark-done", "#e8f9ff"] : x.status === "delivered" ? ["checkmark-done", "rgba(255,255,255,0.75)"]
    : x.status === "sent" ? ["checkmark", "rgba(255,255,255,0.75)"] : ["time-outline", "rgba(255,255,255,0.75)"];

  return (
    <SafeAreaView style={{ backgroundColor: bg }} className="flex-1">
      <View className="h-[60px] flex-row items-center px-2 border-b border-black/5" style={{ backgroundColor: "rgba(255,255,255,0.94)" }}>
        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center"><Ionicons name="chevron-back" size={24} color="#382b3b" /></Pressable>
        <Avatar uri={partner.profile_photo} name={partner.name || "P"} size={38} />
        <View className="flex-1 ml-2.5">
          <Text className="text-[#382b3b] text-[15px] font-bold" numberOfLines={1}>{partner.name || partner.username || "Partner"}</Text>
          <Text className="text-[11px]" style={{ color: conn === "open" && (online || typing) ? "#2f9e6a" : "#968b98" }}>{headerStatus}</Text>
        </View>
        <Pressable onPress={() => setMoodModal(true)} className="px-3 h-8 rounded-full items-center justify-center" style={{ backgroundColor: accent }}>
          <Text className="text-white text-xs font-bold">{m[1]}</Text>
        </Pressable>
      </View>

      {notice ? <View className="px-4 py-2 bg-[#ffe3e3]"><Text className="text-[#c92a2a] text-xs">{notice}</Text></View> : null}

      <View className="flex-row items-center gap-2.5 mx-3 mt-2.5 p-2.5 rounded-2xl bg-white/90">
        <Text style={{ color: accent }} className="text-xl">✦</Text>
        <View className="flex-1"><Text className="text-[#382b3b] text-[13px] font-bold">UtaNexa Couple Assistant</Text><Text className="text-[#968b98] text-[11px]">Reply ideas, questions & games</Text></View>
        <Pressable onPress={() => setAiModal(true)}><Ionicons name="chatbox-ellipses-outline" size={22} color={accent} /></Pressable>
      </View>

      <View className="flex-row gap-2 mx-3 mt-2.5">
        {Object.entries(QUICK).map(([k, q]) => (
          <Pressable key={k} onPress={() => setText(q.text)} className="flex-1 items-center py-2 rounded-xl bg-white/90">
            <Ionicons name={q.icon} size={20} color={accent} />
            <Text className="text-[#382b3b] text-[10px] mt-1">{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        {conn === "connecting" && messages.length === 0 ? <ActivityIndicator color={accent} className="mt-6" /> : null}
        <FlatList ref={listRef} data={messages} keyExtractor={(x, i) => String(x.client_message_id || x.id || i)} contentContainerClassName="p-3.5 gap-2"
          renderItem={({ item }) => {
            const mine = item.sender_id === user.id;
            const [ti, tc] = mine ? tick(item) : [];
            const t = parseTime(item.created_at)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <View className={`max-w-[80%] px-3.5 py-2.5 rounded-[18px] ${mine ? "self-end" : "self-start bg-white"}`}
                style={{ backgroundColor: mine ? accent : "#fff", opacity: item.pending ? 0.7 : 1 }}>
                <Text className={`text-[14px] leading-5 ${mine ? "text-white" : "text-[#382b3b]"}`}>{item.content}</Text>
                <View className="flex-row justify-end items-center gap-1 mt-0.5">
                  <Text className={`text-[10px] ${mine ? "text-white/75" : "text-[#968b98]"}`}>{t}</Text>
                  {mine && <Ionicons name={ti} size={13} color={tc} />}
                </View>
              </View>
            );
          }} />

        {suggestions.length > 0 && (
          <View className="px-3 pb-2">
            <View className="flex-row justify-between mb-1.5"><Text className="text-[#968b98] text-xs">Suggestions</Text><Pressable onPress={() => setSuggestions([])}><Text className="text-[#968b98]">×</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {suggestions.map((s, i) => (
                <Pressable key={i} onPress={() => send(s)} className="px-3.5 py-2 rounded-full bg-white border" style={{ borderColor: accent }}>
                  <Text className="text-[#382b3b] text-[13px]">{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="flex-row items-center gap-2 px-3 py-2.5 bg-white/95">
          <TextInput value={text} onChangeText={onChange} maxLength={4000} placeholder="Message your partner…" placeholderTextColor="#968b98"
            className="flex-1 h-11 px-4 rounded-full bg-[#f6f2f6] text-[#382b3b] text-[14px]" onSubmitEditing={() => send()} />
          <Pressable onPress={() => send()} className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: accent, opacity: conn === "open" ? 1 : 0.5 }}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={moodModal} transparent animationType="slide" onRequestClose={() => setMoodModal(false)}>
        <Pressable className="flex-1 bg-black/45 justify-end" onPress={() => setMoodModal(false)}>
          <Pressable className="max-h-[70%] bg-white rounded-t-3xl p-4" onPress={() => {}}>
            <Text className="text-[#968b98] text-xs">UtaNexa Couple Chat</Text>
            <Text className="text-[#382b3b] text-xl font-bold mb-3">Choose a mood</Text>
            <ScrollView><View className="flex-row flex-wrap gap-2 pb-6">
              {MOODS.map(([k, label, c]) => (
                <Pressable key={k} onPress={() => { setMood(k); setMoodModal(false); }}
                  className="px-3.5 py-2.5 rounded-full border" style={{ borderColor: c, backgroundColor: mood === k ? c : "#fff" }}>
                  <Text style={{ color: mood === k ? "#fff" : c }} className="text-[13px] font-semibold">{label}</Text>
                </Pressable>
              ))}
            </View></ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={aiModal} transparent animationType="fade" onRequestClose={() => setAiModal(false)}>
        <Pressable className="flex-1 bg-black/45 justify-center p-6" onPress={() => setAiModal(false)}>
          <Pressable className="bg-white rounded-3xl p-5 gap-2.5" onPress={() => {}}>
            <Text className="text-[#382b3b] text-xl font-bold mb-1">Couple assistant</Text>
            {[["suggest", "Suggest a message"], ["question", "Give us a question"], ["game", "Couple game"]].map(([k, l]) => (
              <Pressable key={k} onPress={() => askAi(k)} className="h-12 rounded-xl items-center justify-center" style={{ backgroundColor: accent }}>
                <Text className="text-white font-semibold">{l}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
