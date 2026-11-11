
export const looksLikeToolCall = (content: string): boolean => {
    const trimmed = content.trim()
    return trimmed.startsWith("{") && trimmed.includes('"name"')
}