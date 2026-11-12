import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Banner, Button, Card, Divider, Row, Screen, text } from '@/components/ui';
import { useAuthStore } from '@/store/useAuthStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';

function timeLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export default function InboxScreen() {
  const user = useAuthStore((s) => s.user);
  const conversations = useCommunityStore((s) => s.conversations);
  const messages = useCommunityStore((s) => s.messages);
  const lastReadAt = useCommunityStore((s) => s.lastReadAt);
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  if (!user) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.faint} />
          <Text style={[text.h3, { marginTop: space.sm }]}>Your messages</Text>
          <Text style={[text.body, { textAlign: 'center', marginTop: 4 }]}>Chat with charger hosts and car sellers. Phone numbers stay private.</Text>
          <Button title="Sign in" style={{ marginTop: space.md, alignSelf: 'stretch' }} onPress={() => router.push('/auth/sign-in?returnTo=/inbox')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Banner icon="shield-checkmark-outline" tone="green" text="Chats stay inside EVWorld. Phone numbers, emails and WhatsApp links are hidden automatically." />
      {sorted.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.faint} />
          <Text style={[text.body, { textAlign: 'center', marginTop: space.sm }]}>No messages yet. Request a community charger or message a car seller to start a chat.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {sorted.map((c, i) => {
            const thread = messages.filter((m) => m.conversationId === c.id);
            const last = thread[thread.length - 1];
            const unread = thread.filter((m) => m.from !== 'me' && m.at > (lastReadAt[c.id] ?? 0)).length;
            return (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <Card onPress={() => router.push(`/chat/${c.id}`)} style={{ padding: 0, shadowOpacity: 0, elevation: 0 }}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.kind === 'community' ? colors.purpleSoft : colors.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={c.kind === 'community' ? 'home' : 'car-sport'} size={20} color={c.kind === 'community' ? colors.purple : colors.amber} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text style={[text.strong, { flex: 1 }]} numberOfLines={1}>
                          {c.counterpartName}
                        </Text>
                        {last ? <Text style={text.small}>{timeLabel(last.at)}</Text> : null}
                      </Row>
                      <Text style={text.small} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={[text.body, { flex: 1 }, unread > 0 && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
                          {last ? (last.from === 'me' ? `You: ${last.text}` : last.text) : 'Say hello'}
                        </Text>
                        {unread > 0 ? (
                          <View style={{ backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread}</Text>
                          </View>
                        ) : null}
                      </Row>
                    </View>
                  </Row>
                </Card>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
