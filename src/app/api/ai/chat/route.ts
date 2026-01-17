import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';

// Data sources schema for the LLM
const DATA_SOURCES_SCHEMA = `
## Available Data Sources

### 1. PostgreSQL Database (Symmetry Production)
Tables and columns (IMPORTANT - use exact column names):
- users: id (uuid), email (text), name (text), created_at, last_login_at, is_whitelisted, organization_ids (uuid[])
- organizations: id (uuid), name (text), created_at
- workspaces: id (uuid), name (text), created_by (uuid FK to users.id), organization_id (uuid), created_at, goal
- knowledge_units: id (uuid), workspace_id (uuid), created_by (uuid FK to users.id), title, overview, ku_version, created_at, source_tools (text[])
- chat_conversations: id (uuid), workspace_id (uuid), user_id (uuid FK to users.id), external_id, platform, created_at
- chat_messages: id (uuid), conversation_id (uuid), role (text), content (text), created_at
- processing_jobs: id (uuid), user_id (uuid), workspace_id (uuid), status (text: 'pending'|'processing'|'completed'|'failed'), job_type (text: 'export'|'stream'), created_at, completed_at, error_message

### Key Relationships:
- Users create workspaces: workspaces.created_by = users.id
- Users create KUs: knowledge_units.created_by = users.id
- Users have conversations: chat_conversations.user_id = users.id

### 2. Azure Application Insights (KQL)
Tables:
- traces: timestamp, message, severityLevel, customDimensions, cloud_RoleName
- exceptions: timestamp, type, outerMessage, innermostMessage, cloud_RoleName
- requests: timestamp, name, url, success, resultCode, duration, cloud_RoleName
- dependencies: timestamp, name, target, success, duration, type

### 3. Azure OpenAI Metrics
Available metrics (via Azure Monitor):
- ProcessedPromptTokens: Input tokens processed
- GeneratedTokens: Output tokens generated
- AzureOpenAIRequests: Total API calls
- TokenTransaction: Total tokens (input + output)

### 4. Azure Service Bus
Queues: batch-jobs, stream-jobs, conversation-jobs
Properties: activeMessageCount, deadLetterMessageCount

### 5. PostgreSQL Statistics (for database health/performance)
Use these SQL queries to get database statistics.

IMPORTANT: pg_stat_statements only has CUMULATIVE totals (since last reset), NOT time-series data.
- You CANNOT get "queries over time" or "queries per hour" from pg_stat_statements
- For time-series, suggest using application-level data (processing_jobs, knowledge_units, users created_at)

**Query execution statistics (pg_stat_statements) - CUMULATIVE totals only:**
\`\`\`sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements 
ORDER BY total_exec_time DESC LIMIT 10
\`\`\`

**Table statistics (pg_stat_user_tables):**
\`\`\`sql
SELECT relname as table_name, 
       n_live_tup as live_rows,
       n_dead_tup as dead_rows,
       last_vacuum,
       last_autovacuum,
       last_analyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
\`\`\`

**Database size:**
\`\`\`sql
SELECT pg_database_size(current_database()) as db_size_bytes
\`\`\`

**Table sizes:**
\`\`\`sql
SELECT relname as table_name,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
       pg_size_pretty(pg_relation_size(relid)) as data_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
\`\`\`

**Index usage:**
\`\`\`sql
SELECT relname as table_name,
       indexrelname as index_name,
       idx_scan as scans,
       idx_tup_read as tuples_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC LIMIT 10
\`\`\`

**Connection stats:**
\`\`\`sql
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
\`\`\`

### Time-Series Data Available (use these for "over time" queries):
- **Users over time:** \`SELECT DATE(created_at) as date, COUNT(*) FROM users GROUP BY DATE(created_at)\`
- **Knowledge Units over time:** \`SELECT DATE(created_at) as date, COUNT(*) FROM knowledge_units GROUP BY DATE(created_at)\`
- **Jobs over time:** \`SELECT DATE(created_at) as date, COUNT(*) FROM processing_jobs GROUP BY DATE(created_at)\`
- **Conversations over time:** \`SELECT DATE(created_at) as date, COUNT(*) FROM chat_conversations GROUP BY DATE(created_at)\`
- **Messages over time:** \`SELECT DATE(created_at) as date, COUNT(*) FROM chat_messages GROUP BY DATE(created_at)\`
`;

