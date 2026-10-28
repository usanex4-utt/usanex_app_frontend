import React, { useRef, useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { EP } from "../api/endpoints";

const SUGGESTIONS = [
  { label: "Usanex ke features", prompt: "Usanex ke features samjhao" },
  { label: "Aaj ke kaam plan karo", prompt: "Mujhe aaj ke kaam plan karne mein help karo" },
  { label: "AI learning roadmap", prompt: "Meri AI learning roadmap banao" },
];

// Backend: POST /api/ai-assistant/chat  {message}  ->  {reply}
// (the server keeps short conversation memory per logged-in user)
export default function NexaScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  const send = async (override) => {
    const body = (override ?? text).trim();
    if (!body || busy) return;
    const next = [...messages, { role: "user", text: body }];
    setMessages(next); setText(""); setBusy(true);
    try {
      const d = await api(EP.nexaChat, { method: "POST", body: { message: body.slice(0, 5000) } });
      setMessages([...next, { role: "assistant", text: d.reply || "..." }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", text: e.message || "Maaf kijiye, abhi jawab nahi mil paya. Dobara try karein.", error: true }]);
    }
    setBusy(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#080d18]">
      <View className="h-14 flex-row items-center justify-between px-3.5">
        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center"><Ionicons name="arrow-back" size={22} color="#f3f6ff" /></Pressable>
        <Text className="text-[#f3f6ff] text-[18px] font-extrabold tracking-widest">NEXA</Text>
        <Pressable onPress={() => setMessages([])} className="w-10 h-10 items-center justify-center"><Ionicons name="refresh" size={20} color="#9aa9c2" /></Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerClassName="p-4 gap-3 flex-grow"
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-10">
              <View className="w-[110px] h-[110px] rounded-full bg-[#4f8cff]/15 items-center justify-center">
                <View className="w-[72px] h-[72px] rounded-full bg-[#4f8cff] items-center justify-center"><Text className="text-white text-3xl">✦</Text></View>
              </View>
              <Text className="text-[#9aa9c2] text-sm mt-5">Your personal AI assistant</Text>
              <Text className="text-[#f3f6ff] text-[15px] text-center mt-2 px-6">Namaste! Aap jo chahein, type karein.</Text>
              <View className="flex-row flex-wrap justify-center gap-2 mt-6">
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s.label} onPress={() => send(s.prompt)} className="px-3.5 py-2.5 rounded-full border border-[#94a3b8]/20 bg-[#101827]">
                    <Text className="text-[#f3f6ff] text-[13px]">{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View className={`max-w-[85%] px-4 py-3 rounded-[18px] ${item.role === "user" ? "self-end bg-[#4f8cff]" : "self-start bg-[#151f32]"}`}>
              <Text selectable className={`text-[14px] leading-6 ${item.error ? "text-danger" : "text-[#f3f6ff]"}`}>{item.text}</Text>
            </View>
          )}
          ListFooterComponent={busy ? <Text className="text-[#9aa9c2] text-xs">NEXA soch raha hai…</Text> : null}
        />

        <View className="px-3 pt-2 pb-1 bg-[#080d18]">
          <View className="flex-row items-end gap-2 p-1.5 rounded-[26px] border border-[#94a3b8]/20 bg-[#101827]">
            <TextInput value={text} onChangeText={setText} multiline maxLength={5000} placeholder="NEXA se kuch bhi poochho..." placeholderTextColor="#9aa9c2"
              className="flex-1 max-h-[110px] px-3.5 py-2.5 text-[#f3f6ff] text-[14px]" />
            <Pressable onPress={() => send()} disabled={busy} className="w-10 h-10 rounded-full bg-[#4f8cff] items-center justify-center" style={{ opacity: busy ? 0.5 : 1 }}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
          <Text className="text-[#9aa9c2]/70 text-[11px] text-center mt-1.5">NEXA kabhi-kabhi galat jawab de sakta hai.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
