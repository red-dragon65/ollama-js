
// Subtract two numbers function 
function subtractTwoNumbers(args: { a: number, b: number }): number {
    return args.a - args.b;
}

// Tool definition for subtract function
const subtractTwoNumbersTool = {
    type: 'function',
    function: {
        name: 'subtractTwoNumbers',
        description: 'Subtract two numbers',
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


export { subtractTwoNumbers as subtractFunction, subtractTwoNumbersTool as subtractToolSchema }