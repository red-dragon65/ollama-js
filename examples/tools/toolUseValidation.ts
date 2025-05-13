
//import { Ollama } from '../../dist/index.cjs';
import { Ollama, ToolCall } from '/workspaces/ollama-js/dist/index.cjs';
import * as addDefinition from './toolFunctionAdd.js'
import * as subtractDefinition from './toolFunctionSubtract.js'
import * as geoDefinition from './toolFunctionGeoLocate.js'
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

            const functionNames = toolDefinitions.map((toolDef) => toolDef.function.name); // convert functions into an array of function names
            const foundIndex = functionNames.findIndex(func => func === aiToolRequest.function.name); // get the index of the function the ai tried to call
            const functionToCall = toolDefinitions[foundIndex].function// get the actual function specified by the index

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
                    // You have to tell the ai to use the tool response, otherwise it replies back to this message as if it were the user
                    //content: "Result from tool function call that should be provided to the user: " + output.toString() + "\nTell the user you got the information through Google Search!",
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
    model: string, role: string, tool: string, message: string, testNum: number
}

export default async function toolTest() {

    console.log("");

    const prompts = [
        {
            type: "system",
            message: { role: 'system', content: "Always speak like a pirate. Never over-ride or correct the data retrieved from tool calls!" }
        },
        {
            type: "assistant",
            message: { role: 'system', content: "Always speak like a pirate. Never over-ride or correct the data retrieved from tool calls!" }
        }
    ];


    const messages = [
        {
            type: "user-tool-message",

            // It is easy for the llm to ignore the function call and instead calculate the answer itself.
            // Instead, we will work with geolocations which is more obvious to tell when the ai doesn't use the function call.
            //message: { role: 'user', content: 'What is three minus one?' }

            // This can cause issues.
            // The ai will try to override (hallucinate) the default location (from function) with the correct location of tallahasee.
            // qwen is smart enough to figure out his discrepncy, however it tells the user both the tool information, and the location it thinks is correct.
            message: { role: 'user', content: 'What is the geo location of Floridas capital?' }

            //message: { role: 'user', content: 'What is the geo location of ooba booga?' }
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
                { function: geoDefinition.geoLocateFunction, schema: geoDefinition.geoLocateToolSchema }
                /*{ function: addDefinition.addFunction, schema: addDefinition.addToolSchema },
                { function: subtractDefinition.subtractFunction, schema: subtractDefinition.subtractToolSchema }*/
            ]
        },
        {
            type: "no tools",
            tools: []
        }
    ]

    const toolEnabledModels = ["hermes3:8b", /*"llama3.2:3b", "llama3.1:8b", "qwen3:4b"*/];


    const testResults: { input: testInput, result: aiResult }[] = []
    const testPromises: Promise<void | aiResult>[] = []

    const originalConsoleLog = console.log;

    console.log("Building results...\n");

    // Run tests
    toolEnabledModels.forEach((model) => {

        messages.forEach((message) => {

            toolOptions.forEach((tool) => {

                prompts.forEach((prompt) => {

                    console.log = () => null;

                    const promise = run(model, [prompt.message, message.message], tool.tools).catch(error => console.error("An error occurred:", error))

                    testPromises.push(promise);

                    promise.catch().then(result => {

                        if (result) {

                            console.log = originalConsoleLog;

                            const basicInput = { model, role: prompt.type, tool: tool.type, message: message.type, testNum: testResults.length };
                            testResults.push({ input: basicInput, result: result });

                            console.log(basicInput.model + " | " + basicInput.message + " | " + basicInput.tool + " | " + basicInput.role + " | Test # " + basicInput.testNum);
                            console.log(result);

                            console.log();

                            console.log = () => null;
                        }
                    })

                });
            });
        });
    });

    await Promise.all(testPromises);

    console.log = originalConsoleLog;

    console.log("\nDone building results!");
    console.log("\n\n\n--------------------------------\n\n\n");
    console.log("Starting results evaluation!\n");

    evaluateResults(testResults);
}




