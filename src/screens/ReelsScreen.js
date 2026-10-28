import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, FlatList, useWindowDimensions, ActivityIndicator, Modal, TextInput,
  Share, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { api, absUrl } from "../api/client";
import { EP } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Avatar, Empty } from "../components/ui";

const PAGE = 10;
const REPORT_REASONS = ["Spam", "Nudity", "Violence", "Hate or harassment", "False information", "Other"];
const SESSION_ID = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const total = (r) => (r.one_star_count || 0) + (r.two_star_count || 0) + (r.three_star_count || 0);

export default function ReelsScreen({ navigation }) {
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const tabH = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const h = height - tabH;

  const [reels, setReels] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState({});      // reel id -> true
  const [myStars, setMyStars] = useState({});  // reel id -> 1..3 (this session)
  const [sheet, setSheet] = useState(null);    // {type: 'comments'|'menu'|'rate'|'report', reel}
  const [comments, setComments] = useState([]);
  const [cLoading, setCLoading] = useState(false);
  const [draft, setDraft] = useState("");

  const progress = useRef({});   // id -> {pos, dur}
  const fetching = useRef(false);
  const loadedOnce = useRef(false);

  const patch = (id, fields) => setReels((l) => l.map((r) => (r.id === id ? { ...r, ...fields } : r)));

  // ── feed ────────────────────────────────────────────────────
  const fetchPage = useCallback(async (reset) => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const q = `?limit=${PAGE}${!reset && cursor ? `&cursor=${cursor}` : ""}`;
      const d = await api(EP.reelsFeed + q);
      const list = d.reels || [];
      setReels((prev) => (reset ? list : [...prev, ...list.filter((r) => !prev.some((p) => p.id === r.id))]));
      setCursor(d.next_cursor || null);
      setMore(list.length >= PAGE && !!d.next_cursor);
    } catch (e) { if (reset) setReels([]); }
    fetching.current = false;
    setLoading(false);
  }, [cursor]);

  const loadSaved = useCallback(async () => {
    try {
      const d = await api(EP.reelsSaved);
      const m = {}; (d.reels || []).forEach((r) => { m[r.id] = true; });
      setSaved(m);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    if (!loadedOnce.current) { loadedOnce.current = true; fetchPage(true); } // keep scroll position when returning to the tab
    loadSaved();
    return () => { setFocused(false); flushWatch(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // ── watch analytics: POST /api/reels/{id}/watch ─────────────
  const activeRef = useRef({ id: null, index: 0 });
  const flushWatch = useCallback(() => {
    const { id, index } = activeRef.current;
    const p = id && progress.current[id];
    if (!p || !p.dur) return;
    const watch = Math.min(p.pos, p.dur) / 1000;
    const pct = Math.min(100, Math.round((p.pos / p.dur) * 100));
    api(EP.reelWatch(id), {
      method: "POST",
      body: { watch_time: watch, watch_percentage: pct, completed: pct >= 90, replayed: false, session_id: SESSION_ID, feed_position: index, source: "feed" },
      silent401: true,
    }).catch(() => {});
    progress.current[id] = { pos: 0, dur: p.dur };
  }, []);

  const onViewable = useRef(({ viewableItems }) => {
    const v = viewableItems[0];
    if (!v) return;
    if (activeRef.current.id !== v.item.id) flushWatch();
    activeRef.current = { id: v.item.id, index: v.index ?? 0 };
    setActive(v.index ?? 0);
  }).current;

  useEffect(() => () => flushWatch(), [flushWatch]);

  // ── actions ─────────────────────────────────────────────────
  const rate = async (reel, rating) => {
    setSheet(null);
    try {
      const d = await api(EP.reelRating(reel.id), { method: "POST", body: { rating } });
      setMyStars((m) => ({ ...m, [reel.id]: rating }));
      patch(reel.id, { one_star_count: d.one_star_count, two_star_count: d.two_star_count, three_star_count: d.three_star_count });
    } catch (e) { Alert.alert("Could not rate", e.message); }
  };

  const toggleSave = async (reel) => {
    const was = !!saved[reel.id];
    setSaved((s) => ({ ...s, [reel.id]: !was }));
    try {
      const d = await api(EP.reelSave(reel.id), { method: was ? "DELETE" : "POST" });
      if (typeof d.save_count === "number") patch(reel.id, { save_count: d.save_count });
    } catch (e) { setSaved((s) => ({ ...s, [reel.id]: was })); Alert.alert("Failed", e.message); }
  };

  const share = async (reel) => {
    try {
      const r = await Share.share({ message: `${reel.caption ? reel.caption + "\n" : ""}${reel.video_url}` });
      if (r.action === Share.sharedAction) {
        const d = await api(EP.reelShare(reel.id), { method: "POST", body: { share_type: "native" } });
        if (typeof d.share_count === "number") patch(reel.id, { share_count: d.share_count });
      }
    } catch {}
  };

  const openComments = async (reel) => {
    setSheet({ type: "comments", reel }); setComments([]); setDraft(""); setCLoading(true);
    try { const d = await api(EP.reelComments(reel.id) + "?limit=100"); setComments(d.comments || []); } catch {}
    setCLoading(false);
  };

  const sendComment = async () => {
    const reel = sheet?.reel; const content = draft.trim();
    if (!reel || !content) return;
    setDraft("");
    try {
      const d = await api(EP.reelComments(reel.id), { method: "POST", body: { content } });
      setComments((l) => [d.comment, ...l]);
      patch(reel.id, { comment_count: (reel.comment_count || 0) + 1 });
      setSheet((s) => s && { ...s, reel: { ...s.reel, comment_count: (s.reel.comment_count || 0) + 1 } });
    } catch (e) { Alert.alert("Could not comment", e.message); setDraft(content); }
  };

  const deleteComment = async (c) => {
    const reel = sheet.reel;
    try {
      await api(EP.reelComment(reel.id, c.id), { method: "DELETE" });
      setComments((l) => l.filter((x) => x.id !== c.id));
      patch(reel.id, { comment_count: Math.max(0, (reel.comment_count || 1) - 1) });
    } catch (e) { Alert.alert("Could not delete", e.message); }
  };

  const notInterested = async (reel) => {
    setSheet(null);
    setReels((l) => l.filter((r) => r.id !== reel.id));
    try { await api(EP.reelNotInterested(reel.id), { method: "POST" }); } catch {}
  };

  const report = async (reel, reason) => {
    setSheet(null);
    try { await api(EP.reelReport(reel.id), { method: "POST", body: { reason } }); Alert.alert("Thanks", "Your report was submitted."); }
    catch (e) { Alert.alert("Could not report", e.message); }
  };

  const remove = (reel) => {
    setSheet(null);
    Alert.alert("Delete reel", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api(EP.reelDelete(reel.id), { method: "DELETE" }); setReels((l) => l.filter((r) => r.id !== reel.id)); }
        catch (e) { Alert.alert("Could not delete", e.message); }
      } },
    ]);
  };

  const Btn = ({ icon, color = "#fff", label, onPress }) => (
    <Pressable onPress={onPress} className="items-center">
      <Ionicons name={icon} size={30} color={color} />
      {label !== undefined && <Text className="text-white text-[11px] mt-0.5">{label}</Text>}
    </Pressable>
  );

  return (
    <View className="flex-1 bg-black">
      <Pressable onPress={() => navigation.navigate("ReelUpload")}
        style={{ top: insets.top + 8 }} className="absolute right-4 z-10 w-10 h-10 rounded-full bg-black/45 items-center justify-center">
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {loading ? <ActivityIndicator color="#fff" className="flex-1" /> : (
        <FlatList
          data={reels}
          pagingEnabled
          snapToInterval={h}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          keyExtractor={(r) => String(r.id)}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (more && !fetching.current) fetchPage(false); }}
          windowSize={3}
          ListEmptyComponent={<View style={{ height: h }} className="justify-center"><Empty text="No reels yet. Tap + to create the first one." /></View>}
          renderItem={({ item, index }) => {
            const c = item.creator || {};
            const stars = total(item);
            return (
              <View style={{ height: h }} className="bg-black">
                <Pressable onPress={() => setMuted(!muted)} className="flex-1">
                  <Video
                    source={{ uri: absUrl(item.video_url) }}
                    posterSource={item.thumbnail_url ? { uri: absUrl(item.thumbnail_url) } : undefined}
                    usePoster
                    style={{ width: "100%", height: "100%" }}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    isMuted={muted}
                    shouldPlay={focused && index === active}
                    progressUpdateIntervalMillis={500}
                    onPlaybackStatusUpdate={(s) => {
                      if (s.isLoaded) progress.current[item.id] = { pos: s.positionMillis || 0, dur: s.durationMillis || progress.current[item.id]?.dur || 0 };
                    }}
                  />
                </Pressable>
                <View className="absolute left-4 bottom-6 right-24">
                  <Pressable onPress={() => c.user_id && navigation.navigate("UserProfile", { userId: c.user_id })} className="flex-row items-center mb-2">
                    <Avatar uri={c.profile_photo} name={c.username || c.name} size={36} />
                    <Text className="text-white font-bold ml-2.5">@{c.username || "user"}</Text>
                  </Pressable>
                  {item.caption ? <Text className="text-white text-[13px]" numberOfLines={3}>{item.caption}</Text> : null}
                  {item.hashtags ? <Text className="text-brandLight text-[12px] mt-1" numberOfLines={1}>{item.hashtags}</Text> : null}
                </View>
                <View className="absolute right-4 bottom-8 items-center gap-5">
                  <Btn icon={myStars[item.id] ? "star" : "star-outline"} color={myStars[item.id] ? "#ffc83d" : "#fff"} label={stars}
                    onPress={() => setSheet({ type: "rate", reel: item })} />
                  <Btn icon="chatbubble-outline" label={item.comment_count || 0} onPress={() => openComments(item)} />
                  <Btn icon={saved[item.id] ? "bookmark" : "bookmark-outline"} color={saved[item.id] ? "#72b0ff" : "#fff"} label={item.save_count || 0} onPress={() => toggleSave(item)} />
                  <Btn icon="paper-plane-outline" label={item.share_count || 0} onPress={() => share(item)} />
                  <Btn icon="ellipsis-horizontal" onPress={() => setSheet({ type: "menu", reel: item })} />
                  <Ionicons name={muted ? "volume-mute" : "volume-high"} size={22} color="#fff" />
                </View>
              </View>
            );
          }}
        />
      )}

      {/* rate */}
      <Modal visible={sheet?.type === "rate"} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable className="flex-1 bg-black/60 justify-center items-center" onPress={() => setSheet(null)}>
          <View className="bg-[#0b1424] border border-white/10 rounded-2xl px-6 py-5 items-center">
            <Text className="text-white text-base font-bold mb-3">Rate this reel</Text>
            <View className="flex-row gap-4">
              {[1, 2, 3].map((n) => (
                <Pressable key={n} onPress={() => rate(sheet.reel, n)}>
                  <Ionicons name={(myStars[sheet?.reel?.id] || 0) >= n ? "star" : "star-outline"} size={42} color="#ffc83d" />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* comments */}
      <Modal visible={sheet?.type === "comments"} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable className="flex-1 bg-black/55 justify-end" onPress={() => setSheet(null)}>
          <Pressable className="h-[68%] bg-[#0b1220] rounded-t-3xl border-t border-white/10" onPress={() => {}}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
              <View className="h-12 items-center justify-center border-b border-white/10">
                <Text className="text-white font-bold">Comments {sheet?.reel?.comment_count ? `(${sheet.reel.comment_count})` : ""}</Text>
              </View>
              {cLoading ? <ActivityIndicator color="#247cff" className="mt-6" /> : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => String(c.id)}
                  contentContainerClassName="p-3.5 gap-3.5"
                  ListEmptyComponent={<Empty text="No comments yet. Be the first." />}
                  renderItem={({ item: c }) => (
                    <View className="flex-row">
                      <Avatar uri={c.user?.profile_photo} name={c.user?.name || c.user?.username} size={34} />
                      <View className="flex-1 ml-2.5">
                        <Text className="text-[#9aa7bb] text-[11px]">@{c.user?.username}</Text>
                        <Text className="text-white text-[13px] leading-5">{c.content}</Text>
                      </View>
                      {c.user_id === user.id && (
                        <Pressable onPress={() => deleteComment(c)} hitSlop={8}><Ionicons name="trash-outline" size={17} color="#7f8b9b" /></Pressable>
                      )}
                    </View>
                  )}
                />
              )}
              <View className="flex-row items-center gap-2 px-3 py-2.5 border-t border-white/10">
                <TextInput value={draft} onChangeText={setDraft} maxLength={2000} placeholder="Add a comment…" placeholderTextColor="#71809a"
                  className="flex-1 h-11 px-4 rounded-full bg-[#121b2e] text-white text-[14px]" onSubmitEditing={sendComment} />
                <Pressable onPress={sendComment} className="w-11 h-11 rounded-full bg-brand items-center justify-center"><Ionicons name="send" size={18} color="#fff" /></Pressable>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ⋯ menu / report */}
      <Modal visible={sheet?.type === "menu" || sheet?.type === "report"} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable className="flex-1 bg-black/55 justify-end" onPress={() => setSheet(null)}>
          <Pressable className="bg-[#0b1220] rounded-t-3xl border-t border-white/10 px-4 pt-4 pb-8" onPress={() => {}}>
            {sheet?.type === "report" ? (
              <>
                <Text className="text-white text-base font-bold mb-2">Why are you reporting this?</Text>
                {REPORT_REASONS.map((r) => (
                  <Pressable key={r} onPress={() => report(sheet.reel, r)} className="h-12 justify-center"><Text className="text-ink text-[14px]">{r}</Text></Pressable>
                ))}
              </>
            ) : (
              <>
                {sheet?.reel?.user_id === user.id ? (
                  <Pressable onPress={() => remove(sheet.reel)} className="h-12 justify-center"><Text className="text-danger text-[14px]">Delete reel</Text></Pressable>
                ) : (
                  <>
                    <Pressable onPress={() => notInterested(sheet.reel)} className="h-12 justify-center"><Text className="text-ink text-[14px]">Not interested</Text></Pressable>
                    <Pressable onPress={() => setSheet({ type: "report", reel: sheet.reel })} className="h-12 justify-center"><Text className="text-danger text-[14px]">Report</Text></Pressable>
                  </>
                )}
                <Pressable onPress={() => setSheet(null)} className="h-12 justify-center"><Text className="text-[#9aa7bb] text-[14px]">Cancel</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
