'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DynamicUI } from '@/components/ai/DynamicUI';
import { useDashboardState } from '@/hooks/useDashboardState';
import { Sparkles, Send, User, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ui?: unknown[];
  timestamp: Date;
  isLoading?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Show me users without any knowledge units or conversations",
  "What are the error trends over the last 7 days?",
  "Show LLM costs breakdown by day for the past week",
  "List all failed jobs with their error messages",
  "How many workspaces does each organization have?",
  "What's the Service Bus queue status?",
];

function AIContent() {
  const { environment, setEnvironment } = useDashboardState();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    e?.preventDefault();
    const prompt = promptOverride || input;
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data.message || '',
        ui: data.ui || [],
        timestamp: new Date(),
      };

      setMessages((prev) =>
        prev.filter((m) => !m.isLoading).concat(assistantMessage)
      );
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error}`,
        timestamp: new Date(),
      };

      setMessages((prev) =>
        prev.filter((m) => !m.isLoading).concat(errorMessage)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex">
      <Sidebar 
        environment={environment}
        onEnvironmentChange={setEnvironment}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="border-b border-border-subtle bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">AI Assistant</h1>
              <p className="text-sm text-text-muted">
                Ask questions about your data in natural language
              </p>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-brand-blue flex items-center justify-center mb-6">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">
                What would you like to know?
              </h2>
              <p className="text-text-secondary text-center mb-8">
                I can query your database, analyze logs, check LLM usage, and
                create visualizations.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(undefined, prompt)}
                    className="text-left p-3 rounded-lg border border-border bg-surface hover:border-brand-blue hover:bg-brand-blue-light transition-colors text-sm text-text-secondary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`${
                      message.role === 'user'
                        ? 'max-w-[70%]'
                        : 'flex-1 min-w-0 space-y-3'
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2 text-text-muted p-3 bg-surface rounded-lg">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <>
                        {message.content && (
                          message.role === 'user' ? (
                            <div className="bg-brand-blue text-white rounded-2xl rounded-br-sm px-4 py-3">
                              <p>{message.content}</p>
                            </div>
                          ) : (
                            <div className="bg-surface border border-border-subtle rounded-lg p-4">
                              <p className="text-text-secondary leading-relaxed">{message.content}</p>
                            </div>
                          )
                        )}
                        {message.ui && message.ui.length > 0 && (
                          <DynamicUI components={message.ui as Parameters<typeof DynamicUI>[0]['components']} />
                        )}
                      </>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-text-secondary" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border-subtle bg-surface px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto relative"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about users, workspaces, errors, LLM usage..."
              className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 pr-14 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light/50 resize-none transition-colors"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-brand-blue hover:bg-brand-blue/90 disabled:bg-surface-tertiary disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
          <p className="text-center text-xs text-text-muted mt-3">
            AI can query PostgreSQL, App Insights, and Azure metrics to answer your questions
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <AIContent />
    </Suspense>
  );
}
