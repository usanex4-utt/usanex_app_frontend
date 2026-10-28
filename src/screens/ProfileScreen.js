import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, ScrollView, Image, ActivityIndicator, Modal, Share, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { api, absUrl } from "../api/client";
import { EP } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Header, Empty } from "../components/ui";

// Used for both "My Profile" (tab, params.me) and other users (params.userId).
// Backend: GET /api/profile/me  |  GET /api/profile/{user_id} (connected users only)
export default function ProfileScreen({ navigation, route }) {
  const { user: me, signOut, patchUser } = useAuth();
  const isMe = !!route.params?.me || route.params?.userId === me?.user_id;
  const uid = isMe ? me?.user_id : route.params?.userId;

  const [p, setP] = useState(null);          // {user, relationship, stats, content}
  const [tab, setTab] = useState("reels");
  const [reels, setReels] = useState([]);
  const [saved, setSaved] = useState([]);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [player, setPlayer] = useState(null); // reel opened from the grid
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", website: "", instagram: "", social_link: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const d = await api(isMe ? EP.myProfile : EP.profile(uid));
      setP(d); setErr("");
      if (!isMe) {
        try { const f = await api(EP.followStatus(uid)); setFollowing(!!f.is_following); } catch {}
      }
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, [uid, isMe]);

  const loadTab = useCallback(async () => {
    if (!uid) return;
    try {
      if (tab === "reels") {
        const d = await api(isMe ? EP.reelsMine : EP.reelsOfUser(uid));
        setReels(d.reels || []);
      } else if (tab === "saved" && isMe) {
        const d = await api(EP.reelsSaved);
        setSaved(d.reels || []);
      }
    } catch { if (tab === "reels") setReels([]); else setSaved([]); }
  }, [uid, tab, isMe]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { loadTab(); }, [loadTab]));

  // opened from Home -> "Create -> Profile photo"
  useEffect(() => { if (isMe && route.params?.edit) openEdit(); }, [route.params?.edit]); // eslint-disable-line

  const u = p?.user;
  const stats = p?.stats || {};
  const posts = (p?.content || []).filter((x) => x.media_url);

  const openEdit = () => {
    const x = p?.user || me || {};
    setForm({ name: x.name || "", bio: x.bio || "", website: x.website || "", instagram: x.instagram || "", social_link: x.social_link || "" });
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!form.name.trim()) return Alert.alert("Name required", "Please enter your name.");
    setSaving(true);
    try {
      const d = await api(EP.myProfile, { method: "PUT", body: { ...form, name: form.name.trim() } });
      patchUser({ name: d.user.name });
      setEditing(false);
      load();
    } catch (e) { Alert.alert("Could not save", e.message); }
    setSaving(false);
  };

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo library access.");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    const ext = (a.uri.split(".").pop() || "jpg").toLowerCase().split("?")[0];
    const fd = new FormData();
    fd.append("photo", { uri: a.uri, name: a.fileName || `photo.${ext}`, type: a.mimeType || (ext === "png" ? "image/png" : "image/jpeg") });
    try {
      const d = await api(EP.myPhoto, { method: "POST", form: fd });
      patchUser({ profile_photo: d.profile_photo });
      load();
    } catch (e) { Alert.alert("Upload failed", e.message); }
  };

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try { await api(next ? EP.follow : EP.unfollow, { method: "POST", body: { user_id: uid } }); load(); }
    catch (e) { setFollowing(!next); Alert.alert("Failed", e.message); }
  };

  const stat = (n, l) => (
    <View className="flex-1 items-center gap-1">
      <Text className="text-white text-[18px] font-extrabold">{n ?? 0}</Text>
      <Text className="text-[#71809a] text-[11px]">{l}</Text>
    </View>
  );

  const tabs = isMe ? ["reels", "saved", "posts"] : ["reels", "posts"];
  const label = { reels: "Reels", saved: "Saved", posts: "Posts" };
  const grid = tab === "reels" ? reels : tab === "saved" ? saved : posts;

  return (
    <SafeAreaView className="flex-1 bg-[#050b18]" edges={["top"]}>
      <Header
        title={u ? (u.username ? `@${u.username}` : u.name) : "Profile"}
        onBack={isMe ? undefined : () => navigation.goBack()}
        right={
          <Pressable onPress={() => setMenu(true)} className="w-10 h-10 rounded-xl bg-[#0d1729] border border-white/10 items-center justify-center">
            <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
          </Pressable>
        }
      />
      {loading ? <ActivityIndicator color="#1685ff" className="mt-10" /> : err ? (
        <View className="m-6 p-7 rounded-2xl border border-white/10 bg-[#0a1424] items-center">
          <Text className="text-white text-lg font-extrabold mb-2">Unable to open profile</Text>
          <Text className="text-[#71809a] text-[13px] mb-4 text-center">{err}</Text>
          <Pressable onPress={() => (isMe ? load() : navigation.goBack())} className="h-10 px-5 rounded-xl bg-[#1685ff] items-center justify-center">
            <Text className="text-white font-bold text-[13px]">{isMe ? "Retry" : "Go Back"}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-3 pb-24">
          <View className="mt-3 p-[18px] flex-row items-center gap-5 rounded-[18px] bg-[#0a1424] border border-white/10">
            <Pressable onPress={isMe ? changePhoto : undefined} className="w-[96px] h-[96px] rounded-full p-0.5 bg-[#1685ff]">
              {u?.profile_photo
                ? <Image source={{ uri: absUrl(u.profile_photo) }} className="w-full h-full rounded-full bg-[#0d1729] border-[3px] border-[#0a1424]" />
                : <View className="w-full h-full rounded-full bg-[#0d1729] border-[3px] border-[#0a1424] items-center justify-center">
                    <Text className="text-white text-3xl font-bold">{(u?.name || "U").charAt(0).toUpperCase()}</Text>
                  </View>}
              {isMe && (
                <View className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-[#1685ff] items-center justify-center border-2 border-[#0a1424]">
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
            <View className="flex-1 gap-1.5">
              <Text className="text-white text-xl font-extrabold" numberOfLines={1}>{u?.name}</Text>
              <Text className="text-[#71809a] text-[13px]" numberOfLines={1}>@{u?.username}  ·  {u?.user_id}</Text>
              {isMe ? (
                <Pressable onPress={openEdit} className="self-start h-8 px-3.5 mt-1 rounded-lg bg-[#13233b] border border-white/10 items-center justify-center">
                  <Text className="text-white text-xs font-bold">Edit profile</Text>
                </Pressable>
              ) : (
                <View className="flex-row gap-2 mt-1">
                  <Pressable onPress={toggleFollow} className={`h-8 px-3.5 rounded-lg items-center justify-center ${following ? "bg-[#202733]" : "bg-[#1685ff]"}`}>
                    <Text className="text-white text-xs font-bold">{following ? "Following" : "Follow"}</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate("Chat", { user: u })} className="h-8 px-3.5 rounded-lg bg-[#13233b] border border-white/10 items-center justify-center">
                    <Text className="text-white text-xs font-bold">Message</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          <View className="flex-row mt-2.5 py-4 px-2 rounded-[17px] bg-[#0a1424] border border-white/10">
            {stat(stats.followers, "Followers")}
            {stat(stats.connected, "Connected")}
            {stat(stats.following, "Following")}
            {stat(stats.posts, "Posts")}
          </View>

          <View className="mt-2.5 p-[18px] rounded-[17px] bg-[#0a1424] border border-white/10">
            <Text className="text-white text-[15px] font-extrabold mb-2">Bio</Text>
            <Text className="text-[#9aa7bb] text-[13px] leading-5">{u?.bio || "No bio available."}</Text>
            {u?.website ? <Text className="text-brandLight text-[13px] mt-2">{u.website}</Text> : null}
            {u?.instagram ? <Text className="text-brandLight text-[13px] mt-1">Instagram: {u.instagram}</Text> : null}
            {u?.social_link ? <Text className="text-brandLight text-[13px] mt-1">{u.social_link}</Text> : null}
          </View>

          <View className="mt-2.5 rounded-[17px] bg-[#0a1424] border border-white/10 overflow-hidden">
            <View className="flex-row h-[54px] border-b border-white/10">
              {tabs.map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} className="flex-1 items-center justify-center">
                  <Text className={`text-[13px] font-bold ${tab === t ? "text-[#1685ff]" : "text-[#64748a]"}`}>{label[t]}</Text>
                  {tab === t && <View className="absolute bottom-0 left-[22%] right-[22%] h-0.5 rounded-full bg-[#1685ff]" />}
                </Pressable>
              ))}
            </View>
            {grid.length === 0 ? <Empty text={`No ${label[tab].toLowerCase()} yet.`} /> : (
              <View className="flex-row flex-wrap p-[3px]">
                {grid.map((it) => {
                  const isReel = tab !== "posts";
                  return (
                    <Pressable key={`${tab}-${it.id}`} style={{ width: "33.33%" }} className="aspect-square p-[1.5px]"
                      onPress={() => isReel && setPlayer(it)}>
                      <View className="flex-1 bg-[#0d1729] items-center justify-center overflow-hidden">
                        {(isReel ? it.thumbnail_url : (it.media_type || "").startsWith("image") && it.media_url)
                          ? <Image source={{ uri: absUrl(isReel ? it.thumbnail_url : it.media_url) }} className="w-full h-full" />
                          : <Text className="text-[#dce5f2] text-xs text-center p-2" numberOfLines={5}>{it.caption || it.content || ""}</Text>}
                        {isReel && <Ionicons name="play" size={14} color="#fff" style={{ position: "absolute", top: 6, right: 6 }} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* "…" menu */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable className="flex-1" onPress={() => setMenu(false)}>
          <View className="absolute top-[70px] right-3 w-[175px] p-2 rounded-2xl bg-[#0b1424] border border-white/10">
            {(isMe ? ["Edit profile", "Share", "Logout"] : ["Share"]).map((l) => (
              <Pressable key={l} className="min-h-[42px] justify-center px-3 rounded-xl"
                onPress={() => {
                  setMenu(false);
                  if (l === "Logout") signOut();
                  if (l === "Edit profile") openEdit();
                  if (l === "Share") Share.share({ message: `Connect with ${u?.username || "me"} on UtaNexa (${u?.user_id})` });
                }}>
                <Text className={`text-[13px] ${l === "Logout" ? "text-danger" : "text-[#e8edf5]"}`}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* edit profile */}
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <SafeAreaView className="flex-1 bg-[#050b18]">
          <View className="h-14 flex-row items-center justify-between px-4 border-b border-white/10">
            <Pressable onPress={() => setEditing(false)}><Text className="text-[#9aa7bb] text-[15px]">Cancel</Text></Pressable>
            <Text className="text-white text-[17px] font-bold">Edit profile</Text>
            <Pressable onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#1685ff" /> : <Text className="text-[#1685ff] text-[15px] font-bold">Save</Text>}
            </Pressable>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
            <ScrollView contentContainerClassName="p-4 gap-4" keyboardShouldPersistTaps="handled">
              <Pressable onPress={changePhoto} className="self-center h-10 px-5 rounded-xl bg-[#13233b] border border-white/10 items-center justify-center">
                <Text className="text-white text-[13px] font-semibold">Change profile photo</Text>
              </Pressable>
              {[["name", "Name", 100], ["bio", "Bio", 500], ["website", "Website", 500], ["instagram", "Instagram", 500], ["social_link", "Other link", 500]].map(([k, l, max]) => (
                <View key={k}>
                  <Text className="text-[#9aa7bb] text-xs mb-1.5">{l}</Text>
                  <TextInput value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} maxLength={max}
                    multiline={k === "bio"} autoCapitalize={k === "name" || k === "bio" ? "sentences" : "none"}
                    placeholderTextColor="#64748a" placeholder={l}
                    className={`px-4 rounded-xl border border-white/10 bg-[#0a1424] text-white text-[14px] ${k === "bio" ? "min-h-[100px] pt-3" : "h-12"}`}
                    style={k === "bio" ? { textAlignVertical: "top" } : undefined} />
                </View>
              ))}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* reel player */}
      <Modal visible={!!player} animationType="fade" onRequestClose={() => setPlayer(null)}>
        <View className="flex-1 bg-black">
          {player && (
            <Video source={{ uri: absUrl(player.video_url) }} style={{ flex: 1 }} resizeMode={ResizeMode.CONTAIN}
              shouldPlay isLooping useNativeControls />
          )}
          {player?.caption ? <Text className="absolute left-4 right-4 bottom-10 text-white text-[13px]">{player.caption}</Text> : null}
          <Pressable onPress={() => setPlayer(null)} className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/60 items-center justify-center">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
