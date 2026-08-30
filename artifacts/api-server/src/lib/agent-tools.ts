import { z } from "zod";
import {
  createOwnedMemory,
  updateOwnedMemory,
} from "./memory-storage";
import {
  memoryInputSchema,
  memoryUpdateSchema,
  type MemoryDocument,
} from "./memory-types";
import {
  retrieveRelevantMemories,
  type RetrievedMemory,
} from "./memory-retrieval";

const memorySearchInputSchema = z.object({
  query: z.string().trim().min(1).max(400),
}).strict();

const memoryManageInputSchema = z.object({
  operation: z.enum(["create", "update"]),
  memoryId: z.string().trim().min(1).max(128).optional(),
  text: z.string().trim().min(3).max(500).optional(),
  type: memoryInputSchema.shape.type.optional(),
}).strict().superRefine((value, context) => {
  if (value.operation === "create" && (value.text === undefined || value.type === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Creating a memory requires text and type.",
      path: ["text"],
    });
  }
  if (value.operation === "update") {
    if (value.memoryId === undefined) {
      context.addIssue({
        code: "custom",
        message: "Updating a memory requires a memory ID.",
        path: ["memoryId"],
      });
    }
    if (value.text === undefined && value.type === undefined) {
      context.addIssue({
        code: "custom",
        message: "Updating a memory requires text or type.",
        path: ["text"],
      });
    }
  }
});

export type AgentToolContext = {
  userId: string;
  userText: string;
  initialMemories?: RetrievedMemory[];
  initialMemoryQuery?: string;
  initialMemoryRetrievalFailed?: boolean;
};

type MemorySearchResult = {
  memories: Array<{
    memoryId: string;
    text: string;
    type: RetrievedMemory["type"];
    score: number;
  }>;
  count: number;
};

type MemoryManagementResult = {
  status: "created" | "updated";
  memory: {
    memoryId: string;
    text: string;
    type: MemoryDocument["type"];
    vectorStatus: MemoryDocument["vectorStatus"];
  };
};

type ToolDefinition<TInput, TResult> = {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: AgentToolContext) => Promise<TResult>;
};

const memorySearchTool: ToolDefinition<
  z.infer<typeof memorySearchInputSchema>,
  MemorySearchResult
> = {
  name: "memory_search",
  description: "Search the authenticated user's saved memories for relevant context.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 400,
        description: "A concise search query based on the user's current request.",
      },
    },
    required: ["query"],
  },
  inputSchema: memorySearchInputSchema,
  async execute(input, context) {
    const normalizedQuery = input.query.trim().toLowerCase();
    const normalizedInitialQuery = context.initialMemoryQuery?.trim().toLowerCase();
    let memories: RetrievedMemory[];

    if (normalizedQuery === normalizedInitialQuery) {
      if (context.initialMemoryRetrievalFailed) {
        throw new Error("Memory search is temporarily unavailable.");
      }
      memories = context.initialMemories ?? [];
    } else {
      memories = await retrieveRelevantMemories(context.userId, input.query);
    }

    return {
      memories: memories.map((memory) => ({
        memoryId: memory.id,
        text: memory.text,
        type: memory.type,
        score: memory.score,
      })),
      count: memories.length,
    };
  },
};

const memoryManageTool: ToolDefinition<
  z.infer<typeof memoryManageInputSchema>,
  MemoryManagementResult
> = {
  name: "memory_manage",
  description: "Create or update a saved memory only after the user explicitly asks to remember or update information.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: {
        type: "string",
        enum: ["create", "update"],
      },
      memoryId: {
        type: "string",
        description: "The memoryId returned by memory_search when updating an existing memory.",
      },
      text: {
        type: "string",
        minLength: 3,
        maxLength: 500,
      },
      type: {
        type: "string",
        enum: ["preference", "interest", "goal", "fact", "instruction", "context"],
      },
    },
    required: ["operation"],
  },
  inputSchema: memoryManageInputSchema,
  async execute(input, context) {
    if (!/\b(remember|save|store|keep in mind|update my memory|change my memory)\b/i.test(context.userText)) {
      throw new Error("Memory changes require an explicit request from the user.");
    }

    if (input.operation === "create") {
      const parsed = memoryInputSchema.parse({
        text: input.text,
        type: input.type,
      });
      const memory = await createOwnedMemory(context.userId, parsed);
      return {
        status: "created",
        memory: summarizeMemory(memory),
      };
    }

    const parsed = memoryUpdateSchema.parse({
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    });
    const memory = await updateOwnedMemory(context.userId, input.memoryId!, parsed);
    if (!memory) {
      throw new Error("The requested memory was not found.");
    }
    return {
      status: "updated",
      memory: summarizeMemory(memory),
    };
  },
};

function summarizeMemory(memory: MemoryDocument): MemoryManagementResult["memory"] {
  return {
    memoryId: memory.id,
    text: memory.text,
    type: memory.type,
    vectorStatus: memory.vectorStatus,
  };
}

export const agentTools = [memorySearchTool, memoryManageTool] as const;

export type AgentToolName = (typeof agentTools)[number]["name"];

export function getAgentToolDeclarations() {
  return agentTools.map(({ name, description, parametersJsonSchema }) => ({
    name,
    description,
    parametersJsonSchema,
  }));
}

export async function executeAgentToolCall(
  name: string | undefined,
  args: Record<string, unknown> | undefined,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  if (name === memorySearchTool.name) {
    return executeDefinition(memorySearchTool, args, context);
  }
  if (name === memoryManageTool.name) {
    return executeDefinition(memoryManageTool, args, context);
  }
  return { error: "The requested application tool is not available." };
}

async function executeDefinition<TInput, TResult>(
  tool: ToolDefinition<TInput, TResult>,
  args: Record<string, unknown> | undefined,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return { error: "The application tool arguments were invalid." };
  }

  try {
    return { output: await tool.execute(parsed.data, context) };
  } catch {
    return { error: "The application tool could not complete the request." };
  }
}