
// Add two numbers function
function addTwoNumbers(args: { a: number, b: number }): number {
    return args.a + args.b;
}

// Tool definition for add function
const addTwoNumbersTool = {
    type: 'function',
    function: {
        name: 'addTwoNumbers',
        description: 'Add two numbers together',
        parameters: {
            type: 'object',
            required: ['a', 'b'],
            properties: {
                a: { type: 'number', description: 'The first number' },
                b: { type: 'number', description: 'The second number' }
            }
        }
    }
};

export { addTwoNumbers as addFunction, addTwoNumbersTool as addToolSchema }