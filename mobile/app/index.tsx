import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-primary-600">Wippestoolen</Text>
      <Text className="text-gray-500 mt-2">Mobile App</Text>
    </View>
  );
}
