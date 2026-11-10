export type Role = "system" | "user" | "assistant" | "tool"

export type ToolCall = {
    id: string,
    function: {
        index: number,
        name: string,
        arguments: Record<string, unknown>
    }
}

export type Message = {
    role: Role,
    content: string,
    tool_name?: string,
    tool_calls?: ToolCall[]
}

export type ChatResponse = {
    message: Message,
    model: string;
    done: boolean;
    done_reason: string;
    eval_count: number;
    prompt_eval_count?: number
}

export type ToolDefinition = {
    type: string,
    function: {
        name: string,
        description: string,
        parameters: Record<string, unknown>
    }
}

export type Tool = {
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    run: (args: Record<string, unknown>) => string
}

export type NumbersResult =
    | { ok: true; a: number; b: number }
    | { ok: false; error: string }

