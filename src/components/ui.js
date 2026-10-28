import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { absUrl } from "../api/client";

export function Brand({ size = 34, upper }) {
  const a = upper ? "UTA" : "Uta", b = upper ? "NEXA" : "Nexa";
  return (
    <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: -1.5 }} className="text-center">
      <Text className="text-brandLight">{a}</Text>
      <Text className="text-white">{b}</Text>
    </Text>
  );
}

export function Banner({ msg, type = "error" }) {
  if (!msg) return null;
  const c = type === "success" ? "border-success/30 bg-success/10" : type === "info" ? "border-brand/30 bg-brand/10" : "border-danger/30 bg-danger/10";
  const t = type === "success" ? "text-success" : type === "info" ? "text-brandLight" : "text-danger";
  return (
    <View className={`border rounded-xl px-3 py-3 ${c}`}>
      <Text className={`text-xs leading-5 ${t}`}>{msg}</Text>
    </View>
  );
}

export function Field({ label, icon, secure, right, ...props }) {
  const [hide, setHide] = useState(!!secure);
  const [focus, setFocus] = useState(false);
  return (
    <View>
      {label ? <Text className="text-[12.5px] font-semibold text-[#dce4f6] mb-2 ml-0.5">{label}</Text> : null}
      <View className={`h-[54px] flex-row items-center px-3.5 rounded-[13px] border bg-authSurface ${focus ? "border-[#4388ff]" : "border-white/15"}`}>
        {icon ? <Ionicons name={icon} size={20} color="#829ac3" style={{ marginRight: 11 }} /> : null}
        <TextInput
          {...props}
          secureTextEntry={hide}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholderTextColor="#71809b"
          className="flex-1 text-white text-[14px] h-full"
        />
        {secure ? (
          <Pressable onPress={() => setHide(!hide)} hitSlop={10}>
            <Ionicons name={hide ? "eye-outline" : "eye-off-outline"} size={21} color="#91a8d1" />
          </Pressable>
        ) : null}
        {right}
      </View>
    </View>
  );
}

export function PrimaryButton({ title, onPress, loading, disabled, arrow = true, small }) {
  const off = loading || disabled;
  return (
    <Pressable onPress={onPress} disabled={off} style={{ opacity: off ? 0.6 : 1 }}>
      <LinearGradient
        colors={["#3478fa", "#5267f5", "#7662f5"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ borderRadius: 13, minHeight: small ? 44 : 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Text className="text-white font-bold text-[14px]">{title}</Text>
            {arrow ? <Text className="text-white text-xl">→</Text> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.45 : 1 }}
      className="h-[49px] items-center justify-center rounded-xl border border-white/15 bg-[#151f35]">
      <Text className="text-[#e8eeff] font-semibold text-[13.5px]">{title}</Text>
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 52, ring }) {
  const initial = (name || "U").trim().charAt(0).toUpperCase();
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 1, borderColor: ring ? "#247cff" : "#27303d" }}
      className="bg-[#18202b] items-center justify-center overflow-hidden"
    >
      {uri ? <Image source={{ uri: absUrl(uri) }} style={{ width: "100%", height: "100%" }} />
           : <Text className="text-white font-bold" style={{ fontSize: size * 0.38 }}>{initial}</Text>}
    </View>
  );
}

export function Empty({ text }) {
  return <Text className="text-muted text-[13px] text-center py-12 px-5 leading-5">{text}</Text>;
}

export function Header({ title, onBack, right }) {
  return (
    <View className="h-[58px] flex-row items-center px-3 border-b border-white/5">
      <View className="w-11">
        {onBack ? (
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl bg-[#0d1729] border border-white/10 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Text className="flex-1 text-center text-white text-[18px] font-extrabold" numberOfLines={1}>{title}</Text>
      <View className="w-11 items-end">{right}</View>
    </View>
  );
}
