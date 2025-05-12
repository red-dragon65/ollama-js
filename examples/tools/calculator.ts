//import ollama from 'ollama';
//import { Ollama } from 'ollama';
//import { Ollama } from '../../dist/index.cjs';
import { Ollama } from '/workspaces/ollama-js/dist/index.cjs';

import * as addDefinition from './toolFunctionAdd.js'
import * as subtractDefinition from './toolFunctionSubtract.js'



// Custom ollama config
const ollama = new Ollama({ host: 'ollama:11434' })

async function run(model: string) {

    const messages = [{ role: 'user', content: 'What is three minus one?' }];

    console.log('Prompt:', messages[0].content);


    const availableFunctions = {
        addTwoNumbers: addDefinition.addFunction,
        subtractTwoNumbers: subtractDefinition.subtractFunction
    };

    const response = await ollama.chat({
        model: model,
        messages: messages,
        tools: [addDefinition.addToolSchema, subtractDefinition.subtractToolSchema]
    });


    console.log("OG Response:", response.message)



    let output: number;

    // See if the ai tried to use a tool
    if (response.message.tool_calls) {

        // Process tool calls from the response
        for (const tool of response.message.tool_calls) {

            // See if the ai actually called an existing tool, or was hallucinating
            // Hold onto the function if match is found
            const functionToCall = availableFunctions[tool.function.name];

            // Run the function if it exists
            if (functionToCall) {

                console.log('Calling function:', tool.function.name);
                console.log('Arguments:', tool.function.arguments);
                output = functionToCall(tool.function.arguments);
                console.log('Function output:', output);

                // Add the function response to messages for the model to use
                messages.push(response.message);

                messages.push({
                    role: 'tool',
                    content: output.toString(),
                });

            } else {
                console.log('Function', tool.function.name, 'not found');
            }
        }

        // Get final response from model with function outputs
        const finalResponse = await ollama.chat({
            model: model,
            messages: messages
        });

        console.log('Final response:', finalResponse.message.content);

    } else {

        console.log('No valid tool calls returned from model');

        // Print the og message we got
        console.log('Final response:', response.message);
    }
}

export default function execute() {

    run('hermes3:8b').catch(error => console.error("An error occurred:", error));
}