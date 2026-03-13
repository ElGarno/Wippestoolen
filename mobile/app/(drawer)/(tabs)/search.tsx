import { View, Text } from "react-native";

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Suche</Text>
      <Text className="text-gray-500 mt-2">Werkzeuge suchen und filtern</Text>
    </View>
  );
}
