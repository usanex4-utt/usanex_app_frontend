import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { EP } from "../api/endpoints";

const CATEGORIES = ["reels", "entertainment", "education", "music", "sports", "technology", "lifestyle", "comedy"];
const MIME = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska" };
const fmt = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// Backend: POST /api/reels/upload  (multipart: video, caption, hashtags, language, category)
// The server uploads to Cloudinary, so CLOUDINARY_* env vars must be set on the backend.
export default function ReelUploadScreen({ navigation }) {
  const [video, setVideo] = useState(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("reels");
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return Alert.alert("Permission needed", "Allow photo library access.");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
    if (!r.canceled) setVideo(r.assets[0]);
  };

  const post = async () => {
    if (!video) return;
    setBusy(true);
    try {
      const ext = ((video.uri.split("?")[0].split(".").pop() || "mp4").toLowerCase());
      const known = MIME[ext] ? ext : "mp4";
      const fd = new FormData();
      fd.append("video", {
        uri: video.uri,
        name: video.fileName && /\.\w+$/.test(video.fileName) ? video.fileName : `reel.${known}`,
        type: video.mimeType && video.mimeType.startsWith("video/") ? video.mimeType : MIME[known],
      });
      if (caption.trim()) fd.append("caption", caption.trim());
      if (hashtags.trim()) fd.append("hashtags", hashtags.trim());
      if (language.trim()) fd.append("language", language.trim());
      fd.append("category", category);
      await api(EP.reelUpload, { method: "POST", form: fd });
      Alert.alert("Reel posted", "Your reel is live.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert("Upload failed", e.message); }
    setBusy(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="h-14 flex-row items-center px-3.5 border-b border-white/5">
        <Pressable onPress={() => navigation.goBack()} className="w-10"><Ionicons name="chevron-back" size={28} color="#fff" /></Pressable>
        <Text className="flex-1 text-center text-white text-[18px] font-bold">New reel</Text>
        <Pressable onPress={post} disabled={busy || !video} style={{ opacity: busy || !video ? 0.45 : 1 }} className="px-4 py-2 rounded-full bg-[#168cff]">
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-sm font-bold">Share</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
          {!video ? (
            <Pressable onPress={pick} className="min-h-[280px] items-center justify-center p-6 rounded-[22px] border border-dashed border-[#64aae6]/35 bg-[#0d1d2d]/80">
              <Ionicons name="videocam" size={48} color="#168cff" />
              <Text className="text-white text-xl font-bold mt-3 mb-1.5">Select a video</Text>
              <Text className="text-[#91a5b8] text-[13px] text-center">MP4, MOV, WebM or MKV</Text>
            </Pressable>
          ) : (
            <View>
              <Video source={{ uri: video.uri }} useNativeControls resizeMode={ResizeMode.CONTAIN}
                style={{ width: "100%", height: 400, borderRadius: 18, backgroundColor: "#000" }} />
              <View className="flex-row justify-between items-center mt-2.5">
                <Text className="text-[#8d96a5] text-xs">{fmt(video.duration)}</Text>
                <Pressable onPress={pick}><Text className="text-brandLight text-[13px] font-semibold">Replace video</Text></Pressable>
              </View>
            </View>
          )}

          <Text className="text-white text-[15px] font-bold mt-6 mb-2">Caption</Text>
          <TextInput value={caption} onChangeText={setCaption} multiline maxLength={5000} placeholder="Write a caption…" placeholderTextColor="#6f8295"
            style={{ textAlignVertical: "top" }} className="min-h-[100px] p-4 rounded-2xl border border-white/10 bg-[#0d1117] text-white text-sm" />

          <Text className="text-white text-[15px] font-bold mt-5 mb-2">Hashtags</Text>
          <TextInput value={hashtags} onChangeText={setHashtags} maxLength={2000} autoCapitalize="none" placeholder="#travel #food"
            placeholderTextColor="#6f8295" className="h-12 px-4 rounded-2xl border border-white/10 bg-[#0d1117] text-white text-sm" />

          <Text className="text-white text-[15px] font-bold mt-5 mb-2">Language</Text>
          <TextInput value={language} onChangeText={setLanguage} maxLength={50} placeholder="e.g. Hindi, English"
            placeholderTextColor="#6f8295" className="h-12 px-4 rounded-2xl border border-white/10 bg-[#0d1117] text-white text-sm" />

          <Text className="text-white text-[15px] font-bold mt-5 mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)}
                className={`px-3.5 py-2 rounded-full border ${category === c ? "bg-[#102f4b] border-[#168cff]" : "bg-[#0d1117] border-white/10"}`}>
                <Text className={`text-[13px] ${category === c ? "text-white font-bold" : "text-[#9eafc0]"}`}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {busy && <Text className="text-[#8d96a5] text-xs text-center mt-6">Uploading… large videos can take a while. Keep the app open.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
