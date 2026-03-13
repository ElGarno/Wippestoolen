import { View, Text } from "react-native";
import { useAuth } from "../../../contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Profil</Text>
      <Text className="text-gray-500 mt-2">{user?.display_name}</Text>
    </View>
  );
}
