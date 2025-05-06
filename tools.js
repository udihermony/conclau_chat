// Define tools array
export const tools = [
    {
        type: "function",
        function: {
            name: "add_numbers",
            description: "Add two numbers together. Use this when the user wants to perform addition.",
            parameters: {
                type: "object",
                properties: {
                    num1: {
                        type: "number",
                        description: "First number to add"
                    },
                    num2: {
                        type: "number",
                        description: "Second number to add"
                    }
                },
                required: ["num1", "num2"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "multiply_numbers",
            description: "Multiply two numbers together. Use this when the user wants to perform multiplication.",
            parameters: {
                type: "object",
                properties: {
                    num1: {
                        type: "number",
                        description: "First number to multiply"
                    },
                    num2: {
                        type: "number",
                        description: "Second number to multiply"
                    }
                },
                required: ["num1", "num2"],
                additionalProperties: false
            }
        }
    }
];

// Define tool executors
export const toolExecutors = {
    add_numbers: (num1, num2) => num1 + num2,
    multiply_numbers: (num1, num2) => num1 * num2
}; 