const UI_COMPONENTS_SCHEMA = `
## Available UI Components

You can return UI components in a structured format that the frontend will render.

### Component Types:

1. **markdown** - Rich text content
   { "type": "markdown", "content": "## Title\\n\\nSome **bold** text" }

2. **metric** - Single KPI display
   { "type": "metric", "label": "Total Users", "value": 42, "change": 5.2, "changeLabel": "vs last week" }

3. **table** - Data table
   { 
     "type": "table", 
     "columns": [
       { "key": "name", "label": "Name" },
       { "key": "email", "label": "Email" }
     ],
     "rows": [{ "name": "John", "email": "john@example.com" }]
   }

4. **bar_chart** - Bar chart
   {
     "type": "bar_chart",
     "title": "Users by Organization",
     "data": [{ "name": "Org A", "value": 10 }, { "name": "Org B", "value": 20 }],
     "xKey": "name",
     "yKey": "value",
     "color": "#8b5cf6"
   }

5. **area_chart** - Time series chart
   {
     "type": "area_chart",
     "title": "Users Over Time",
     "data": [{ "date": "2026-01-01", "count": 5 }, { "date": "2026-01-02", "count": 8 }],
     "xKey": "date",
     "yKey": "count",
     "color": "#10b981"
   }

6. **pie_chart** - Pie/donut chart
   {
     "type": "pie_chart",
     "title": "Job Status Distribution",
     "data": [{ "name": "Completed", "value": 80 }, { "name": "Failed", "value": 20 }],
     "nameKey": "name",
     "valueKey": "value"
   }

7. **stat_grid** - Multiple metrics in a grid
   {
     "type": "stat_grid",
     "stats": [
       { "label": "Users", "value": 42 },
       { "label": "Workspaces", "value": 15 },
       { "label": "KUs", "value": 128 }
     ]
   }
`;

const SYSTEM_PROMPT = `You are an AI assistant for the Symmetry Admin Dashboard. You help users explore and visualize data from the Symmetry platform.

${DATA_SOURCES_SCHEMA}

${UI_COMPONENTS_SCHEMA}

## Report Generation Guidelines

When generating reports or answering complex questions:

1. **Use markdown for narrative content** - Write clear explanations, summaries, and insights
2. **Combine multiple queries** - You can execute several SQL/KQL queries to gather comprehensive data
3. **Mix UI components** - Create rich reports by combining:
   - markdown for context and explanations
   - stat_grid for key metrics at the top
   - tables for detailed data
   - charts (bar_chart, area_chart, pie_chart) for visualizations
4. **Structure reports logically**:
   - Start with a summary/headline metrics
   - Add visualizations for trends
   - Include detailed tables
   - End with insights or recommendations

Example report structure:
[
  { "type": "markdown", "content": "## User Activity Report\\n\\nAnalysis of user engagement over the past week." },
  { "type": "stat_grid", "stats": [{ "label": "Total Users", "value": 42 }, { "label": "Active", "value": 35 }] },
  { "type": "area_chart", "title": "Daily Active Users", "data": [...], "xKey": "date", "yKey": "count" },
  { "type": "markdown", "content": "### Key Findings\\n\\n- User growth is steady\\n- Peak activity on Tuesdays" },
  { "type": "table", "title": "Top Users by Activity", "columns": [...], "rows": [...] }
]

## Your Capabilities

1. **Execute SQL queries** on PostgreSQL to get user data, workspaces, knowledge units, conversations, etc.
2. **Execute KQL queries** on Azure Application Insights for logs, errors, performance data.
3. **Get Azure metrics** for LLM usage, costs, and performance.
4. **Get Service Bus status** for queue depths and health.

## Response Format - CRITICAL

You MUST respond with ONLY a valid JSON object in this exact format:

{"message": "Your explanation here", "ui": [...]}

RULES:
1. Output ONLY the JSON object - no text before or after
2. The "message" field contains a brief explanation (plain text, no JSON inside)
3. The "ui" field is an array of UI components
4. Do NOT include the same JSON twice
5. Do NOT output the response explanation AND then JSON - just output the JSON

Example of CORRECT response:
{"message": "I found 7 users on 2026-01-12 and 2 users on 2026-01-13.", "ui": [{"type": "area_chart", "title": "Users Over Time", "data": [{"date": "2026-01-12", "count": 7}, {"date": "2026-01-13", "count": 2}], "xKey": "date", "yKey": "count", "color": "#22c55e"}]}

Example of WRONG response (DO NOT DO THIS):
I have the user counts. Here is a chart... {"message": "...", "ui": [...]}

## Important Notes
- Always use the tools to fetch real data before responding
- Format dates nicely for display
- Round numbers appropriately  
- Use appropriate chart types for the data
- Be concise but informative in the message field
`;

