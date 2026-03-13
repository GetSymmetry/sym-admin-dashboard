'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DynamicUI } from '@/components/ai/DynamicUI';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { debuggerClient } from '@/lib/api/client';
import { Sparkles, Send, User, MessageCircle, Database, Globe, Cpu, Clock } from 'lucide-react';

/* ── Types ── */

interface ToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  duration_ms?: number;
  success?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ui?: unknown[];
  toolsCalled?: ToolCall[];
  model?: string;
  rounds?: number;
  timestamp: Date;
  isLoading?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Did the last deploy cause error spikes? Correlate deployment timeline with error rates",
  "What's our cost per active user? Break down infra vs LLM spend",
  "Which workspace is generating the most load? Show their jobs, graph size, and conversations",
  "Find the slowest API endpoints, show what errors they throw, and trace one",
  "Is backpressure building? Compare pipeline throughput with Service Bus queue depth",
  "Show user retention by weekly cohort alongside feature adoption rates",
  "Full system health: DB consistency, graph health, SLO status, and active alerts",
  "Compare user growth rate with infrastructure costs — are we scaling efficiently?",
];

/* ── Tool indicator icons ── */

function getToolIcon(name: string) {
  if (name.includes('postgresql') || name.includes('sql') || name.includes('database') || name.includes('active_users') || name.includes('scaling'))
    return <Database className="w-3 h-3" />;
  if (name.includes('neo4j') || name.includes('graph'))
    return <Globe className="w-3 h-3" />;
  if (name.includes('container') || name.includes('service_bus') || name.includes('infra'))
    return <Cpu className="w-3 h-3" />;
  return <Database className="w-3 h-3" />;
}

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_neo4j_status: 'Neo4j',
    get_postgresql_status: 'PostgreSQL',
    get_database_metrics: 'Database Metrics',
    get_service_bus_status: 'Service Bus',
    get_container_apps_detailed: 'Container Apps',
    get_infra_costs: 'Costs',
    get_llm_costs: 'LLM Costs',
    get_llm_metrics: 'LLM Metrics',
    get_business_pulse: 'Business Pulse',
    get_growth_metrics: 'Growth',
    get_engagement_metrics: 'Engagement',
    get_top_workspaces: 'Top Workspaces',
    get_pipeline_health: 'Pipeline',
    get_active_users: 'Active Users',
    get_scaling_metrics: 'Scaling',
    get_api_performance: 'API Performance',
    get_dependency_map: 'Dependencies',
    get_error_hotspots: 'Error Hotspots',
    get_throughput_trends: 'Throughput',
    get_slo_status: 'SLO Status',
    get_alerts_status: 'Alerts',
    get_error_timeline: 'Error Timeline',
    execute_sql: 'SQL Query',
    execute_cypher: 'Cypher Query',
    execute_kql: 'KQL Query',
  };
  return labels[name] || name.replace(/^get_/, '').replace(/_/g, ' ');
}

/* ── Tool Chips ── */

function ToolChips({ tools }: { tools: ToolCall[] }) {
  if (!tools || tools.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {tools.map((tool, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            tool.success === false
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {getToolIcon(tool.name)}
          {getToolLabel(tool.name)}
          {tool.duration_ms !== undefined && (
            <span className="text-blue-400 ml-0.5 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {tool.duration_ms < 1000 ? `${tool.duration_ms}ms` : `${(tool.duration_ms / 1000).toFixed(1)}s`}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ── Content ── */

function AIContent() {
  const { region } = useDebuggerDashboardState();
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

  const handleSubmit = useCallback(async (e?: React.FormEvent, promptOverride?: string) => {
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
      const response = await debuggerClient.post<{
        message: string;
        ui?: unknown[];
        tools_called?: ToolCall[];
        model?: string;
        rounds?: number;
      }>('/debug/ai/chat', {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const data = response.data;
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data?.message || '',
        ui: data?.ui || [],
        toolsCalled: data?.tools_called || [],
        model: data?.model,
        rounds: data?.rounds,
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
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex">
      <Sidebar environment="prod" />

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
                Query infrastructure, analyze data, and generate visualizations
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
                Ask me to correlate across PostgreSQL, Neo4j, App Insights, Service Bus, Container Apps,
                and Cost Management — I'll stitch together data from multiple sources and visualize it.
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
                        <span className="text-sm">Querying data sources...</span>
                      </div>
                    ) : (
                      <>
                        {/* Tool execution indicators */}
                        {message.toolsCalled && message.toolsCalled.length > 0 && (
                          <ToolChips tools={message.toolsCalled} />
                        )}

                        {message.content && (
                          message.role === 'user' ? (
                            <div className="bg-brand-blue text-white rounded-2xl rounded-br-sm px-4 py-3">
                              <p>{message.content}</p>
                            </div>
                          ) : (
                            <div className="bg-surface border border-border-subtle rounded-lg p-4">
                              <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
              placeholder="Ask anything — correlate deployments with errors, trace slow endpoints, compare costs with growth..."
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
            Queries 6 data sources with 55+ tools — correlates across PostgreSQL, Neo4j, App Insights, Service Bus, Container Apps, and Cost Management
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <AIContent />
    </Suspense>
  );
}
