
// Add two numbers function
function geoLocate(args: { state: string }): string {
    console.log("Function was called! " + args.state);
    return "37°25'15.5\"N 122°04'56.4\"W";
}

// Tool definition for add function
const geoLocateTool = {
    type: 'function',
    function: {
        name: 'geoLocate',
        description: 'Returns the coordinates of the given state capital city.',
        parameters: {
            type: 'object',
            required: ['state'],
            properties: {
                a: { type: 'string', description: 'The states full name or abbreviation.' }
            }
        }
    }
};

export { geoLocate as geoLocateFunction, geoLocateTool as geoLocateToolSchema }