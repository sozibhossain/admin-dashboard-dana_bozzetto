"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Send } from 'lucide-react';
import Image from 'next/image';
import { chatsAPI, messagesAPI } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

type Chat = {
  _id: string;
  users: { _id: string; name: string; email: string; avatar?: { url?: string } }[];
  project?: { name?: string };
  latestMessage?: { content?: string; createdAt?: string; sender?: { name?: string } };
};

type Message = {
  _id: string;
  sender?: { _id?: string; name?: string; avatar?: { url?: string } };
  content?: string;
  createdAt: string;
  attachments?: { url: string; fileType?: string }[];
};

function MessagesPageContent() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedChatId = searchParams.get('chatId');
  const socketRef = useRef<Socket | null>(null);
  const lastChatIdRef = useRef<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const requestedChatIdRef = useRef<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const { data: chatsData, isLoading: chatsLoading, isError: chatsError } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      const res = await chatsAPI.getAll();
      return res.data as Chat[];
    },
    staleTime: 30000,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeChatId],
    enabled: !!activeChatId,
    queryFn: async () => {
      const res = await messagesAPI.getByChat(activeChatId as string);
      return res.data as Message[];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (chatId: string) => messagesAPI.markRead(chatId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', activeChatId] }),
  });

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = chatsData || [];
    if (!term) return list;
    return list.filter((chat) => {
      const other = chat.users.find((u) => u._id !== currentUserId);
      const haystack = `${other?.name || ''} ${other?.email || ''} ${chat.project?.name || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [chatsData, search, currentUserId]);

  const activeChat = filteredChats.find((c) => c._id === activeChatId);
  const otherUser = activeChat?.users.find((u) => u._id !== currentUserId);

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    markReadMutation.mutate(chatId);
  };

  useEffect(() => {
    if (!session?.accessToken) return;

    const socketUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token: `Bearer ${session.accessToken}` },
    });

    socketRef.current = socket;

    socket.on('message received', (message: any) => {
      const chatId = message?.chat?._id || message?.chat;
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }

      const currentChatId = activeChatIdRef.current;
      if (chatId && currentChatId && chatId === currentChatId) {
        queryClient.setQueryData(['messages', currentChatId], (old: any) => {
          const existing = Array.isArray(old) ? old : [];
          return [...existing, message];
        });
      }
    });

    socket.on('message:error', (err: any) => {
      toast.error(err?.message || 'Failed to send message');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      lastChatIdRef.current = null;
    };
  }, [session?.accessToken, queryClient]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const previous = lastChatIdRef.current;
    if (previous && previous !== activeChatId) {
      socket.emit('leave chat', previous);
    }

    if (activeChatId) {
      socket.emit('join chat', activeChatId);
      lastChatIdRef.current = activeChatId;
    } else {
      lastChatIdRef.current = null;
    }
  }, [activeChatId]);

  useEffect(() => {
    if (!requestedChatId || !filteredChats.length) return;
    const exists = filteredChats.some((chat) => chat._id === requestedChatId);
    if (!exists) return;
    if (activeChatId !== requestedChatId) {
      setActiveChatId(requestedChatId);
    }
    if (requestedChatIdRef.current !== requestedChatId) {
      requestedChatIdRef.current = requestedChatId;
      markReadMutation.mutate(requestedChatId);
    }
  }, [requestedChatId, filteredChats, activeChatId, markReadMutation]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const handleSend = () => {
    const socket = socketRef.current;
    if (!socket) {
      toast.error('Socket is not connected');
      return;
    }
    if (!activeChatId) {
      toast.error('Select a chat first');
      return;
    }
    if (!messageText.trim()) return;

    socket.emit('message:send', {
      chatId: activeChatId,
      content: messageText.trim(),
    });
    setMessageText('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Messages</h1>
        <p className="text-slate-400">Your conversation with team and clients</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white" />
            <Input
              type="text"
              placeholder="Search by name, email, project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px]">
            {chatsLoading ? (
              <div className="text-slate-300 p-4">Loading chats...</div>
            ) : chatsError ? (
              <div className="text-red-300 p-4">Failed to load chats</div>
            ) : filteredChats.length === 0 ? (
              <div className="text-slate-400 p-4">No chats found</div>
            ) : (
              filteredChats.map((chat) => {
                const other = chat.users.find((u) => u._id !== currentUserId);
                return (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat._id)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      activeChatId === chat._id
                        ? 'bg-teal-600 border border-teal-500'
                        : 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Image
                        src={other?.avatar?.url || '/placeholder.svg'}
                        alt={other?.name || 'User'}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-white truncate">
                            {other?.name || 'Unknown'}
                          </p>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {chat.latestMessage?.createdAt
                              ? new Date(chat.latestMessage.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {chat.latestMessage?.content || 'No messages yet'}
                        </p>
                        {chat.project?.name && (
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            Project: {chat.project.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 hidden lg:flex flex-col rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
          {activeChat ? (
            <>
              <div className="border-b border-slate-700 pb-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChatId(null)}
                    className="text-slate-400 hover:text-white mr-2"
                  >
                    ? Back
                  </button>
                  <Image
                    src={otherUser?.avatar?.url || '/placeholder.svg'}
                    alt={otherUser?.name || 'User'}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {otherUser?.name || 'Conversation'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {activeChat.project?.name ? `Project: ${activeChat.project.name}` : 'Direct chat'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mb-4 space-y-4 px-2">
                {messagesLoading ? (
                  <div className="text-slate-300">Loading messages...</div>
                ) : !messagesData || messagesData.length === 0 ? (
                  <div className="text-slate-400">No messages yet</div>
                ) : (
                  messagesData.map((msg) => {
                    const isSender = msg.sender?._id === currentUserId;
                    return (
                      <div
                        key={msg._id}
                        className={`flex gap-3 ${isSender ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isSender && (
                          <Image
                            src={msg.sender?.avatar?.url || '/placeholder.svg'}
                            alt={msg.sender?.name || 'Sender'}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full flex-shrink-0"
                          />
                        )}
                        <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`rounded-lg px-4 py-2 max-w-xs ${
                              isSender
                                ? 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white'
                                : 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-slate-200'
                            }`}
                          >
                            {msg.content || '[attachment]'}
                          </div>
                          <span className="text-xs text-slate-500 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  type="button"
                  onClick={handleSend}
                  disabled={!messageText}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Messages</h1>
            <p className="text-slate-400">Loading conversations...</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 text-slate-300">
            Loading messages...
          </div>
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
