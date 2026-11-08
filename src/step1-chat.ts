type Role = "system" | "user" | "assistant" | "tool"
type Tool = {
	name:string,
	description:string,
	parameters:Record<string,unknown>,
	run: (args:Record<string,unknown>)=>string
}
type ToolCall = {
	id: string,
      	function: {
        	index: number,
	        name: string,
	        arguments:Record<string,unknown>
	}
}

type Message = {
	role:Role, 
	content:string,
	tool_name?:string,
	tool_calls?:ToolCall[]
}

type ChatResponse = {
	message:Message,
	model:string;
	done:boolean;
	done_reason:string;
	eval_count:number;
}

type NumbersResult =
  | { ok: true; a: number; b: number }
  | { ok: false; error: string }

const url:string = "http://localhost:11434/api/chat";


const toNumber = (value: unknown): number | undefined => {

	const num = Number(value)
	const to= typeof value
	console.log('value',value,'num:',num,'typeof',to)

	if (value === null){
		return undefined
	}

	if (isNaN(num)){
		return undefined
	}

	if (num && Number.isFinite(num)){
		return num
	}

	if (typeof value === 'number' && Number.isFinite(num)){
		return num
	}

	return undefined
}

const parseArgs = (args:Record<string,unknown>):NumbersResult => {
	const {a,b} = args
	
	const tn_a = toNumber(a)
	const tn_b = toNumber(b)

	if (tn_a === undefined || tn_b === undefined ){
        	return {ok:false,error:`error: a and b must be JSON numbers (not strings). You sent: ${JSON.stringify(args)}. If the user didn't give a number, ask them for it`}
	}

	return {ok:true,a:tn_a,b:tn_b}
}

const registry = new Map<string,Tool>([
	["add",{
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
		run: (args:Record<string,unknown>) => {
			const pa_res = parseArgs(args)
			console.log('parseArgs:',pa_res)

			if (!pa_res.ok){
                               return  pa_res.error
                        }

			return  (pa_res.a + pa_res.b).toString()
		}
	}],
	["multiply",{
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
		run: (args:Record<string,unknown>) => {
			const pa_res = parseArgs(args)
			console.log('parseArgs:',pa_res)

			if (!pa_res.ok){
                               return  pa_res.error
                        }
			
			return  (pa_res.a * pa_res.b).toString()
		}
	}]

]);

const chat = async (messages:Message[]): Promise<ChatResponse> => {
	const tools:{type:string,function:{name:string,description:string,parameters:Record<string,unknown>}}[] = [...registry.values()].map(x => ({type:"function",function:{
	name:x.name,description:x.description,parameters:x.parameters	
}}));
	const payload = {
			model: "llama3.2:3b",
			messages,
			tools,
			stream:false
	}
	const headers={'Content-Type':'application/json'}
	const response:Response = await fetch(url,{method:'POST',body:JSON.stringify(payload),headers})
	if (response.ok !== true){
		console.error('response not OK')
		throw Error('ResponseOKError')
	}
	
	const cr = (await response.json()) as ChatResponse
	return cr;
}


const executeTool = (tc:ToolCall):string => {
	console.log('executing tool:',tc.function.name)
	console.log('args:',tc.function.arguments);
	const name:string = tc.function.name;

	const tool:Tool | undefined = registry.get(name)

	if (tool){
		const tool_res:string = tool.run(tc.function.arguments)
		return tool_res
	}
	
	return `unknown tool ${name}`
}


const runAgent = async (userInput:string):Promise<ChatResponse> => {
	const messages:Message[] = [
		{role:'system',content:'If the user doesn’t give both numbers, ask for them. Never call a tool with made-up values.'},
		{role:'user',content:userInput}] 
	let i:number = 1;

	do {
		//console.log(`iteration #${i}`)
		const cr:ChatResponse = await chat(messages)
	        if (cr.message.tool_calls){
	                messages.push(cr.message)
	
	                for (const tc of cr.message.tool_calls){
	                        const tool_res:string = executeTool(tc)
	                        messages.push({
	                                role:'tool',
	                                tool_name:tc.function.name,
	                                content: tool_res
	                        });
	                }
	        }else{
			return cr
		}

		if (i>=5){
			throw new Error('MaxIterationsError')
		}
		i++
	}while (true)
}

const tests = [
	'what is 121 + 566 ?',
	'what is 222.222 + 555.555 ?',
	'what is 444 + ?', 
	'what is + ?',
//	'what is 31 * 32 ?',
//	'what is 31.23 * 32.33 ?',
//	'what is 55 * -11?'
	]


for (const message of tests){
	console.log('question:',message)
	const chat_res:ChatResponse = await runAgent(message)
	console.log('result:',chat_res.message.content)
	console.log('-----------------------------------------------------------\n')
}
