import type { MessageDTO } from '../modules/messages/messages.service';

export interface ClientToServerEvents {
  'chat:join': (data: { chatId: string }) => void;
  'chat:leave': (data: { chatId: string }) => void;
  'message:send': (data: { chatId: string; content: string }) => void;
  'typing:start': (data: { chatId: string }) => void;
  'typing:stop': (data: { chatId: string }) => void;
  'read:mark': (data: { chatId: string; lastReadMessageId: string }) => void;
}

export interface ServerToClientEvents {
  'message:new': (data: { chatId: string; message: MessageDTO }) => void;
  typing: (data: { chatId: string; userId: string; isTyping: boolean }) => void;
  'presence:update': (data: {
    userId: string;
    status: 'online' | 'offline';
    lastSeen?: string;
  }) => void;
  'read:update': (data: {
    chatId: string;
    userId: string;
    lastReadMessageId: string;
  }) => void;
  'message:translated': (data: {
    chatId: string;
    messageId: string;
    lang: string;
    content: string;
  }) => void;
  'notification:new': (data: { notification: any }) => void;
  'notification:read': (data: { notificationId: string }) => void;
  error: (data: { message: string }) => void;
}

export interface SocketData {
  userId: string;
}
