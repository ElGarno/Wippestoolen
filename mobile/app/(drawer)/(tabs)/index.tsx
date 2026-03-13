import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Home</Text>
      <Text className="text-gray-500 mt-2">Werkzeuge in deiner Nähe</Text>
    </View>
  );
}
