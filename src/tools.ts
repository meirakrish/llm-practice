import { type NumbersResult, type Tool, type ToolCall, type ToolDefinition } from './types.js'

export const toNumber = (value: unknown): number | undefined => {

    const num = Number(value)

    if (value === null) {
        return undefined
    }

    if (isNaN(num)) {
        return undefined
    }

    if (num && Number.isFinite(num)) {
        return num
    }

    if (typeof value === 'number' && Number.isFinite(num)) {
        return num
    }

    return undefined
}

const parseArgs = (args: Record<string, unknown>): NumbersResult => {
    const { a, b } = args

    const tn_a = toNumber(a)
    const tn_b = toNumber(b)

    if (tn_a === undefined || tn_b === undefined) {
        return { ok: false, error: `error: a and b must be JSON numbers (not strings). You sent: ${JSON.stringify(args)}. If the user didn't give a number, ask them for it` }
    }

    return { ok: true, a: tn_a, b: tn_b }
}

export const registry = new Map<string, Tool>([
    ["add", {
        name: "add",
        description: "Add two given numbers, otherwise fail",
        parameters: {
            type: "object",

            properties: {
                a: { type: "number", description: "the first number to add, must be specified by the user" },
                b: { type: "number", description: "the second number to add, must be specified by the user" },
            },
            required: ["a", "b"],
        },
        run: (args: Record<string, unknown>) => {
            const pa_res = parseArgs(args)
            // console.log('parseArgs:',pa_res)

            if (!pa_res.ok) {
                return pa_res.error
            }

            return (pa_res.a + pa_res.b).toString()
        }
    }],
    ["multiply", {
        name: "multiply",
        description: "Multiplies two given numbers, otherwise fail",
        parameters: {
            type: "object",

            properties: {
                a: { type: "number", description: "the first number to multiply, must be specified by the user" },
                b: { type: "number", description: "the second number to multiply, must be specified by the user" },
            },
            required: ["a", "b"],
        },
        run: (args: Record<string, unknown>) => {
            const pa_res = parseArgs(args)
            console.log('parseArgs:', pa_res)

            if (!pa_res.ok) {
                return pa_res.error
            }

            return (pa_res.a * pa_res.b).toString()
        }
    }]

]);


export const buildToolsArray = (): ToolDefinition[] => {
    return [...registry.values()].map(x => ({
        type: "function", function: {
            name: x.name, description: x.description, parameters: x.parameters
        }
    }));
}

export const executeTool = (tc: ToolCall): string => {
    // console.log('executing tool:',tc.function.name)
    // console.log('args:',tc.function.arguments);
    const name: string = tc.function.name;

    const tool: Tool | undefined = registry.get(name)

    if (tool) {
        const tool_res: string = tool.run(tc.function.arguments)
        return tool_res
    }

    return `unknown tool ${name}`
}