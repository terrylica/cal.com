import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function OOOLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: Platform.OS === "ios",
          title: "Out of Office",
        }}
      />
    </Stack>
  );
}