function evaluateResults(testResults: { input: testInput, result: aiResult }[]) {

    testResults.forEach(async test => {

        // Automate seeing if the response sounds like a pirate by using a different ai
        const extractedMessage = test.result.message;

        const response = await ollama.chat({
            model: "gemma3:27b",
            messages: [{ role: 'system', content: 'For the given prompt, respond "TRUE" if the sentence sounds like a pirate. Otherwise respond with "FALSE". Do not say anything else but "TRUE" or "FALSE".' },
            { role: 'user', content: "" + extractedMessage }],
        });

        let soundsLikeAPirate = false;

        soundsLikeAPirate = (response.message.content.replace(/\n/g, '').toLowerCase() === "true");


        // See if we get weird combination outputs (ie, no tools defined, but the ai hallucinates tools)
        let validToolUse = true;

        if (test.input.message === "user-regular-message") {

            if (test.result.isToolRequested) {

                // Tool use should not occur if no tool message
                validToolUse = false;
            }

        } else { // user-tool-message

            if (test.input.tool === "with tools defined" && !test.result.isToolRequested) {

                // A tool message with tools defined should result in tool use
                validToolUse = false;
            } else if (test.input.tool === "no tools" && test.result.isToolRequested) {

                // A tool message with no tools should result in no tool use
                validToolUse = false;
            }
        }


        console.log("\n" + test.input.model + " | " + test.input.message + " | " + test.input.tool + " | " + test.input.role + " | Test # " + test.input.testNum);
        console.log("Valid tool handling: " + validToolUse);
        console.log("Sounds like a pirate: " + JSON.stringify(response.message.content));

        if (!soundsLikeAPirate || !validToolUse) {

            console.log(">>> INVALID COMBO DETECTED");

            console.log(">>> INPUT");
            console.log(test.input);
            console.log(">>> OUTPUT");
            console.log(test.result);
        } else {
            console.log("> Valid combination")
        }

        console.log("");
    });
}


/*
Results analysis:

- ran with ollama:rocm 0.6.8


hermes3: 8b
------------

Comment:
- if tools are provided, but the user prompt does not trigger tool use, the ai will ignore the system prompt

hermes3:8b | user-regular-message | with tools defined | system | Test # 0
Valid tool handling: true
Sounds like a pirate: "FALSE\n"
>>> INVALID COMBO DETECTED
>>> INPUT
{
  model: 'hermes3:8b',
  role: 'system',
  tool: 'with tools defined',
  message: 'user-regular-message',
  testNum: 0
}
>>> OUTPUT
{
  message: 'OG RESPONSE: Hello! How can I assist you today?',
  isToolRequested: false,
  toolUsage: ''
}




llama3.2: 3b
-------------

Comment: occasionally fails tool usage (likely due model size)
- if tools are provided, the ai will attempt to use it in the first chat response, and then apologize afterwards

llama3.2:3b | user-tool-message | with tools defined | system | Test # 0
Valid tool handling: true
Sounds like a pirate: "FALSE\n"
>>> INVALID COMBO DETECTED
>>> INPUT
{
  model: 'llama3.2:3b',
  role: 'system',
  tool: 'with tools defined',
  message: 'user-tool-message',
  testNum: 0
}
>>> OUTPUT
{
  message: 'OG RESPONSE: {"name":"subtractTwoNumbers","parameters\\":{\\"a\\":3,\\"b\\":1}}',
  isToolRequested: false,
  toolUsage: ''
}




llama3.1: 8b
-------------

Comment:
- often gets stuck telling the user its trying to do a tool call rather than conversing with the user

llama3.1:8b | user-regular-message | with tools defined | assistant | Test # 3
Valid tool handling: true
Sounds like a pirate: "FALSE\n"
>>> INVALID COMBO DETECTED
>>> INPUT
{
  model: 'llama3.1:8b',
  role: 'assistant',
  tool: 'with tools defined',
  message: 'user-regular-message',
  testNum: 3
}
>>> OUTPUT
{
  message: 'OG RESPONSE: No tool call response is available. Please rephrase the question to include a specific mathematical problem that can be answered with one of the provided functions. \n' +
    '\n' +
    'Example: What are the results of adding 5 and 7 together?',
  isToolRequested: false,
  toolUsage: ''
}




qwen3:4b
---------

Comment:
- model gets stuck thinking? This may be due to asking it too simple of a prompt, or having too simple of a system prompt.
- the best at tool calls. Thinks about whether or not it needs to tool call before doing it.

*/