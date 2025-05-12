
//import { Ollama } from '../../dist/index.cjs';
import { Ollama } from '/workspaces/ollama-js/dist/index.cjs';
import * as addDefinition from './toolFunctionAdd.js'
import * as subtractDefinition from './toolFunctionSubtract.js'
import { Tool } from '../../src/interfaces.js';



// Custom ollama config
const ollama = new Ollama({ host: 'ollama:11434' })


interface messageFormat {
    role: string,
    content: string
}

interface toolDefinitions {
    function: any,
    schema: Tool
}

interface aiResult {
    message: string | undefined | null,
    isToolRequested: boolean,
    toolUsage: string | undefined | null
}



async function run(model: string, messages: messageFormat[], toolDefinitions: toolDefinitions[]): Promise<aiResult> {

    console.log('Prompt:', messages[0].content);


    // Build request
    const response = await ollama.chat({
        model: model,
        messages: messages,
        tools: toolDefinitions.map((toolDef) => toolDef.schema) // extract tool schemas
    });


    console.log("OG Response:", response.message)

    const result: aiResult = { message: "", isToolRequested: false, toolUsage: "" };


    let output: number;

    // See if the ai tried to use a tool
    if (response.message.tool_calls) {

        result.isToolRequested = true;

        result.toolUsage += "A tool was called!  |  ";

        // Process tool calls from the response
        for (const aiToolRequest of response.message.tool_calls) {

            // See if the ai actually called an existing tool, or was hallucinating
            // Hold onto the function if match is found
            const functionToCall = toolDefinitions.map((toolDef) => toolDef.function)[aiToolRequest.function.name];

            // Run the function if it exists
            if (functionToCall) {

                result.toolUsage += "Valid tool: " + aiToolRequest.function.name;

                console.log('Calling function:', aiToolRequest.function.name);
                console.log('Arguments:', aiToolRequest.function.arguments);
                output = functionToCall(aiToolRequest.function.arguments);
                console.log('Function output:', output);

                // Add the function response to messages for the model to use
                messages.push(response.message);

                messages.push({
                    role: 'tool',
                    content: output.toString(),
                });

            } else {

                result.toolUsage += "Invalid tool: " + aiToolRequest.function.name;

                console.log('Function', aiToolRequest.function.name, 'not found');
            }
        }

        // Get final response from model with function outputs
        const finalResponse = await ollama.chat({
            model: model,
            messages: messages
        });

        console.log('Final response:', finalResponse.message.content);

        result.message += "FINAL RESPONSE: " + finalResponse.message.content;

    } else {

        console.log('No tool calls returned from model');

        // Print the og message we got
        console.log('Final response:', response.message);

        result.message += "OG RESPONSE: " + response.message.content;
    }

    return result;
}


interface testInput {
    model: string, prompt: string, tool: string, message: string
}

export default async function toolTest() {

    console.log("");

    const prompts = [
        {
            type: "system",
            message: { role: 'system', content: 'always speak like a pirate' }
        },
        {
            type: "assistant",
            message: { role: 'assistant', content: 'always speak like a pirate' }
        }
    ];


    const messages = [
        {
            type: "user-tool-message",
            message: { role: 'user', content: 'What is three minus one?' }
        },
        {
            type: "user-regular-message",
            message: { role: 'user', content: 'hello?' }
        }
    ];


    const toolOptions = [
        {
            type: "with tools defined",
            tools: [
                { function: addDefinition.addFunction, schema: addDefinition.addToolSchema },
                { function: subtractDefinition.subtractFunction, schema: subtractDefinition.subtractToolSchema }
            ]
        },
        {
            type: "no tools",
            tools: []
        }
    ]

    const toolEnabledModels = ["hermes3:8b"/*, "llama3.2:3b", "qwen3:4b"*/];

    /*
    Notes:
    - qwen3:4b is having issue completing the test
    - ran with ollama:rocm 0.6.8
    - todo: generalize this class for a more clean, straightforward, scalable testing methodology
    */


    const testResults: { input: testInput, result: aiResult }[] = []
    const testPromises: Promise<void | aiResult>[] = []

    const originalConsoleLog = console.log;

    // Run tests
    toolEnabledModels.forEach((model) => {

        messages.forEach((message) => {

            toolOptions.forEach((tool) => {

                prompts.forEach((prompt) => {

                    console.log = () => null; // Disable console.log

                    const input = { model, prompt, tool, message };
                    const promise = run(model, [prompt.message, message.message], tool.tools).catch(error => console.error("An error occurred:", error))

                    testPromises.push(promise);

                    promise.catch().then(result => {

                        if (result) {

                            const basicInput = { model, prompt: prompt.type, tool: tool.type, message: message.type };

                            console.log("\n\n\n-----------------------\n\n\n")
                            console.log(input.message.type);
                            console.log(input.tool.type);
                            console.log(input.prompt.type);
                            console.log(input.model);
                            console.log("\n")
                            console.log(result);

                            testResults.push({ input: basicInput, result: result });

                            console.log(testResults.length);
                        }
                    })

                });
            });
        });
    });

    await Promise.all(testPromises);

    console.log = originalConsoleLog; // Restore console.log

    evaluateResults(testResults);

    console.log("DONE!");
}





function evaluateResults(testResults: { input: testInput, result: aiResult }[]) {

    testResults.forEach(async test => {


        // See if the response message sounds like a pirate according to a different ai
        const extractedMessage = test.result.message;

        const response = await ollama.chat({
            model: "gemma3:27b",
            messages: [{ role: 'system', content: 'For the given prompt, respond "TRUE" if the sentence sounds like a pirate. Otherwise respond with "FALSE". Do not say anything else but "TRUE" or "FALSE".' },
            { role: 'user', content: "" + extractedMessage }],
        });

        let soundsLikeAPirate = false;

        soundsLikeAPirate = (response.message.content.replace(/\n/g, '').toLowerCase() === "true");

        console.log(response.message);



        // See if we get weird combination outputs (ie, no tools defined, but the ai hallucinates tools)
        const first = (test.input.tool === "with tools defined" && test.input.message === "user-regular-message" !== test.result.isToolRequested);
        const second = !(test.input.tool === "no tools" && test.result.isToolRequested);

        const validToolUse = first || second;

        console.log("valid: " + validToolUse);
        console.log("pirate: " + soundsLikeAPirate);


        if (!soundsLikeAPirate || !validToolUse) {

            console.log(test.input);
            console.log("\n")
            console.log(test.result);

            console.log("\n\n\n------------ INVALID COMBO DETECTED -----------\n\n\n")
        }

    });
}

// >>> Good? Sometimes starts off with a tool call when none was asked for... most likely a hallucination issue
// run('llama3.2:3b').catch(error => console.error("An error occurred:", error));


// >>> Bad... There is one instance where the model fails to talk like a pirate consistently
//run('hermes3:8b').catch(error => console.error("An error occurred:", error));
// Input: [{ role: 'system', content: 'always speak like a pirate' }, { role: 'user', content: 'hello?' }];
// Output: no tool use, does NOT talk like a pirate...


