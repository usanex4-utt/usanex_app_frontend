import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Only things the backend can actually store: reel upload + profile photo.
const OPTIONS = [
  { type: "reel", label: "Reel", icon: "film-outline" },
  { type: "photo", label: "Profile photo", icon: "image-outline" },
];

export default function CreateSheet({ visible, onClose, onPick }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/65 justify-end" onPress={onClose}>
        <Pressable className="bg-[#081323] rounded-t-3xl border-t border-[#24364c] px-3.5 pt-2.5 pb-8" onPress={() => {}}>
          <View className="w-12 h-1 rounded-full bg-[#718096] self-center mb-3.5" />
          <View className="h-[42px] items-center justify-center mb-3">
            <Text className="text-white text-[18px] font-bold">Create</Text>
            <Pressable onPress={onClose} className="absolute right-0 w-9 h-9 items-center justify-center">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
          <View className="flex-row gap-2">
            {OPTIONS.map((o) => (
              <Pressable key={o.type} onPress={() => onPick(o.type)}
                className="flex-1 min-h-[100px] items-center justify-center gap-2 rounded-2xl border border-[#1d3046] bg-[#0d1a2b]">
                <Ionicons name={o.icon} size={36} color="#fff" />
                <Text className="text-white text-[12px] font-semibold" numberOfLines={1}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
