import React, { useEffect, useRef, useState } from 'react';
import { useTeamChat } from '../hooks/useWebSocket';
import { useLanguage } from '../i18n';

/**
 * TeamChat - Floating team chat panel
 * Real-time messaging between team members
 */
const TeamChat = ({ currentUser }) => {
  const { t } = useLanguage();
  const {
    messages,
    onlineUsers,
    typingUsers,
    unreadCount,
    isOpen,
    sendMessage,
    sendTyping,
    toggleChat,
    closeChat,
  } = useTeamChat('general');

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    // Send typing indicator
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      sendTyping(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTyping(false);
    }, 2000);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
      setIsTyping(false);
      sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('time.today');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('time.yesterday');
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {});

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const isOwnMessage = (msg) => {
    return msg.user_id === currentUser?.user_id || msg.username === currentUser?.username;
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-105"
        style={{ 
          background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
          boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)'
        }}
        title={t('chat.title')}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 w-96 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl z-50 flex flex-col transition-all duration-300 ${
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ 
          height: '500px',
          maxHeight: 'calc(100vh - 150px)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div 
          className="p-4 border-b border-gray-700 flex items-center justify-between rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              💬
            </div>
            <div>
              <h3 className="font-bold text-white">{t('chat.title')}</h3>
              <p className="text-xs text-zinc-400">
                {onlineUsers.length > 0 
                  ? `${onlineUsers.length} ${t('chat.online')}` 
                  : t('chat.generalChannel')}
              </p>
            </div>
          </div>
          <button
            onClick={closeChat}
            className="p-2 rounded-lg hover:bg-gray-800 text-zinc-400 hover:text-white transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Online Users Bar */}
        {onlineUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider shrink-0">{t('chat.online')}:</span>
            {onlineUsers.slice(0, 5).map((user) => (
              <div
                key={user.user_id}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded-full shrink-0"
                title={user.full_name || user.username}
              >
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs text-zinc-300">{user.username}</span>
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <span className="text-xs text-zinc-500">+{onlineUsers.length - 5}</span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-zinc-400 text-sm">{t('chat.noMessages')}</p>
              <p className="text-zinc-500 text-xs">{t('chat.startConversation')}</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date Separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-700"></div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{date}</span>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>

                {/* Messages for this date */}
                {msgs.map((msg, idx) => {
                  const own = isOwnMessage(msg);
                  const showAvatar = idx === 0 || msgs[idx - 1]?.user_id !== msg.user_id;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${own ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'}`}
                    >
                      {/* Avatar */}
                      {showAvatar ? (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            own ? 'bg-purple-600' : 'bg-gray-700'
                          }`}
                          title={msg.full_name || msg.username}
                        >
                          {getInitials(msg.full_name || msg.username)}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0"></div>
                      )}

                      {/* Message Bubble */}
                      <div className={`max-w-[75%] ${own ? 'items-end' : 'items-start'}`}>
                        {showAvatar && !own && (
                          <p className="text-[10px] text-zinc-500 mb-1 ml-1">
                            {msg.full_name || msg.username}
                          </p>
                        )}
                        <div
                          className={`px-3 py-2 rounded-2xl ${
                            own
                              ? 'bg-purple-600 text-white rounded-br-md'
                              : 'bg-gray-800 text-zinc-200 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        <p className={`text-[10px] text-zinc-600 mt-1 ${own ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-xs">
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.typeMessage')}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-4 py-2 rounded-xl text-white font-medium disabled:opacity-50 transition"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              title={t('chat.send')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TeamChat;