// Tool definitions for Azure OpenAI
const tools = [
  {
    type: 'function',
    function: {
      name: 'execute_sql',
      description: 'Execute a SQL query on the PostgreSQL database. Use for user data, workspaces, knowledge units, conversations, jobs, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The SQL query to execute. Use PostgreSQL syntax. Only SELECT queries allowed.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_kql',
      description: 'Execute a KQL query on Azure Application Insights. Use for logs, errors, performance metrics.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The KQL query to execute.',
          },
          timeRange: {
            type: 'string',
            description: 'Time range like "1h", "24h", "7d", "30d". Defaults to "24h".',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_llm_metrics',
      description: 'Get Azure OpenAI LLM usage metrics including tokens, costs, and call counts.',
      parameters: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Time range like "1h", "24h", "7d". Defaults to "24h".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_bus_status',
      description: 'Get Azure Service Bus queue status including active and dead-letter message counts.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// Tool execution functions
async function executeSql(query: string): Promise<unknown> {
  const dbHost = process.env.PROD_DB_HOST;
  const dbUser = process.env.PROD_DB_USER;
  const dbPassword = process.env.PROD_DB_PASSWORD;
  const dbName = process.env.PROD_DB_NAME;

  try {
    // Sanitize query - only allow SELECT
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const result = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -U ${dbUser} -d ${dbName} -t -A -F '|' -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    // Parse the pipe-delimited result
    const lines = result.trim().split('\n').filter(l => l);
    if (lines.length === 0) return { rows: [], count: 0 };

    // Get column names from the query (simple extraction)
    const columnMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    let columns: string[] = [];
    if (columnMatch) {
      columns = columnMatch[1].split(',').map(c => {
        const asMatch = c.match(/AS\s+["']?(\w+)["']?/i);
        if (asMatch) return asMatch[1];
        const cleaned = c.trim().split('.').pop() || c.trim();
        return cleaned.replace(/[()]/g, '').split(' ')[0];
      });
    }

    const rows = lines.map(line => {
      const values = line.split('|');
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = values[i] || null;
      });
      return row;
    });

    return { rows, count: rows.length, columns };
  } catch (error) {
    return { error: String(error), rows: [], count: 0 };
  }
}

async function executeKql(query: string): Promise<unknown> {
  const appInsights = process.env.PROD_APP_INSIGHTS || 'ai-asp-sym-prod-centralus';
  const resourceGroup = process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus';

  try {
    const result = execSync(
      `az monitor app-insights query --app ${appInsights} --resource-group ${resourceGroup} --analytics-query "${query.replace(/"/g, '\\"')}" --query "tables[0]" -o json`,
      { encoding: 'utf-8', timeout: 60000 }
    );

    const data = JSON.parse(result);
    const columns = data.columns?.map((c: { name: string }) => c.name) || [];
    const rows = (data.rows || []).map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return { rows, count: rows.length, columns };
  } catch (error) {
    return { error: String(error), rows: [], count: 0 };
  }
}

async function getLlmMetrics(timeRange = '24h'): Promise<unknown> {
  try {
    const response = await fetch(
      `http://localhost:3000/api/llm?env=prod&range=${timeRange}`
    );
    return await response.json();
  } catch (error) {
    return { error: String(error) };
  }
}

async function getServiceBusStatus(): Promise<unknown> {
  try {
    const result = execSync(
      `az servicebus queue list --namespace-name sb-sym-prod-centralus --resource-group rg-sym-prod-centralus --query "[].{name:name, active:countDetails.activeMessageCount, deadLetter:countDetails.deadLetterMessageCount}" -o json`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return { queues: JSON.parse(result) };
  } catch (error) {
    return { error: String(error), queues: [] };
  }
}

// Process tool calls
async function processToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'execute_sql':
      return await executeSql(toolArgs.query as string);
    case 'execute_kql':
      return await executeKql(toolArgs.query as string);
    case 'get_llm_metrics':
      return await getLlmMetrics((toolArgs.timeRange as string) || '24h');
    case 'get_service_bus_status':
      return await getServiceBusStatus();
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Call Azure OpenAI
async function callAzureOpenAI(messages: Array<{role: string; content: string; tool_call_id?: string; name?: string}>, includeTools = true) {
  const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  const body: Record<string, unknown> = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens: 4096,
    temperature: 0.1,
  };

  if (includeTools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { messages: userMessages } = await request.json();

    if (!userMessages || !Array.isArray(userMessages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    // Build conversation
    const messages: Array<{role: string; content: string; tool_call_id?: string; name?: string}> = userMessages.map(
      (m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })
    );

    // Initial call
    let response = await callAzureOpenAI(messages);
    let assistantMessage = response.choices[0].message;

    // Process tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        ...assistantMessage,
      });

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        const result = await processToolCall(toolName, toolArgs);

        // Add tool result
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation
      response = await callAzureOpenAI(messages);
      assistantMessage = response.choices[0].message;
    }

    // Extract final response
    const content = assistantMessage.content || '';

    // Try to parse as JSON response format
    let parsedResponse: { message: string; ui: unknown[] };
    try {
      // Try to parse the whole content as JSON first
      const trimmed = content.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        parsedResponse = {
          message: parsed.message || '',
          ui: Array.isArray(parsed.ui) ? parsed.ui : []
        };
      } else {
        // Content has text before JSON - try to find JSON
        const jsonStart = content.indexOf('{');
        if (jsonStart !== -1) {
          const jsonPart = content.substring(jsonStart);
          const parsed = JSON.parse(jsonPart);
          // Get any text before the JSON as additional context
          const textBefore = content.substring(0, jsonStart).trim();
          parsedResponse = {
            message: textBefore ? `${textBefore}\n\n${parsed.message || ''}`.trim() : (parsed.message || ''),
            ui: Array.isArray(parsed.ui) ? parsed.ui : []
          };
        } else {
          parsedResponse = { message: content, ui: [] };
        }
      }
    } catch (e) {
      console.error('JSON parse error:', e, 'Content:', content.substring(0, 500));
      // Fallback: return content as message
      parsedResponse = { message: content, ui: [] };
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
